import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { loadPack } from "../packs";
import { createApp } from "./app";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function mockModel(onPrompt?: (p: unknown) => void) {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      onPrompt?.(options.prompt);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Hello" },
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
          ],
        }),
      };
    },
  });
}

const pack = await loadPack(resolve(__dirname, "../../../../packs"), "de");
const userMsg = { role: "user", parts: [{ type: "text", text: "Hi" }] };

async function makeApp(onPrompt?: (p: unknown) => void) {
  return createApp({ model: mockModel(onPrompt), pack, dataDir: await mkdtemp(join(tmpdir(), "app-")) });
}
const post = (app: Awaited<ReturnType<typeof makeApp>>, body: unknown) =>
  app.request("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const upload = (app: Awaited<ReturnType<typeof makeApp>>, file: File, query = "") => {
  const form = new FormData();
  form.set("file", file);
  return app.request(`/api/files${query}`, { method: "POST", body: form });
};

describe("app", () => {
  it("reports health", async () => {
    const res = await (await makeApp()).request("/api/health");
    expect(await res.json()).toMatchObject({ ok: true, country: "de" });
  });
  it("rejects invalid bodies with a stable code", async () => {
    const res = await post(await makeApp(), { messages: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_request" });
  });
  it("rejects unsupported years", async () => {
    const res = await post(await makeApp(), { messages: [userMsg], year: 1999 });
    expect(await res.json()).toEqual({ code: "unsupported_year" });
  });
  it("streams a reply and sends the composed system prompt", async () => {
    let prompt: unknown;
    const res = await post(await makeApp((p) => (prompt = p)), { messages: [userMsg], year: 2025 });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Hello");
    expect(JSON.stringify(prompt)).toContain("Tax year: 2025");
  });
  it("offers extractReceipt to the model", async () => {
    let tools: unknown;
    const model = new MockLanguageModelV4({
      doStream: async (options) => {
        tools = options.tools;
        return { stream: simulateReadableStream({ chunks: [{ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage }] }) };
      },
    });
    const app = createApp({ model, pack, dataDir: await mkdtemp(join(tmpdir(), "app-")) });
    await (await post(app, { messages: [userMsg] })).text();
    expect(JSON.stringify(tools)).toContain("extractReceipt");
  });
  it("stores an uploaded file and returns its id", async () => {
    const res = await upload(await makeApp(), new File([new Uint8Array([1, 2])], "r.png", { type: "image/png" }), "?year=2025");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ mediaType: "image/png", fileId: expect.stringMatching(/\.png$/) });
  });
  it("rejects unsupported upload types", async () => {
    const res = await upload(await makeApp(), new File(["<html>"], "x.html", { type: "text/html" }));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ code: "unsupported_type" });
  });
  it("streams an askUser question and stops for the user's answer", async () => {
    const input = { question: "How many days did you work from home?", field: "days", answerType: "number", unit: "days", min: 0, max: 366 };
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "tool-call", toolCallId: "c1", toolName: "askUser", input: JSON.stringify(input) },
            { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
          ],
        }),
      }),
    });
    const app = createApp({ model, pack, dataDir: await mkdtemp(join(tmpdir(), "app-")) });
    const body = await (await post(app, { messages: [userMsg] })).text();
    expect(body).toContain("tool-input-available");
    expect(body).toContain("How many days did you work from home?");
    expect(model.doStreamCalls).toHaveLength(1);
  });
  it("feeds the user's answer back to the model as a tool result", async () => {
    let prompt: unknown;
    const app = await makeApp((p) => (prompt = p));
    const input = { question: "Days?", field: "days", answerType: "number", min: 0, max: 366 };
    const history = [
      userMsg,
      { role: "assistant", parts: [{ type: "tool-askUser", toolCallId: "c1", state: "output-available", input, output: { answered: true, value: 120 } }] },
    ];
    const res = await post(app, { messages: history });
    expect(res.status).toBe(200);
    await res.text();
    const text = JSON.stringify(prompt);
    expect(text).toContain("tool-result");
    expect(text).toContain("120");
  });
  it("does not choke on a question the user ignored by sending a new message", async () => {
    const input = { question: "Days?", answerType: "number" };
    const history = [
      userMsg,
      { role: "assistant", parts: [{ type: "tool-askUser", toolCallId: "c1", state: "input-available", input }] },
      userMsg,
    ];
    const res = await post(await makeApp(), { messages: history });
    expect(res.status).toBe(200);
    await res.text();
  });
  it("rejects an answer that does not fit its question", async () => {
    const input = { question: "Days?", answerType: "number", min: 0, max: 366 };
    const history = [
      userMsg,
      { role: "assistant", parts: [{ type: "tool-askUser", toolCallId: "c1", state: "output-available", input, output: { answered: true, value: 9999 } }] },
    ];
    const res = await post(await makeApp(), { messages: history });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_answer" });
  });

  describe("export approval", () => {
    const input = { items: [{ ruleId: "de.home_office.tagespauschale", facts: { days: 100, arbeitszimmerClaimed: false } }] };
    const callThenText = () => {
      let n = 0;
      return new MockLanguageModelV4({
        doStream: async () => {
          n++;
          const chunks =
            n === 1
              ? [
                  { type: "tool-call", toolCallId: "e1", toolName: "buildExport", input: JSON.stringify(input) },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ]
              : [
                  { type: "text-start", id: "t" },
                  { type: "text-delta", id: "t", delta: "Done" },
                  { type: "text-end", id: "t" },
                  { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                ];
          return { stream: simulateReadableStream({ chunks: chunks as never }) };
        },
      });
    };
    const exportsIn = async (dir: string) => (await import("node:fs/promises")).readdir(join(dir, "default", "2025", "exports")).catch(() => []);
    const approvalHistory = (approved: boolean) => [
      userMsg,
      { role: "assistant", parts: [{ type: "tool-buildExport", toolCallId: "e1", state: "approval-responded", input, approval: { id: "a1", approved } }] },
    ];

    it("stops at an approval request and writes nothing", async () => {
      const dir = await mkdtemp(join(tmpdir(), "app-"));
      const app = createApp({ model: callThenText(), pack, dataDir: dir });
      const body = await (await post(app, { messages: [userMsg], year: 2025 })).text();
      expect(body).toContain("tool-approval-request");
      expect(await exportsIn(dir)).toEqual([]);
    });
    it("writes the export only after the user approves", async () => {
      const dir = await mkdtemp(join(tmpdir(), "app-"));
      const app = createApp({ model: callThenText(), pack, dataDir: dir });
      await (await post(app, { messages: approvalHistory(true), year: 2025 })).text();
      expect(await exportsIn(dir)).toHaveLength(1);
    });
    it("does not write when the user denies", async () => {
      const dir = await mkdtemp(join(tmpdir(), "app-"));
      const app = createApp({ model: callThenText(), pack, dataDir: dir });
      await (await post(app, { messages: approvalHistory(false), year: 2025 })).text();
      expect(await exportsIn(dir)).toEqual([]);
    });
    it("serves the written files and nothing else", async () => {
      const dir = await mkdtemp(join(tmpdir(), "app-"));
      const app = createApp({ model: callThenText(), pack, dataDir: dir });
      await (await post(app, { messages: approvalHistory(true), year: 2025 })).text();
      const [id] = await exportsIn(dir);
      const ok = await app.request(`/api/exports/${id}/summary.md?year=2025`);
      expect(ok.status).toBe(200);
      expect(await ok.text()).toContain("| 53 |");
      expect((await app.request(`/api/exports/${id}/entries.csv?year=2025`)).headers.get("content-type")).toContain("text/csv");
      expect((await app.request(`/api/exports/${id}/secret.txt?year=2025`)).status).toBe(404);
      expect((await app.request(`/api/exports/..%2F..%2Fx/summary.md?year=2025`)).status).toBe(404);
    });
  });
});
