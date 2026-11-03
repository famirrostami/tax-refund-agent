import { z, type ZodType } from "zod";
import type { CalcOutcome } from "./types";

/** Validate the model-supplied facts and the rule's own calc parameters. */
export function parseWith<T>(schema: ZodType<T>, value: unknown, what: string): { ok: true; data: T } | { ok: false; outcome: CalcOutcome } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, outcome: { invalid: `${what}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` } };
}

export const days = z.number().int().min(0).max(366);
export const percent = z.number().min(0).max(100);
export const money = z.number().finite().min(0);
export { z };
