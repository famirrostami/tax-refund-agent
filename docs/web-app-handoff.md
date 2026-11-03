# Handoff: build `apps/web`

The backend (`apps/server`) is feature-complete and tested. The web app does not exist yet; `apps/web/src/**/AGENT.md` hold the conventions (copied from the Anki app), nothing else. Your task: build the real web app.

## Run what exists
```
cp .env.example .env           # set LLM_PROVIDER=claude-code (no key) or an API key provider
npm install
npm run dev:server             # http://127.0.0.1:8787
npm run chat                   # terminal client, shows the full flow
npm test                       # server tests (149)   |  npm run eval  (offline suites)
```

## What the agent does
Upload receipts → agent extracts and classifies them → checks deductibility against sourced rules → asks the user for missing facts (question cards) → maps results to official ELSTER lines → shows a document checklist and upload steps → writes an export (summary.md, entries.csv, export.json) **only after the user approves**. Nothing is ever sent to a tax authority. Germany first (tax years 2025, 2026); other countries are packs under `packs/<cc>/`.

## HTTP API (the only contract between web and server)
- `GET  /api/health` → `{ ok, country, years }`
- `POST /api/files?year=2025` multipart field `file` (pdf, png, jpg, webp, max 15 MB) → `201 { fileId, mediaType, name }`. Tell the agent about a file by writing its `fileId` in the chat message.
- `POST /api/chat` body `{ year, messages: UIMessage[] }` → AI SDK UI message stream (SSE, `data: {json}` lines; chunk types: `text-delta`, `tool-input-available`, `tool-output-available`, `tool-approval-request`, `error`, ...). Always send the whole history. Errors: `400 { code }` with `invalid_request | unsupported_year | invalid_answer`.
- `GET  /api/exports/:id/:name?year=2025` with name in `summary.md | entries.csv | export.json` (downloads).
- Server errors carry stable `code`s, never user-facing English: translate in the web app.

## UI contract (what the chat must render). `apps/server/src/scripts/chat.ts` is a working reference.
Use `@ai-sdk/react` `useChat` (4.0.x, matches `ai` 7); it handles the stream, tool outputs and approvals.
1. **Tool part `tool-askUser`, state `input-available`**: render a question card from `input` = `{ question, field?, answerType: text|number|boolean|choice|date, choices?, unit?, min?, max? }`. Answer with `addToolOutput` using `{ answered: true, value }` or `{ answered: false, reason: "skipped" | "dont_know" }`. Always offer Skip and "I don't know". The server rejects answers that don't fit the question (`invalid_answer`): validate in the UI first.
2. **Tool part `tool-buildExport`, state `approval-requested`**: render an approval prompt ("this writes files on your machine"); respond approved or denied. Never auto-approve.
3. **Other tool parts** (`searchRules`, `checkDeductibility`, `mapToFormFields`, `buildChecklist`, `classifyExpense`, `extractReceipt`): show as small status chips; for `mapToFormFields` output render the entries (form, line, German label, value) as a table, and for `buildChecklist` the documents with official vs "recommended" labels (`official: false` items must be visibly marked as recommendations). `confidence`, `verdict` and `caveats` from `checkDeductibility` should be visible (needs_review is not an answer).
4. After `buildExport` succeeds (`output.exportId`), offer the three files for download and show the upload steps from `buildChecklist`.
5. Year selector (2025, 2026). For 2026 the official form is not published: entries have `line: null`; show the German labels and the warning.

## Web architecture (follow `AGENT.md` + `apps/web/AGENT.md` and the per-layer AGENT.md files)
React 18 + Vite PWA, atomic design (`ui/atoms → molecules → organisms → templates`, `pages` only place where UI meets data), React Query for server data, Jotai for client state, i18n (en first, locale-ready: no hard-coded strings in JSX), TypeScript strict, tests required (Vitest + Testing Library), design tokens in `styles.css`, accessibility. Dev proxy `/api` → `127.0.0.1:8787` in `vite.config.ts`. `ui/` is product-agnostic: `Message`, `Card`, `Table`, never `DeductionTable`. Model the Anki app's setup (`~/anki-agent/apps/web`) for tooling, `architecture.test.ts` and test helpers. Check the server's `GET /api/health` for years.

Suggested pages: Chat (main, with file drop zone), Summary (entries + checklist + export download). Keep the first slice small: chat + upload + question cards + approval + entries table.

## Rules that must not be broken
- Behaviour/tax knowledge never goes into `AGENT.md` or TypeScript; it lives in `apps/server/src/agent/prompts/*.md` and `packs/`.
- The web app never sees API keys, never imports from `apps/server`.
- Model backend is swappable (`anthropic | openai | ollama | claude-code`) and invisible to the web app.
- Don't state tax figures in the UI that did not come from a tool result.

## Status of `apps/web` (first slice built on branch `feat/web-app`)
Done: single Chat page (streaming via `useChat`, file upload, question cards, export approval, entries table, checklist with official/recommended labels, deduction cards, downloads, year selector with inline confirm, retry). Design: `docs/superpowers/specs/2026-11-02-web-app-first-slice-design.md`; plan: `docs/superpowers/plans/2026-11-03-web-app-first-slice.md`. Tests: `npm test` (web 238, server 149), `npm run build`.
Checked in a real browser (Chrome, `LLM_PROVIDER=claude-code`): upload, "I worked from home 120 days", question cards (client validation blocks out-of-range answers), export deny (nothing written) then approve (three download links), and tax year 2026 (line numbers shown as "—" with the German label and the server warning).
Known gaps / follow-ups:
- Model text is shown as plain text: no Markdown rendering, and the `claude-code` backend returned literal `\n` sequences in some replies.
- No favicon (one harmless 404 in the console); no PWA/service worker; no Summary page or delete-all UI.
- Empty section headings (not mapped / missing information / notes) are rendered even when empty.
- `validateAnswer` reads a comma as a decimal separator, so "1,000" becomes 1.
- Web uses vitest 2 while the server uses vitest 5 (hoisted); `src/test/setup.ts` registers jest-dom explicitly because of this.

## Open items (not part of the web slice, don't forget)
- Eval suites `classify` and `agent` have never run with a real model (need a key or `claude-code`); run `npm run eval`, then `npm run eval -- --update-baseline` only after reviewing failures.
- Union-fee line in Anlage N is unconfirmed (`packs/de/forms/est.2025.json`).
- No depreciation table (AfA) for expensive non-computer work equipment: returns `needs_review`.
- Codex CLI as a model backend: not built (needs `codex` installed and `codex login`).
- Repo: https://github.com/s0aee1d/tax-refund-agent (private).

## First message for the new session
> Read `docs/web-app-handoff.md` and build `apps/web` as described: start with the plan (use the superpowers planning flow), then implement the first slice (chat + upload + question cards + export approval + entries table) with tests. Ask me before deviating from the Anki app's web conventions.
