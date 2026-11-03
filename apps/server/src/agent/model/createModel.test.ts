import { describe, expect, it } from "vitest";
import { createModel } from "./index";

const base = { LLM_MODEL: "m", OLLAMA_URL: "http://127.0.0.1:11434" };

describe("createModel", () => {
  it("builds a model for each provider", () => {
    for (const LLM_PROVIDER of ["anthropic", "openai", "ollama"] as const) {
      const model = createModel({ ...base, LLM_PROVIDER, ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" });
      expect(model).toMatchObject({ modelId: "m" });
    }
  });
  it("builds the Claude Code CLI model without any API key", () => {
    expect(createModel({ ...base, LLM_PROVIDER: "claude-code", LLM_MODEL: "sonnet" })).toMatchObject({ modelId: "sonnet" });
  });
});
