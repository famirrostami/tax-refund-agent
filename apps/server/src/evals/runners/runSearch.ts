import { searchRules } from "../../agent/tools/searchRules";
import type { SearchCase } from "../schema";
import { finish, same, type CaseResult, type RunContext } from "./types";

export function runSearch(c: SearchCase, { pack }: RunContext): CaseResult {
  const t = Date.now();
  const ids = searchRules(pack, { query: c.query, year: c.year, category: c.category }).map((r) => r.id);
  const e = c.expected;
  const checks = [
    ...(e.top !== undefined ? [same("top", ids[0], e.top)] : []),
    ...(e.includes ?? []).map((id) => ({ name: `includes ${id}`, pass: ids.includes(id), detail: `got ${JSON.stringify(ids)}` })),
    ...(e.excludes ?? []).map((id) => ({ name: `excludes ${id}`, pass: !ids.includes(id), detail: `got ${JSON.stringify(ids)}` })),
    ...(e.empty ? [same("empty", ids, [])] : []),
  ];
  return finish(c.id, "search", checks, t);
}
