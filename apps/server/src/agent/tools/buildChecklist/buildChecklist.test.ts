import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../../packs";
import { buildChecklist, createBuildChecklistTool } from "./buildChecklist";

const pack = await loadPack(resolve(__dirname, "../../../../../../packs"), "de");

describe("buildChecklist", () => {
  it("lists items per rule with status from the `have` ids only", () => {
    const c = buildChecklist(pack, 2025, { ruleIds: ["de.other.spenden", "de.work_equipment.arbeitsmittel"], have: ["donation_receipt"] });
    const donation = c.perRule.find((r) => r.ruleId === "de.other.spenden")!;
    expect(donation.items.find((i) => i.id === "donation_receipt")!.status).toBe("have");
    expect(donation.items.find((i) => i.id === "donation_retention")!.status).toBe("missing");
    expect(c.missingCount).toBe(donation.items.length - 1 + c.perRule[1]!.items.length);
  });
  it("separates official requirements from recommendations, and every official item has a source", () => {
    const c = buildChecklist(pack, 2025, { ruleIds: ["de.work_equipment.arbeitsmittel"] });
    const items = c.perRule[0]!.items;
    expect(items.find((i) => i.id === "equipment_invoice")).toMatchObject({ official: false });
    expect(items.filter((i) => i.official).every((i) => i.source?.url)).toBe(true);
  });
  it("includes the official upload steps and the keep-receipts rule", () => {
    const c = buildChecklist(pack, 2025, { ruleIds: ["de.home_office.tagespauschale"] });
    expect(c.uploadSteps.map((s) => s.text).join(" ")).toMatch(/Meine Belege/);
    expect(c.uploadSteps.map((s) => s.text).join(" ")).toMatch(/Belegnachreichung/);
    expect(c.keep.official).toBe(true);
  });
  it("skips unknown rules, rules from another year, and dedupes", () => {
    const c = buildChecklist(pack, 2025, { ruleIds: ["nope", "de.other.gewerkschaftsbeitraege.2026", "de.other.spenden", "de.other.spenden"] });
    expect(c.skipped.map((s) => s.reason)).toEqual(["unknown rule", "rule does not apply to tax year 2025"]);
    expect(c.perRule).toHaveLength(1);
  });
  it("warns when the guidance is from an earlier year", () => {
    expect(buildChecklist(pack, 2026, { ruleIds: ["de.home_office.tagespauschale"] }).warnings.join(" ")).toMatch(/2025 ELSTER instructions/);
    expect(buildChecklist(pack, 2025, { ruleIds: ["de.home_office.tagespauschale"] }).warnings).toEqual([]);
  });
  it("has checklist data for every rule that can produce a form entry", () => {
    const mapped = pack.forms[2025]!.mappings.filter((m) => m.outputs.length > 0).map((m) => m.ruleId);
    const withItems = mapped.filter((id) => (pack.documents.by_rule[id] ?? []).length > 0);
    expect(mapped.filter((id) => !withItems.includes(id))).toEqual(["de.general.arbeitnehmer_pauschbetrag"].filter(() => false));
  });
  it("is exposed as a tool", async () => {
    const t = createBuildChecklistTool({ pack, year: 2025 });
    const out = (await t.execute!({ ruleIds: ["de.other.spenden"] } as never, { toolCallId: "1", messages: [] } as never)) as any;
    expect(out.ok).toBe(true);
  });
});
