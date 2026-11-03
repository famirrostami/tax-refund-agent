import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pack } from "../../packs";

const defaultDir = dirname(fileURLToPath(import.meta.url));

/** Core prompt (system.md) + pack prompt + the pack's categories and the tax year. */
export async function buildSystemPrompt(pack: Pack, year: number, opts: { promptsDir?: string } = {}): Promise<string> {
  const promptsDir = opts.promptsDir ?? defaultDir;
  const core = await readFile(join(promptsDir, "system.md"), "utf8");
  const categories = pack.categories
    .map((c) => `- ${c.id}: documents: ${c.requiredDocs.join("; ") || "none"}; ask: ${c.questions.join(" | ") || "none"}`)
    .join("\n");
  return [
    core.trim(),
    pack.prompt.trim(),
    `# Context\nCountry: ${pack.manifest.name} (${pack.manifest.currency}). Tax year: ${year}.\n\n## Deduction categories\n${categories}`,
  ].join("\n\n");
}
