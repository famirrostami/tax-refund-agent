# apps/server/src/agent — AGENT.md

Inherits `apps/server/AGENT.md`. Coding conventions only; agent behaviour lives in `prompts/` and `packs/` (see root §3b).

- Layout: `loop.ts` (streamText + tool loop with a step limit), `model/` (provider factory), `tools/<tool>/` (one unit folder per tool), `prompts/` (prompt files + a loader), `rag/` (embedding + retrieval over the pack corpus), `approvals.ts`.
- `prompts/system.md` is plain Markdown loaded at startup and composed with `packs/<cc>/prompt.md`. Never inline prompt text in `.ts` files.
- Tools validate input/output with Zod and return typed failures; never throw raw provider errors to the model.
- Pass the model only the current profile/year summary and relevant receipts, not the whole corpus.
- Each tool and loader needs a unit test (LLM mocked) and, if behaviour changes, an eval case.
