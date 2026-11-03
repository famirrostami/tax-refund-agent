# pages — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** product-aware screens (`ChatPage`, `ReceiptsPage`, `ExportPage`). The only layer where UI meets data, state, i18n and the tax domain (receipts, deductions, country packs).

**Rules**
- Fill a template's slots with organisms; wire data in via `api/` hooks, client state via `state/` atoms, text via `useTranslation()`.
- Translate here and pass strings down as props. Keys are namespaced per page (`chat.composer.placeholder`).
- Map domain data to generic UI props here (e.g. a receipt → `{ id, title, subtitle }` for `DataList`). Domain types never leak into `ui/`.
- Pages hold orchestration only: no styling, no raw `fetch`, no business logic that belongs in `api/` or the server.
- Page-local components that are product-specific live in `pages/<Page>/`; if one turns generic, promote it to `ui/`.
- No imports between pages.
- Pages consume `domain/` types only; they never see server DTOs (those stay in `api/`).

**Tests**
- Integration tests per page: render with a fresh `QueryClient`, Jotai `Provider`, `en` i18n resources and a mocked network; assert user-visible behaviour (translated text, interactions, loading/error/empty).

**Structure**
- Each page is a folder (`NamePage/index.ts`, `NamePage.tsx`, `NamePage.test.tsx`, plus page-local components/hooks/types inside it); see root §3 rule 16.
