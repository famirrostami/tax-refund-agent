import { z } from "zod";
import { receiptSchema } from "../../receipts";

const base = { id: z.string().regex(/^[a-z0-9_.-]+$/), year: z.number().int(), description: z.string().optional() };
const verdict = z.enum(["deductible", "not_deductible", "needs_review"]);
const confidence = z.enum(["high", "medium", "low"]);
const fact = z.union([z.number(), z.boolean(), z.string()]);

export const checkCase = z.object({
  ...base,
  suite: z.literal("check"),
  ruleId: z.string(),
  facts: z.record(z.string(), fact),
  expected: z.object({
    ok: z.boolean().default(true),
    code: z.string().optional(),
    verdict: verdict.optional(),
    amount: z.number().nullable().optional(),
    confidence: confidence.optional(),
    missing: z.array(z.string()).optional(),
  }),
});

export const searchCase = z.object({
  ...base,
  suite: z.literal("search"),
  query: z.string(),
  category: z.string().optional(),
  expected: z.object({ top: z.string().optional(), includes: z.array(z.string()).optional(), excludes: z.array(z.string()).optional(), empty: z.boolean().optional() }),
});

export const classifyCase = z.object({
  ...base,
  suite: z.literal("classify"),
  receipt: receiptSchema.pick({ vendor: true, date: true, description: true, lineItems: true, totalAmount: true, currency: true, documentType: true }),
  userNote: z.string().optional(),
  expected: z.object({ category: z.string(), taxYearMatches: z.boolean().nullable().optional() }),
});

export const agentCase = z.object({
  ...base,
  suite: z.literal("agent"),
  /** The user's opening message. */
  message: z.string(),
  /** Simulated user: answers to askUser questions, keyed by the question's `field`. Unlisted fields get "don't know". */
  answers: z.record(z.string(), fact).default({}),
  expected: z.object({
    toolsCalled: z.array(z.string()).optional(),
    toolsNotCalled: z.array(z.string()).optional(),
    /** The last successful checkDeductibility call for this rule. */
    check: z.object({ ruleId: z.string(), verdict: verdict.optional(), amount: z.number().nullable().optional() }).optional(),
    /** Fail if the agent produced a firm deductible amount (used for private / unsupported cases). */
    noDeductibleClaim: z.boolean().optional(),
    maxQuestions: z.number().int().optional(),
    textNotMatching: z.array(z.string()).optional(),
  }),
});

export const caseSchema = z.discriminatedUnion("suite", [checkCase, searchCase, classifyCase, agentCase]);
export const caseFileSchema = z.array(caseSchema);

export type EvalCase = z.infer<typeof caseSchema>;
export type CheckCase = z.infer<typeof checkCase>;
export type SearchCase = z.infer<typeof searchCase>;
export type ClassifyCase = z.infer<typeof classifyCase>;
export type AgentCase = z.infer<typeof agentCase>;
export type Suite = EvalCase["suite"];

export const SUITES: Suite[] = ["check", "search", "classify", "agent"];
/** Suites that call a model and therefore need an API key. */
export const LLM_SUITES: Suite[] = ["classify", "agent"];
