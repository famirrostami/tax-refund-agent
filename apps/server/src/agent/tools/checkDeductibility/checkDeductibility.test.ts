import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../../packs";
import { checkDeductibility, createCheckDeductibilityTool } from "./checkDeductibility";

const pack = await loadPack(resolve(__dirname, "../../../../../../packs"), "de");

describe("checkDeductibility", () => {
  it("returns a cited, typed verdict", () => {
    const r = checkDeductibility(pack, 2025, { ruleId: "de.home_office.tagespauschale", facts: { days: 100, arbeitszimmerClaimed: false } });
    expect(r).toMatchObject({ ok: true, verdict: "deductible", amount: 600, currency: "EUR", taxYear: 2025, confidence: "high", missingInfo: [] });
    if (r.ok) expect(r.sources[0]!.url).toMatch(/^https:\/\//);
  });
  it("lowers confidence for partially verified rules and surfaces open questions", () => {
    const partial = { ...pack, rules: pack.rules.map((r) => (r.id === "de.work_equipment.arbeitsmittel" ? { ...r, verification: "partial" as const } : r)) };
    const r = checkDeductibility(partial, 2025, { ruleId: "de.work_equipment.arbeitsmittel", facts: { grossAmount: 300, workUsePercent: 100 } });
    expect(r).toMatchObject({ ok: true, confidence: "medium" });
    if (r.ok) expect(r.caveats.length).toBeGreaterThan(0);
  });
  it("forces needs_review for unresolved rules", () => {
    const unresolved = { ...pack, rules: pack.rules.map((r) => (r.id === "de.home_office.tagespauschale" ? { ...r, verification: "unresolved" as const } : r)) };
    expect(checkDeductibility(unresolved, 2025, { ruleId: "de.home_office.tagespauschale", facts: { days: 10, arbeitszimmerClaimed: false } })).toMatchObject({ verdict: "needs_review", confidence: "low" });
  });
  it("lowers confidence to low when information is missing", () => {
    const r = checkDeductibility(pack, 2025, { ruleId: "de.home_office.tagespauschale", facts: {} });
    expect(r).toMatchObject({ ok: true, verdict: "needs_review", amount: null, confidence: "low" });
  });
  it("refuses unknown rules, wrong years, supporting rules and bad facts", () => {
    expect(checkDeductibility(pack, 2025, { ruleId: "nope", facts: {} })).toMatchObject({ ok: false, code: "rule_not_found" });
    expect(checkDeductibility(pack, 2025, { ruleId: "de.commute.entfernungspauschale.2026", facts: {} })).toMatchObject({ ok: false, code: "rule_not_for_year" });
    expect(checkDeductibility(pack, 2025, { ruleId: "de.work_equipment.computer_nutzungsdauer", facts: {} })).toMatchObject({ ok: false, code: "no_calculator" });
    expect(checkDeductibility(pack, 2025, { ruleId: "de.home_office.tagespauschale", facts: { days: "many" } })).toMatchObject({ ok: false, code: "invalid_facts" });
  });
  it("uses the year-specific commute figures", () => {
    const facts = { oneWayKm: 30, workingDays: 200 };
    expect(checkDeductibility(pack, 2025, { ruleId: "de.commute.entfernungspauschale.2025", facts })).toMatchObject({ amount: 1960 });
    expect(checkDeductibility(pack, 2026, { ruleId: "de.commute.entfernungspauschale.2026", facts })).toMatchObject({ amount: 2280 });
  });
  it("is exposed as a tool bound to the session's tax year", async () => {
    const t = createCheckDeductibilityTool({ pack, year: 2026 });
    const out = (await t.execute!({ ruleId: "de.commute.entfernungspauschale.2025", facts: {} }, { toolCallId: "1", messages: [] } as never)) as any;
    expect(out.code).toBe("rule_not_for_year");
  });
});
