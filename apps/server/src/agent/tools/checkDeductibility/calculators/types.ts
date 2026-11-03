import type { Rule } from "../../../../packs";

export type Verdict = "deductible" | "not_deductible" | "needs_review";
export type MissingInfo = { field: string; description: string };

export type CalcResult = {
  verdict: Verdict;
  /** Amount that can be claimed under this rule, or null when it cannot be computed yet. */
  amount: number | null;
  missingInfo: MissingInfo[];
  explanation: string;
  breakdown: Record<string, number | string>;
  caveats: string[];
};

export type CalcContext = { rule: Rule; rules: Rule[]; year: number };
export type CalcOutcome = CalcResult | { invalid: string };
export type Calculator = (facts: Record<string, unknown>, ctx: CalcContext) => CalcOutcome;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const needsReview = (missingInfo: MissingInfo[], explanation: string, extra: Partial<CalcResult> = {}): CalcResult => ({
  verdict: "needs_review",
  amount: null,
  missingInfo,
  explanation,
  breakdown: {},
  caveats: [],
  ...extra,
});
