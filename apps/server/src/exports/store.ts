import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const EXPORT_FILES = ["summary.md", "entries.csv", "export.json"] as const;
const ID = /^export-\d{8}T\d{6}Z(-\d+)?$/;
const REL = /^[a-z0-9_-][a-z0-9_.-]*(\/[a-z0-9_-][a-z0-9_.-]*)*$/i;

export type ExportBundle = { files: { path: string; content: string | Uint8Array }[] };

/** Exports live under <dataDir>/<profile>/<year>/exports/<export-id>/. Ids are server-generated. */
export function createExportStore(dataDir: string, profile: string, year: number) {
  if (!/^[a-z0-9_-]{1,40}$/i.test(profile) || !Number.isInteger(year)) throw new Error("bad profile or year");
  const root = join(dataDir, profile, String(year), "exports");
  return {
    async save(bundle: ExportBundle, now = new Date()): Promise<{ exportId: string }> {
      const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
      const existing = new Set(await readdir(root).catch(() => []));
      let exportId = `export-${stamp}`;
      for (let n = 2; existing.has(exportId); n++) exportId = `export-${stamp}-${n}`;
      for (const f of bundle.files) {
        if (!REL.test(f.path) || f.path.includes("..")) throw new Error(`unsafe export path: ${f.path}`);
        const target = join(root, exportId, f.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, f.content);
      }
      return { exportId };
    },
    async read(exportId: string, name: string): Promise<string | null> {
      if (!ID.test(exportId) || !(EXPORT_FILES as readonly string[]).includes(name)) return null;
      return readFile(join(root, exportId, name), "utf8").catch(() => null);
    },
    async list(): Promise<string[]> {
      return readdir(root).catch(() => []);
    },
  };
}

export type ExportStore = ReturnType<typeof createExportStore>;
