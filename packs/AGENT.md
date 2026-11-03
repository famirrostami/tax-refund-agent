# packs — AGENT.md

Inherits the root `/AGENT.md` (rules 17–18). Coding/structure conventions only; the tax content itself is data in each pack.

```
packs/<cc>/
  pack.json        manifest: country, currency, tax authority, supported years, locale
  prompt.md        country-specific agent instructions (loaded into the system prompt)
  categories.json  deduction categories (id, label key, description for the classifier, required docs, questions)
  rules/           rule files: id, tax_year, text, limits, source_url, last_verified
  forms/           est.<year>.json: form fields (official line, German/English label, unit, verification) and rule -> field mappings
  documents.json   checklist items per rule (document or information, official flag + source) and the official upload steps
  corpus/          documents embedded for RAG
  evals/           labelled cases
```

- Every file is validated by a Zod schema in the pack loader; `npm run validate:packs` runs it in CI.
- Every rule needs `id`, `tax_year`, `source_url`, `last_verified`.
- Adding a country = adding a folder that passes validation. If core code must change, the abstraction is wrong.
- User-visible strings are i18n keys or per-locale files, not hard-coded English.
- Forms (`forms/est.<year>.json`, `yearFormsSchema`): every supported year needs a file. `fields[]` hold the official `line` (e.g. "34", "49-51") or `null` when unconfirmed; `mappings[]` connect a rule id to field ids with a small path language (`facts.x`, `result.amount`, optional `minus`, or `choose` on a fact). Every rule valid for a year needs a mapping, or an `informational` note when nothing is entered (e.g. automatic allowances).
- A year whose official form is not published uses `status: "pending"` and `extends: <earlier year>`: labels are inherited, line numbers are withheld (`null`). Never copy line numbers into a new year until the new instructions are read.
- Line numbers come only from the official ELSTER instructions or the form itself, never from advice sites.
- `documents.json` (`documentsSchema`): every item says whether it is `official` (stated by an official source, then it must carry the source) or only a recommendation of the app. Never mark something official from memory. Upload and retention steps come from the official instructions of `based_on_year`; other years show a warning until the new instructions are read.
