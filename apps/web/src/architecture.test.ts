import { describe, expect, it } from "vitest";

/** Enforces the import boundaries from /AGENT.md §1 and §3. */
const files = import.meta.glob(["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}", "!./test/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const forbidden: Record<string, string[]> = {
  ui: ["pages", "api", "state", "i18n", "domain", "react-i18next", "i18next", "@tanstack/react-query", "jotai"],
  lib: ["ui", "pages", "api", "state", "i18n", "domain", "react-i18next", "@tanstack/react-query", "jotai"],
  domain: ["ui", "pages", "api", "state", "i18n", "lib", "react", "react-i18next", "@tanstack/react-query", "jotai"],
  api: ["ui", "pages", "state", "i18n", "jotai"],
  state: ["ui", "pages", "api", "i18n", "@tanstack/react-query"],
  i18n: ["ui", "pages", "api", "state", "domain"],
};

const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);

/** Resolves a relative import to the top-level folder it lands in; bare specifiers are returned as-is. */
function target(from: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const parts = from.split("/").slice(1, -1);
  for (const seg of spec.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts[0] ?? "";
}

describe("architecture", () => {
  for (const [layer, banned] of Object.entries(forbidden)) {
    it(`${layer}/ does not import ${banned.join(", ")}`, () => {
      const violations: string[] = [];
      for (const [file, src] of Object.entries(files)) {
        if (!file.startsWith(`./${layer}/`)) continue;
        for (const spec of importsOf(src)) {
          const t = target(file, spec);
          if (t === layer) continue; // inside own layer
          if (banned.includes(t)) violations.push(`${file} -> ${spec}`);
        }
      }
      expect(violations).toEqual([]);
    });
  }

  it("ui/ has no hard-coded fetch or storage access", () => {
    const bad = Object.entries(files)
      .filter(([f]) => f.startsWith("./ui/"))
      .filter(([, s]) => /\bfetch\(|localStorage|sessionStorage/.test(s))
      .map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it("ai and @ai-sdk/react are only imported from api/", () => {
    const bad: string[] = [];
    for (const [file, src] of Object.entries(files)) {
      if (file.startsWith("./api/")) continue;
      for (const spec of importsOf(src)) {
        if (spec === "ai" || spec.startsWith("ai/") || spec.startsWith("@ai-sdk/")) bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("fetch is only used in api/", () => {
    const bad = Object.entries(files)
      .filter(([f]) => !f.startsWith("./api/") && /\bfetch\(/.test(files[f]))
      .map(([f]) => f);
    expect(bad).toEqual([]);
  });
});

describe("unit folders (root §3 rule 16)", () => {
  const tests = Object.keys(import.meta.glob("./{ui,pages,lib,api,state}/**/*.test.{ts,tsx}"));
  const indexes = new Set(Object.keys(import.meta.glob("./{ui,pages,lib,api,state}/**/index.ts")));

  it("every test lives in a folder named after its unit, with an index.ts", () => {
    const bad = tests.filter((f) => {
      const parts = f.split("/");
      const folder = parts[parts.length - 2];
      const unit = parts[parts.length - 1].split(".test.")[0];
      return !unit.startsWith(folder) || !indexes.has(`${parts.slice(0, -1).join("/")}/index.ts`);
    });
    expect(bad).toEqual([]);
  });
});
