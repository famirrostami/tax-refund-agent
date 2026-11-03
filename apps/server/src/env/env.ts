import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");

/** Default model id per provider. `claude-code` takes the CLI's own aliases (sonnet, opus, haiku). */
const DEFAULT_MODEL = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4o",
  ollama: "llama3.1",
  "claude-code": "sonnet",
} as const;

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    LLM_PROVIDER: z.enum(["anthropic", "openai", "ollama", "claude-code"]).default("anthropic"),
    LLM_MODEL: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OLLAMA_URL: z.string().url().default("http://127.0.0.1:11434"),
    COUNTRY: z.string().regex(/^[a-z]{2}$/).default("de"),
    DATA_DIR: z.string().default(resolve(repoRoot, "data")),
    PACKS_DIR: z.string().default(resolve(repoRoot, "packs")),
  })
  .superRefine((v, ctx) => {
    if (v.LLM_PROVIDER === "anthropic" && !v.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "required when LLM_PROVIDER=anthropic" });
    }
    if (v.LLM_PROVIDER === "openai" && !v.OPENAI_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["OPENAI_API_KEY"], message: "required when LLM_PROVIDER=openai" });
    }
  })
  .transform((v) => ({ ...v, LLM_MODEL: v.LLM_MODEL ?? DEFAULT_MODEL[v.LLM_PROVIDER] }));

export type Env = z.infer<typeof schema>;

/** Pure: validate a key/value source. Throws with a readable message listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return result.data;
}

/** The only reader of process.env in the server. */
export function loadEnv(): Env {
  // The README puts .env at the repo root, whatever folder the server is started from. Real environment variables win.
  loadDotenv({ path: resolve(repoRoot, ".env"), quiet: true });
  return parseEnv(process.env);
}
