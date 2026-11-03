import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateText, Output, tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { Pack } from "../../../packs";
import { receiptSchema } from "../../../receipts";
import { searchRules } from "../searchRules";

const promptPath = join(dirname(fileURLToPath(import.meta.url)), "prompt.md");

const inputSchema = z.object({
  receipt: receiptSchema.pick({ vendor: true, date: true, description: true, lineItems: true, totalAmount: true, currency: true, documentType: true }),
  userNote: z.string().max(1000).optional().describe("What the user said about this expense, e.g. 'bought for my home office'"),
});

type Confidence = "high" | "medium" | "low";

export type ClassifyExpenseResult =
  | {
      ok: true;
      category: string;
      confidence: Confidence;
      reasoning: string;
      needsSplit: boolean;
      taxYearCheck: { receiptYear: number | null; matchesSession: boolean | null };
      suggestedRules: { ruleId: string; title: string; calcType: string }[];
      requiredDocs: string[];
      questions: string[];
    }
  | { ok: false; code: "insufficient_data" | "classification_failed"; message: string };

const lower = (c: Confidence): Confidence => (c === "high" ? "medium" : c);

export function createClassifyExpenseTool({ model, pack, year }: { model: LanguageModel; pack: Pack; year: number }) {
  const ids = pack.categories.map((c) => c.id);
  const outputSchema = z.object({
    category: z.enum(["not_work_related", "unclear", ...ids]),
    confidence: z.enum(["high", "medium", "low"]),
    reasoning: z.string().min(1).max(500),
    needsSplit: z.boolean(),
  });

  return tool({
    description:
      "Classify an extracted expense (from extractReceipt) into one of the country's deduction categories, or 'not_work_related' / 'unclear'. Returns the category, confidence, suggested rule ids to pass to checkDeductibility, the documents still needed and the questions to ask. Check taxYearCheck before continuing.",
    inputSchema,
    execute: async ({ receipt, userNote }): Promise<ClassifyExpenseResult> => {
      const hasContent = receipt.description.trim().length > 0 || receipt.lineItems.length > 0 || Boolean(userNote?.trim());
      if (!hasContent) return { ok: false, code: "insufficient_data", message: "No description or line items to classify. Ask the user what the expense was for." };

      const categories = pack.categories.map((c) => `- ${c.id}: ${c.description}`).join("\n");
      let out;
      try {
        ({ output: out } = await generateText({
          model,
          instructions: `${await readFile(promptPath, "utf8")}\n\nCategories:\n${categories}\n- not_work_related: clearly private\n- unclear: not enough information`,
          output: Output.object({ schema: outputSchema }),
          prompt: JSON.stringify({ receipt, userNote: userNote ?? null }),
        }));
      } catch {
        return { ok: false, code: "classification_failed", message: "Classification failed. Ask the user which category fits." };
      }

      const receiptYear = receipt.date ? Number(receipt.date.slice(0, 4)) : null;
      const category = pack.categories.find((c) => c.id === out.category);
      const text = [receipt.description, ...receipt.lineItems.map((i) => i.description), userNote ?? ""].join(" ");
      const suggested = category ? searchRules(pack, { query: text, year, category: category.id, limit: 3 }) : [];

      return {
        ok: true,
        category: out.category,
        // A document with no date, or from another year, cannot support a confident verdict.
        confidence: receiptYear === null || receiptYear !== year ? lower(out.confidence) : out.confidence,
        reasoning: out.reasoning,
        needsSplit: out.needsSplit,
        taxYearCheck: { receiptYear, matchesSession: receiptYear === null ? null : receiptYear === year },
        suggestedRules: suggested.map((r) => ({ ruleId: r.id, title: r.title, calcType: r.calc.type })),
        requiredDocs: category?.requiredDocs ?? [],
        questions: category?.questions ?? [],
      };
    },
  });
}
