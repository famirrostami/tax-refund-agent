import { randomUUID } from "node:crypto";
import type { LanguageModelMiddleware } from "ai";

type Params = Parameters<NonNullable<LanguageModelMiddleware["transformParams"]>>[0]["params"];
type Prompt = Params["prompt"];
type Tool = { name: string; description?: string; inputSchema: unknown };

/** Marks calls that went through the adapter, so the wrap hooks know to translate the answer back. */
const MARK = "tool_turn";

const stringify = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/**
 * Tool calling for models that cannot take tool declarations (the Claude Code CLI). The tools are described in the
 * system prompt and the model answers with schema-validated JSON: a message plus the tool calls it wants. The
 * answer is translated into ordinary tool-call parts, so the normal AI SDK loop runs the tools: askUser pauses
 * for the user, approval-gated tools ask first, results are fed back. The CLI is only used as a language model.
 */
export function textToolCalling(): LanguageModelMiddleware {
  return {
    transformParams: async ({ params }) => {
      const tools = (params.tools ?? []).filter((t): t is typeof t & Tool => t.type === "function");
      if (tools.length === 0) return params;
      return {
        ...params,
        tools: undefined,
        toolChoice: undefined,
        prompt: flatten(withProtocol(params.prompt, tools)),
        responseFormat: { type: "json", name: MARK, schema: protocolSchema(tools) } as Params["responseFormat"],
      };
    },

    wrapGenerate: async ({ doGenerate, params }) => {
      const result = await doGenerate();
      return params.responseFormat?.type === "json" && params.responseFormat.name === MARK ? translate(result) : result;
    },

    wrapStream: async ({ doGenerate, doStream, params }) => {
      if (!(params.responseFormat?.type === "json" && params.responseFormat.name === MARK)) return doStream();
      // The CLI delivers its structured answer in one piece anyway, so generate and replay it as a stream.
      const result = translate(await doGenerate());
      const id = randomUUID();
      const parts: unknown[] = [{ type: "stream-start", warnings: result.warnings }];
      for (const c of result.content) {
        if (c.type === "text") parts.push({ type: "text-start", id }, { type: "text-delta", id, delta: c.text }, { type: "text-end", id });
        else if (c.type === "tool-call") parts.push(c);
      }
      parts.push({ type: "finish", finishReason: result.finishReason, usage: result.usage });
      return { stream: new ReadableStream({ start(ctrl) { for (const p of parts) ctrl.enqueue(p as never); ctrl.close(); } }) };
    },
  };
}

function protocolSchema(tools: Tool[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["text", "toolCalls"],
    properties: {
      text: { type: "string", description: "Message to the user. Empty string when you only call tools." },
      toolCalls: {
        type: "array",
        description: "Tools to call now. Empty when you are giving your final answer.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["toolName", "inputJson"],
          properties: {
            toolName: { type: "string", enum: tools.map((t) => t.name) },
            inputJson: { type: "string", description: "The tool input as a JSON object string that matches the tool's schema" },
          },
        },
      },
    },
  };
}

function protocolText(tools: Tool[]): string {
  const list = tools.map((t) => `- ${t.name}: ${t.description ?? ""}\n  input schema: ${JSON.stringify(t.inputSchema)}`).join("\n");
  return [
    "# Calling tools",
    "You can call tools. Every reply of yours must be a JSON object with `text` (message to the user) and `toolCalls` (tools to call now).",
    "- To use a tool, add it to `toolCalls` with `inputJson` set to a JSON object string that matches the tool's input schema. Only include facts you actually know.",
    "- After you call tools you will receive their results as '[tool result ...]' messages. Do not state or guess results in the same reply as the call; wait for them.",
    "- Call several tools together only if none needs the result of another. Otherwise call one at a time.",
    "- When you have what you need, or none of the tools helps, answer with `toolCalls` set to [] and your answer in `text`.",
    "- Never write tool calls in `text`; use `toolCalls`.",
    "",
    "Available tools:",
    list,
  ].join("\n");
}

function withProtocol(prompt: Prompt, tools: Tool[]): Prompt {
  const text = protocolText(tools);
  const first = prompt.findIndex((m) => m.role === "system");
  if (first === -1) return [{ role: "system", content: text }, ...prompt];
  return prompt.map((m, i) => (i === first && m.role === "system" ? { ...m, content: `${m.content}\n\n${text}` } : m)) as Prompt;
}

/** Past tool calls and results become plain transcript text; the CLI model never sees tool-typed messages. */
function flatten(prompt: Prompt): Prompt {
  const out: unknown[] = [];
  for (const m of prompt) {
    if (m.role === "assistant") {
      const parts = (m.content as unknown as { type: string; [k: string]: unknown }[]).flatMap((p) => {
        if (p.type === "tool-call") return [{ type: "text", text: `[tool call ${p["toolName"]}] ${stringify(p["input"])}` }];
        if (p.type === "text" || p.type === "file") return [p];
        return [];
      });
      if (parts.length) out.push({ ...m, content: parts });
    } else if (m.role === "tool") {
      const parts = (m.content as unknown as { type: string; [k: string]: unknown }[])
        .filter((p) => p.type === "tool-result")
        .map((p) => ({ type: "text", text: `[tool result ${p["toolName"]}] ${stringify((p["output"] as { value?: unknown } | undefined)?.value ?? p["output"])}` }));
      if (parts.length) out.push({ role: "user", content: parts });
    } else out.push(m);
  }
  return out as Prompt;
}

function translate<R extends { content: unknown[]; finishReason: unknown }>(result: R): R {
  const textPart = result.content.find((c) => (c as { type?: string }).type === "text") as { text: string } | undefined;
  let turn: { text?: string; toolCalls?: { toolName: string; inputJson: string }[] } | null = null;
  try {
    turn = textPart ? JSON.parse(textPart.text) : null;
  } catch {
    turn = null;
  }
  // Not valid JSON: treat the raw text as the final answer instead of failing the conversation.
  if (!turn || typeof turn !== "object") return result;
  const calls = Array.isArray(turn.toolCalls) ? turn.toolCalls : [];
  const content: unknown[] = [
    ...(turn.text?.trim() ? [{ type: "text", text: turn.text }] : []),
    ...calls.map((c) => ({ type: "tool-call", toolCallId: `call_${randomUUID()}`, toolName: c.toolName, input: c.inputJson })),
  ];
  return { ...result, content, finishReason: calls.length ? { unified: "tool-calls", raw: "tool-calls" } : result.finishReason };
}
