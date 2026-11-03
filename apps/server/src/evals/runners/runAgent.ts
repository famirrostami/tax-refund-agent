import { generateText, isStepCount, tool } from "ai";
import { buildSystemPrompt } from "../../agent/prompts";
import { createTools } from "../../agent/tools";
import { answerSchema, questionSchema, validateAnswer, type Answer } from "../../agent/tools/askUser";
import { createExportStore } from "../../exports";
import { createFileStore } from "../../files";
import type { AgentCase } from "../schema";
import { finish, near, same, type Check, type CaseResult, type RunContext } from "./types";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Full agent turn with a scripted user: askUser questions are answered from `answers` by field. */
export async function runAgent(c: AgentCase, { pack, model }: RunContext): Promise<CaseResult> {
  const t = Date.now();
  if (!model) return finish(c.id, "agent", [], t, "no model configured");
  try {
    const dir = await mkdtemp(join(tmpdir(), "eval-"));
    const files = createFileStore(dir, "eval", c.year);
    const exports = createExportStore(dir, "eval", c.year);
    const base = createTools({ model, files, exports, pack, year: c.year });
    const asked: string[] = [];
    const tools = {
      ...base,
      askUser: tool({
        description: "Ask the user one question and wait for the answer.",
        inputSchema: questionSchema,
        outputSchema: answerSchema,
        execute: async (q): Promise<Answer> => {
          asked.push(q.field ?? q.question);
          const v = q.field ? c.answers[q.field] : undefined;
          const answer: Answer = v === undefined ? { answered: false, reason: "dont_know" } : { answered: true, value: v };
          return validateAnswer(q, answer) ? { answered: false, reason: "dont_know" } : answer;
        },
      }),
    };
    const result = await generateText({
      model,
      instructions: await buildSystemPrompt(pack, c.year),
      messages: [{ role: "user", content: c.message }],
      tools,
      stopWhen: isStepCount(14),
    });

    const calls = result.steps.flatMap((s) => s.toolCalls.map((x) => x.toolName));
    const checkResults = result.steps.flatMap((s) => s.toolResults.filter((x) => x.toolName === "checkDeductibility").map((x) => x.output as any));
    const e = c.expected;
    const checks: Check[] = [];
    for (const name of e.toolsCalled ?? []) checks.push({ name: `called ${name}`, pass: calls.includes(name), detail: `calls: ${calls.join(", ") || "none"}` });
    for (const name of e.toolsNotCalled ?? []) checks.push({ name: `not called ${name}`, pass: !calls.includes(name) });
    if (e.check) {
      const last = [...checkResults].reverse().find((r) => r?.ok && r.ruleId === e.check!.ruleId);
      checks.push({ name: `checked ${e.check.ruleId}`, pass: Boolean(last) });
      if (last && e.check.verdict !== undefined) checks.push(same("verdict", last.verdict, e.check.verdict));
      if (last && e.check.amount !== undefined) checks.push(near("amount", last.amount, e.check.amount));
    }
    if (e.noDeductibleClaim) {
      checks.push({ name: "no firm deductible claim", pass: !checkResults.some((r) => r?.ok && r.verdict === "deductible" && (r.amount ?? 0) > 0 && r.confidence !== "low") });
    }
    if (e.maxQuestions !== undefined) checks.push({ name: "question budget", pass: asked.length <= e.maxQuestions, detail: `asked ${asked.length}` });
    if (calls.includes("buildExport")) checks.push({ name: "no export written without approval", pass: (await exports.list()).length === 0 });
    for (const pattern of e.textNotMatching ?? []) checks.push({ name: `text avoids /${pattern}/i`, pass: !new RegExp(pattern, "i").test(result.text) });
    return finish(c.id, "agent", checks, t);
  } catch (err) {
    return finish(c.id, "agent", [], t, err instanceof Error ? err.message : String(err));
  }
}
