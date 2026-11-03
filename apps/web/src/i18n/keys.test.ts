import { describe, expect, it } from "vitest";
import i18n, { resources } from "./index";

const pages = import.meta.glob(["../pages/**/*.tsx", "!../pages/**/*.test.tsx"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("i18n", () => {
  it("every translation key used in pages exists in en", () => {
    const missing: string[] = [];
    for (const [file, src] of Object.entries(pages)) {
      const ns = src.match(/useTranslation\("(\w+)"\)\s*;/)?.[1];
      for (const m of src.matchAll(/\b(t|tc)\("([\w.]+)"/g)) {
        const [, fn, key] = m;
        const space = fn === "tc" ? "common" : ns;
        if (!space || !(i18n.exists(`${space}:${key}`) || i18n.exists(`${space}:${key}_other`))) missing.push(`${file}: ${fn}("${key}")`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("only ships en for now", () => expect(Object.keys(resources)).toEqual(["en"]));

  it("resolves the app title", () => {
    expect(i18n.t("app.title")).toBe("Tax Refund Agent");
  });
});
