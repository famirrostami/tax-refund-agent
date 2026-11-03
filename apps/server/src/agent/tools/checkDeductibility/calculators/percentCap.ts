import { money, parseWith, percent, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

const params = z.object({ percent, percent_of: z.string() });
export const percentCapFacts = z.object({ donationAmount: money.optional(), totalIncome: money.optional(), recipientEligible: z.boolean().optional() });

/** Deductible up to a percentage of a base amount (e.g. donations: 20% of total income). */
export const percentCap: Calculator = (rawFacts, { rule }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(percentCapFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  const { percent: pct, percent_of } = p.data;
  const { donationAmount, totalIncome, recipientEligible } = f.data;

  if (recipientEligible === false) {
    return { verdict: "not_deductible", amount: 0, missingInfo: [], explanation: "The recipient does not meet the rule's conditions.", breakdown: {}, caveats: [] };
  }
  const missing = [
    ...(donationAmount === undefined ? [{ field: "donationAmount", description: "Total donated in the tax year" }] : []),
    ...(recipientEligible === undefined ? [{ field: "recipientEligible", description: "Whether the recipient meets the rule's recipient conditions (check the receipt)" }] : []),
    ...(totalIncome === undefined ? [{ field: "totalIncome", description: `${percent_of} for the tax year` }] : []),
  ];
  if (missing.length) {
    return needsReview(missing, "Need more information before the cap can be applied.", { breakdown: donationAmount === undefined ? {} : { donationAmount } });
  }
  const cap = round2((totalIncome! * pct) / 100);
  const amount = round2(Math.min(donationAmount!, cap));
  return {
    verdict: amount > 0 ? "deductible" : "not_deductible",
    amount,
    missingInfo: [],
    explanation: `Limit ${pct}% of ${percent_of} (${totalIncome}) = ${cap}; donated ${donationAmount}; deductible ${amount}.`,
    breakdown: { donationAmount: donationAmount!, cap, totalIncome: totalIncome! },
    caveats: ["The limit applies to all donations of the year together."],
  };
};
