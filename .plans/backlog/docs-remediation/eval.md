# Eval — Docs Remediation

Per-phase validation commands (run from repo root):

- `bun run build:docs` — must pass (onBrokenLinks throws)
- `bun run docs:audit` — no new warnings; after Phase 3, `bun run docs:audit:ci` exits 0
- `bun run lint:vocab` — when i18n or banned-vocabulary files are touched
- `bun run check:ontology` — when the glossary is touched (entity/persona rows are char-locked to the sidecar)
- Phase 0 proof: `ls docs/build/search-index*.json` shows files; served `/search-index.json` returns 200 with JSON

Every changed claim ships with the code evidence it was re-verified against; anything unverifiable is stated plainly in the PR body, never shipped as fact.
