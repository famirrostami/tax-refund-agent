import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateText, Output, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { FileStoreError, type FileStore } from "../../../files";
import { receiptSchema, type Receipt } from "../../../receipts";

const promptPath = join(dirname(fileURLToPath(import.meta.url)), "prompt.md");

export type ExtractReceiptResult =
  | { ok: true; fileId: string; receipt: Receipt }
  | { ok: false; code: "file_not_found" | "unreadable" | "extraction_failed" | "unsupported_type"; message: string };

export function createExtractReceiptTool({ model, files, acceptsPdf = true }: { model: LanguageModel; files: Pick<FileStore, "read">; acceptsPdf?: boolean }) {
  return tool({
    description:
      "Read an uploaded document (image or PDF) by its fileId and return structured receipt data: vendor, date, totals, VAT, description. Unknown values are null. Call once per uploaded file.",
    inputSchema: z.object({ fileId: z.string().describe("The fileId of the uploaded document") }),
    execute: async ({ fileId }): Promise<ExtractReceiptResult> => {
      let file;
      try {
        file = await files.read(fileId);
      } catch (e) {
        if (e instanceof FileStoreError) return { ok: false, code: "file_not_found", message: "No uploaded file with that id." };
        throw e;
      }
      // A model that cannot read PDFs would invent data from a document it never saw.
      if (!acceptsPdf && file.mediaType === "application/pdf") {
        return { ok: false, code: "unsupported_type", message: "The configured model cannot read PDFs. Ask the user to upload a photo or screenshot of the document instead." };
      }
      try {
        const { output: object } = await generateText({
          model,
          instructions: await readFile(promptPath, "utf8"),
          output: Output.object({ schema: receiptSchema }),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the receipt data from this document." },
                { type: "file", data: file.bytes, mediaType: file.mediaType },
              ],
            },
          ],
        });
        if (object.legibility === "unreadable") {
          return { ok: false, code: "unreadable", message: "The document could not be read. Ask the user for a clearer photo or PDF." };
        }
        return { ok: true, fileId, receipt: object };
      } catch {
        return { ok: false, code: "extraction_failed", message: "Extraction failed. Try again or ask the user to re-upload." };
      }
    },
  });
}
