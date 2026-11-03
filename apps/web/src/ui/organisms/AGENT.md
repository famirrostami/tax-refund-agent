# ui/organisms — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** self-contained sections made of molecules/atoms: `Panel`, `MessageList`, `Composer`, `DataList`, `Modal`, `Header`, `Form`.

**Rules**
- May import `molecules/` and `atoms/` only.
- Still prop-driven, i18n-agnostic and product-agnostic: items, callbacks, labels and empty/loading/error content come in as props or slots. Render-props (`renderItem`) are encouraged for lists.
- Loading/empty/error are *presentational states* controlled by props (`status`), never derived from fetching.
- Handle layout and interaction patterns (focus trap, scroll, keyboard nav) here, not in pages.
- No data, no i18n, no Jotai, no React Query. Pages feed organisms.

**Shared-UI boundaries (hard)**
- No product domain: no `domain/` imports; items are generic shapes defined by the component's own props types.
- No i18n, no React Query, no Jotai. Text, data and handlers come from props.

**Tests**
- One `Name.test.tsx` per organism, props only: each presentational state (empty/loading/error via props), interaction and keyboard behaviour, slot rendering.

**Structure**
- Each component is a folder (`Name/index.ts`, `Name.tsx`, `Name.test.tsx`, plus types/hooks as needed); see root §3 rule 16. Export new components from this layer's `index.ts`.
