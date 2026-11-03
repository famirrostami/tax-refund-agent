# lib — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** small, pure, product-agnostic helpers: `cx` (class names), `formatTime`, `clamp`, `isDefined`, URL/HTML string helpers.

**Rules**
- Pure functions (same input → same output). No React hooks/components, no `fetch`, no globals beyond standard built-ins, no module-level state.
- **Must not import `domain/`**, nor `ui/`, `pages/`, `api/`, `state/`, `i18n/`. Only external packages and other `lib/` files.
- Generic signatures: take primitives or generic types, never `Receipt`/`Deduction`. If a helper needs domain knowledge, it belongs in `pages/` or `api/`.
- Allowed consumers: every layer, including shared `ui/`.
- One function per file where practical; export through `lib/index.ts`.

**Tests**
- Every function has a `name.test.ts` covering normal, edge and invalid input. Coverage here should be near-complete; these are the cheapest tests in the repo.

**Structure**
- Each function with a test lives in `name/` (`index.ts`, `name.ts`, `name.test.ts`); see root §3 rule 16.
