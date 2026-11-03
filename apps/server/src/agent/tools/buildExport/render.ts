import type { Checklist } from "../buildChecklist";
import type { MapToFormFieldsResult } from "../mapToFormFields";

type Mapped = Extract<MapToFormFieldsResult, { ok: true }>;
export type ExportData = {
  country: string;
  taxYear: number;
  generatedAt: string;
  mapping: Mapped;
  checklist: Checklist;
  rules: { ruleId: string; title: string; verification: string; sources: { label: string; url: string }[] }[];
  documents: { fileId: string; ruleId: string; folder: string }[];
};

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const unit = (u: string) => (u === "EUR" ? "EUR" : u);

export function renderCsv(d: ExportData): string {
  const head = ["form", "line", "line_verified", "label_de", "label_en", "value", "unit", "rules"];
  const rows = d.mapping.entries.map((e) => [e.form, e.line ?? "", e.lineVerified, e.labelDe, e.labelEn, e.value, e.unit, e.ruleIds.join(" ")]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function renderMarkdown(d: ExportData): string {
  const m = d.mapping;
  const out: string[] = [];
  out.push(`# Tax return summary ${d.taxYear} (${d.country})`, "", `Generated ${d.generatedAt}. This is a helper for filling in your own return; it is **not tax advice** and nothing has been sent to any tax authority.`, "");
  if (m.formStatus === "pending") out.push(`> The official form for ${d.taxYear} is not published yet. Line numbers are left out; use the German field labels and re-check once the form is out.`, "");
  out.push("## Entries for the tax return", "");
  if (m.entries.length === 0) out.push("_Nothing to enter yet._", "");
  let form = "";
  for (const e of m.entries) {
    if (e.form !== form) {
      form = e.form;
      out.push(`### ${form}`, "", "| Line | Field (German) | Value | Based on |", "|---|---|---|---|");
    }
    out.push(`| ${e.line ?? "–"}${e.line && !e.lineVerified ? " (unconfirmed)" : ""} | ${e.labelDe} | ${e.value} ${unit(e.unit)} | ${e.ruleIds.join(", ")} |`);
  }
  if (m.entries.length) out.push("");
  if (m.informational.length) { out.push("## Nothing to enter", "", ...m.informational.map((i) => `- ${i.note}`), ""); }
  if (m.notMapped.length) { out.push("## Not included (needs your attention)", "", ...m.notMapped.map((n) => `- ${n.ruleId}: ${n.reason}`), ""); }
  if (m.warnings.length) { out.push("## Warnings", "", ...m.warnings.map((w) => `- ${w}`), ""); }
  out.push("## Documents", "", `- ${d.checklist.keep.text}`, "", "How to upload (Mein ELSTER):", ...d.checklist.uploadSteps.map((s, i) => `${i + 1}. ${s.text}`), "");
  for (const r of d.checklist.perRule) {
    out.push(`**${r.title}**`, "");
    for (const i of r.items) out.push(`- [${i.status === "have" ? "x" : " "}] ${i.text}${i.official ? "" : " _(recommended, not required by ELSTER)_"}`);
    out.push("");
  }
  if (d.documents.length) out.push("Your documents were copied into the `belege/` folder, sorted by form field.", "");
  out.push("## Rules and sources", "", ...d.rules.flatMap((r) => [`- **${r.title}** (${r.ruleId}, ${r.verification})`, ...r.sources.map((s) => `  - ${s.label}: ${s.url}`)]), "", `Sources for the line numbers: ${m.source.label} (${m.source.url}). Always compare each line with the field label on screen.`, "");
  return out.join("\n");
}

export function renderJson(d: ExportData): string {
  return JSON.stringify({ country: d.country, taxYear: d.taxYear, generatedAt: d.generatedAt, formStatus: d.mapping.formStatus, entries: d.mapping.entries, notMapped: d.mapping.notMapped, warnings: d.mapping.warnings, checklist: d.checklist, rules: d.rules, documents: d.documents }, null, 2) + "\n";
}
