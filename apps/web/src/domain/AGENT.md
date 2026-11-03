# domain — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** the types the app *expects*: `Receipt`, `Deduction`, `TaxProfile`, `ChatMessage`… This is the product's vocabulary, independent of how the server happens to send it.

**Rules**
- Types and pure type-level helpers only. No React, no I/O, no imports from any other app folder.
- Named in product terms and camelCase (`newCount`, not `new_count`), with the shape pages actually need.
- Importable by `pages/`, `api/` (mappers return these), `state/` and `lib/`-free code. **Never imported by `ui/` or `lib/`.**
- Server DTOs do not live here; they live in `api/` and are mapped to these types.

**Tests**
- Nothing to test at runtime; types are exercised by the mapper tests in `api/` and the type-check in `npm run build`.
