# apps/web — AGENT.md

Inherits the root `/AGENT.md`. React 18 + Vite PWA.

- Entry (`main.tsx`) only mounts providers: `QueryClientProvider`, Jotai `Provider`, i18n, then the router/page.
- Layer map and import direction: see root §1. Each layer folder has its own `AGENT.md`.
- Global styles and design tokens live in `src/styles.css`; components consume tokens, never redefine them.
- Dev proxy/config lives in `vite.config.ts`; no environment-specific URLs in source.
- Libraries: `@tanstack/react-query`, `jotai`, `react-i18next`/`i18next`. Do not add alternatives.
- Tests: Vitest + Testing Library (+ `jest-dom`), run with `npm test`. Files sit next to the source: `Foo.test.tsx` / `foo.test.ts`.
  - `lib/`, `domain/` (type-level), `api/` mappers: plain unit tests.
  - `ui/*`: render with props only; no providers, no mocks of data/i18n/state layers. Assert roles, labels and callbacks.
  - `api/`: test DTO → domain mapping and query/mutation behaviour with a mocked `fetch`/MSW and a fresh `QueryClient` per test.
  - `state/`: test atoms through a Jotai `createStore()`.
  - `pages/`: integration tests with real providers, `en` resources and a mocked network.
- Layers added since the first cut: `domain/` (app types) and `lib/` (pure helpers); see their `AGENT.md`.
- Test helpers live in `src/test/`: `setup.ts` (jest-dom, cleanup), `render.tsx` (`renderWithProviders`, `createWrapper`), `network.ts` (`mockApi`, `sseResponse`).
- `src/architecture.test.ts` enforces the import boundaries in root §1/§3 (e.g. `ui/` must not import `api`, `state`, `i18n`, `domain`, React Query, Jotai or i18next; `fetch` only in `api/`). Fix the import, never the test.
