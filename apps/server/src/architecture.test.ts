import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = __dirname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
const rel = (p: string) => relative(root, p);
const all = files(root).map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));

describe("model backend boundary", () => {
  it("provider SDKs are imported only inside agent/model", () => {
    const offenders = all
      .filter((f) => /from "(ai-sdk-provider-[^"]+|@ai-sdk\/(anthropic|openai))"/.test(f.text))
      .map((f) => f.path)
      .filter((p) => !p.startsWith("agent/model/"));
    expect(offenders).toEqual([]);
  });
  it("only the model factory and env know which backend is configured", () => {
    const mentions = all.filter((f) => /claude-code|claudeCode/.test(f.text)).map((f) => f.path).sort();
    expect(mentions).toEqual(["agent/model/capabilities.ts", "agent/model/claudeCode.ts", "agent/model/createModel.ts", "env/env.ts"]);
  });
  it("the tool-calling adapter is the only place that knows about the emulation protocol", () => {
    const mentions = all.filter((f) => /textToolCalling|tool_turn/.test(f.text)).map((f) => f.path).sort();
    expect(mentions).toEqual(["agent/model/claudeCode.ts", "agent/model/toolCalling.ts"]);
  });
});
