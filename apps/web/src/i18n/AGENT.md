# i18n — AGENT.md

Inherits root and `apps/web/AGENT.md`.

**Rules**
- `react-i18next` configured in `index.ts`; imported once from `main.tsx`.
- Locale resources in `locales/<lng>/<namespace>.json`. Only `en` for now; adding a language must need zero component changes.
- Namespaces map to pages (`chat`, `gate`, `common`). Keys are semantic and nested, never the English sentence (`chat.composer.placeholder`).
- Use interpolation and plural forms (`{{count}}`); never concatenate fragments. Format dates/numbers with `Intl`.
- Type-safe keys: derive key types from the `en` resources.
- Only `pages/` call `useTranslation`. `ui/`, `api/` and `state/` must not import this folder.
- Server errors arrive as codes and are mapped to keys in pages.

**Tests**
- A test asserts every key used in `pages/` exists in `en`, and that locale files have identical key sets once more than one language exists.
