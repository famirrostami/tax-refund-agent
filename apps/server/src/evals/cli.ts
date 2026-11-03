import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createModel } from "../agent/model";
import { loadEnv } from "../env";
import { loadPack } from "../packs";
import { compareBaseline, mergeBaseline, summarize, type Baseline } from "./report";
import { runCase, type CaseResult } from "./runners";
import { LLM_SUITES, SUITES, loadCases, type Suite } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const evalsDir = join(root, "evals");
const baselinePath = join(evalsDir, "baseline.json");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => process.argv.includes(`--${name}`);

const country = arg("country") ?? "de";
const wantedSuites = (arg("suite")?.split(",") ?? SUITES) as Suite[];
const onlyCase = arg("case");
const verbose = flag("verbose");

let model;
let skipReason = "";
try {
  const env = loadEnv();
  model = createModel(env);
} catch (e) {
  skipReason = e instanceof Error ? e.message.split("\n").slice(0, 2).join(" ").trim() : String(e);
}

const pack = await loadPack(join(root, "packs"), country);
const all = await loadCases(pack.dir);
const skipped = new Set<Suite>(model ? [] : LLM_SUITES.filter((s) => wantedSuites.includes(s)));
const cases = all.filter((c) => wantedSuites.includes(c.suite) && !skipped.has(c.suite) && (!onlyCase || c.id === onlyCase));

const results: CaseResult[] = [];
for (const c of cases) {
  const r = await runCase(c, { pack, model });
  results.push(r);
  const mark = r.passed ? "PASS" : "FAIL";
  if (!r.passed || verbose) {
    console.log(`${mark} ${r.suite}/${r.id} (${r.ms}ms)`);
    if (r.error) console.log(`     error: ${r.error}`);
    for (const ch of r.checks.filter((x) => !x.pass || verbose)) console.log(`     ${ch.pass ? "ok " : "BAD"} ${ch.name}${ch.detail ? ` - ${ch.detail}` : ""}`);
  }
}

const summary = summarize(results);
console.log(`\nEval: country=${country}`);
for (const [suite, s] of Object.entries(summary)) console.log(`  ${suite.padEnd(9)} ${s.passed}/${s.total} passed`);
for (const s of skipped) console.log(`  ${s.padEnd(9)} skipped (${skipReason || "no model"})`);

const baseline: Baseline | null = await readFile(baselinePath, "utf8").then((t) => JSON.parse(t), () => null);
const cmp = compareBaseline(summary, baseline);

await mkdir(join(evalsDir, "results"), { recursive: true });
await writeFile(join(evalsDir, "results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ country, summary, results }, null, 2));

if (flag("update-baseline")) {
  if (onlyCase) {
    console.error("Refusing to update the baseline from a single-case run.");
    process.exit(2);
  }
  await writeFile(baselinePath, JSON.stringify(mergeBaseline(baseline, summary), null, 2) + "\n");
  console.log(`Baseline updated (${baselinePath}).`);
  process.exit(0);
}

for (const r of cmp.regressions) console.log(`REGRESSION ${r.suite}/${r.id}`);
for (const r of cmp.unbaselinedFailures) console.log(`UNBASELINED FAILURE ${r.suite}/${r.id}`);
if (!cmp.ok) process.exit(1);
console.log("No regressions against the baseline.");
