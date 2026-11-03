import type { LanguageModel } from "ai";
import type { Pack } from "../../packs";
import type { Suite } from "../schema";

export type Check = { name: string; pass: boolean; detail?: string };
export type CaseResult = { id: string; suite: Suite; passed: boolean; checks: Check[]; error?: string; ms: number };
export type RunContext = { pack: Pack; model?: LanguageModel };

export const same = (name: string, actual: unknown, expected: unknown): Check => ({
  name,
  pass: JSON.stringify(actual) === JSON.stringify(expected),
  detail: JSON.stringify(actual) === JSON.stringify(expected) ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
});

export const near = (name: string, actual: number | null | undefined, expected: number | null): Check => {
  const pass = expected === null ? actual === null : typeof actual === "number" && Math.abs(actual - expected) <= 0.01;
  return { name, pass, detail: pass ? undefined : `expected ${expected}, got ${actual}` };
};

export const finish = (id: string, suite: Suite, checks: Check[], started: number, error?: string): CaseResult => ({
  id,
  suite,
  checks,
  error,
  passed: !error && checks.length > 0 && checks.every((c) => c.pass),
  ms: Date.now() - started,
});
