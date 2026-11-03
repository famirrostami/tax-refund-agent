import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../../../packs";
import { calculators, type CalcContext } from "./index";

const pack = await loadPack(resolve(__dirname, "../../../../../../../packs"), "de");
const ctx = (id: string, year = 2025): CalcContext => ({ rule: pack.rules.find((r) => r.id === id)!, rules: pack.rules, year });
const run = (id: string, facts: Record<string, unknown>, year = 2025) => {
  const c = ctx(id, year);
  return calculators[c.rule.calc.type]!(facts, c) as any;
};

describe("home office day rate", () => {
  const id = "de.home_office.tagespauschale";
  it("multiplies days by the rate", () => expect(run(id, { days: 120 })).toMatchObject({ verdict: "deductible", amount: 720 }));
  it("caps at the yearly maximum", () => expect(run(id, { days: 250 }).amount).toBe(1260));
  it("is excluded when a work room is claimed", () => expect(run(id, { days: 100, arbeitszimmerClaimed: true })).toMatchObject({ verdict: "not_deductible", amount: 0 }));
  it("asks for the days when unknown", () => expect(run(id, {})).toMatchObject({ verdict: "needs_review", amount: null, missingInfo: [{ field: "days" }] }));
  it("rejects impossible values", () => {
    expect(run(id, { days: 400 })).toHaveProperty("invalid");
    expect(run(id, { days: 10, daysAlsoAtFirstWorkplace: 11 })).toHaveProperty("invalid");
  });
});

describe("commute", () => {
  it("2026: flat 0.38 per km from the first km", () => {
    expect(run("de.commute.entfernungspauschale.2026", { oneWayKm: 30, workingDays: 200 }, 2026)).toMatchObject({ amount: 2280 });
  });
  it("2025: 0.30 for the first 20 km, 0.38 from the 21st", () => {
    // (20*0.30 + 10*0.38) * 200 = 9.8 * 200 = 1960
    expect(run("de.commute.entfernungspauschale.2025", { oneWayKm: 30, workingDays: 200 }).amount).toBe(1960);
  });
  it("uses full kilometres only", () => {
    expect(run("de.commute.entfernungspauschale.2026", { oneWayKm: 10.9, workingDays: 10 }, 2026).amount).toBe(38);
  });
  it("applies the cap, and asks about a car when over it", () => {
    const r = run("de.commute.entfernungspauschale.2026", { oneWayKm: 100, workingDays: 220 }, 2026);
    expect(r.amount).toBe(4500);
    expect(r.missingInfo[0].field).toBe("usesOwnOrProvidedCar");
  });
  it("does not cap when a car is used", () => {
    expect(run("de.commute.entfernungspauschale.2026", { oneWayKm: 100, workingDays: 220, usesOwnOrProvidedCar: true }, 2026).amount).toBe(8360);
  });
  it("asks for missing facts", () => {
    expect(run("de.commute.entfernungspauschale.2026", { oneWayKm: 5 }, 2026).missingInfo.map((m: any) => m.field)).toEqual(["workingDays"]);
  });
});

describe("work equipment", () => {
  const id = "de.work_equipment.arbeitsmittel";
  it("deducts the work share immediately within the limit", () => {
    expect(run(id, { grossAmount: 500, workUsePercent: 80 })).toMatchObject({ verdict: "deductible", amount: 400 });
  });
  it("treats a computer above the limit via the one-year useful life", () => {
    const r = run(id, { grossAmount: 1500, workUsePercent: 100, isComputerOrSoftware: true });
    expect(r).toMatchObject({ verdict: "deductible", amount: 1500 });
    expect(r.breakdown.usefulLifeRule).toBe("de.work_equipment.computer_nutzungsdauer");
  });
  it("measures the limit without VAT: gross 900 at 19% is 756 net, so it is deductible at once", () => {
    const r = run(id, { grossAmount: 900, workUsePercent: 100, isComputerOrSoftware: false, vatRatePercent: 19 });
    expect(r).toMatchObject({ verdict: "deductible", amount: 900 });
    expect(r.breakdown.netAmount).toBe(756.3);
  });
  it("needs depreciation when the net price is above the limit", () => {
    expect(run(id, { grossAmount: 1000, workUsePercent: 100, isComputerOrSoftware: false, vatRatePercent: 19 })).toMatchObject({ verdict: "needs_review", amount: null });
  });
  it("requires depreciation for expensive non-computers", () => {
    const r = run(id, { grossAmount: 2400, workUsePercent: 100, isComputerOrSoftware: false, vatRatePercent: 19 });
    expect(r).toMatchObject({ verdict: "needs_review", amount: null });
  });
  it("asks what it needs, in order", () => {
    expect(run(id, {}).missingInfo.map((m: any) => m.field)).toEqual(["grossAmount", "workUsePercent"]);
    expect(run(id, { grossAmount: 1000, workUsePercent: 100 }).missingInfo[0].field).toBe("isComputerOrSoftware");
    expect(run(id, { grossAmount: 1000, workUsePercent: 100, isComputerOrSoftware: false }).missingInfo[0].field).toBe("vatRatePercent");
  });
  it("rejects purely private use", () => expect(run(id, { grossAmount: 500, workUsePercent: 0 }).verdict).toBe("not_deductible"));
});

describe("work room flat amount", () => {
  const id = "de.home_office.arbeitszimmer_jahrespauschale";
  it("reduces by month and requires confirmation of the conditions", () => {
    expect(run(id, { qualifyingMonths: 6 })).toMatchObject({ verdict: "needs_review", amount: 630 });
    expect(run(id, { qualifyingMonths: 12, conditionsConfirmed: true })).toMatchObject({ verdict: "deductible", amount: 1260 });
  });
});

describe("donations", () => {
  const id = "de.other.spenden";
  it("caps at a percentage of total income", () => {
    expect(run(id, { donationAmount: 5000, totalIncome: 20000, recipientEligible: true })).toMatchObject({ verdict: "deductible", amount: 4000 });
    expect(run(id, { donationAmount: 300, totalIncome: 20000, recipientEligible: true }).amount).toBe(300);
  });
  it("is not deductible for ineligible recipients and asks for missing info", () => {
    expect(run(id, { donationAmount: 100, recipientEligible: false }).verdict).toBe("not_deductible");
    expect(run(id, { donationAmount: 100 }).missingInfo.map((m: any) => m.field)).toEqual(["recipientEligible", "totalIncome"]);
  });
});

describe("allowances", () => {
  it("only the excess over the standard allowance helps", () => {
    expect(run("de.general.arbeitnehmer_pauschbetrag", { totalWerbungskosten: 1500 })).toMatchObject({ verdict: "deductible", amount: 270 });
    expect(run("de.general.arbeitnehmer_pauschbetrag", { totalWerbungskosten: 900 })).toMatchObject({ verdict: "not_deductible", amount: 0 });
  });
  it("union dues count in full on top (2026)", () => {
    expect(run("de.other.gewerkschaftsbeitraege.2026", { amount: 240 }, 2026)).toMatchObject({ verdict: "deductible", amount: 240 });
  });
});
