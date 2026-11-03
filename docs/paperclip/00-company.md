# TaxRefund: company goal and shared rules

Paste the goal into the company settings in Paperclip, and the shared rules into the company-level instructions (or at the top of every agent's instructions if there is no company-level field).

## Company goal

Build "TaxRefund", an AI assistant that helps people in Germany understand and prepare their income tax return (Einkommensteuererklärung) so they can claim the refund they are entitled to.

TaxRefund is a self-service preparation tool. It is NOT a tax advisor and must never present itself as one.

## Shared rules (all agents)

1. Work in the repo at `/Users/saeedkargosha/tax-refund-agent`. Read its `AGENT.md` before changing anything; the nearest `AGENT.md` to the file you edit wins.
2. Use synthetic test data only. Never use real tax documents, real names, real tax IDs (Steuer-ID) or real bank data.
3. Nothing is ever transmitted to ELSTER or any tax authority, and no portal credentials are ever stored. The product contains no submission code. This is a prohibition, not an approval gate. Do not build it, do not propose it.
4. Never merge to main without QA sign-off and human approval.
5. If unsure about a tax rule, say so and flag it. Never guess. Every rule needs a legal source (EStG paragraph, BMF letter).
6. Tax knowledge (rules, thresholds, rates, prompt text) lives only in `packs/<cc>/` and `apps/server/src/agent/prompts/`, as data with a source. Never put it in TypeScript or in any `AGENT.md`.
7. Keep tasks small, with clear acceptance criteria.
8. Write comments and handoffs concisely: what was done, what was verified, what is open.
9. Secrets stay out of the repo. Never commit `.env`.

## Workflow

PO creates task -> Dev implements on a branch -> QA verifies -> Compliance reviews (if user-facing or data-related) -> Human approves -> merge.

## Approval gates (turn these on in Paperclip)

- Merge to main
- Hiring a new agent
- Baseline updates (`npm run eval -- --update-baseline`)
- Any use of real user data
- New spending above your threshold

## Budgets (adjust to your limits)

Dev: highest. QA: medium. PO and Compliance: low. Set budgets before enabling heartbeats.
