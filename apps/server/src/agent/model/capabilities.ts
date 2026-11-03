import type { Env } from "../../env";

/** What the configured model can do, independent of how it is reached. The rest of the app only sees this. */
export type ModelCapabilities = {
  /** Can read PDF documents. Image receipts work with every provider. */
  pdf: boolean;
};

export const DEFAULT_CAPABILITIES: ModelCapabilities = { pdf: true };

export function modelCapabilities(env: Pick<Env, "LLM_PROVIDER">): ModelCapabilities {
  switch (env.LLM_PROVIDER) {
    case "anthropic":
    case "openai":
      return { pdf: true };
    case "ollama":
    case "claude-code":
      return { pdf: false };
  }
}
