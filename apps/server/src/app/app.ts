import { Hono } from "hono";
import { z } from "zod";
import type { LanguageModel, UIMessage } from "ai";
import { buildSystemPrompt } from "../agent/prompts";
import { streamAgent } from "../agent/loop";
import type { Pack } from "../packs";
import { createFileStore, FileStoreError, MAX_UPLOAD_BYTES } from "../files";
import { createExportStore } from "../exports";
import { DEFAULT_CAPABILITIES, type ModelCapabilities } from "../agent/model";
import { createTools } from "../agent/tools";
import { findInvalidAnswer } from "../agent/tools/askUser";

export type AppDeps = {
  model: LanguageModel;
  pack: Pack;
  dataDir: string;
  profile?: string;
  /** What the configured model can do; defaults to everything. */
  capabilities?: ModelCapabilities;
};

const chatBody = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), parts: z.array(z.record(z.string(), z.unknown())) }).passthrough()).min(1),
  year: z.number().int().optional(),
});

export function createApp({ model, pack, dataDir, profile = "default", capabilities = DEFAULT_CAPABILITIES }: AppDeps) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, country: pack.manifest.country, years: pack.manifest.years }));

  app.post("/api/files", async (c) => {
    const year = Number(c.req.query("year") ?? Math.max(...pack.manifest.years));
    if (!pack.manifest.years.includes(year)) return c.json({ code: "unsupported_year" }, 400);
    const body = await c.req.parseBody().catch(() => null);
    const file = body?.["file"];
    if (!(file instanceof File)) return c.json({ code: "invalid_request" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ code: "too_large" }, 413);
    try {
      const saved = await createFileStore(dataDir, profile, year).save({
        mediaType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json({ fileId: saved.fileId, mediaType: saved.mediaType, name: file.name }, 201);
    } catch (e) {
      if (e instanceof FileStoreError) return c.json({ code: e.code }, e.code === "too_large" ? 413 : 415);
      throw e;
    }
  });

  app.post("/api/chat", async (c) => {
    const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_request" }, 400);
    const year = parsed.data.year ?? Math.max(...pack.manifest.years);
    if (!pack.manifest.years.includes(year)) return c.json({ code: "unsupported_year" }, 400);
    if (findInvalidAnswer(parsed.data.messages as { parts: { type?: unknown }[] }[])) return c.json({ code: "invalid_answer" }, 400);
    const system = await buildSystemPrompt(pack, year);
    const tools = createTools({ model, files: createFileStore(dataDir, profile, year), exports: createExportStore(dataDir, profile, year), pack, year, acceptsPdf: capabilities.pdf });
    const result = await streamAgent({
      model,
      system,
      messages: parsed.data.messages as unknown as Omit<UIMessage, "id">[],
      tools,
      signal: c.req.raw.signal,
    });
    return result.toUIMessageStreamResponse();
  });

  app.get("/api/exports/:id/:name", async (c) => {
    const year = Number(c.req.query("year") ?? Math.max(...pack.manifest.years));
    if (!pack.manifest.years.includes(year)) return c.json({ code: "unsupported_year" }, 400);
    const name = c.req.param("name");
    const text = await createExportStore(dataDir, profile, year).read(c.req.param("id"), name);
    if (text === null) return c.json({ code: "not_found" }, 404);
    const type = name.endsWith(".csv") ? "text/csv" : name.endsWith(".json") ? "application/json" : "text/markdown";
    return c.body(text, 200, { "content-type": `${type}; charset=utf-8`, "content-disposition": `attachment; filename="${name}"` });
  });

  app.onError((_err, c) => c.json({ code: "internal_error" }, 500));
  return app;
}
