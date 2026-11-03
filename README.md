# tax-refund-agent

Open-source, local-first AI agent that helps you claim tax deductions (home office, work equipment, commute, …). Germany first; other countries plug in as packs.

1. Upload receipts/invoices. 2. The agent checks refundability against cited rules. 3. It asks for missing info. 4. It produces a field-by-field summary for ELSTER plus a document checklist. **You** enter and submit; nothing is ever sent to a tax authority.

## Run
```
git clone https://github.com/s0aee1d/tax-refund-agent && cd tax-refund-agent
cp .env.example .env   # add your LLM key
npm install && npm run dev:server & npm run dev:web
```

## Model options
The agent, tools, prompts and flow are identical for every model. Pick one in `.env`; nothing else changes.

| `LLM_PROVIDER` | Needs | Notes |
|---|---|---|
| `anthropic`, `openai` | API key | PDF and image receipts |
| `ollama` | a local Ollama server | images only |
| `claude-code` | the `claude` CLI installed and logged in (uses your Claude subscription, no API key) | images only; each answer takes a few seconds longer and counts against your Claude plan |

`claude-code` uses the CLI purely as a language model. The app's own loop still runs the tools, shows question cards, and asks you to approve the export. Tool calling is emulated by a small adapter (`apps/server/src/agent/model/toolCalling.ts`) that only the model factory knows about. The CLI session is locked down: no shell, file or web tools, none of your Claude account's connectors (such as Gmail), nothing saved to `~/.claude`, and every call starts a fresh, stateless session.

## Privacy
Your data stays in `./data` on your machine. The only network egress is to the LLM provider you configure (with `claude-code`, that is Anthropic via the CLI). Use the delete action to wipe a profile/year.

## Disclaimer
Not tax advice. Verify results or ask a Steuerberater.

Conventions for humans and AI agents: see `AGENT.md`.
