import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("applies defaults and requires the provider key", () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: "k" });
    expect(env).toMatchObject({ PORT: 8787, LLM_PROVIDER: "anthropic", COUNTRY: "de" });
  });
  it("fails fast with every problem listed", () => {
    expect(() => parseEnv({ COUNTRY: "Germany" })).toThrow(/ANTHROPIC_API_KEY[\s\S]*COUNTRY|COUNTRY[\s\S]*ANTHROPIC_API_KEY/);
  });
  it("requires an OpenAI key only for openai", () => {
    expect(() => parseEnv({ LLM_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
    expect(parseEnv({ LLM_PROVIDER: "ollama" }).LLM_PROVIDER).toBe("ollama");
  });
  it("needs no API key for the Claude Code CLI and defaults to its model alias", () => {
    expect(parseEnv({ LLM_PROVIDER: "claude-code" })).toMatchObject({ LLM_PROVIDER: "claude-code", LLM_MODEL: "sonnet" });
    expect(parseEnv({ LLM_PROVIDER: "claude-code", LLM_MODEL: "opus" }).LLM_MODEL).toBe("opus");
  });
  it("rejects providers that do not exist", () => {
    expect(() => parseEnv({ LLM_PROVIDER: "codex-cli" })).toThrow(/LLM_PROVIDER/);
  });
});

describe("loadEnv", () => {
  it("reads the repo-root .env regardless of the working directory", async () => {
    const { loadEnv } = await import("./env");
    const { writeFileSync, existsSync, rmSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = resolve(__dirname, "../../../../.env");
    if (existsSync(file)) return; // never touch a developer's real .env
    const saved = { ...process.env };
    try {
      for (const k of ["LLM_PROVIDER", "LLM_MODEL", "ANTHROPIC_API_KEY"]) delete process.env[k];
      writeFileSync(file, "LLM_PROVIDER=claude-code\n");
      expect(loadEnv()).toMatchObject({ LLM_PROVIDER: "claude-code", LLM_MODEL: "sonnet" });
    } finally {
      rmSync(file, { force: true });
      process.env = saved;
    }
  });
});
