# ui/templates — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**What:** page-level layout skeletons with named slots: `AppShell`, `SplitView`, `CenteredLayout`.

**Rules**
- Arrange organisms/molecules via slot props (`header`, `main`, `aside`, `footer`); they do not create content.
- Own responsive behaviour and landmark semantics (`header`, `main`, `nav`, `aside`).
- No real data, no copy, no routing, no i18n, no Jotai, no React Query.
- A template renders correctly with placeholder nodes in every slot.

**Shared-UI boundaries (hard)**
- No product domain, no i18n, no React Query, no Jotai, no `domain/` imports.

**Tests**
- Per template: placeholder nodes in each slot render in the right landmarks; omitted slots don't leave empty wrappers.

**Structure**
- Each component is a folder (`Name/index.ts`, `Name.tsx`, `Name.test.tsx`, plus types/hooks as needed); see root §3 rule 16. Export new components from this layer's `index.ts`.
