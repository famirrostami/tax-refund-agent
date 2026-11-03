import { readdir } from "node:fs/promises";
import { loadPack } from "../packs";

const STALE_DAYS = 180;
const packsDir = new URL("../../../../packs", import.meta.url).pathname;

let failed = false;
for (const entry of await readdir(packsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const pack = await loadPack(packsDir, entry.name);
    const problems: string[] = [];
    for (const year of pack.manifest.years)
      for (const c of pack.categories)
        if (!pack.rules.some((r) => r.category === c.id && r.tax_years.includes(year))) problems.push(`no rule for ${c.id} in ${year}`);
    const now = Date.now();
    const stale = pack.rules.filter((r) => (now - Date.parse(r.last_verified)) / 86_400_000 > STALE_DAYS).map((r) => r.id);
    const open = pack.rules.filter((r) => r.verification !== "verified").length;
    console.log(`${entry.name}: ${pack.rules.length} rules, ${open} not fully verified${stale.length ? `, stale: ${stale.join(", ")}` : ""}`);
    if (problems.length) {
      failed = true;
      console.error(`  ${entry.name}: ${problems.join("; ")}`);
    }
  } catch (e) {
    failed = true;
    console.error(`${entry.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(failed ? 1 : 0);
