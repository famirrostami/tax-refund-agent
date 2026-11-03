import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createFileStore } from "../../../files";
import { createExtractReceiptTool } from "./extractReceipt";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const receipt = {
  vendor: "MediaMarkt", date: "2025-03-14", totalAmount: 899, currency: "EUR", vatAmount: 143.55, vatRate: 19,
  description: "Laptop", lineItems: [{ description: "Laptop", amount: 899 }], paymentMethod: null,
  documentType: "invoice", legibility: "clear", uncertainFields: [],
};

function modelReturning(payload: unknown, seen?: (p: unknown) => void) {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen?.(options.prompt);
      return {
        content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
      };
    },
  });
}

async function setup(model: MockLanguageModelV4) {
  const files = createFileStore(await mkdtemp(join(tmpdir(), "x-")), "default", 2025);
  const { fileId } = await files.save({ mediaType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  const tool = createExtractReceiptTool({ model, files });
  const run = (id: string) => tool.execute!({ fileId: id }, { toolCallId: "1", messages: [] } as never) as Promise<any>;
  return { fileId, run };
}

describe("extractReceipt", () => {
  it("returns a typed receipt and sends the file to the model", async () => {
    let prompt: unknown;
    const { fileId, run } = await setup(modelReturning(receipt, (p) => (prompt = p)));
    const result = await run(fileId);
    expect(result).toMatchObject({ ok: true, fileId, receipt: { vendor: "MediaMarkt", totalAmount: 899 } });
    expect(JSON.stringify(prompt)).toContain("image/png");
  });
  it("reports unknown files without calling the model", async () => {
    const { run } = await setup(modelReturning(receipt));
    expect(await run("00000000-0000-0000-0000-000000000000.png")).toMatchObject({ ok: false, code: "file_not_found" });
  });
  it("turns an unreadable document into a typed failure", async () => {
    const { fileId, run } = await setup(modelReturning({ ...receipt, legibility: "unreadable" }));
    expect(await run(fileId)).toMatchObject({ ok: false, code: "unreadable" });
  });
  it("turns model/schema errors into extraction_failed, not a throw", async () => {
    const { fileId, run } = await setup(modelReturning("not json"));
    expect(await run(fileId)).toMatchObject({ ok: false, code: "extraction_failed" });
  });
  it("refuses PDFs when the configured model cannot read them, without calling the model", async () => {
    let called = 0;
    const model = new MockLanguageModelV4({ doGenerate: async () => { called++; throw new Error("must not be called"); } });
    const files = createFileStore(await mkdtemp(join(tmpdir(), "x-")), "default", 2025);
    const { fileId } = await files.save({ mediaType: "application/pdf", bytes: new Uint8Array([1]) });
    const t = createExtractReceiptTool({ model, files, acceptsPdf: false });
    const out = (await t.execute!({ fileId } as never, { toolCallId: "1", messages: [] } as never)) as any;
    expect(out).toMatchObject({ ok: false, code: "unsupported_type" });
    expect(called).toBe(0);
  });
});
