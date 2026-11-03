import { checkDeductibility } from "../../agent/tools/checkDeductibility";
import type { CheckCase } from "../schema";
import { finish, near, same, type CaseResult, type RunContext } from "./types";

export function runCheck(c: CheckCase, { pack }: RunContext): CaseResult {
  const t = Date.now();
  const r = checkDeductibility(pack, c.year, { ruleId: c.ruleId, facts: c.facts });
  const e = c.expected;
  const checks = [same("ok", r.ok, e.ok)];
  if (!r.ok) {
    if (e.code !== undefined) checks.push(same("code", r.code, e.code));
    return finish(c.id, "check", checks, t);
  }
  if (e.verdict !== undefined) checks.push(same("verdict", r.verdict, e.verdict));
  if (e.amount !== undefined) checks.push(near("amount", r.amount, e.amount));
  if (e.confidence !== undefined) checks.push(same("confidence", r.confidence, e.confidence));
  if (e.missing !== undefined) checks.push(same("missing", r.missingInfo.map((m) => m.field), e.missing));
  checks.push({ name: "cited", pass: r.sources.length > 0 && r.ruleId === c.ruleId });
  return finish(c.id, "check", checks, t);
}
