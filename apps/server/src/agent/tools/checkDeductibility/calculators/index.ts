import { additionalFacts, additionalToAllowance, standardAllowance, standardFacts } from "./allowances";
import { flatAllowance } from "./flatAllowance";
import { immediateVsDepreciation } from "./immediateVsDepreciation";
import { perKmTiered } from "./perKmTiered";
import { perUnitCapped } from "./perUnitCapped";
import { percentCap } from "./percentCap";
import type { Calculator } from "./types";
import { z } from "zod";
import { perUnitFacts } from "./perUnitCapped";
import { perKmFacts } from "./perKmTiered";
import { flatAllowanceFacts } from "./flatAllowance";
import { equipmentFacts } from "./immediateVsDepreciation";
import { percentCapFacts } from "./percentCap";

/** Keyed by `calc.type` in the rule files. Adding a rule type = adding a calculator here. */
export const calculators: Record<string, Calculator> = {
  per_unit_capped: perUnitCapped,
  per_km_tiered: perKmTiered,
  flat_allowance: flatAllowance,
  immediate_vs_depreciation: immediateVsDepreciation,
  percent_cap: percentCap,
  additional_to_allowance: additionalToAllowance,
  standard_allowance: standardAllowance,
};
export type { CalcContext, CalcResult, Calculator, MissingInfo, Verdict } from "./types";

/**
 * Every fact any calculator understands, assembled from the calculators' own schemas so the two cannot drift.
 * One explicit object (instead of a free-form record) tells the model the exact fact names and types, and is
 * a schema the CLI tool bridge can register.
 */
export const factsSchema = z.object({
  ...perUnitFacts.shape,
  ...perKmFacts.shape,
  ...flatAllowanceFacts.shape,
  ...equipmentFacts.shape,
  ...percentCapFacts.shape,
  ...additionalFacts.shape,
  ...standardFacts.shape,
});
export type Facts = z.infer<typeof factsSchema>;
