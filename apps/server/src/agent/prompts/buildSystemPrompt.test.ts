import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../packs";
import { buildSystemPrompt } from "./buildSystemPrompt";

describe("buildSystemPrompt", () => {
  it("composes core prompt, pack prompt, year and categories", async () => {
    const pack = await loadPack(resolve(__dirname, "../../../../../packs"), "de");
    const text = await buildSystemPrompt(pack, 2025);
    expect(text).toContain("# Role");
    expect(text).toContain("# Germany");
    expect(text).toContain("Tax year: 2025");
    expect(text).toContain("- commute:");
  });
});
