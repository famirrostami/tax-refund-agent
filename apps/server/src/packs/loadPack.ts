import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ZodType } from "zod";
import { categoriesSchema, manifestSchema, ruleSchema, yearFormsSchema, documentsSchema, type Category, type Documents, type Manifest, type Rule, type YearForms } from "./schema";

export type Pack = { manifest: Manifest; categories: Category[]; rules: Rule[]; forms: Record<number, YearForms>; documents: Documents; prompt: string; dir: string };

export class PackError extends Error {
  constructor(public readonly code: "pack_not_found" | "pack_invalid", message: string) {
    super(message);
  }
}

async function readJson<T>(file: string, schema: ZodType<T>): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new PackError("pack_not_found", `Missing pack file: ${file}`);
  }
  try {
    return schema.parse(JSON.parse(raw));
  } catch (e) {
    throw new PackError("pack_invalid", `Invalid pack file ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadPack(packsDir: string, country: string): Promise<Pack> {
  if (!/^[a-z]{2}$/.test(country)) throw new PackError("pack_invalid", `Bad country code: ${country}`);
  const dir = join(packsDir, country);
  const manifest = await readJson(join(dir, "pack.json"), manifestSchema);
  if (manifest.country !== country) {
    throw new PackError("pack_invalid", `pack.json country "${manifest.country}" does not match folder "${country}"`);
  }
  const categories = await readJson(join(dir, "categories.json"), categoriesSchema);
  const rules = await loadRules(join(dir, "rules"), manifest.years, new Set(categories.map((c) => c.id)));
  const forms = await loadForms(join(dir, "forms"), manifest.years, rules);
  const documents = await readJson(join(dir, "documents.json"), documentsSchema);
  const knownRules = new Set(rules.map((r) => r.id));
  for (const [ruleId, items] of Object.entries(documents.by_rule)) {
    if (!knownRules.has(ruleId)) throw new PackError("pack_invalid", `documents.json: unknown rule ${ruleId}`);
    const ids = items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) throw new PackError("pack_invalid", `documents.json: duplicate item ids for ${ruleId}`);
  }
  let prompt: string;
  try {
    prompt = await readFile(join(dir, "prompt.md"), "utf8");
  } catch {
    throw new PackError("pack_not_found", `Missing pack file: ${join(dir, "prompt.md")}`);
  }
  return { manifest, categories, rules, forms, documents, prompt, dir };
}

async function loadRules(dir: string, years: number[], categoryIds: Set<string>): Promise<Rule[]> {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  const rules: Rule[] = [];
  for (const f of files) rules.push(await readJson(join(dir, f), ruleSchema));
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) throw new PackError("pack_invalid", `Duplicate rule id: ${r.id}`);
    seen.add(r.id);
    if (!categoryIds.has(r.category)) throw new PackError("pack_invalid", `Rule ${r.id}: unknown category "${r.category}"`);
    const bad = r.tax_years.filter((y) => !years.includes(y));
    if (bad.length) throw new PackError("pack_invalid", `Rule ${r.id}: tax year(s) ${bad.join(", ")} not supported by the pack`);
  }
  return rules;
}

async function loadForms(dir: string, years: number[], rules: Rule[]): Promise<Record<number, YearForms>> {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  const raw = new Map<number, ReturnType<typeof yearFormsSchema.parse>>();
  for (const f of files) {
    const y = await readJson(join(dir, f), yearFormsSchema);
    if (raw.has(y.tax_year)) throw new PackError("pack_invalid", `Duplicate forms for tax year ${y.tax_year}`);
    raw.set(y.tax_year, y);
  }
  const ruleIds = new Set(rules.map((r) => r.id));
  const out: Record<number, YearForms> = {};
  for (const year of years) {
    const y = raw.get(year);
    if (!y) throw new PackError("pack_invalid", `No form mapping for supported tax year ${year}`);
    const base = y.extends !== undefined ? raw.get(y.extends) : y;
    if (!base?.fields || !base.mappings) throw new PackError("pack_invalid", `Forms ${year}: cannot resolve fields (extends ${y.extends})`);
    // A pending year inherits labels but never line numbers: they are not published yet.
    const fields = y.extends !== undefined
      ? base.fields.map((fld) => ({ ...fld, line: null, verification: "unverified" as const }))
      : base.fields;
    const fieldIds = new Set(fields.map((fld) => fld.id));
    if (fieldIds.size !== fields.length) throw new PackError("pack_invalid", `Forms ${year}: duplicate field ids`);
    for (const m of base.mappings) {
      if (!ruleIds.has(m.ruleId)) throw new PackError("pack_invalid", `Forms ${year}: mapping for unknown rule ${m.ruleId}`);
      for (const o of m.outputs) {
        const targets = "choose" in o ? o.choose.cases.map((c) => c.fieldId) : [o.fieldId];
        for (const t of targets) if (!fieldIds.has(t)) throw new PackError("pack_invalid", `Forms ${year}: rule ${m.ruleId} maps to unknown field ${t}`);
      }
    }
    const yearRules = rules.filter((r) => r.tax_years.includes(year));
    const unmapped = yearRules.filter((r) => !base.mappings!.some((m) => m.ruleId === r.id));
    if (unmapped.length) throw new PackError("pack_invalid", `Forms ${year}: rules without a mapping: ${unmapped.map((r) => r.id).join(", ")}`);
    out[year] = { taxYear: year, status: y.status, source: y.source, notes: y.notes, fields, mappings: base.mappings };
  }
  return out;
}
