import type { EvalCase } from "../schema";
import { runAgent } from "./runAgent";
import { runCheck } from "./runCheck";
import { runClassify } from "./runClassify";
import { runSearch } from "./runSearch";
import type { CaseResult, RunContext } from "./types";

export async function runCase(c: EvalCase, ctx: RunContext): Promise<CaseResult> {
  switch (c.suite) {
    case "check": return runCheck(c, ctx);
    case "search": return runSearch(c, ctx);
    case "classify": return runClassify(c, ctx);
    case "agent": return runAgent(c, ctx);
  }
}
