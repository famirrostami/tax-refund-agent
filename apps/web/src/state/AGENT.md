# state — AGENT.md

Inherits root and `apps/web/AGENT.md`. **Client-only state uses Jotai.**

**Rules**
- Atoms hold UI/session state only: selections, drafts, preferences, panel open/closed. Anything fetched from the server belongs in React Query.
- One file per domain (`chat.atoms.ts`, `prefs.atoms.ts`); atoms are named `xxxAtom`, derived ones are small and pure.
- Persistence (`atomWithStorage`) only for explicit user preferences, with a versioned key.
- Consumed by `pages/` only; they pass values and setters to `ui/` as props.
- No JSX, no fetching inside atoms, no imports from `ui/` or `pages/`.

- State types come from `domain/` or are local UI types; never DTOs.

**Tests**
- Test atoms through a `createStore()`: initial value, writes, derived atoms. No React rendering needed.

**Structure**
- Each state module lives in a folder (`app/` → `index.ts`, `app.atoms.ts`, `app.atoms.test.ts`); see root §3 rule 16.
