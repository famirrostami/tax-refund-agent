import { tool } from "ai";
import { z } from "zod";
import type { Pack } from "../../../packs";
import { calculators, factsSchema, type CalcResult, type MissingInfo, type Verdict } from "./calculators";

export type Confidence = "high" | "medium" | "low";

export type CheckDeductibilityResult =
  | {
      ok: true;
      verdict: Verdict;
      amount: number | null;
      currency: string;
      ruleId: string;
      taxYear: number;
      confidence: Confidence;
      missingInfo: MissingInfo[];
      explanation: string;
      breakdown: CalcResult["breakdown"];
      caveats: string[];
      sources: { label: string; url: string }[];
    }
  | { ok: false; code: "rule_not_found" | "rule_not_for_year" | "no_calculator" | "invalid_facts" | "rule_misconfigured"; message: string };

export function checkDeductibility(
  pack: Pick<Pack, "rules" | "manifest">,
  year: number,
  input: { ruleId: string; facts: Record<string, unknown> },
): CheckDeductibilityResult {
  const rule = pack.rules.find((r) => r.id === input.ruleId);
  if (!rule) return { ok: false, code: "rule_not_found", message: `No rule with id ${input.ruleId}. Use searchRules to find rule ids.` };
  if (!rule.tax_years.includes(year)) return { ok: false, code: "rule_not_for_year", message: `Rule ${rule.id} does not apply to tax year ${year}.` };
  const calc = calculators[rule.calc.type];
  if (!calc) {
    return { ok: false, code: "no_calculator", message: `Rule ${rule.id} is a supporting rule and cannot be checked directly. Check the expense against the main rule of its category (use searchRules).` };
  }
  const outcome = calc(input.facts, { rule, rules: pack.rules, year });
  if ("invalid" in outcome) {
    return { ok: false, code: outcome.invalid.startsWith("rule ") ? "rule_misconfigured" : "invalid_facts", message: outcome.invalid };
  }

  const unresolved = rule.verification === "unresolved";
  const confidence: Confidence = outcome.missingInfo.length > 0 || unresolved ? "low" : rule.verification === "verified" ? "high" : "medium";
  return {
    ok: true,
    verdict: unresolved ? "needs_review" : outcome.verdict,
    amount: outcome.amount,
    currency: pack.manifest.currency,
    ruleId: rule.id,
    taxYear: year,
    confidence,
    missingInfo: outcome.missingInfo,
    explanation: outcome.explanation,
    breakdown: outcome.breakdown,
    caveats: [...outcome.caveats, ...rule.open_questions],
    sources: rule.sources.map((s) => ({ label: s.label, url: s.url })),
  };
}

export function createCheckDeductibilityTool({ pack, year }: { pack: Pick<Pack, "rules" | "manifest">; year: number }) {
  return tool({
    description:
      "Compute whether and how much of an expense or situation is deductible under one specific rule, for the current tax year. Get the ruleId from searchRules. Pass only facts the user or a document actually provided; leave unknown facts out and the result lists exactly what is missing. Never compute amounts yourself. Fact names by rule type: per_unit_capped {days (all qualifying days), daysAlsoAtFirstWorkplace (optional: days at both home and first workplace), arbeitszimmerClaimed}; per_km_tiered {oneWayKm, workingDays, usesOwnOrProvidedCar}; flat_allowance {qualifyingMonths, conditionsConfirmed}; immediate_vs_depreciation {grossAmount, vatRatePercent, workUsePercent, isComputerOrSoftware}; percent_cap {donationAmount, totalIncome, recipientEligible}; additional_to_allowance {amount}; standard_allowance {totalWerbungskosten}.",
    inputSchema: z.object({
      ruleId: z.string().describe("Rule id returned by searchRules"),
      facts: factsSchema.describe("Known facts for this rule; omit unknown ones. Only the fact names listed in the tool description exist."),
    }),
    execute: async (input) => checkDeductibility(pack, year, input),
  });
}
