/** "needs_review" is a verdict of its own; never treat it as pass or fail. */
export type Verdict = "deductible" | "not_deductible" | "needs_review";

export type DeductionCheck = {
  verdict: Verdict;
  amount: number | null;
  currency: string;
  ruleId: string;
  taxYear: number;
  confidence: "high" | "medium" | "low";
  missingInfo: { field: string; description: string }[];
  explanation: string;
  breakdown: Record<string, number | string>;
  caveats: string[];
  sources: { label: string; url: string }[];
};
