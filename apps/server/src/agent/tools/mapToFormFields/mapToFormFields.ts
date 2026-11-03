import { tool } from "ai";
import { z } from "zod";
import type { FormField, MappingOutput, Pack } from "../../../packs";
import { checkDeductibility } from "../checkDeductibility";
import { factsSchema } from "../checkDeductibility/calculators";

type Facts = Record<string, unknown>;
type Entry = {
  form: string;
  section: string;
  fieldId: string;
  line: string | null;
  lineVerified: boolean;
  labelDe: string;
  labelEn: string;
  unit: FormField["unit"];
  value: number;
  ruleIds: string[];
  note?: string;
};

export type MapToFormFieldsResult =
  | {
      ok: true;
      taxYear: number;
      formStatus: "published" | "pending";
      source: { label: string; url: string };
      entries: Entry[];
      informational: { ruleId: string; note: string }[];
      notMapped: { ruleId: string; reason: string }[];
      missingInfo: { ruleId: string; field: string; description: string }[];
      warnings: string[];
    }
  | { ok: false; code: "no_forms_for_year"; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

function read(path: string, facts: Facts, result: { amount: number | null; breakdown: Record<string, unknown> }): unknown {
  const [root, ...rest] = path.split(".");
  let cur: unknown = root === "facts" ? facts : root === "result" ? result : undefined;
  for (const key of rest) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined;
  return cur;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const lineOrder = (l: string | null) => (l === null ? 9999 : Number(l.split("-")[0]));

/** Turns confirmed deductions into form entries. Amounts are recomputed here from facts; nothing the model typed is trusted. */
export function mapToFormFields(pack: Pack, year: number, items: { ruleId: string; facts: Facts }[]): MapToFormFieldsResult {
  const forms = pack.forms[year];
  if (!forms) return { ok: false, code: "no_forms_for_year", message: `No form mapping for tax year ${year}.` };
  const fields = new Map(forms.fields.map((f) => [f.id, f]));
  const acc = new Map<string, Entry>();
  const informational: { ruleId: string; note: string }[] = [];
  const notMapped: { ruleId: string; reason: string }[] = [];
  const missingInfo: { ruleId: string; field: string; description: string }[] = [];
  const warnings: string[] = [];

  const add = (fieldId: string, value: number, ruleId: string) => {
    if (value <= 0) return;
    const f = fields.get(fieldId)!;
    const e = acc.get(fieldId) ?? { form: f.form, section: f.section, fieldId, line: f.line, lineVerified: f.verification === "verified" && f.line !== null, labelDe: f.labelDe, labelEn: f.labelEn, unit: f.unit, value: 0, ruleIds: [], note: f.note };
    e.value = round2(e.value + value);
    if (!e.ruleIds.includes(ruleId)) e.ruleIds.push(ruleId);
    acc.set(fieldId, e);
  };

  for (const item of items) {
    const check = checkDeductibility(pack, year, item);
    if (!check.ok) { notMapped.push({ ruleId: item.ruleId, reason: `${check.code}: ${check.message}` }); continue; }
    if (check.verdict !== "deductible") {
      notMapped.push({ ruleId: item.ruleId, reason: check.verdict === "not_deductible" ? "not deductible" : "needs review; resolve before it can be entered" });
      for (const m of check.missingInfo) missingInfo.push({ ruleId: item.ruleId, field: m.field, description: m.description });
      continue;
    }
    for (const m of check.missingInfo) missingInfo.push({ ruleId: item.ruleId, field: m.field, description: m.description });
    const mapping = forms.mappings.find((m) => m.ruleId === item.ruleId);
    if (!mapping) { notMapped.push({ ruleId: item.ruleId, reason: "no form mapping in the pack" }); continue; }
    if (mapping.informational) informational.push({ ruleId: item.ruleId, note: mapping.informational });
    const ctx = { amount: check.amount, breakdown: check.breakdown as Record<string, unknown> };
    for (const o of mapping.outputs as MappingOutput[]) {
      let fieldId: string | undefined;
      if ("choose" in o) {
        const chosen = read(o.choose.path, item.facts, ctx);
        fieldId = o.choose.cases.find((c) => c.equals === chosen)?.fieldId;
        if (!fieldId) {
          const name = o.choose.path.replace(/^facts\./, "");
          missingInfo.push({ ruleId: item.ruleId, field: name, description: "Needed to choose the correct form field" });
          continue;
        }
      } else fieldId = o.fieldId;
      const value = num(read(o.from, item.facts, ctx));
      if (value === undefined) continue;
      add(fieldId, value - (o.minus ? (num(read(o.minus, item.facts, ctx)) ?? 0) : 0), item.ruleId);
    }
    const uncapped = num(check.breakdown["uncapped"]);
    const cap = num(check.breakdown["cap"]);
    if (uncapped !== undefined && cap !== undefined && uncapped > cap) warnings.push(`${item.ruleId}: the claim is limited to ${cap}; the tax office applies the cap, check the on-screen limit for the entered values.`);
  }

  const entries = [...acc.values()].sort((a, b) => a.form.localeCompare(b.form) || lineOrder(a.line) - lineOrder(b.line));
  if (forms.status === "pending") warnings.push(`Line numbers for tax year ${year} are not published yet. Use the field labels (labelDe) and re-check once the official form is out.`);
  for (const e of entries) if (forms.status === "published" && !e.lineVerified) warnings.push(`${e.labelDe}: line number not confirmed; find the field by its label.`);

  return { ok: true, taxYear: year, formStatus: forms.status, source: forms.source, entries, informational, notMapped, missingInfo, warnings };
}

export function createMapToFormFieldsTool({ pack, year }: { pack: Pack; year: number }) {
  return tool({
    description:
      "Turn the user's confirmed deductions into tax-return form entries (form, official line, German field label, value) for the current tax year. Pass the same ruleId and facts you gave checkDeductibility; amounts are recomputed, so do not pass amounts. Items that are not clearly deductible are listed in notMapped with the reason. Returns missingInfo (e.g. the means of transport for commute kilometres) to ask the user about, and warnings to relay.",
    inputSchema: z.object({
      items: z.array(z.object({ ruleId: z.string(), facts: factsSchema })).min(1).max(40),
    }),
    execute: async ({ items }) => mapToFormFields(pack, year, items),
  });
}
