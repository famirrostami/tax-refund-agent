import { tool } from "ai";
import { z } from "zod";

export const questionSchema = z
  .object({
    question: z.string().min(1).max(500).describe("One focused question in the user's language"),
    field: z.string().optional().describe("The fact this answers, e.g. a missingInfo field from checkDeductibility"),
    answerType: z.enum(["text", "number", "boolean", "choice", "date"]),
    choices: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).max(10).optional(),
    unit: z.string().max(20).optional().describe("Unit shown next to a number, e.g. km, days, EUR"),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.answerType === "choice" && (q.choices?.length ?? 0) < 2) ctx.addIssue({ code: "custom", path: ["choices"], message: "choice questions need at least 2 choices" });
    if (q.answerType !== "choice" && q.choices) ctx.addIssue({ code: "custom", path: ["choices"], message: "only choice questions take choices" });
  });

export const answerSchema = z.discriminatedUnion("answered", [
  z.object({ answered: z.literal(true), value: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ answered: z.literal(false), reason: z.enum(["skipped", "dont_know"]) }),
]);

export type Question = z.infer<typeof questionSchema>;
export type Answer = z.infer<typeof answerSchema>;

/** Returns an error message if the answer does not fit the question, else null. */
export function validateAnswer(q: Question, a: Answer): string | null {
  if (!a.answered) return null;
  const v = a.value;
  switch (q.answerType) {
    case "number":
      if (typeof v !== "number" || !Number.isFinite(v)) return "expected a number";
      if (q.min !== undefined && v < q.min) return `must be at least ${q.min}`;
      if (q.max !== undefined && v > q.max) return `must be at most ${q.max}`;
      return null;
    case "boolean":
      return typeof v === "boolean" ? null : "expected true or false";
    case "choice":
      return typeof v === "string" && q.choices?.some((c) => c.value === v) ? null : "expected one of the offered choices";
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : "expected a date as YYYY-MM-DD";
    case "text":
      return typeof v === "string" && v.trim().length > 0 && v.length <= 2000 ? null : "expected non-empty text";
  }
}

/**
 * Client-side tool: it has no `execute`. The stream stops at the tool call, the UI shows the question,
 * and the user's answer comes back as the tool output in the next request.
 */
export function createAskUserTool() {
  return tool({
    description:
      "Ask the user ONE structured question and wait for the answer. Use it when a fact is missing (for example the fields listed in checkDeductibility's missingInfo) or a choice is needed. Prefer boolean or choice over free text. Never ask for something that is already in an uploaded document or an earlier answer. The result is either the answer or that the user skipped / does not know.",
    inputSchema: questionSchema,
    outputSchema: answerSchema,
  });
}

type Part = { type?: unknown; state?: unknown; input?: unknown; output?: unknown };

/** Checks every answered askUser call in the incoming history. Returns a message for the first invalid one. */
export function findInvalidAnswer(messages: { parts: Part[] }[]): string | null {
  for (const m of messages) {
    for (const part of m.parts) {
      if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
      const q = questionSchema.safeParse(part.input);
      const a = answerSchema.safeParse(part.output);
      if (!q.success || !a.success) return "malformed askUser call or answer";
      const err = validateAnswer(q.data, a.data);
      if (err) return err;
    }
  }
  return null;
}
