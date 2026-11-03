import { money, parseWith, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

const params = z.object({ amount: money, currency: z.string(), months_in_year: z.number().int().positive() });
export const flatAllowanceFacts = z.object({ qualifyingMonths: z.number().int().min(0).max(12).optional(), conditionsConfirmed: z.boolean().optional() });

/** Annual flat amount, reduced pro rata per full month in which the conditions are not met. */
export const flatAllowance: Calculator = (rawFacts, { rule }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(flatAllowanceFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  const { amount, currency, months_in_year } = p.data;
  if (f.data.qualifyingMonths === undefined) {
    return needsReview([{ field: "qualifyingMonths", description: "Number of full calendar months in which the rule's conditions were met" }], "Need the number of qualifying months.");
  }
  const claim = round2((amount * f.data.qualifyingMonths) / months_in_year);
  const confirmed = f.data.conditionsConfirmed === true;
  return {
    verdict: claim === 0 ? "not_deductible" : confirmed ? "deductible" : "needs_review",
    amount: claim,
    missingInfo: confirmed ? [] : [{ field: "conditionsConfirmed", description: "Whether every condition of this rule is met (read them to the user and confirm)" }],
    explanation: `${amount} ${currency} x ${f.data.qualifyingMonths}/${months_in_year} = ${claim} ${currency}.`,
    breakdown: { annual: amount, months: f.data.qualifyingMonths, currency },
    caveats: [],
  };
};
