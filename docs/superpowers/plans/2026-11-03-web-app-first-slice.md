# apps/web First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React chat UI for the tax agent: streaming chat, file upload, question cards, export approval, entries table, checklist, downloads.

**Architecture:** Vite + React 18 SPA following the root `AGENT.md` layers (`ui` generic, `pages` wires data, `api` owns React Query/`useChat`/DTOs, `state` Jotai, `i18n` en). `api/chat` wraps `@ai-sdk/react` `useChat` and maps UI-message parts to domain types; `pages/ChatPage` maps domain types to generic `ui` props.

**Tech Stack:** React 18, Vite 5, TypeScript strict, `@tanstack/react-query`, `jotai`, `i18next`/`react-i18next`, `@ai-sdk/react` + `ai` (api layer only), Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-02-web-app-first-slice-design.md` (also read `docs/web-app-handoff.md`, `AGENT.md`, `apps/web/**/AGENT.md`, `apps/server/src/scripts/chat.ts`).

## Global Constraints
- Single Chat page, no router, no PWA plugin, no change to `apps/server`.
- Dev proxy `/api` → `http://127.0.0.1:8787`.
- `ui/` imports nothing from `pages|api|state|i18n|domain`, no `t()`, no string literals, no `fetch`/storage.
- `fetch` only in `api/`; DTO types never leave `api/`; `ai`/`@ai-sdk/react` imported only in `api/`.
- No tax knowledge or figures in UI code; render only tool-result content. `needs_review` is never presented as an answer; checklist items with `official: false` carry a visible "Recommended" badge.
- Export approval is never automatic. Question cards always offer Skip and "I don't know".
- Stable server error codes (`invalid_request | unsupported_year | invalid_answer`) are translated in `i18n`, never shown raw.
- Unit folders with `index.ts`; one component per file; tests colocated in a same-named folder; commit small, **do not push**.
- Model every helper after `~/anki-agent/apps/web` (`src/test/*`, `architecture.test.ts`, `keys.test.ts`).

## Review Focus
- Server returns `400 {code:"invalid_answer"}` for a mismatched answer: UI validates first; if it still arrives, show translated error and keep the card open.
- Stream drops or `error` chunk mid-reply: partial text stays, error `Notice` with retry, composer re-enabled.
- Two pending items in one assistant message (question and approval): only one actionable at a time, no double-submit.
- Changing the year mid-conversation: history cleared after confirm, pending uploads dropped, no stale `fileId` sent.
- Upload rejected (wrong type, >15 MB, server error): file never enters the composer; translated error shown.

---

### Task 1: Scaffold, tooling, test helpers, architecture test
**Files:** Create `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html}`, `src/{main.tsx,styles.css,vite-env.d.ts}`, `src/test/{setup.ts,render.tsx,network.ts}`, `src/architecture.test.ts`, `src/i18n/{index.ts,keys.test.ts,locales/en.ts}`, empty layer `index.ts` files (`domain,lib,api,state,ui/{atoms,molecules,organisms,templates,tokens}`).
**Interfaces:** Produces `renderWithProviders(ui, {store?, client?})`, `createWrapper()`, `mockApi(routes)`, `sseChunks(chunks: object[]): Response` (AI SDK UI-message stream: `data: {json}\n\n`, ends `data: [DONE]`), `i18n` instance with `en`.
- [ ] Copy package/tsconfig/vite/test helpers from `~/anki-agent/apps/web`; change proxy to 8787, drop `allowedHosts`, add `@ai-sdk/react@^4` and `ai@^7`; `npm install` at repo root.
- [ ] Copy `architecture.test.ts` and `keys.test.ts` unchanged; add a rule that `ai`/`@ai-sdk/react` may be imported only from `api/`.
- [ ] Define design tokens (colour, spacing, radius, font-size, light/dark) in `styles.css` only.
- [ ] Verify: `npm test -w apps/web` passes (architecture + keys); `npm run build -w apps/web` passes.
- [ ] Commit `chore(web): scaffold app and test helpers`.

### Task 2: `lib/` pure helpers
**Files:** `lib/cx`, `lib/formatNumber`, `lib/validateAnswer`, `lib/formatFileMention` (each unit folder with test).
**Interfaces (produces):**
- `cx(...parts: (string|false|null|undefined)[]): string`
- `formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string`
- `validateAnswer(spec: {answerType:"text"|"number"|"boolean"|"choice"|"date"; choices?: {value:string;label:string}[]; min?: number; max?: number}, raw: string|boolean): {ok:true;value:string|number|boolean}|{ok:false;reason:"required"|"not_a_number"|"too_small"|"too_large"|"not_a_choice"|"not_a_date"}`
- `formatFileMention(text: string, fileIds: string[]): string` (appends the ids per the API contract; returns `text` unchanged when no ids)
- [ ] Tests first: number accepts `"120"` and `"120,5"` → 120.5; `min`/`max` bounds; choice rejects unknown value; date requires `YYYY-MM-DD`; empty text → `required`; boolean passes through; `formatFileMention("hi", ["f1","f2"])` contains both ids.
- [ ] Implement; run `npm test -w apps/web`; commit `feat(web): lib helpers`.

### Task 3: `domain/` types and `api/` client, health, mappers
**Files:** `domain/{question,approval,formEntry,checklist,deductionCheck,chat}.ts`, `domain/index.ts`; `api/client`, `api/health`, `api/mappers`, `api/dto.ts`, `api/queryClient.ts`.
**Interfaces (produces):**
- `Question {toolCallId; question; field?; answerType; choices?; unit?; min?; max?}`; `Answer = {answered:true;value:string|number|boolean}|{answered:false;reason:"skipped"|"dont_know"}`
- `FormEntry {form; line: string|null; labelDe; value; ...}` fields exactly as `mapToFormFields` returns (read `apps/server/src/agent/tools/mapToFormFields` once to mirror names); `MappingResult {formStatus; entries; notMapped; missingInfo; warnings}`
- `ChecklistResult {uploadSteps; perRule:{ruleId;title;items:{id;label;official:boolean;status:"have"|"missing"}[]}[]; warnings}` (mirror `buildChecklist`)
- `ChatPart` union: `text | question | approval | mapping | checklist | deduction | exportResult | toolStatus`
- `ApiError(code: string, status: number)`; `apiFetch<T>(path, init?)`; `useHealth(): UseQueryResult<{country:string; years:number[]}>`; `toChatParts(uiParts: unknown[]): ChatPart[]` (in `api/mappers`).
- [ ] Tests first: `apiFetch` throws `ApiError` with server `code`; `useHealth` returns years from mocked `/api/health`; `toChatParts` maps `tool-askUser` input-available → `question`, `tool-buildExport` approval-requested → `approval`, `tool-mapToFormFields` output → `mapping` (including `line: null` for 2026), `needs_review` verdict preserved as-is, unknown tool types → `toolStatus`.
- [ ] Implement; run tests; commit `feat(web): domain types, api client, mappers`.

### Task 4: `api/files` upload
**Files:** `api/files/{files.ts,files.test.tsx,index.ts}`.
**Interfaces:** `useUploadFile(year: number)`: mutation taking `File`, returns `{fileId:string; name:string; mediaType:string}`. Client-side precheck rejects non pdf/png/jpg/webp or >15 MB with `ApiError("file_type"|"file_too_large")` before any request.
- [ ] Tests first: success maps 201 body; oversize and wrong type never call `fetch`; server error code surfaces via `ApiError`.
- [ ] Implement (`FormData`, field `file`, `?year=`); commit `feat(web): file upload api`.

### Task 5: `api/chat` adapter around `useChat`
**Files:** `api/chat/{chat.ts,chat.test.tsx,index.ts}`, `api/exports/{exports.ts,exports.test.ts}`.
**Interfaces:**
- Produces `useAgentChat(year: number): {messages: {id:string; role:"user"|"assistant"; parts: ChatPart[]}[]; status:"ready"|"submitted"|"streaming"|"error"; error: ApiError|null; send(text: string): void; answerQuestion(toolCallId: string, answer: Answer): void; respondApproval(toolCallId: string, approved: boolean): void; stop(): void; reset(): void}`
- Produces `exportUrl(exportId: string, name: "summary.md"|"entries.csv"|"export.json", year: number): string`.
- Implementation notes: `useChat` with `DefaultChatTransport({api:"/api/chat", prepareSendMessagesRequest → body {year, messages}})`; `sendAutomaticallyWhen` using the AI SDK helpers `lastAssistantMessageIsCompleteWithToolCalls` / `…WithApprovalResponses` so the stream resumes after an answer or an approval; `answerQuestion` → `addToolOutput({tool:"askUser", toolCallId, output: answer})`; `respondApproval` → `addToolApprovalResponse({id: approvalId, approved})` (look up `approval.id` from the part). Verify exact v4 names against the installed package types before coding; report any difference to the user.
- [ ] Tests first (mock `fetch` with `sseChunks`): streamed `text-delta` accumulates; `tool-input-available` for `askUser` yields a `question` part; `answerQuestion` triggers a second request whose body contains the output; `respondApproval(false)` sends `approved:false` and never calls `buildExport` output; `400 {code:"invalid_request"}` → `error.code`; request body always carries full history and `year`.
- [ ] Implement; commit `feat(web): useAgentChat adapter`.

### Task 6: `state/` atoms
**Files:** `state/{app,composer}/…` with tests via `createStore()`.
**Interfaces:** `yearAtom` (default first year from health, set via `selectedYearAtom: atom<number|null>`), `draftAtom: atom<string>`, `attachmentsAtom: atom<{fileId:string;name:string}[]>`, `clearConversationAtom` (write-only: empties draft and attachments), `questionDraftsAtomFamily(toolCallId)`.
- [ ] Tests first: clear empties draft and attachments; changing year does not keep attachments; families are independent per id. Implement; commit `feat(web): client state atoms`.

### Task 7: `ui/atoms`
**Files:** `Button, Badge, Spinner, TextInput, Select, Link, VisuallyHidden` (unit folders).
- [ ] Tests first per atom (roles, labels via props, `onClick`/`onChange`, disabled, keyboard operation, `Badge` tone prop `neutral|info|warning|danger|success`). Props only; classes use tokens. Commit `feat(web/ui): atoms`.

### Task 8: `ui/molecules`
**Files:** `Message` (role + slots `header`, `children`), `FormField` (label, hint, error slots), `FileChip` (name, `onRemove`, `removeLabel`), `DropZone` (`onFiles`, `label`, `busy`), `Notice` (tone, children, `actions`), `ChoiceGroup` (options, value, `onChange`, radio semantics).
- [ ] Tests first: `DropZone` accepts dropped files and a keyboard-activated file input; `ChoiceGroup` arrow-key selection; `Notice` with `role="alert"` for error tone. Commit `feat(web/ui): molecules`.

### Task 9: `ui/organisms` and `ui/templates`
**Files:** `Card` (slots `header,children,actions`), `Table` (`columns:{key;header}[]`, `rows`, `caption`, `emptyLabel`), `List`, `Composer` (textarea, `onSend`, `sendLabel`, `attachments` slot, `disabled`), `ChatLog` (`aria-live="polite"`, auto-scroll to latest), `AppShell` (`header`, `children`, `footer` slots).
- [ ] Tests first: `Composer` sends on button and on Ctrl/Cmd+Enter, not when empty or disabled; `Table` renders caption and empty state; `ChatLog` has live region. Commit `feat(web/ui): organisms and shell`.

### Task 10: ChatPage interactive cards
**Files:** `pages/ChatPage/{QuestionCard,ApprovalCard}/…` (unit folders, page-local), en strings under `chat.question.*`, `chat.approval.*`.
**Interfaces:** `QuestionCard({question: Question; onAnswer(a: Answer): void; disabled?: boolean})`; `ApprovalCard({onApprove(): void; onDeny(): void; disabled?: boolean})` with copy "this writes files on your machine; nothing is sent to a tax authority" from i18n.
- [ ] Tests first: each `answerType` renders the right control; invalid input shows translated error and does not call `onAnswer`; Skip → `{answered:false,reason:"skipped"}`; "I don't know" → `dont_know`; choice uses labels but returns `value`; unit shown; approval has two explicit buttons, no default focus on Approve. Commit `feat(web): question and approval cards`.

### Task 11: Result views
**Files:** `pages/ChatPage/{EntriesView,ChecklistView,DeductionChip,ToolChip,ExportDownloads}/…`.
**Interfaces:** consume `ChatPart` mapping/checklist/deduction/exportResult; map to `Table`, `List`, `Badge`, `Link`.
- [ ] Tests first: entries table shows form, line (`—` when `null`, with the server warning visible), German label, value; `notMapped` and `missingInfo` listed; checklist items with `official:false` show "Recommended" badge, official ones do not; deduction chip shows verdict, confidence and caveats and `needs_review` renders as "Needs review" with no figure emphasis; downloads render three links using `exportUrl` and the checklist `uploadSteps`; failed export (`ok:false`) shows the message, no links. Commit `feat(web): result views`.

### Task 12: ChatPage integration
**Files:** `pages/ChatPage/{ChatPage.tsx,ChatPage.test.tsx,index.ts}`, `main.tsx` providers (QueryClient, Jotai, i18n), year selector, upload, error handling.
- [ ] Integration tests first with real providers and `mockApi`/`sseChunks`: (a) upload → chip → send includes `fileId` and clears attachments; (b) "I worked from home 120 days in 2025" streams text and a question card, answering resumes the stream; (c) invalid server answer (`400 invalid_answer`) shows translated error and keeps card; (d) approval: deny then approve flows, Approve calls only after click; (e) 2026 mapping shows null lines and warning; (f) year change asks to confirm and clears history/attachments; (g) stream `error` chunk shows retry; (h) upload type/size rejection never adds a chip.
- [ ] Implement page orchestration only (no logic that belongs in `api`/`lib`); run `npm test` and `npm run build`; commit `feat(web): chat page`.

### Task 13: Real-browser verification and docs
- [ ] `cp -n .env.example .env`, `LLM_PROVIDER=claude-code`; `npm run dev:server` and `npm run dev:web`; with the `run` skill and the browser tools: upload a receipt, send "I worked from home 120 days in 2025", answer a question card (also try Skip and invalid input), deny the export then approve, download the three files, switch to 2026 and confirm withheld lines show German labels plus warning. Record failures and fix with systematic-debugging.
- [ ] Update `apps/web/AGENT.md` only for facts about the web app (no tax content); update `docs/web-app-handoff.md` status. Run `npm test`, `npm run build`. Commit `docs: web app status`. Do not push.

---

## Self-review
- Spec coverage: chat/stream (5,12), upload (4,12), question cards (10), approval (10,12), entries table (11), checklist official/recommended (11), deduction chip with `needs_review` (11), downloads and upload steps (11), year selector and 2026 null lines (11,12), tests and architecture (all, 1), real run (13).
- Types: `Question`, `Answer`, `ChatPart`, `useAgentChat`, `exportUrl`, `validateAnswer` named identically wherever used.
- Known unknown: exact `useChat` v4 method names; Task 5 requires checking the installed types first.
