# evals — AGENT.md

Inherits the root `/AGENT.md` (rule 24). This folder holds only the baseline and git-ignored results; runner code is `apps/server/src/evals/`, cases are `packs/<cc>/evals/*.json`.

- Run: `npm run eval` (all suites it can run), `npm run eval -- --suite=check,search`, `--case=<id>`, `--verbose`, `--country=nl`. Exit code 1 means a regression or an unbaselined failure.
- Suites:
  - `check`, `search`: deterministic, no model, run in CI. They exercise `checkDeductibility` and `searchRules` against the pack's rules.
  - `classify`, `agent`: call a model, so they need an API key in `.env`; without one they are reported as skipped and never count as passed. `agent` runs the full tool loop with a scripted user (answers keyed by the askUser `field`).
- Baseline (`evals/baseline.json`) lists the case ids that passed. A regression is a baselined case that now fails or disappeared. Update it only with `npm run eval -- --update-baseline` after a full run, in a commit that explains why. Only suites that ran are updated; a single-case run refuses to update.
- Case formats are defined by `apps/server/src/evals/schema/schema.ts`. Ids are unique across files. Use synthetic data only, never real user documents.
- Every new tool behaviour, prompt change or rule needs at least one case; every refusal or `needs_review` path needs a negative case.
- When a case fails, decide deliberately whether the case or the product is wrong; never loosen a case just to turn it green.
- Braintrust is optional and not wired up yet; the local runner is the source of truth.
