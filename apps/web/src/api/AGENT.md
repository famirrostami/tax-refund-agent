# api — AGENT.md

Inherits root and `apps/web/AGENT.md`. **All server data goes through React Query.**

**Rules**
- `client.ts` is the only place that calls `fetch`; it handles base URL, auth/device headers and error normalisation.
- One module per resource (`receipts.ts`, `deductions.ts`, `chat.ts`) exporting typed `useXxxQuery` / `useXxxMutation` hooks. Components never use `useQuery` directly.
- Query keys come from a central key factory per resource (`receiptKeys.all`, `receiptKeys.detail(id)`); never inline arrays.
- Mutations declare their invalidations/optimistic updates; no manual refetch from pages.
- Server (DTO) types are defined here (`dto.ts`), mirror the wire format, and are **not exported from `api/index.ts`**.
- Every resource has a mapper in `mappers.ts` (`toReceipt(dto): Receipt`, etc.) producing `domain/` types. Hooks return domain types only (map in `queryFn` or `select`); mutations accept domain-shaped inputs and map to DTOs.
- Validate at the boundary (zod or manual guards) if the server shape is untrusted.
- Server errors are mapped to error *codes*, not text; pages translate them.
- No JSX, no Jotai, no imports from `ui/` or `pages/`. Never copy server data into Jotai.

**Tests**
- Mapper unit tests for every DTO → domain mapping (including missing/odd fields).
- Hook tests with a fresh `QueryClient` per test and mocked network: success, error (`ApiError`), invalidation after mutations, polling where applicable.

**Structure**
- Each resource/mapper with a test lives in `name/` (`index.ts`, `name.ts`, `name.test.ts`); shared untested files (`dto.ts`, `queryClient.ts`) may stay flat. See root §3 rule 16.
