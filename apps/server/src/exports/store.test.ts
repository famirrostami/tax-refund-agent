import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createExportStore } from "./store";

const make = async () => createExportStore(await mkdtemp(join(tmpdir(), "exp-")), "default", 2025);

describe("export store", () => {
  it("saves a bundle and reads back only the allowed top-level files", async () => {
    const store = await make();
    const { exportId } = await store.save({ files: [{ path: "summary.md", content: "# hi" }, { path: "belege/commute_days/1-a.pdf", content: new Uint8Array([1]) }] }, new Date("2026-11-02T10:00:00Z"));
    expect(exportId).toBe("export-20261102T100000Z");
    expect(await store.read(exportId, "summary.md")).toBe("# hi");
    expect(await store.read(exportId, "belege/commute_days/1-a.pdf")).toBeNull();
    expect(await store.list()).toEqual([exportId]);
  });
  it("never overwrites an earlier export made in the same second", async () => {
    const store = await make();
    const t = new Date("2026-11-02T10:00:00Z");
    const a = await store.save({ files: [{ path: "summary.md", content: "a" }] }, t);
    const b = await store.save({ files: [{ path: "summary.md", content: "b" }] }, t);
    expect(b.exportId).not.toBe(a.exportId);
    expect(await store.read(a.exportId, "summary.md")).toBe("a");
  });
  it("refuses unsafe paths and ids", async () => {
    const store = await make();
    await expect(store.save({ files: [{ path: "../evil.md", content: "x" }] })).rejects.toThrow(/unsafe/);
    await expect(store.save({ files: [{ path: "/abs.md", content: "x" }] })).rejects.toThrow(/unsafe/);
    expect(await store.read("../../etc", "summary.md")).toBeNull();
  });
});
