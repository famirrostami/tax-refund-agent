import { tool } from "ai";
import { z } from "zod";
import type { DocItem, Pack } from "../../../packs";

export type ChecklistItem = DocItem & { status: "have" | "missing" };
export type Checklist = {
  taxYear: number;
  keep: DocItem;
  uploadSteps: { text: string; source: { label: string; url: string } }[];
  perRule: { ruleId: string; title: string; items: ChecklistItem[] }[];
  skipped: { ruleId: string; reason: string }[];
  missingCount: number;
  warnings: string[];
};

/** Pure: what the user has to know, keep and upload for the given rules. Statuses come only from the `have` ids. */
export function buildChecklist(pack: Pack, year: number, input: { ruleIds: string[]; have?: string[] }): Checklist {
  const have = new Set(input.have ?? []);
  const perRule: Checklist["perRule"] = [];
  const skipped: Checklist["skipped"] = [];
  const seen = new Set<string>();
  for (const ruleId of input.ruleIds) {
    if (seen.has(ruleId)) continue;
    seen.add(ruleId);
    const rule = pack.rules.find((r) => r.id === ruleId);
    if (!rule) { skipped.push({ ruleId, reason: "unknown rule" }); continue; }
    if (!rule.tax_years.includes(year)) { skipped.push({ ruleId, reason: `rule does not apply to tax year ${year}` }); continue; }
    const items = pack.documents.by_rule[ruleId];
    if (!items?.length) { skipped.push({ ruleId, reason: "no checklist items defined for this rule" }); continue; }
    perRule.push({ ruleId, title: rule.title, items: items.map((i) => ({ ...i, status: have.has(i.id) ? "have" : "missing" })) });
  }
  const warnings: string[] = [];
  if (year !== pack.documents.based_on_year) warnings.push(`Upload and retention guidance is based on the ${pack.documents.based_on_year} ELSTER instructions; check the current ones.`);
  const missingCount = perRule.reduce((n, r) => n + r.items.filter((i) => i.status === "missing").length, 0);
  return { taxYear: year, keep: pack.documents.general.keep, uploadSteps: pack.documents.general.upload_steps, perRule, skipped, missingCount, warnings };
}

export function createBuildChecklistTool({ pack, year }: { pack: Pack; year: number }) {
  return tool({
    description:
      "Build the list of documents to keep and upload, and the information still needed, for the rules the user is claiming this year, plus the official steps for uploading documents in Mein ELSTER. Pass the rule ids and the item ids the user has already confirmed in `have`. Items marked official=false are recommendations, not ELSTER requirements: say so.",
    inputSchema: z.object({
      ruleIds: z.array(z.string()).min(1).max(40),
      have: z.array(z.string()).max(100).optional().describe("Checklist item ids the user already has or has told you"),
    }),
    execute: async (input) => ({ ok: true as const, ...buildChecklist(pack, year, input) }),
  });
}
