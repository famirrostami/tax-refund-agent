# apps/server — AGENT.md

Inherits the root `/AGENT.md` (§3 rules 12–13 and 17–25 apply here; the UI/state rules apply to the web client only).

- Owns: chat endpoint (streaming, AI SDK), agent loop and tools (`src/agent/`), pack loader (`packs.ts`), storage (`db.ts` SQLite, `files.ts` receipts on disk), export generation (`export/`), env parsing (`env.ts`), routing/bootstrap (`index.ts`).
- `env.ts` is the only reader of `process.env`; validate with Zod at startup, fail fast. Keys: `LLM_PROVIDER`, `LLM_MODEL`, provider API key, `DATA_DIR`, `COUNTRY` (default `de`).
- The model backend is swappable and invisible to the rest of the server. Provider SDKs and anything backend-specific live only in `agent/model/` (`architecture.test.ts` enforces it); other code asks for `ModelCapabilities` (e.g. `pdf`), never for a provider name. A backend that cannot take tool declarations (the Claude Code CLI) is wrapped by `agent/model/toolCalling.ts`, which turns schema-validated JSON answers into ordinary tool calls, so tools, `askUser` and approval-gated tools work unchanged.
- Claude Code CLI rules (`agent/model/claudeCode.ts`): locked-down session (empty cwd, `tools: []`, `strictMcpConfig`, `persistSession: false`, no permission prompts, no MCP servers); a fresh provider instance per call, because an instance resumes its last session and would carry one conversation into another; never share the instance. After changing any of this, run a real conversation through the CLI (question card, then export approval).
- Secrets never appear in responses or logs. Document contents and amounts are never logged above `debug`.
- Route handlers are thin: validate input → call a module → shape output.
- Errors returned to the client carry a stable machine `code` (the web app translates them).
- Uploads: validate type (pdf/png/jpg/webp; HEIC must be converted before upload) and size; store under `DATA_DIR/<profile>/<year>/`; never serve files outside that tree.
- Tests: Vitest unit tests per module with the LLM mocked (AI SDK `MockLanguageModel`), plus route tests for validation and error `code` shapes.
- The HTTP API is the only contract with `apps/web`; changing a response shape requires updating `apps/web/src/api` in the same change.
