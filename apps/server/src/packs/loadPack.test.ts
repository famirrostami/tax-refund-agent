import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack, PackError } from "./loadPack";

const realPacks = resolve(__dirname, "../../../../packs");

const docs = JSON.stringify({ based_on_year: 2025, last_verified: "2026-01-01", notes: "", general: { keep: { id: "k", kind: "document", text: "t", official: false }, upload_steps: [{ text: "s", source: { label: "l", url: "https://example.com" } }] }, by_rule: {} });
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "packs-"));
  await mkdir(join(root, "xx"));
  for (const [name, content] of Object.entries({ "documents.json": docs, ...files })) await writeFile(join(root, "xx", name), content);
  return root;
}
const manifest = JSON.stringify({ country: "xx", name: "X", currency: "EUR", locale: "en", authority: "A", years: [2025] });
const cats = JSON.stringify([{ id: "home_office", labelKey: "k", description: "d", requiredDocs: [], questions: [] }]);

describe("loadPack", () => {
  it("loads the shipped de pack", async () => {
    const pack = await loadPack(realPacks, "de");
    expect(pack.manifest.country).toBe("de");
    expect(pack.categories.map((c) => c.id)).toEqual(["home_office", "work_equipment", "commute", "other"]);
    expect(pack.prompt.length).toBeGreaterThan(0);
  });
  it("loads sourced rules for every supported year and category", async () => {
    const pack = await loadPack(realPacks, "de");
    for (const year of pack.manifest.years) {
      for (const c of pack.categories) {
        expect(pack.rules.some((r) => r.category === c.id && r.tax_years.includes(year)), `${c.id} ${year}`).toBe(true);
      }
    }
    expect(pack.rules.every((r) => r.sources.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.last_verified))).toBe(true);
  });
  it("rejects rules with unknown category, unsupported year or duplicate id", async () => {
    const rule = { id: "xx.a", category: "nope", title: "t", tax_years: [2025], summary: "s", keywords: [], calc: { type: "x" }, conditions: [], sources: [{ label: "l", url: "https://example.com", kind: "statute" }], verification: "verified", last_verified: "2026-01-01", notes: "", open_questions: [] };
    const make = async (rules: object[]) => {
      const root = await fixture({ "pack.json": manifest, "categories.json": cats, "prompt.md": "p" });
      await mkdir(join(root, "xx", "rules"));
      for (const [i, r] of rules.entries()) await writeFile(join(root, "xx", "rules", `${i}.json`), JSON.stringify(r));
      return root;
    };
    await expect(loadPack(await make([rule]), "xx")).rejects.toThrow(/unknown category/);
    await expect(loadPack(await make([{ ...rule, category: "home_office", tax_years: [1999] }]), "xx")).rejects.toThrow(/not supported/);
    await expect(loadPack(await make([{ ...rule, category: "home_office" }, { ...rule, category: "home_office" }]), "xx")).rejects.toThrow(/Duplicate/);
  });
  it("every official checklist item in the de pack carries a source, and every rule with a mapping has been considered", async () => {
    const pack = await loadPack(realPacks, "de");
    const all = [pack.documents.general.keep, ...Object.values(pack.documents.by_rule).flat()];
    expect(all.filter((i) => i.official).every((i) => i.source?.url.startsWith("https://"))).toBe(true);
    expect(all.some((i) => !i.official)).toBe(true);
  });
  it("rejects checklist entries for unknown rules and official items without a source", async () => {
    const make = async (byRule: object) => {
      const root = await fixture({ "pack.json": manifest, "categories.json": cats, "prompt.md": "p", "documents.json": JSON.stringify({ ...JSON.parse(docs), by_rule: byRule }) });
      await mkdir(join(root, "xx", "forms"));
      await writeFile(join(root, "xx", "forms", "est.2025.json"), JSON.stringify({ tax_year: 2025, status: "published", source: { label: "l", url: "https://example.com", kind: "official_guidance" }, last_verified: "2026-01-01", notes: "", fields: [], mappings: [] }));
      return root;
    };
    await expect(loadPack(await make({ "xx.nope": [{ id: "a", kind: "document", text: "t", official: false }] }), "xx")).rejects.toThrow(/unknown rule/);
    await expect(loadPack(await make({ "xx.nope": [{ id: "a", kind: "document", text: "t", official: true }] }), "xx")).rejects.toThrow();
  });
  it("rejects path-traversal country codes", async () => {
    await expect(loadPack(realPacks, "../x")).rejects.toMatchObject({ code: "pack_invalid" });
  });
  it("reports a missing file", async () => {
    const root = await fixture({ "pack.json": manifest });
    await expect(loadPack(root, "xx")).rejects.toMatchObject({ code: "pack_not_found" });
  });
  it("reports schema violations", async () => {
    const root = await fixture({ "pack.json": manifest, "categories.json": "[]", "prompt.md": "p" });
    await expect(loadPack(root, "xx")).rejects.toBeInstanceOf(PackError);
  });
  it("loads a valid fixture", async () => {
    const root = await fixture({ "pack.json": manifest, "categories.json": cats, "prompt.md": "p" });
    await mkdir(join(root, "xx", "forms"));
    await writeFile(join(root, "xx", "forms", "est.2025.json"), JSON.stringify({ tax_year: 2025, status: "published", source: { label: "l", url: "https://example.com", kind: "official_guidance" }, last_verified: "2026-01-01", notes: "", fields: [], mappings: [] }));
    expect((await loadPack(root, "xx")).prompt).toBe("p");
  });
});

describe("forms validation", () => {
  const rule = (id: string) => ({ id, category: "home_office", title: "t", tax_years: [2025], summary: "s", keywords: [], calc: { type: "x" }, conditions: [], sources: [{ label: "l", url: "https://example.com", kind: "statute" }], verification: "verified", last_verified: "2026-01-01", notes: "", open_questions: [] });
  const field = { id: "f1", form: "Anlage N", section: "s", line: "5", labelDe: "d", labelEn: "e", unit: "EUR", verification: "verified" };
  const forms = (mappings: object[], extra: object = {}) => JSON.stringify({ tax_year: 2025, status: "published", source: { label: "l", url: "https://example.com", kind: "official_guidance" }, last_verified: "2026-01-01", notes: "", fields: [field], mappings, ...extra });
  async function make(formsJson: string | null) {
    const root = await fixture({ "pack.json": manifest, "categories.json": cats, "prompt.md": "p" });
    await mkdir(join(root, "xx", "rules"));
    await writeFile(join(root, "xx", "rules", "a.json"), JSON.stringify(rule("xx.a")));
    if (formsJson) { await mkdir(join(root, "xx", "forms")); await writeFile(join(root, "xx", "forms", "est.2025.json"), formsJson); }
    return root;
  }
  const good = [{ ruleId: "xx.a", outputs: [{ fieldId: "f1", from: "result.amount" }] }];

  it("loads a valid mapping and the shipped de pack resolves 2026 labels without lines", async () => {
    expect((await loadPack(await make(forms(good)), "xx")).forms[2025]!.status).toBe("published");
    const de = await loadPack(realPacks, "de");
    expect(de.forms[2026]!.fields.every((f) => f.line === null)).toBe(true);
    expect(de.forms[2025]!.fields.find((f) => f.id === "commute_days")!.line).toBe("34");
  });
  it("requires forms for every supported year", async () => {
    await expect(loadPack(await make(null), "xx")).rejects.toThrow(/No form mapping for supported tax year 2025/);
  });
  it("rejects mappings to unknown rules or fields and rules without a mapping", async () => {
    await expect(loadPack(await make(forms([{ ruleId: "xx.zzz", outputs: [{ fieldId: "f1", from: "result.amount" }] }])), "xx")).rejects.toThrow(/unknown rule/);
    await expect(loadPack(await make(forms([{ ruleId: "xx.a", outputs: [{ fieldId: "nope", from: "result.amount" }] }])), "xx")).rejects.toThrow(/unknown field/);
    await expect(loadPack(await make(forms([])), "xx")).rejects.toThrow(/without a mapping/);
  });
  it("rejects malformed line numbers", async () => {
    await expect(loadPack(await make(forms(good, { fields: [{ ...field, line: "line five" }] })), "xx")).rejects.toThrow(/Invalid pack file/);
  });
});
