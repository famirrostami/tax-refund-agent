import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { caseFileSchema, type EvalCase } from "./schema";

/** Reads packs/<cc>/evals/*.json; ids must be unique across files. */
export async function loadCases(packDir: string): Promise<EvalCase[]> {
  const dir = join(packDir, "evals");
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  const cases: EvalCase[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const parsed = caseFileSchema.safeParse(JSON.parse(await readFile(join(dir, f), "utf8")));
    if (!parsed.success) throw new Error(`Invalid eval file ${f}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    for (const c of parsed.data) {
      if (seen.has(c.id)) throw new Error(`Duplicate eval case id: ${c.id}`);
      seen.add(c.id);
      cases.push(c);
    }
  }
  return cases;
}
