import { days, money, parseWith, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

const params = z.object({ unit: z.string(), rate: money, cap_per_year: money, currency: z.string() });
export const perUnitFacts = z.object({ days: days.optional(), daysAlsoAtFirstWorkplace: days.optional(), arbeitszimmerClaimed: z.boolean().optional() });

/** Flat amount per unit (e.g. per home-office day) with a yearly cap. */
export const perUnitCapped: Calculator = (rawFacts, { rule }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(perUnitFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  const { rate, cap_per_year, currency, unit } = p.data;

  if (f.data.arbeitszimmerClaimed === true) {
    return { verdict: "not_deductible", amount: 0, missingInfo: [], explanation: "The daily flat rate is excluded when the work-room (Arbeitszimmer) deduction is claimed.", breakdown: {}, caveats: [] };
  }
  if (f.data.days === undefined) {
    return needsReview([{ field: "days", description: `Number of ${unit}s that meet this rule's conditions (see rule conditions)` }], `Need the number of qualifying ${unit}s.`);
  }
  if ((f.data.daysAlsoAtFirstWorkplace ?? 0) > f.data.days) return { invalid: "facts: daysAlsoAtFirstWorkplace cannot exceed days" };
  const raw = f.data.days * rate;
  const amount = round2(Math.min(raw, cap_per_year));
  return {
    verdict: amount > 0 ? "deductible" : "not_deductible",
    amount,
    missingInfo: f.data.arbeitszimmerClaimed === undefined ? [{ field: "arbeitszimmerClaimed", description: "Whether a work-room (Arbeitszimmer) deduction is also claimed for the same period" }] : [],
    explanation: `${f.data.days} ${unit}s x ${rate} ${currency} = ${round2(raw)} ${currency}${raw > cap_per_year ? `, capped at ${cap_per_year} ${currency}` : ""}.`,
    breakdown: { units: f.data.days, rate, uncapped: round2(raw), cap: cap_per_year, currency },
    caveats: [],
  };
};
