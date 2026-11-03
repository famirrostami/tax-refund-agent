import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { Env } from "../../env";
import { createClaudeCodeModel } from "./claudeCode";

/** The only place provider SDKs are imported. */
export function createModel(env: Pick<Env, "LLM_PROVIDER" | "LLM_MODEL" | "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "OLLAMA_URL">): LanguageModel {
  switch (env.LLM_PROVIDER) {
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(env.LLM_MODEL);
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.LLM_MODEL);
    case "ollama":
      return createOpenAI({ baseURL: `${env.OLLAMA_URL}/v1`, apiKey: "ollama" }).chat(env.LLM_MODEL);
    case "claude-code":
      return createClaudeCodeModel(env.LLM_MODEL);
  }
}
