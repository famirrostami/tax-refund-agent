# ui/molecules — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** small groups of atoms with one purpose: `FormField` (label + input + hint), `SearchBar`, `ListItem`, `MessageBubble`, `IconButton`.

**Rules**
- May import `atoms/` only (plus siblings in `molecules/` sparingly; prefer composing via `children`).
- Single responsibility; if it handles two jobs, split it.
- All strings, handlers and values arrive via props. Expose slots (`leading`, `trailing`, `children`) rather than flags.
- Local state only for ephemeral presentation (e.g. focus, open/closed) and must be overridable by controlled props.
- Generic names. `ListItem`, not `ReceiptListItem`.
- No data, no i18n, no Jotai, no React Query.

**Shared-UI boundaries (hard)**
- No product domain: no `domain/` imports, no domain vocabulary. May use `lib/` helpers.
- No i18n, no React Query, no Jotai. Text, data and handlers come from props.

**Tests**
- One `Name.test.tsx` per molecule, props only: slots render, callbacks fire (click / submit), controlled vs ephemeral state, a11y names.

**Structure**
- Each component is a folder (`Name/index.ts`, `Name.tsx`, `Name.test.tsx`, plus types/hooks as needed); see root §3 rule 16. Export new components from this layer's `index.ts`.
