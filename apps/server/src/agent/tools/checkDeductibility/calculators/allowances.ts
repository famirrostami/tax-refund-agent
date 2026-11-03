import { money, parseWith, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

export const additionalFacts = z.object({ amount: money.optional() });
export const standardFacts = z.object({ totalWerbungskosten: money.optional() });

/** Additional to the standard allowance: the claimed amount is deductible in full. */
export const additionalToAllowance: Calculator = (rawFacts, { rule }) => {
  const f = parseWith(additionalFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  if (f.data.amount === undefined) return needsReview([{ field: "amount", description: "Amount paid in the tax year" }], "Need the amount paid.");
  return {
    verdict: f.data.amount > 0 ? "deductible" : "not_deductible",
    amount: round2(f.data.amount),
    missingInfo: [],
    explanation: `${round2(f.data.amount)} is taken into account in addition to the standard allowance (${rule.id}).`,
    breakdown: { amount: f.data.amount },
    caveats: [],
  };
};

const params = z.object({ amount: money, currency: z.string() });

/** Standard allowance: individual costs only help to the extent they exceed it. */
export const standardAllowance: Calculator = (rawFacts, { rule }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(standardFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  if (f.data.totalWerbungskosten === undefined) {
    return needsReview([{ field: "totalWerbungskosten", description: "Sum of all work-related costs the user can claim, excluding items taken into account in addition to the allowance" }], "Need the total of work-related costs.");
  }
  const excess = round2(Math.max(0, f.data.totalWerbungskosten - p.data.amount));
  return {
    verdict: excess > 0 ? "deductible" : "not_deductible",
    amount: excess,
    missingInfo: [],
    explanation: excess > 0 ? `Total ${f.data.totalWerbungskosten} exceeds the allowance ${p.data.amount} by ${excess} ${p.data.currency}; only that excess lowers tax.` : `Total ${f.data.totalWerbungskosten} does not exceed the allowance ${p.data.amount}, so individual costs give no extra benefit.`,
    breakdown: { total: f.data.totalWerbungskosten, allowance: p.data.amount, excess, currency: p.data.currency },
    caveats: [],
  };
};
