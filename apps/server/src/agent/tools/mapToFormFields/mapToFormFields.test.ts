import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../../packs";
import { createMapToFormFieldsTool, mapToFormFields } from "./mapToFormFields";

const pack = await loadPack(resolve(__dirname, "../../../../../../packs"), "de");
const H = "de.home_office.tagespauschale";
const EQ = "de.work_equipment.arbeitsmittel";
const ok = (r: ReturnType<typeof mapToFormFields>) => {
  if (!r.ok) throw new Error("expected ok");
  return r;
};
const entry = (r: ReturnType<typeof mapToFormFields>, id: string) => ok(r).entries.find((e) => e.fieldId === id);

describe("mapToFormFields 2025 (published)", () => {
  const items = [
    { ruleId: H, facts: { days: 100, daysAlsoAtFirstWorkplace: 20, arbeitszimmerClaimed: false } },
    { ruleId: "de.commute.entfernungspauschale.2025", facts: { oneWayKm: 30, workingDays: 150, usesOwnOrProvidedCar: true } },
    { ruleId: EQ, facts: { grossAmount: 1500, workUsePercent: 100, isComputerOrSoftware: true } },
    { ruleId: EQ, facts: { grossAmount: 200, workUsePercent: 50 } },
    { ruleId: "de.other.spenden", facts: { donationAmount: 300, totalIncome: 40000, recipientEligible: true } },
    { ruleId: "de.general.arbeitnehmer_pauschbetrag", facts: { totalWerbungskosten: 3000 } },
  ];
  const r = ok(mapToFormFields(pack, 2025, items));

  it("maps each deduction to the official ELSTER line", () => {
    expect(entry(r, "home_office_days")).toMatchObject({ form: "Anlage N", line: "53", value: 80, unit: "days", lineVerified: true });
    expect(entry(r, "home_office_days_both")).toMatchObject({ line: "54", value: 20 });
    expect(entry(r, "commute_days")).toMatchObject({ line: "34", value: 150 });
    expect(entry(r, "commute_km_car")).toMatchObject({ line: "36", value: 30 });
    expect(entry(r, "donations_amount")).toMatchObject({ form: "Anlage Sonderausgaben", line: "5", value: 300 });
  });
  it("adds up several items that land in the same field and records their rules", () => {
    expect(entry(r, "work_equipment_amount")).toMatchObject({ line: "49-51", value: 1600, ruleIds: [EQ] });
  });
  it("lists informational rules instead of inventing an entry", () => {
    expect(r.informational.map((i) => i.ruleId)).toEqual(["de.general.arbeitnehmer_pauschbetrag"]);
    expect(r.entries.some((e) => e.ruleIds.includes("de.general.arbeitnehmer_pauschbetrag"))).toBe(false);
  });
  it("sorts by form and line", () => {
    expect(r.entries.map((e) => `${e.form}:${e.line}`)).toEqual(["Anlage N:34", "Anlage N:36", "Anlage N:49-51", "Anlage N:53", "Anlage N:54", "Anlage Sonderausgaben:5"]);
  });
  it("has no warnings when everything is confirmed", () => expect(r.warnings).toEqual([]));
});

describe("mapToFormFields edge cases", () => {
  it("does not map items that are not clearly deductible, and says why", () => {
    const r = ok(mapToFormFields(pack, 2025, [
      { ruleId: EQ, facts: { grossAmount: 2400, workUsePercent: 100, isComputerOrSoftware: false, vatRatePercent: 19 } },
      { ruleId: EQ, facts: { grossAmount: 500, workUsePercent: 0 } },
      { ruleId: H, facts: {} },
    ]));
    expect(r.entries).toEqual([]);
    expect(r.notMapped.map((n) => n.reason)).toEqual(["needs review; resolve before it can be entered", "not deductible", "needs review; resolve before it can be entered"]);
    expect(r.missingInfo.map((m) => m.field)).toContain("days");
  });
  it("refuses rules from another year and unknown rules via notMapped", () => {
    const r = ok(mapToFormFields(pack, 2025, [{ ruleId: "de.commute.entfernungspauschale.2026", facts: { oneWayKm: 5, workingDays: 5 } }, { ruleId: "nope", facts: {} }]));
    expect(r.notMapped.map((n) => n.reason.split(":")[0])).toEqual(["rule_not_for_year", "rule_not_found"]);
  });
  it("asks for the means of transport instead of guessing the commute field", () => {
    const r = ok(mapToFormFields(pack, 2025, [{ ruleId: "de.commute.entfernungspauschale.2025", facts: { oneWayKm: 30, workingDays: 150 } }]));
    expect(entry(r, "commute_days")?.value).toBe(150);
    expect(r.entries.some((e) => e.fieldId.startsWith("commute_km"))).toBe(false);
    expect(r.missingInfo).toEqual([{ ruleId: "de.commute.entfernungspauschale.2025", field: "usesOwnOrProvidedCar", description: expect.any(String) }]);
  });
  it("places other means of transport in the other-kilometres field", () => {
    const r = mapToFormFields(pack, 2025, [{ ruleId: "de.commute.entfernungspauschale.2025", facts: { oneWayKm: 12, workingDays: 100, usesOwnOrProvidedCar: false } }]);
    expect(entry(r, "commute_km_other")).toMatchObject({ line: "37-38", value: 12 });
  });
  it("warns when a cap applied", () => {
    const r = ok(mapToFormFields(pack, 2025, [{ ruleId: H, facts: { days: 250, arbeitszimmerClaimed: false } }]));
    expect(r.warnings.join(" ")).toMatch(/limited to 1260/);
  });
  it("flags a field whose line number is not confirmed", () => {
    const r = ok(mapToFormFields(pack, 2026, [{ ruleId: "de.other.gewerkschaftsbeitraege.2026", facts: { amount: 240 } }]));
    expect(entry(r, "union_dues_amount")).toMatchObject({ line: null, lineVerified: false, value: 240 });
  });
});

describe("mapToFormFields 2026 (form not published)", () => {
  it("withholds line numbers and warns, but keeps the field labels", () => {
    const r = ok(mapToFormFields(pack, 2026, [{ ruleId: H, facts: { days: 100, arbeitszimmerClaimed: false } }]));
    expect(r.formStatus).toBe("pending");
    expect(entry(r, "home_office_days")).toMatchObject({ line: null, lineVerified: false, labelDe: expect.stringContaining("Tage") });
    expect(r.warnings.join(" ")).toMatch(/not published yet/);
  });
});

describe("tool", () => {
  it("recomputes amounts from facts and ignores any amount the model might add", async () => {
    const t = createMapToFormFieldsTool({ pack, year: 2025 });
    const out = (await t.execute!({ items: [{ ruleId: "de.other.spenden", facts: { donationAmount: 300, totalIncome: 40000, recipientEligible: true, amount: 99999 } }] } as never, { toolCallId: "1", messages: [] } as never)) as any;
    expect(out.entries[0].value).toBe(300);
  });
});
