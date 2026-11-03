import { generateText, streamText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { textToolCalling } from "./toolCalling";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const stop = { unified: "stop", raw: "stop" } as const;

/** Underlying "CLI" model: answers each call with the next scripted JSON turn and records what it was sent. */
function scripted(turns: unknown[]) {
  const seen: { prompt: unknown; tools: unknown; responseFormat: unknown }[] = [];
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (o) => {
      seen.push({ prompt: o.prompt, tools: o.tools, responseFormat: o.responseFormat });
      const t = turns[Math.min(i++, turns.length - 1)];
      return { content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t) }], finishReason: stop, usage, warnings: [] };
    },
  });
  return { model: wrapLanguageModel({ model, middleware: textToolCalling() }), seen };
}
const call = (toolName: string, input: unknown) => ({ toolName, inputJson: JSON.stringify(input) });

const add = tool({ description: "Add two numbers", inputSchema: z.object({ a: z.number(), b: z.number() }), execute: async ({ a, b }) => ({ sum: a + b }) });
const ask = tool({ description: "Ask the user", inputSchema: z.object({ question: z.string() }) });
const gated = tool({ description: "Writes a file", inputSchema: z.object({ name: z.string() }), needsApproval: true, execute: async () => ({ written: true }) });

describe("textToolCalling", () => {
  it("runs the normal tool loop: the tool executes and its result goes back to the model as a transcript", async () => {
    const { model, seen } = scripted([
      { text: "", toolCalls: [call("add", { a: 2, b: 3 })] },
      { text: "The sum is 5.", toolCalls: [] },
    ]);
    const r = await generateText({ model, instructions: "Be helpful.", prompt: "2+3?", tools: { add }, stopWhen: ({ steps }) => steps.length >= 4 });
    expect(r.text).toBe("The sum is 5.");
    expect(r.steps.flatMap((s) => s.toolResults).map((x) => x.output)).toEqual([{ sum: 5 }]);
    expect(seen).toHaveLength(2);
    const second = JSON.stringify(seen[1]!.prompt);
    expect(second).toContain("[tool call add]");
    expect(second).toContain("[tool result add]");
    expect(second).toContain('\\"sum\\":5');
  });

  it("describes the tools in the system prompt, appends to the existing one, and sends no native tools", async () => {
    const { model, seen } = scripted([{ text: "hi", toolCalls: [] }]);
    await generateText({ model, instructions: "Be helpful.", prompt: "hello", tools: { add, ask } });
    const call0 = seen[0]!;
    expect(call0.tools).toBeUndefined();
    const system = (call0.prompt as { role: string; content: string }[]).filter((m) => m.role === "system");
    expect(system).toHaveLength(1);
    expect(system[0]!.content).toContain("Be helpful.");
    expect(system[0]!.content).toMatch(/- add: Add two numbers/);
    expect(system[0]!.content).toMatch(/- ask: Ask the user/);
    const rf = call0.responseFormat as { type: string; schema: { properties: { toolCalls: { items: { properties: { toolName: { enum: string[] } } } } } } };
    expect(rf.type).toBe("json");
    expect(rf.schema.properties.toolCalls.items.properties.toolName.enum).toEqual(["add", "ask"]);
  });

  it("a client-side tool (no execute) stops the loop, so the UI can ask the user", async () => {
    const { model } = scripted([{ text: "", toolCalls: [call("ask", { question: "How many days?" })] }]);
    const r = await generateText({ model, prompt: "help", tools: { ask }, stopWhen: ({ steps }) => steps.length >= 4 });
    expect(r.steps).toHaveLength(1);
    expect(r.toolCalls[0]).toMatchObject({ toolName: "ask", input: { question: "How many days?" } });
    expect(r.toolResults).toEqual([]);
  });

  it("an approval-gated tool is not executed without approval", async () => {
    let ran = 0;
    const g = tool({ description: "Writes a file", inputSchema: z.object({ name: z.string() }), needsApproval: true, execute: async () => { ran++; return { written: true }; } });
    const { model } = scripted([{ text: "", toolCalls: [call("gated", { name: "x" })] }]);
    const r = await generateText({ model, prompt: "write", tools: { gated: g }, stopWhen: ({ steps }) => steps.length >= 4 });
    expect(ran).toBe(0);
    expect(JSON.stringify(r.content)).toContain("approval");
    void gated;
  });

  it("streams: text first, then the tool calls, and finishes with tool-calls", async () => {
    const { model } = scripted([{ text: "Checking.", toolCalls: [call("add", { a: 1, b: 1 })] }, { text: "Done.", toolCalls: [] }]);
    const s = streamText({ model, prompt: "go", tools: { add }, stopWhen: ({ steps }) => steps.length >= 4 });
    const types: string[] = [];
    for await (const p of s.fullStream) types.push(p.type);
    expect(types).toEqual(expect.arrayContaining(["text-delta", "tool-call", "tool-result", "finish"]));
    expect(await s.text).toContain("Done.");
  });

  it("passes calls without tools straight through (structured output for extractReceipt/classifyExpense)", async () => {
    const { model, seen } = scripted(['{"ok":true}']);
    const r = await generateText({ model, prompt: "x" });
    expect(r.text).toBe('{"ok":true}');
    expect(seen[0]!.responseFormat).toBeUndefined();
  });

  it("treats a non-JSON answer as the final message instead of failing", async () => {
    const { model } = scripted(["Sorry, plain text."]);
    const r = await generateText({ model, prompt: "x", tools: { add } });
    expect(r.text).toBe("Sorry, plain text.");
    expect(r.toolCalls).toEqual([]);
  });

  it("an unknown tool name is reported back to the model, not executed", async () => {
    const { model } = scripted([{ text: "", toolCalls: [call("nope", {})] }, { text: "ok", toolCalls: [] }]);
    const r = await generateText({ model, prompt: "x", tools: { add }, stopWhen: ({ steps }) => steps.length >= 4 });
    expect(r.text).toBe("ok");
    expect(r.steps.flatMap((s) => s.toolResults)).toEqual([]);
  });
});
