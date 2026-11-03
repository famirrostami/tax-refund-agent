import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { attachmentsAtom, draftAtom, questionDraftsAtomFamily, selectedYearAtom } from "../../state";
import { mockApi, sseChunks } from "../../test/network";
import { renderWithProviders } from "../../test/render";
import { ChatPage } from "./ChatPage";

type Chunk = Record<string, unknown>;
type WireMessage = { role: string; parts: Array<Record<string, unknown>> };
type ChatBody = { year: number; messages: WireMessage[] };
type Handler = Parameters<typeof mockApi>[0][string];

// Chunk builders with the real AI SDK UI-message stream shapes (see apps/server/src/scripts/chat.ts).
const text = (id: string, ...deltas: string[]): Chunk[] => [
  { type: "text-start", id },
  ...deltas.map((delta) => ({ type: "text-delta", id, delta })),
  { type: "text-end", id },
];
const ask = (toolCallId: string, input: Record<string, unknown>): Chunk => ({
  type: "tool-input-available",
  toolCallId,
  toolName: "askUser",
  input,
});
const homeOfficeDays = { question: "How many days did you work from home?", answerType: "number", unit: "days", min: 0, max: 366 };
const exportApproval = (toolCallId: string, approvalId: string): Chunk[] => [
  { type: "tool-input-available", toolCallId, toolName: "buildExport", input: { items: [{ ruleId: "de.home_office" }] } },
  { type: "tool-approval-request", approvalId, toolCallId },
];
const reply = (...chunks: Chunk[]) => () =>
  sseChunks([{ type: "start" }, { type: "start-step" }, ...chunks, { type: "finish-step" }, { type: "finish" }]);

const health = { ok: true, country: "de", years: [2025, 2026] };

/** Mocks health, uploads and consecutive chat replies; `routes` stays mutable for retry scenarios. */
function server(chatReplies: Array<() => Response | Promise<Response>>, extra: Record<string, Handler> = {}) {
  let i = 0;
  const routes: Record<string, Handler> = {
    "GET /api/health": () => health,
    "POST /api/chat": () => chatReplies[i++]?.() ?? Response.json({ code: "unexpected_call" }, { status: 500 }),
    ...extra,
  };
  const api = mockApi(routes);
  const chatBodies = () => api.calls.filter((c) => c.key === "POST /api/chat").map((c) => c.body as ChatBody);
  return { api, routes, chatBodies };
}

const toolPart = (body: ChatBody, type: string) => body.messages.flatMap((m) => m.parts).find((p) => p["type"] === type);
const userTexts = (body: ChatBody) =>
  body.messages.filter((m) => m.role === "user").map((m) => m.parts.map((p) => p["text"]).join(""));

async function renderPage() {
  const user = userEvent.setup({ applyAccept: false });
  const view = renderWithProviders(<ChatPage />);
  await screen.findByRole("combobox", { name: "Tax year" });
  return { user, ...view };
}

const composerInput = () => screen.getByRole("textbox", { name: "Message" });
const sendButton = () => screen.getByRole("button", { name: "Send" });
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;
const ready = () => waitFor(() => expect(screen.queryByRole("status", { name: "Working" })).not.toBeInTheDocument());

async function say(user: ReturnType<typeof userEvent.setup>, message: string) {
  await user.type(composerInput(), message);
  await user.click(sendButton());
  await ready();
}

describe("ChatPage", () => {
  it("(a) loads the years from health and selects the first one", async () => {
    server([]);
    renderWithProviders(<ChatPage />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    const select = await screen.findByRole("combobox", { name: "Tax year" });
    expect(select).toHaveValue("2025");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["2025", "2026"]);
    expect(screen.getByRole("heading", { level: 1, name: "Tax Refund Agent" })).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveTextContent("Upload a document or write a message to get started.");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("(b) uploads a file, shows a chip, sends its fileId and clears draft and attachments", async () => {
    const { api, chatBodies } = server([reply(...text("t1", "Got it."))], {
      "POST /api/files": ({ url }) => Response.json({ fileId: "f-123", mediaType: "image/png", name: "receipt.png", year: url }, { status: 201 }),
    });
    const { user, container, store } = await renderPage();

    await user.upload(fileInput(container), new File(["x"], "receipt.png", { type: "image/png" }));
    expect(await screen.findByRole("button", { name: "Remove receipt.png" })).toBeInTheDocument();
    expect(api.calls.find((c) => c.key === "POST /api/files")).toBeDefined();
    expect(String(api.fetch.mock.calls.find(([u]) => String(u).startsWith("/api/files"))?.[0])).toBe("/api/files?year=2025");

    await say(user, "Here is my receipt");

    expect(userTexts(chatBodies()[0]!)).toEqual(["Here is my receipt\n\nfileId: f-123"]);
    expect(chatBodies()[0]!.year).toBe(2025);
    expect(composerInput()).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remove receipt.png" })).not.toBeInTheDocument();
    expect(store.get(draftAtom)).toBe("");
    expect(store.get(attachmentsAtom)).toEqual([]);
    expect(await screen.findByText("Got it.")).toBeInTheDocument();
  });

  it("text parts keep their line breaks (pre-wrap class)", async () => {
    server([reply(...text("t1", "Line one\nLine two"))]);
    const { user } = await renderPage();
    await say(user, "hi");
    const p = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Line one\nLine two");
    expect(p).toHaveClass("message-text");
  });

  it("(b) sends with attachments only", async () => {
    const { chatBodies } = server([reply(...text("t1", "Reading it."))], {
      "POST /api/files": () => Response.json({ fileId: "f-9", mediaType: "application/pdf", name: "a.pdf" }, { status: 201 }),
    });
    const { user, container } = await renderPage();
    expect(sendButton()).toBeDisabled();

    await user.upload(fileInput(container), new File(["x"], "a.pdf", { type: "application/pdf" }));
    await screen.findByRole("button", { name: "Remove a.pdf" });
    expect(sendButton()).toBeEnabled();
    await user.click(sendButton());
    await ready();

    expect(userTexts(chatBodies()[0]!)).toEqual(["fileId: f-9"]);
  });

  it("(c) streams text and a question card; answering resumes the stream in the same bubble", async () => {
    const { chatBodies } = server([
      reply(...text("t1", "Let me check ", "that."), ask("q1", homeOfficeDays)),
      reply(...text("t2", "Thanks, noted.")),
    ]);
    const { user } = await renderPage();

    await say(user, "I worked from home 120 days in 2025");
    expect(screen.getByText("Let me check that.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: homeOfficeDays.question })).toBeInTheDocument();
    expect(userTexts(chatBodies()[0]!)).toEqual(["I worked from home 120 days in 2025"]);

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "120");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    await screen.findByText("Thanks, noted.");
    await ready();
    expect(chatBodies()).toHaveLength(2);
    expect(toolPart(chatBodies()[1]!, "tool-askUser")).toMatchObject({ toolCallId: "q1", output: { answered: true, value: 120 } });
    expect(userTexts(chatBodies()[1]!)).toEqual(["I worked from home 120 days in 2025"]);
    expect(screen.getAllByRole("article", { name: "Assistant" })).toHaveLength(1);
    expect(screen.getByText("Your answer: 120 days")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit answer" })).not.toBeInTheDocument();
  });

  it.each([
    ["I don't know", { answered: false, reason: "dont_know" }, "You answered: I don't know"],
    ["Skip", { answered: false, reason: "skipped" }, "Skipped"],
  ])("(c) %s sends its payload", async (button, output, summary) => {
    const { chatBodies } = server([reply(ask("q1", homeOfficeDays)), reply(...text("t2", "Okay."))]);
    const { user } = await renderPage();
    await say(user, "hi");

    await user.click(screen.getByRole("button", { name: button }));
    await screen.findByText("Okay.");
    await ready();

    expect(toolPart(chatBodies()[1]!, "tool-askUser")).toMatchObject({ output });
    expect(screen.getByText(summary)).toBeInTheDocument();
  });

  it("(d) 400 invalid_answer shows the translated error and the card is answerable again", async () => {
    const { chatBodies } = server([
      reply(ask("q1", homeOfficeDays)),
      () => Response.json({ code: "invalid_answer" }, { status: 400 }),
      reply(...text("t3", "Thanks.")),
    ]);
    const { user } = await renderPage();
    await say(user, "hi");

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "120");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText("Your answer was not accepted. Please check it and answer again.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your answer was not accepted.");
    const input = screen.getByRole("textbox", { name: "Your answer" });
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "100");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await screen.findByText("Thanks.");
    await ready();

    expect(chatBodies()).toHaveLength(3);
    expect(toolPart(chatBodies()[2]!, "tool-askUser")).toMatchObject({ output: { answered: true, value: 100 } });
    expect(screen.queryByText("Your answer was not accepted. Please check it and answer again.")).not.toBeInTheDocument();
    expect(screen.getByText("Your answer: 100 days")).toBeInTheDocument();
  });

  it("(e) deny sends approved:false and shows no downloads; Approve never fires without a click", async () => {
    const { chatBodies } = server([
      reply(...text("t1", "Ready to export."), ...exportApproval("x1", "ap1")),
      reply({ type: "tool-output-denied", toolCallId: "x1" }, ...text("t2", "Okay, no export.")),
    ]);
    const { user } = await renderPage();
    await say(user, "export please");

    expect(screen.getByRole("heading", { name: "Approval needed" })).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(chatBodies()).toHaveLength(1);
    expect(sendButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Deny" }));
    await screen.findByText("Okay, no export.");
    await ready();

    const part = toolPart(chatBodies()[1]!, "tool-buildExport");
    expect(part).toMatchObject({ state: "approval-responded", approval: { id: "ap1", approved: false } });
    expect(part).not.toHaveProperty("output");
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("(e) approve sends approved:true and shows the three downloads", async () => {
    const exportOutput = {
      ok: true,
      exportId: "exp-1",
      files: ["summary.md", "entries.csv", "export.json"],
      entryCount: 1,
      documentCount: 2,
      notMappedCount: 0,
      warnings: [],
    };
    const { chatBodies } = server([
      reply(...exportApproval("x1", "ap1")),
      reply({ type: "tool-output-available", toolCallId: "x1", output: exportOutput }, ...text("t2", "Exported.")),
    ]);
    const { user } = await renderPage();
    await say(user, "export please");

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("Exported.");
    await ready();

    expect(toolPart(chatBodies()[1]!, "tool-buildExport")).toMatchObject({ approval: { id: "ap1", approved: true } });
    const links = screen.getAllByRole("link", { name: /^Download/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/api/exports/exp-1/summary.md?year=2025",
      "/api/exports/exp-1/entries.csv?year=2025",
      "/api/exports/exp-1/export.json?year=2025",
    ]);
  });

  it("(f) 2026 mapping shows the em dash for null lines, the German label and the server warning", async () => {
    const mapping = {
      ok: true,
      taxYear: 2026,
      formStatus: "pending",
      source: { label: "Form source", url: "https://example.test/form" },
      entries: [
        { form: "Anlage N", section: "s", fieldId: "home", line: null, lineVerified: false, labelDe: "Tagespauschale Homeoffice", labelEn: "Home office", unit: "EUR", value: 10, ruleIds: ["r"] },
      ],
      informational: [],
      notMapped: [],
      missingInfo: [],
      warnings: ["Server warning: official form for 2026 is not published."],
    };
    const { chatBodies } = server([
      reply(
        { type: "tool-input-available", toolCallId: "m1", toolName: "mapToFormFields", input: {} },
        { type: "tool-output-available", toolCallId: "m1", output: mapping },
      ),
    ]);
    const { user } = await renderPage();
    await user.selectOptions(screen.getByRole("combobox", { name: "Tax year" }), "2026");
    expect(screen.queryByText("Start a new conversation?")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tax year" })).toHaveValue("2026");

    await say(user, "map it");

    expect(chatBodies()[0]!.year).toBe(2026);
    const table = screen.getByRole("table", { name: "Form entries" });
    expect(within(table).getByRole("cell", { name: "—" })).toBeInTheDocument();
    expect(within(table).getByText("Tagespauschale Homeoffice")).toBeInTheDocument();
    expect(screen.getByText("Server warning: official form for 2026 is not published.")).toBeInTheDocument();
  });

  it("(g) year change with content asks inline; Cancel keeps everything, Confirm clears it", async () => {
    server([reply(...text("t1", "Hello there."))], {
      "POST /api/files": () => Response.json({ fileId: "f-1", mediaType: "image/png", name: "r.png" }, { status: 201 }),
    });
    const { user, container, store } = await renderPage();
    await say(user, "hi");
    await user.upload(fileInput(container), new File(["x"], "r.png", { type: "image/png" }));
    await screen.findByRole("button", { name: "Remove r.png" });
    await user.type(composerInput(), "draft text");
    act(() => store.set(questionDraftsAtomFamily("old-q"), "42"));
    const select = screen.getByRole("combobox", { name: "Tax year" });

    await user.selectOptions(select, "2026");
    expect(screen.getByText("Start a new conversation?")).toBeInTheDocument();
    expect(select).toHaveValue("2025");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Start a new conversation?")).not.toBeInTheDocument();
    expect(screen.getByText("Hello there.")).toBeInTheDocument();
    expect(composerInput()).toHaveValue("draft text");
    expect(screen.getByRole("button", { name: "Remove r.png" })).toBeInTheDocument();
    expect(store.get(selectedYearAtom)).toBe(2025);

    await user.selectOptions(screen.getByRole("combobox", { name: "Tax year" }), "2026");
    await user.click(screen.getByRole("button", { name: "Switch year" }));

    expect(await screen.findByText("Upload a document or write a message to get started.")).toBeInTheDocument();
    expect(screen.queryByText("Hello there.")).not.toBeInTheDocument();
    expect(composerInput()).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remove r.png" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tax year" })).toHaveValue("2026");
    expect(store.get(selectedYearAtom)).toBe(2026);
    expect(store.get(questionDraftsAtomFamily("old-q"))).toBe("");
  });

  describe("(g) uploads in flight during a year change", () => {
    /** An upload response the test resolves by hand. */
    function deferredUpload() {
      let resolve!: (r: Response) => void;
      const pending = new Promise<Response>((r) => (resolve = r));
      return {
        handler: () => pending,
        finish: (fileId: string, name: string) =>
          act(async () => {
            resolve(Response.json({ fileId, mediaType: "image/png", name }, { status: 201 }));
            await new Promise((r) => setTimeout(r, 20));
          }),
      };
    }

    it("a pending upload counts as content: the switch asks for confirmation; the late result adds no chip and no fileId", async () => {
      const upload = deferredUpload();
      const { chatBodies } = server([reply(...text("t1", "Fresh start."))], { "POST /api/files": upload.handler });
      const { user, container, store } = await renderPage();

      await user.upload(fileInput(container), new File(["x"], "late.png", { type: "image/png" }));
      expect(screen.getByRole("status", { name: "Uploading" })).toBeInTheDocument();

      await user.selectOptions(screen.getByRole("combobox", { name: "Tax year" }), "2026");
      expect(screen.getByText("Start a new conversation?")).toBeInTheDocument();
      expect(store.get(selectedYearAtom)).toBe(2025);
      await user.click(screen.getByRole("button", { name: "Switch year" }));
      expect(await screen.findByRole("combobox", { name: "Tax year" })).toHaveValue("2026");

      await upload.finish("f-2025", "late.png");

      expect(screen.queryByRole("button", { name: "Remove late.png" })).not.toBeInTheDocument();
      expect(store.get(attachmentsAtom)).toEqual([]);
      await say(user, "hello");
      expect(chatBodies()[0]!.year).toBe(2026);
      expect(userTexts(chatBodies()[0]!)).toEqual(["hello"]);
    });

    it("cancelling the switch keeps the upload: its chip appears when it finishes", async () => {
      const upload = deferredUpload();
      server([], { "POST /api/files": upload.handler });
      const { user, container } = await renderPage();

      await user.upload(fileInput(container), new File(["x"], "kept.png", { type: "image/png" }));
      await user.selectOptions(screen.getByRole("combobox", { name: "Tax year" }), "2026");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await upload.finish("f-kept", "kept.png");

      expect(await screen.findByRole("button", { name: "Remove kept.png" })).toBeInTheDocument();
    });

    it("an upload that finishes before any year change still adds its chip", async () => {
      const upload = deferredUpload();
      server([], { "POST /api/files": upload.handler });
      const { user, container } = await renderPage();

      await user.upload(fileInput(container), new File(["x"], "early.png", { type: "image/png" }));
      await upload.finish("f-early", "early.png");

      expect(await screen.findByRole("button", { name: "Remove early.png" })).toBeInTheDocument();
    });
  });

  it("(h) a stream error chunk shows the error with Retry and keeps the streamed text; Retry works", async () => {
    const { chatBodies } = server([
      () => sseChunks([{ type: "start" }, { type: "start-step" }, ...text("t1", "Partial answer"), { type: "error", errorText: "provider down" }]),
      reply(...text("t2", "Full answer.")),
    ]);
    const { user } = await renderPage();
    await say(user, "hi");

    expect(await screen.findByRole("alert")).toHaveTextContent("The reply was interrupted.");
    expect(screen.getByText("Partial answer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Full answer.");
    await ready();

    expect(chatBodies()).toHaveLength(2);
    expect(userTexts(chatBodies()[1]!)).toEqual(["hi"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("(h) a 400 code is translated, unknown codes use the fallback", async () => {
    server([() => Response.json({ code: "unsupported_year" }, { status: 400 }), () => Response.json({ code: "weird" }, { status: 500 })]);
    const { user } = await renderPage();
    await say(user, "hi");
    expect(await screen.findByRole("alert")).toHaveTextContent("This tax year is not supported.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
  });

  it.each([
    ["wrong type", new File(["x"], "notes.txt", { type: "text/plain" }), "This file type is not supported. Use PDF, PNG, JPG or WebP."],
    [
      "too large",
      (() => {
        const f = new File(["x"], "big.pdf", { type: "application/pdf" });
        Object.defineProperty(f, "size", { value: 16 * 1024 * 1024 });
        return f;
      })(),
      "This file is too large.",
    ],
    ["415 from the server", new File(["x"], "odd.png", { type: "image/png" }), "The server does not accept this file type."],
  ])("(i) upload rejection (%s) never adds a chip", async (_label, file, message) => {
    const { api } = server([], { "POST /api/files": () => Response.json({ code: "unsupported_type" }, { status: 415 }) });
    const { user, container, store } = await renderPage();

    await user.upload(fileInput(container), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: `Remove ${file.name}` })).not.toBeInTheDocument();
    expect(store.get(attachmentsAtom)).toEqual([]);
    if (file.type !== "image/png") expect(api.calls.some((c) => c.key === "POST /api/files")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("(j) sending is blocked while a question is pending (the input stays editable) and only the first open item is actionable", async () => {
    server([reply(ask("q1", homeOfficeDays), ...exportApproval("x1", "ap1")), reply(...text("t2", "Done."))]);
    const { user } = await renderPage();
    await say(user, "hi");

    expect(composerInput()).toBeEnabled();
    await user.type(composerInput(), "later");
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());
    expect(sendButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("Done.");
    await ready();
    expect(composerInput()).toHaveValue("later");
    expect(sendButton()).toBeEnabled();
  });

  describe("keyboard focus", () => {
    it("Ctrl+Enter keeps focus in the composer; a draft typed while the reply streams is kept and sendable", async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const { chatBodies } = server([async () => (await gate, reply(...text("t1", "First."))()), reply(...text("t2", "Second."))]);
      const { user } = await renderPage();

      await user.click(composerInput());
      await user.keyboard("hi{Control>}{Enter}{/Control}");
      await screen.findByRole("status", { name: "Working" });
      expect(composerInput()).toHaveFocus();
      expect(composerInput()).toBeEnabled();
      await user.keyboard("next one");
      expect(sendButton()).toBeDisabled();

      await act(async () => release());
      await screen.findByText("First.");
      await ready();
      expect(composerInput()).toHaveFocus();
      expect(composerInput()).toHaveValue("next one");

      await user.keyboard("{Control>}{Enter}{/Control}");
      await screen.findByText("Second.");
      expect(userTexts(chatBodies()[1]!)).toEqual(["hi", "next one"]);
    });

    it("moves focus into a question card, and back to the composer after answering", async () => {
      server([reply(ask("q1", homeOfficeDays)), reply(...text("t2", "Noted."))]);
      const { user } = await renderPage();
      await user.click(composerInput());
      await user.keyboard("hi{Control>}{Enter}{/Control}");

      await waitFor(() => expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveFocus());
      await user.keyboard("12");
      await user.click(screen.getByRole("button", { name: "Skip" }));
      await screen.findByText("Noted.");
      await ready();
      await waitFor(() => expect(composerInput()).toHaveFocus());
    });

    it.each(["Approve", "Deny"])("moves focus into the approval card, and back to the composer after %s", async (button) => {
      server([reply(...exportApproval("x1", "ap1")), reply(...text("t2", "Finished."))]);
      const { user } = await renderPage();
      await user.click(composerInput());
      await user.keyboard("export{Control>}{Enter}{/Control}");

      await waitFor(() => expect(screen.getByRole("button", { name: "Deny" })).toHaveFocus());
      await user.click(screen.getByRole("button", { name: button }));
      await screen.findByText("Finished.");
      await ready();
      await waitFor(() => expect(composerInput()).toHaveFocus());
    });

    it("does not steal focus from a control the user moved to", async () => {
      server([reply(...text("t1", "Hello."))]);
      const { user } = await renderPage();
      await user.type(composerInput(), "hi");
      await user.click(sendButton());
      screen.getByRole("combobox", { name: "Tax year" }).focus();
      await screen.findByText("Hello.");
      await ready();
      expect(screen.getByRole("combobox", { name: "Tax year" })).toHaveFocus();
    });
  });

  it("(k) a health failure shows a retry notice that refetches", async () => {
    const { routes } = server([]);
    routes["GET /api/health"] = () => Response.json({ code: "internal_error" }, { status: 500 });
    const user = userEvent.setup();
    renderWithProviders(<ChatPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
    expect(screen.queryByRole("combobox", { name: "Tax year" })).not.toBeInTheDocument();

    routes["GET /api/health"] = () => health;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("combobox", { name: "Tax year" })).toHaveValue("2025");
  });
});
