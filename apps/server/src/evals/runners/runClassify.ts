import { createClassifyExpenseTool } from "../../agent/tools/classifyExpense";
import type { ClassifyCase } from "../schema";
import { finish, same, type CaseResult, type RunContext } from "./types";

export async function runClassify(c: ClassifyCase, { pack, model }: RunContext): Promise<CaseResult> {
  const t = Date.now();
  if (!model) return finish(c.id, "classify", [], t, "no model configured");
  try {
    const tool = createClassifyExpenseTool({ model, pack, year: c.year });
    const r = (await tool.execute!({ receipt: c.receipt, userNote: c.userNote } as never, { toolCallId: "eval", messages: [] } as never)) as any;
    const checks = [same("ok", r.ok, true)];
    if (r.ok) {
      checks.push(same("category", r.category, c.expected.category));
      if (c.expected.taxYearMatches !== undefined) checks.push(same("taxYearMatches", r.taxYearCheck.matchesSession, c.expected.taxYearMatches));
    }
    return finish(c.id, "classify", checks, t);
  } catch (e) {
    return finish(c.id, "classify", [], t, e instanceof Error ? e.message : String(e));
  }
}
