import { describe, expect, it } from "vitest";
import { modelCapabilities } from "./capabilities";

describe("modelCapabilities", () => {
  it("API models read PDFs; models that cannot are flagged", () => {
    expect(modelCapabilities({ LLM_PROVIDER: "anthropic" })).toEqual({ pdf: true });
    expect(modelCapabilities({ LLM_PROVIDER: "openai" })).toEqual({ pdf: true });
    expect(modelCapabilities({ LLM_PROVIDER: "ollama" })).toEqual({ pdf: false });
    expect(modelCapabilities({ LLM_PROVIDER: "claude-code" })).toEqual({ pdf: false });
  });
});
