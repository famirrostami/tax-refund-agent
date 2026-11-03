import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createExportStore } from "../../../exports";
import { createFileStore } from "../../../files";
import { loadPack } from "../../../packs";
import { buildExport, createBuildExportTool } from "./buildExport";

const pack = await loadPack(resolve(__dirname, "../../../../../../packs"), "de");
const H = "de.home_office.tagespauschale";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "bx-"));
  const files = createFileStore(dir, "default", 2025);
  const exports = createExportStore(dir, "default", 2025);
  return { dir, files, exports, deps: { pack, year: 2025, files, exports } };
}
const items: { ruleId: string; facts: Record<string, string | number | boolean> }[] = [
  { ruleId: H, facts: { days: 100, arbeitszimmerClaimed: false } },
  { ruleId: "de.work_equipment.arbeitsmittel", facts: { grossAmount: 2400, workUsePercent: 100, isComputerOrSoftware: false, vatRatePercent: 19 } },
];

describe("buildExport", () => {
  it("writes summary, CSV and JSON with the entries, the unresolved item and the sources", async () => {
    const { deps, exports } = await setup();
    const r = await buildExport(deps, { items, have: ["homeoffice_log"] });
    expect(r).toMatchObject({ ok: true, entryCount: 1, notMappedCount: 1, documentCount: 0 });
    if (!r.ok) return;
    const md = (await exports.read(r.exportId, "summary.md"))!;
    expect(md).toContain("| 53 |");
    expect(md).toContain("100 days");
    expect(md).toContain("Not included (needs your attention)");
    expect(md).toContain("not tax advice");
    expect(md).toContain("[x] A calendar or log of your home-office days.");
    expect(md).toContain("https://www.gesetze-im-internet.de/estg/__4.html");
    const csv = (await exports.read(r.exportId, "entries.csv"))!;
    expect(csv.split("\n")[0]).toBe("form,line,line_verified,label_de,label_en,value,unit,rules");
    expect(csv).toContain("Anlage N,53,true");
    expect(JSON.parse((await exports.read(r.exportId, "export.json"))!).entries[0]).toMatchObject({ fieldId: "home_office_days", value: 100 });
  });
  it("copies uploaded documents into folders named after the form field", async () => {
    const { deps, files, dir, exports } = await setup();
    const { fileId } = await files.save({ mediaType: "application/pdf", bytes: new Uint8Array([7, 7]) });
    const r = await buildExport(deps, { items, documents: [{ fileId, ruleId: H }, { fileId: "00000000-0000-0000-0000-000000000000.pdf", ruleId: H }] });
    if (!r.ok) throw new Error("expected ok");
    expect(r.documentCount).toBe(1);
    expect(r.warnings.join(" ")).toMatch(/not found and was left out/);
    const folder = join(dir, "default", "2025", "exports", r.exportId, "belege", "anlage_n_home_office_days");
    expect((await readdir(folder))[0]).toMatch(/^01-/);
    expect(Array.from(await readFile(join(folder, (await readdir(folder))[0]!)))).toEqual([7, 7]);
    expect(await exports.list()).toEqual([r.exportId]);
  });
  it("tells the reader when the official form is not published yet and leaves lines out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bx26-"));
    const exports = createExportStore(dir, "default", 2026);
    const r = await buildExport({ pack, year: 2026, files: createFileStore(dir, "default", 2026), exports }, { items: [{ ruleId: H, facts: { days: 10, arbeitszimmerClaimed: false } }] });
    if (!r.ok) throw new Error("expected ok");
    const md = (await exports.read(r.exportId, "summary.md"))!;
    expect(md).toMatch(/not published yet/);
    expect(md).toContain("| – |");
  });
  it("still produces an explanatory export when nothing could be entered", async () => {
    const { deps, exports } = await setup();
    const r = await buildExport(deps, { items: [{ ruleId: "nope", facts: {} }] });
    expect(r).toMatchObject({ ok: true, entryCount: 0, notMappedCount: 1 });
    if (r.ok) expect(await exports.read(r.exportId, "summary.md")).toContain("_Nothing to enter yet._");
  });
  it("requires approval and does not write when only inspected", async () => {
    const { deps, exports } = await setup();
    const t = createBuildExportTool(deps);
    expect(t.needsApproval).toBe(true);
    expect(await exports.list()).toEqual([]);
  });
});
