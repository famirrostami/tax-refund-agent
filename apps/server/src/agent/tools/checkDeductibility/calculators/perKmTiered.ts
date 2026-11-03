import { days, money, parseWith, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

const params = z.object({
  tiers: z.array(z.object({ from_km: z.number().int().min(1), to_km: z.number().int().nullable(), rate: money })).min(1),
  cap_per_year: money,
  currency: z.string(),
});
export const perKmFacts = z.object({
  oneWayKm: money.optional(),
  workingDays: days.optional(),
  usesOwnOrProvidedCar: z.boolean().optional(),
});

/** Distance allowance: tiered rate per full one-way km per working day, yearly cap unless a car is used. */
export const perKmTiered: Calculator = (rawFacts, { rule }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(perKmFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  const { tiers, cap_per_year, currency } = p.data;
  const { oneWayKm, workingDays, usesOwnOrProvidedCar } = f.data;

  const missing = [
    ...(oneWayKm === undefined ? [{ field: "oneWayKm", description: "One-way distance between home and first place of work in km" }] : []),
    ...(workingDays === undefined ? [{ field: "workingDays", description: "Number of days the first place of work was visited" }] : []),
  ];
  if (missing.length) return needsReview(missing, "Need the distance and the number of working days.");

  const fullKm = Math.floor(oneWayKm!);
  const perDay = tiers.reduce((sum, t) => {
    const upper = t.to_km ?? Number.POSITIVE_INFINITY;
    return sum + Math.max(0, Math.min(fullKm, upper) - (t.from_km - 1)) * t.rate;
  }, 0);
  const raw = perDay * workingDays!;
  const overCap = raw > cap_per_year;
  const capApplies = overCap && usesOwnOrProvidedCar !== true;
  const amount = round2(capApplies ? cap_per_year : raw);

  return {
    verdict: amount > 0 ? "deductible" : "not_deductible",
    amount,
    missingInfo: overCap && usesOwnOrProvidedCar === undefined ? [{ field: "usesOwnOrProvidedCar", description: "Whether an own or provided car is used for the commute (the yearly cap does not apply then)" }] : [],
    explanation: `${fullKm} full km x tiers = ${round2(perDay)} ${currency} per day x ${workingDays} days = ${round2(raw)} ${currency}${capApplies ? `, capped at ${cap_per_year} ${currency}` : ""}.`,
    breakdown: { fullKm, perDay: round2(perDay), workingDays: workingDays!, uncapped: round2(raw), cap: cap_per_year, currency },
    caveats: overCap && usesOwnOrProvidedCar === true ? ["The yearly cap is not applied because a car is used."] : [],
  };
};
