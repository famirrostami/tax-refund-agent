import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { caseSchema, loadCases } from "./index";

describe("eval cases", () => {
  it("loads every shipped de case with unique ids across all four suites", async () => {
    const cases = await loadCases(resolve(__dirname, "../../../../../packs/de"));
    expect(new Set(cases.map((c) => c.suite))).toEqual(new Set(["check", "search", "classify", "agent"]));
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(cases.filter((c) => c.suite === "classify").some((c) => c.expected.category === "not_work_related")).toBe(true);
    expect(cases.filter((c) => c.suite === "agent").some((c) => c.expected.noDeductibleClaim)).toBe(true);
  });
  it("rejects malformed cases", () => {
    expect(caseSchema.safeParse({ id: "Bad Id", suite: "check", year: 2025, ruleId: "r", facts: {}, expected: {} }).success).toBe(false);
    expect(caseSchema.safeParse({ id: "x", suite: "nope" }).success).toBe(false);
  });
});
