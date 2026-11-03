import type { CaseResult } from "../runners";

export type SuiteSummary = { total: number; passed: number; passing: string[]; failing: string[] };
export type Baseline = { updated: string; suites: Record<string, { passing: string[] }> };

export function summarize(results: CaseResult[]): Record<string, SuiteSummary> {
  const out: Record<string, SuiteSummary> = {};
  for (const r of results) {
    const s = (out[r.suite] ??= { total: 0, passed: 0, passing: [], failing: [] });
    s.total++;
    if (r.passed) { s.passed++; s.passing.push(r.id); } else s.failing.push(r.id);
  }
  return out;
}

/**
 * A regression is a case that passed in the baseline and fails (or vanished) now.
 * A suite with no baseline entry cannot regress, but any failure in it is reported as unbaselined.
 */
export function compareBaseline(summary: Record<string, SuiteSummary>, baseline: Baseline | null) {
  const regressions: { suite: string; id: string }[] = [];
  const unbaselinedFailures: { suite: string; id: string }[] = [];
  for (const [suite, s] of Object.entries(summary)) {
    const base = baseline?.suites[suite];
    if (!base) {
      for (const id of s.failing) unbaselinedFailures.push({ suite, id });
      continue;
    }
    for (const id of base.passing) if (!s.passing.includes(id)) regressions.push({ suite, id });
  }
  return { regressions, unbaselinedFailures, ok: regressions.length === 0 && unbaselinedFailures.length === 0 };
}

/** Only suites that actually ran are updated; the rest keep their previous baseline. */
export function mergeBaseline(prev: Baseline | null, summary: Record<string, SuiteSummary>, now = new Date()): Baseline {
  const suites = { ...(prev?.suites ?? {}) };
  for (const [suite, s] of Object.entries(summary)) suites[suite] = { passing: [...s.passing].sort() };
  return { updated: now.toISOString().slice(0, 10), suites };
}
