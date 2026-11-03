import { money, parseWith, percent, z } from "./parse";
import { needsReview, round2, type Calculator } from "./types";

const params = z.object({ immediate_limit: money, currency: z.string() });
const usefulLifeParams = z.object({ years: z.number().int().positive() });
export const equipmentFacts = z.object({
  grossAmount: money.optional(),
  vatRatePercent: percent.optional(),
  workUsePercent: percent.optional(),
  isComputerOrSoftware: z.boolean().optional(),
});

/** Work equipment: immediate deduction up to the limit (measured without VAT); computers use the useful-life rule; the rest needs depreciation. */
export const immediateVsDepreciation: Calculator = (rawFacts, { rule, rules, year }) => {
  const p = parseWith(params, rule.calc, `rule ${rule.id} calc`);
  if (!p.ok) return p.outcome;
  const f = parseWith(equipmentFacts, rawFacts, "facts");
  if (!f.ok) return f.outcome;
  const { immediate_limit: limit, currency } = p.data;
  const { grossAmount, vatRatePercent, workUsePercent, isComputerOrSoftware } = f.data;

  const missing = [
    ...(grossAmount === undefined ? [{ field: "grossAmount", description: "Price paid for the single item, including VAT" }] : []),
    ...(workUsePercent === undefined ? [{ field: "workUsePercent", description: "Share of use that is for work, 0-100" }] : []),
  ];
  if (missing.length) return needsReview(missing, "Need the price and the work-use share.");
  if (workUsePercent === 0) {
    return { verdict: "not_deductible", amount: 0, missingInfo: [], explanation: "Purely private use is not deductible.", breakdown: {}, caveats: [] };
  }
  const potential = round2((grossAmount! * workUsePercent!) / 100);
  const breakdown = { grossAmount: grossAmount!, workUsePercent: workUsePercent!, workShareAmount: potential, limit, currency };

  if (grossAmount! <= limit) {
    return { verdict: "deductible", amount: potential, missingInfo: [], explanation: `Price ${grossAmount} ${currency} is within the ${limit} ${currency} immediate-deduction limit, so the work share is deductible in the year of purchase.`, breakdown, caveats: [] };
  }
  if (isComputerOrSoftware === undefined) {
    return needsReview([{ field: "isComputerOrSoftware", description: "Whether the item is computer hardware or software for data entry and processing" }], `Price is above the ${limit} ${currency} limit; the treatment depends on the item type.`, { breakdown });
  }
  if (isComputerOrSoftware) {
    const life = rules.find((r) => r.calc.type === "useful_life" && r.category === rule.category && r.tax_years.includes(year));
    const years = life ? parseWith(usefulLifeParams, life.calc, `rule ${life.id} calc`) : undefined;
    if (life && years?.ok && years.data.years === 1) {
      return {
        verdict: "deductible",
        amount: potential,
        missingInfo: [],
        explanation: `Computer equipment may be written off over ${years.data.years} year (rule ${life.id}), so the work share of ${potential} ${currency} is deductible in the year of purchase.`,
        breakdown: { ...breakdown, usefulLifeRule: life.id },
        caveats: ["The one-year useful life is an option the taxpayer may choose, not an obligation."],
      };
    }
  }
  if (vatRatePercent === undefined) {
    return needsReview([{ field: "vatRatePercent", description: "VAT rate on the invoice in percent (0 if none)" }], `The ${limit} ${currency} limit is measured without VAT; need the VAT rate.`, { breakdown });
  }
  const net = round2(grossAmount! / (1 + vatRatePercent / 100));
  if (net <= limit) {
    return {
      verdict: "deductible",
      amount: potential,
      missingInfo: [],
      explanation: `Net price ${net} ${currency} (gross ${grossAmount}) is within the ${limit} ${currency} limit, which is measured without VAT, so the work share of ${potential} ${currency} is deductible in the year of purchase.`,
      breakdown: { ...breakdown, netAmount: net },
      caveats: [],
    };
  }
  return needsReview([], `Net price ${net} ${currency} exceeds the ${limit} ${currency} limit, so the cost must be spread over the useful life. The pack has no useful-life table, so the yearly amount cannot be computed.`, { breakdown: { ...breakdown, netAmount: net } });
};
