import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi, sseChunks } from "../../test/network";
import { createWrapper } from "../../test/render";
import { ApiError } from "../client";
import { useAgentChat } from "./chat";

type Chunk = Record<string, unknown>;
type WireMessage = { role: string; parts: Array<Record<string, unknown>> };
type ChatBody = { year: number; messages: WireMessage[] };

const text = (id: string, ...deltas: string[]): Chunk[] => [
  { type: "text-start", id },
  ...deltas.map((delta) => ({ type: "text-delta", id, delta })),
  { type: "text-end", id },
];
const ask = (toolCallId: string): Chunk => ({
  type: "tool-input-available",
  toolCallId,
  toolName: "askUser",
  input: { question: "How many home-office days?", answerType: "number", unit: "days" },
});
const exportApproval = (toolCallId: string, approvalId: string): Chunk[] => [
  { type: "tool-input-available", toolCallId, toolName: "buildExport", input: { items: [{ ruleId: "de.home_office" }] } },
  { type: "tool-approval-request", approvalId, toolCallId },
];
/** A server-executed tool (no human involved) that completed inside the step, e.g. when the step limit stops the loop. */
const serverTool = (toolCallId: string): Chunk[] => [
  { type: "tool-input-available", toolCallId, toolName: "lookupRule", input: { ruleId: "de.home_office" } },
  { type: "tool-output-available", toolCallId, output: { ok: true } },
];
/** One assistant reply as the server streams it: start, one step, finish. */
const reply = (...chunks: Chunk[]) => () =>
  sseChunks([{ type: "start" }, { type: "start-step" }, ...chunks, { type: "finish-step" }, { type: "finish" }]);

/** Serves the given responses to consecutive POST /api/chat calls. */
function server(...responses: Array<() => Response>) {
  let i = 0;
  return mockApi({
    "POST /api/chat": () => responses[i++]?.() ?? Response.json({ code: "unexpected_call" }, { status: 500 }),
  });
}

const bodies = (api: ReturnType<typeof server>) => api.calls.map((c) => c.body as ChatBody);
const toolPart = (body: ChatBody, type: string) =>
  body.messages.flatMap((m) => m.parts).find((p) => p["type"] === type);

function setup(year = 2025) {
  const { result } = renderHook(() => useAgentChat(year), { wrapper: createWrapper().Wrapper });
  const settle = () => waitFor(() => expect(result.current.status === "ready" || result.current.status === "error").toBe(true));
  return { result, settle };
}

describe("useAgentChat", () => {
  it("accumulates streamed text deltas into one text part", async () => {
    server(reply(...text("t1", "Hello", ", ", "world")));
    const { result, settle } = setup();
    expect(result.current.status).toBe("ready");
    expect(result.current.messages).toEqual([]);

    await act(async () => result.current.send("hi"));
    await settle();

    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([
      { id: expect.any(String), role: "user", parts: [{ kind: "text", text: "hi" }] },
      { id: expect.any(String), role: "assistant", parts: [{ kind: "text", text: "Hello, world" }] },
    ]);
  });

  it("posts {year, messages} with the hook's year and the full history every time", async () => {
    const api = server(reply(...text("t1", "First")), reply(...text("t2", "Second")));
    const { result, settle } = setup(2024);

    await act(async () => result.current.send("one"));
    await settle();
    await act(async () => result.current.send("two"));
    await settle();

    const [first, second] = bodies(api);
    expect(api.calls.map((c) => c.key)).toEqual(["POST /api/chat", "POST /api/chat"]);
    expect(Object.keys(first!).sort()).toEqual(["messages", "year"]);
    expect(first).toMatchObject({ year: 2024, messages: [{ role: "user", parts: [{ type: "text", text: "one" }] }] });
    expect(second!.year).toBe(2024);
    expect(second!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second!.messages[1]!.parts).toContainEqual(expect.objectContaining({ type: "text", text: "First" }));
    expect(second!.messages[2]!.parts).toEqual([{ type: "text", text: "two" }]);
  });

  it("maps an askUser tool call to a question part and waits for the answer", async () => {
    const api = server(reply(...text("t1", "One question."), ask("c1")));
    const { result, settle } = setup();

    await act(async () => result.current.send("hi"));
    await settle();

    expect(result.current.messages[1]!.parts).toEqual([
      { kind: "text", text: "One question." },
      { kind: "question", question: { toolCallId: "c1", question: "How many home-office days?", answerType: "number", unit: "days" } },
    ]);
    expect(api.calls).toHaveLength(1);
  });

  it("answerQuestion sends the answer as the askUser output and resumes the stream", async () => {
    const api = server(reply(ask("c1")), reply(...text("t2", "Thanks.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();

    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 120 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();

    const second = bodies(api)[1]!;
    expect(second.year).toBe(2025);
    expect(second.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(toolPart(second, "tool-askUser")).toMatchObject({
      toolCallId: "c1",
      state: "output-available",
      output: { answered: true, value: 120 },
    });
    const assistant = result.current.messages[1]!;
    expect(assistant.parts).toContainEqual(expect.objectContaining({ kind: "question", answer: { answered: true, value: 120 } }));
    expect(assistant.parts).toContainEqual({ kind: "text", text: "Thanks." });
  });

  it("respondApproval(false) sends approved:false and never a buildExport output", async () => {
    const api = server(reply(...exportApproval("c2", "ap1")), reply(...text("t2", "Okay, not exporting.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("export please"));
    await settle();

    expect(result.current.messages[1]!.parts).toEqual([
      { kind: "approval", approval: { approvalId: "ap1", toolCallId: "c2", toolName: "buildExport", ruleIds: ["de.home_office"] } },
    ]);
    expect(api.calls).toHaveLength(1); // never auto-approved

    await act(async () => result.current.respondApproval("c2", false));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();

    const part = toolPart(bodies(api)[1]!, "tool-buildExport");
    expect(part).toMatchObject({ toolCallId: "c2", state: "approval-responded", approval: { id: "ap1", approved: false } });
    expect(part).not.toHaveProperty("output");
  });

  it("respondApproval(true) sends approved:true", async () => {
    const api = server(reply(...exportApproval("c2", "ap1")), reply(...text("t2", "Exported.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("export please"));
    await settle();

    await act(async () => result.current.respondApproval("c2", true));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();

    expect(toolPart(bodies(api)[1]!, "tool-buildExport")).toMatchObject({
      state: "approval-responded",
      approval: { id: "ap1", approved: true },
    });
  });

  it("does not resume until every pending question and approval in the message is resolved", async () => {
    const api = server(reply(ask("c1"), ...exportApproval("c2", "ap1")), reply(...text("t2", "Done.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("go"));
    await settle();

    await act(async () => result.current.answerQuestion("c1", { answered: false, reason: "dont_know" }));
    await settle();
    expect(api.calls).toHaveLength(1);

    await act(async () => result.current.respondApproval("c2", true));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();

    const second = bodies(api)[1]!;
    expect(toolPart(second, "tool-askUser")).toMatchObject({ state: "output-available", output: { answered: false, reason: "dont_know" } });
    expect(toolPart(second, "tool-buildExport")).toMatchObject({ state: "approval-responded", approval: { id: "ap1", approved: true } });
  });

  it("does not resume when the approval is answered first and the question is still open", async () => {
    const api = server(reply(ask("c1"), ...exportApproval("c2", "ap1")), reply(...text("t2", "Done.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("go"));
    await settle();

    await act(async () => result.current.respondApproval("c2", false));
    await settle();
    expect(api.calls).toHaveLength(1);

    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 3 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
  });

  it("does not resend when a stream ends on a completed server-tool step", async () => {
    const api = server(reply(...serverTool("s1")), reply(...text("t2", "unexpected")));
    const { result, settle } = setup();

    await act(async () => result.current.send("hi"));
    await settle();
    await new Promise((r) => setTimeout(r, 50));
    await settle();

    expect(api.calls).toHaveLength(1);
    expect(result.current.status).toBe("ready");
  });

  it("does not resend again when the resumed stream ends on a completed server-tool step", async () => {
    const api = server(reply(ask("c1")), reply(...serverTool("s1")), reply(...text("t3", "unexpected")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();

    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 3 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
    await new Promise((r) => setTimeout(r, 50));
    await settle();

    expect(api.calls).toHaveLength(2);
    expect(result.current.status).toBe("ready");
  });

  it("send() disarms a resume left over from an answer given mid-stream and then Stop", async () => {
    /** A reply that streams an askUser call and then stays open until aborted. */
    const hanging = () => {
      const enc = new TextEncoder();
      const chunks = [{ type: "start" }, { type: "start-step" }, ask("c1")];
      return new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            for (const chunk of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };
    const api = server(hanging, reply(...serverTool("s1")), reply(...text("t3", "unexpected")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await waitFor(() => expect(result.current.messages[1]?.parts).toContainEqual(expect.objectContaining({ kind: "question" })));
    expect(result.current.status).toBe("streaming");

    // Answered while the step is still streaming (no resume possible yet), then the user stops the reply.
    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 3 }));
    await act(async () => result.current.stop());
    await settle();
    expect(api.calls).toHaveLength(1);

    await act(async () => result.current.send("next"));
    await waitFor(() => expect(api.calls.length).toBeGreaterThanOrEqual(2));
    await settle();
    await new Promise((r) => setTimeout(r, 50));
    await settle();

    expect(api.calls).toHaveLength(2);
  });

  it("surfaces a 400 {code} response as an ApiError with that code", async () => {
    server(() => Response.json({ code: "invalid_request" }, { status: 400 }));
    const { result, settle } = setup();

    await act(async () => result.current.send("hi"));
    await settle();

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ code: "invalid_request", status: 400 });
  });

  it("a stream error chunk sets stream_error and keeps the text streamed so far", async () => {
    server(() => sseChunks([{ type: "start" }, { type: "start-step" }, ...text("t1", "Partial"), { type: "error", errorText: "provider down" }]));
    const { result, settle } = setup();

    await act(async () => result.current.send("hi"));
    await settle();

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ code: "stream_error", status: 0 });
    expect(result.current.messages[1]!.parts).toEqual([{ kind: "text", text: "Partial" }]);
  });

  it("a network failure becomes network_error", async () => {
    mockApi({ "POST /api/chat": () => Promise.reject(new TypeError("Failed to fetch")) });
    const { result, settle } = setup();

    await act(async () => result.current.send("hi"));
    await settle();

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ code: "network_error", status: 0 });
  });

  it("retry after a stream error chunk resends the history with exactly one copy of the user message", async () => {
    const api = server(
      () => sseChunks([{ type: "start" }, { type: "start-step" }, ...text("t1", "Partial"), { type: "error", errorText: "provider down" }]),
      reply(...text("t2", "Recovered.")),
    );
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();
    expect(result.current.error).toMatchObject({ code: "stream_error" });

    await act(async () => result.current.retry());
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();

    const second = bodies(api)[1]!;
    expect(second.messages.filter((m) => m.role === "user")).toEqual([{ role: "user", parts: [{ type: "text", text: "hi" }], id: expect.any(String) }]);
    expect(result.current.error).toBeNull();
    expect(result.current.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(result.current.messages[1]!.parts).toEqual([{ kind: "text", text: "Recovered." }]);
  });

  it("retry after a failed resume resends the answered history without re-adding the user message", async () => {
    const api = server(reply(ask("c1")), () => Response.json({ code: "internal_error" }, { status: 500 }), reply(...text("t3", "Thanks.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();
    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 120 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
    expect(result.current.error).toMatchObject({ code: "internal_error" });

    await act(async () => result.current.retry());
    await waitFor(() => expect(api.calls).toHaveLength(3));
    await settle();

    const third = bodies(api)[2]!;
    expect(third.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(toolPart(third, "tool-askUser")).toMatchObject({ state: "output-available", output: { answered: true, value: 120 } });
    expect(result.current.messages[1]!.parts).toContainEqual({ kind: "text", text: "Thanks." });
  });

  it("retry does nothing when there is no error", async () => {
    const api = server(reply(...text("t1", "Hello")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();
    await act(async () => result.current.retry());
    await settle();
    expect(api.calls).toHaveLength(1);
  });

  it("400 invalid_answer reopens the answered question; a second answer replaces it and is sent", async () => {
    const api = server(reply(ask("c1")), () => Response.json({ code: "invalid_answer" }, { status: 400 }), reply(...text("t3", "Thanks.")));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();

    await act(async () => result.current.answerQuestion("c1", { answered: true, value: -5 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
    expect(result.current.error).toMatchObject({ code: "invalid_answer", status: 400 });
    const reopened = result.current.messages[1]!.parts.find((p) => p.kind === "question");
    expect(reopened).toEqual({ kind: "question", question: expect.objectContaining({ toolCallId: "c1" }) });

    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 120 }));
    await waitFor(() => expect(api.calls).toHaveLength(3));
    await settle();

    expect(toolPart(bodies(api)[2]!, "tool-askUser")).toMatchObject({ state: "output-available", output: { answered: true, value: 120 } });
    expect(result.current.error).toBeNull();
    expect(result.current.messages[1]!.parts).toContainEqual(expect.objectContaining({ kind: "question", answer: { answered: true, value: 120 } }));
    expect(result.current.messages[1]!.parts).toContainEqual({ kind: "text", text: "Thanks." });
  });

  it("an earlier accepted answer stays answered when a later answer is rejected", async () => {
    const api = server(
      reply(ask("c1")),
      reply(ask("c2")),
      () => Response.json({ code: "invalid_answer" }, { status: 400 }),
    );
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();
    await act(async () => result.current.answerQuestion("c1", { answered: true, value: 1 }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
    await act(async () => result.current.answerQuestion("c2", { answered: true, value: -1 }));
    await waitFor(() => expect(api.calls).toHaveLength(3));
    await settle();

    const questions = result.current.messages[1]!.parts.filter((p) => p.kind === "question");
    expect(questions).toEqual([
      expect.objectContaining({ question: expect.objectContaining({ toolCallId: "c1" }), answer: { answered: true, value: 1 } }),
      { kind: "question", question: expect.objectContaining({ toolCallId: "c2" }) },
    ]);
  });

  it("reset clears messages and error", async () => {
    server(() => Response.json({ code: "unsupported_year" }, { status: 400 }));
    const { result, settle } = setup();
    await act(async () => result.current.send("hi"));
    await settle();
    expect(result.current.error).not.toBeNull();

    act(() => result.current.reset());

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("ready");
  });
});
