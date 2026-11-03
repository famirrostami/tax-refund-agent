# apps/web first slice: design

## Intent
A browser front end for the finished local-first tax agent. The user uploads receipts, chats, answers the agent's questions, approves the export, and sees ELSTER entries. The web app only renders what the HTTP API and tool results contain. It never submits anything to a tax authority.

## Goals
- Single **Chat page** (no router, no second page). Everything appears inline in the conversation.
- Streaming chat via `@ai-sdk/react` `useChat`, whole history sent each turn.
- File upload (drop zone + button), then the `fileId` is written into the next chat message.
- `askUser` question cards (text/number/boolean/choice/date), always with Skip and "I don't know"; validated in the UI before answering.
- `buildExport` approval prompt (approve / deny, never auto-approved).
- `mapToFormFields` entries table (form, line, German label, value), warnings, `notMapped`, `missingInfo`.
- `buildChecklist` documents with official vs "Recommended" badge, plus upload steps.
- `checkDeductibility` result chip showing verdict, confidence, caveats; `needs_review` is shown as "needs review", never as an answer.
- After `buildExport` succeeds: download links for summary.md, entries.csv, export.json.
- Year selector (years from `GET /api/health`). For 2026 the entries have `line: null`: show the German label and the server warning.
- Tests for every unit; architecture test enforcing root `AGENT.md` boundaries.

## Non-goals
- Summary page, routing, PWA/service worker, auth, multi-profile, delete-all UI, non-English locales (code stays locale-ready).
- Any change to `apps/server`.

## Anti-goals
- No tax knowledge, figures or rule text in the UI or `AGENT.md`; only tool-result content (server strings such as `warnings` and `caveats` are rendered as received).
- No import from `apps/server`, no API keys, no model/provider awareness.
- No auto-approval path.

## Constraints
Root `AGENT.md` and the layer files win: atomic design, React Query for server data, Jotai for client state, no strings in JSX or `ui/`, design tokens, unit folders, strict TS, `fetch` only in `api/`. Tooling and test helpers are modelled on `~/anki-agent/apps/web`.

## Approaches considered
- **A. Separate Summary page reading `export.json`**: more structure, but needs a router and only exists after an export. Rejected by you.
- **B. Summary from chat state in Jotai**: breaks "server data is not client state". Rejected.
- **C. New server endpoint**: changes the finished backend. Rejected.
- **Chosen: single Chat page.** Entries, checklist and downloads render inline under their tool outputs.

## Deviations from the Anki app (for your confirmation)
1. `useChat` instead of the hand-rolled SSE parser (`api/chat` becomes an adapter around `useChat`; the `ai` and `@ai-sdk/react` packages are allowed in `api/` only).
2. Dev proxy to `127.0.0.1:8787`, not 3001.
3. No PWA plugin in this slice.
4. New deps: `@ai-sdk/react`, `ai` (types for UI messages). No router.

## Design

### Layers
- `domain/`: `TaxYear`, `Question` (+ `Answer`), `ExportApproval`, `FormEntry`, `Checklist`, `DeductionCheck`, `ChatMessage`/`ChatPart` (the app's view of messages). Types only.
- `api/`:
  - `client` (fetch wrapper, `ApiError` with stable `code`).
  - `health` (`useHealth` → years).
  - `files` (`useUploadFile` mutation → `{ fileId, name, mediaType }`).
  - `chat` (`useAgentChat(year)`: wraps `useChat` with a transport to `/api/chat` carrying `{ year, messages }`; maps UI-message parts → domain `ChatPart`s; exposes `send`, `answerQuestion`, `respondApproval`, `status`, `error`).
  - `exports` (`exportUrl(id, name, year)`).
  - `mappers` (DTO/tool-output → domain). DTO types never leave `api/`.
- `state/` (Jotai): selected year, composer draft, pending uploaded files (name + fileId), per-question draft values.
- `i18n/`: `en` resources; error `code`s (`invalid_request | unsupported_year | invalid_answer`, upload errors) translated here.
- `lib/`: `cx`, `formatNumber`/`formatCurrency` (Intl), `validateAnswer(question, raw)` (pure type/min/max/choice checks).
- `ui/` (generic only):
  - atoms: `Button`, `Badge`, `Spinner`, `TextInput`, `Select`, `VisuallyHidden`, `Link`.
  - molecules: `Message` (role slot), `FormField`, `FileChip`, `DropZone`, `Notice` (info/warning/error), `ChoiceGroup`.
  - organisms: `Card` (header/body/actions slots), `Table`, `List`, `Composer` (textarea + send + attachments slot), `ChatLog` (scrolling, aria-live).
  - templates: `AppShell` (header slot, main, footer/composer slot).
- `pages/ChatPage/`: wires everything; page-local components map tool parts → generic UI: `QuestionCard`, `ApprovalCard`, `EntriesTable`, `ChecklistView`, `DeductionChip`, `ToolChip`, `ExportDownloads`.

### Data flow
1. User picks a year; changing it starts a new conversation (history cleared, confirmed if non-empty).
2. Upload → `POST /api/files?year=` → chip shown in the composer; on send, the message text gets the `fileId` appended per the API contract (formatted by one `lib` function, not hand-written in JSX).
3. `useChat` streams the reply. Tool parts are rendered by type: `tool-askUser` (input-available) → question card; `tool-buildExport` (approval-requested) → approval card; others → chips with expandable tables.
4. Answers use `addToolOutput({ answered: true, value } | { answered: false, reason })`; approvals use `addToolApprovalResponse`. The chat continues automatically after the last pending answer.
5. Errors: `400 { code }` → translated message with retry; stream `error` chunks shown in a `Notice`.

### Testing
Per `apps/web/AGENT.md`: unit tests for `lib`, mappers and atoms; `ui/*` rendered with props only; `api/` with mocked `fetch` and an SSE helper (`sseResponse` rewritten for the AI SDK chunk format); page integration tests for upload, question card (answer, skip, don't know, invalid), approval (deny, then approve), 2026 null lines, `needs_review` and recommended labels. `architecture.test.ts` and `keys.test.ts` (i18n keys) copied from Anki.

### Verification (before claiming done)
Run `npm run dev:server` (`LLM_PROVIDER=claude-code`) and `npm run dev:web`, then in a browser: upload a receipt, "I worked from home 120 days in 2025", answer a question card, deny then approve the export, and check the 2026 case with withheld line numbers.

## Left to the builder (my calls, mark if you disagree)
- Exact visual design, within tokens in `styles.css` (light/dark via CSS variables).
- Which tool outputs get expandable details versus a plain chip.
- Hash of file text formatting for `fileId` mentions.
- Commit granularity: one commit per layer or feature (no push).
