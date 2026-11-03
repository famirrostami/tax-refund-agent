# ui/atoms — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** smallest indivisible UI elements: `Button`, `Input`, `Text`, `Icon`, `Badge`, `Spinner`, `Avatar`, `Checkbox`.

**Rules**
- Wrap one native element (or none). Forward `ref`, spread remaining native props, accept `className`.
- Import nothing except React, tokens/styles and other files in `atoms/` (prefer none).
- No text of their own: label, placeholder, aria text all via props. Icon-only atoms *require* an `aria-label` prop in the type.
- Variants through a small closed prop set (`size`, `tone`); no product-specific variants.
- No state beyond what the native element needs (controlled via props; uncontrolled only for trivial inputs).
- No data, no i18n, no Jotai, no React Query.
- If it needs another atom, it is a molecule.

**Shared-UI boundaries (hard)**
- No product domain: no `domain/` imports, no domain vocabulary in names, props or classes.
- No `react-i18next`/`i18n`, no `@tanstack/react-query`, no `jotai`. May use `lib/` helpers.

**Tests**
- One `Name.test.tsx` per atom, props only: renders, forwards `ref`/native props, variants, disabled, and a11y name (role + label from props).

**Structure**
- Each component is a folder (`Name/index.ts`, `Name.tsx`, `Name.test.tsx`, plus types/hooks as needed); see root §3 rule 16 (global unit-folder rule). Export new components from this layer's `index.ts`.
