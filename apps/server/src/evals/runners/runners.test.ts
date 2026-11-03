import { resolve } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../packs";
import { loadCases, type AgentCase, type CheckCase, type ClassifyCase, type SearchCase } from "../schema";
import { runCase } from "./index";

const packDir = resolve(__dirname, "../../../../../packs");
const pack = await loadPack(packDir, "de");
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const H = "de.home_office.tagespauschale";

describe("deterministic suites", () => {
  it("every shipped check and search case passes against the real pack", async () => {
    const cases = (await loadCases(resolve(packDir, "de"))).filter((c) => c.suite === "check" || c.suite === "search");
    expect(cases.length).toBeGreaterThan(20);
    for (const c of cases) {
      const r = await runCase(c, { pack });
      expect(r.checks.filter((x) => !x.pass), `${c.id}: ${JSON.stringify(r.checks)}`).toEqual([]);
      expect(r.passed, c.id).toBe(true);
    }
  });
  it("fails a case whose expectation is wrong, with a readable detail", async () => {
    const c: CheckCase = { id: "wrong", suite: "check", year: 2025, ruleId: H, facts: { days: 100 }, expected: { ok: true, amount: 999 } };
    const r = await runCase(c, { pack });
    expect(r.passed).toBe(false);
    expect(r.checks.find((x) => x.name === "amount")?.detail).toBe("expected 999, got 600");
  });
  it("search expectations can fail", async () => {
    const c: SearchCase = { id: "s", suite: "search", year: 2025, query: "zebra", expected: { top: H } };
    expect((await runCase(c, { pack })).passed).toBe(false);
  });
});

describe("model suites", () => {
  it("report an error instead of passing when no model is configured", async () => {
    const c: ClassifyCase = { id: "c", suite: "classify", year: 2025, receipt: { vendor: null, date: null, description: "Laptop", lineItems: [], totalAmount: null, currency: null, documentType: "receipt" }, expected: { category: "work_equipment" } };
    expect(await runCase(c, { pack })).toMatchObject({ passed: false, error: "no model configured" });
  });
  it("classify compares the category", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({ content: [{ type: "text", text: JSON.stringify({ category: "work_equipment", confidence: "high", reasoning: "r", needsSplit: false }) }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] }),
    });
    const base = { suite: "classify" as const, year: 2025, receipt: { vendor: null, date: "2025-01-01", description: "Laptop", lineItems: [], totalAmount: null, currency: null, documentType: "receipt" as const } };
    expect((await runCase({ ...base, id: "ok", expected: { category: "work_equipment", taxYearMatches: true } }, { pack, model })).passed).toBe(true);
    expect((await runCase({ ...base, id: "bad", expected: { category: "not_work_related" } }, { pack, model })).passed).toBe(false);
  });
  it("agent: scripted user answers askUser, tool results are scored", async () => {
    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call++;
        if (call === 1) return { content: [{ type: "tool-call", toolCallId: "1", toolName: "askUser", input: JSON.stringify({ question: "Days?", field: "days", answerType: "number", min: 0, max: 366 }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] };
        if (call === 2) return { content: [{ type: "tool-call", toolCallId: "2", toolName: "checkDeductibility", input: JSON.stringify({ ruleId: H, facts: { days: 120 } }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] };
        return { content: [{ type: "text", text: "You can deduct 720 EUR." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
      },
    });
    const c: AgentCase = {
      id: "agent_mock", suite: "agent", year: 2025, message: "I work from home.", answers: { days: 120 },
      expected: { toolsCalled: ["askUser", "checkDeductibility"], toolsNotCalled: ["extractReceipt"], check: { ruleId: H, verdict: "deductible", amount: 720 }, maxQuestions: 1, textNotMatching: ["submitted"] },
    };
    const r = await runCase(c, { pack, model });
    expect(r.checks.filter((x) => !x.pass)).toEqual([]);
    expect(r.passed).toBe(true);
  });
  it("agent: a firm claim on a case that must not have one fails", async () => {
    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call++;
        return call === 1
          ? { content: [{ type: "tool-call", toolCallId: "1", toolName: "checkDeductibility", input: JSON.stringify({ ruleId: H, facts: { days: 120, arbeitszimmerClaimed: false } }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] }
          : { content: [{ type: "text", text: "ok" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
      },
    });
    const c: AgentCase = { id: "claim", suite: "agent", year: 2025, message: "m", answers: {}, expected: { noDeductibleClaim: true } };
    expect((await runCase(c, { pack, model })).passed).toBe(false);
  });
});
