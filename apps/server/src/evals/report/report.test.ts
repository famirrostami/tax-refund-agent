import { describe, expect, it } from "vitest";
import type { CaseResult } from "../runners";
import { compareBaseline, mergeBaseline, summarize } from "./index";

const r = (suite: string, id: string, passed: boolean) => ({ suite, id, passed, checks: [], ms: 0 }) as unknown as CaseResult;

describe("report", () => {
  const summary = summarize([r("check", "a", true), r("check", "b", false), r("search", "c", true)]);
  it("summarizes per suite", () => {
    expect(summary["check"]).toMatchObject({ total: 2, passed: 1, passing: ["a"], failing: ["b"] });
  });
  it("flags a previously passing case that now fails or vanished", () => {
    const base = { updated: "x", suites: { check: { passing: ["a", "b"] }, search: { passing: ["c", "gone"] } } };
    const cmp = compareBaseline(summary, base);
    expect(cmp.regressions).toEqual([{ suite: "check", id: "b" }, { suite: "search", id: "gone" }]);
    expect(cmp.ok).toBe(false);
  });
  it("tolerates known failures but reports failures in unbaselined suites", () => {
    expect(compareBaseline(summary, { updated: "x", suites: { check: { passing: ["a"] }, search: { passing: ["c"] } } }).ok).toBe(true);
    expect(compareBaseline(summary, null).unbaselinedFailures).toEqual([{ suite: "check", id: "b" }]);
  });
  it("updates only the suites that ran", () => {
    const merged = mergeBaseline({ updated: "old", suites: { agent: { passing: ["z"] }, check: { passing: [] } } }, summary, new Date("2026-11-02"));
    expect(merged).toEqual({ updated: "2026-11-02", suites: { agent: { passing: ["z"] }, check: { passing: ["a"] }, search: { passing: ["c"] } } });
  });
});
