import { tool } from "ai";
import { z } from "zod";
import type { ExportStore } from "../../../exports";
import { FileStoreError, type FileStore } from "../../../files";
import type { Pack } from "../../../packs";
import { factsSchema } from "../checkDeductibility/calculators";
import { buildChecklist } from "../buildChecklist";
import { mapToFormFields } from "../mapToFormFields";
import { renderCsv, renderJson, renderMarkdown, type ExportData } from "./render";

export const exportInput = z.object({
  items: z.array(z.object({ ruleId: z.string(), facts: factsSchema })).min(1).max(40),
  have: z.array(z.string()).max(100).optional(),
  documents: z.array(z.object({ fileId: z.string(), ruleId: z.string() })).max(60).optional().describe("Uploaded files to include, each with the rule it supports"),
});

export type BuildExportResult =
  | { ok: true; exportId: string; files: string[]; entryCount: number; documentCount: number; notMappedCount: number; warnings: string[] }
  | { ok: false; code: "nothing_to_export" | "no_forms_for_year"; message: string };

export async function buildExport(
  deps: { pack: Pack; year: number; files: Pick<FileStore, "read">; exports: ExportStore; now?: Date },
  input: z.infer<typeof exportInput>,
): Promise<BuildExportResult> {
  const { pack, year, files, exports } = deps;
  const mapping = mapToFormFields(pack, year, input.items);
  if (!mapping.ok) return mapping;
  if (mapping.entries.length === 0 && mapping.notMapped.length === 0) return { ok: false, code: "nothing_to_export", message: "No deductions to export." };

  const checklist = buildChecklist(pack, year, { ruleIds: input.items.map((i) => i.ruleId), have: input.have });
  const extra: string[] = [];
  const copies: { path: string; content: Uint8Array }[] = [];
  const documents: ExportData["documents"] = [];
  const counters = new Map<string, number>();
  for (const doc of input.documents ?? []) {
    const entry = mapping.entries.find((e) => e.ruleIds.includes(doc.ruleId));
    try {
      const file = await files.read(doc.fileId);
      const folder = entry ? `belege/${entry.form === "Anlage N" ? "anlage_n" : "sonderausgaben"}_${entry.fieldId}` : "belege/unassigned";
      const n = (counters.get(folder) ?? 0) + 1;
      counters.set(folder, n);
      const path = `${folder}/${String(n).padStart(2, "0")}-${doc.fileId}`;
      copies.push({ path, content: file.bytes });
      documents.push({ fileId: doc.fileId, ruleId: doc.ruleId, folder });
    } catch (e) {
      if (!(e instanceof FileStoreError)) throw e;
      extra.push(`Document ${doc.fileId} was not found and was left out.`);
    }
  }

  const data: ExportData = {
    country: pack.manifest.name,
    taxYear: year,
    generatedAt: (deps.now ?? new Date()).toISOString(),
    mapping: { ...mapping, warnings: [...mapping.warnings, ...extra] },
    checklist,
    rules: [...new Set(input.items.map((i) => i.ruleId))].flatMap((id) => {
      const r = pack.rules.find((x) => x.id === id);
      return r ? [{ ruleId: r.id, title: r.title, verification: r.verification, sources: r.sources.map((s) => ({ label: s.label, url: s.url })) }] : [];
    }),
    documents,
  };
  const { exportId } = await exports.save(
    { files: [{ path: "summary.md", content: renderMarkdown(data) }, { path: "entries.csv", content: renderCsv(data) }, { path: "export.json", content: renderJson(data) }, ...copies] },
    deps.now,
  );
  return { ok: true, exportId, files: ["summary.md", "entries.csv", "export.json"], entryCount: mapping.entries.length, documentCount: copies.length, notMappedCount: mapping.notMapped.length, warnings: data.mapping.warnings };
}

export function createBuildExportTool(deps: { pack: Pack; year: number; files: Pick<FileStore, "read">; exports: ExportStore }) {
  return tool({
    description:
      "Create the final export folder (summary, CSV, JSON and the user's documents sorted by form field) for the current tax year. This writes files, so the user must approve the call in the UI first. Pass the same rule ids and facts as before, the checklist item ids the user already has in `have`, and the uploaded files with the rule each supports. Nothing is ever sent to a tax authority.",
    inputSchema: exportInput,
    needsApproval: true,
    execute: async (input) => buildExport(deps, input),
  });
}
