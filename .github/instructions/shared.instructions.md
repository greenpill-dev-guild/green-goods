---
applyTo: "packages/shared/**"
---

- `@green-goods/shared` is the only home for reusable hooks, providers, stores, modules, types, i18n, and shared UI primitives.
- Do not duplicate reusable hooks or providers in `client`, `admin`, or `agent`.
- Export public APIs through package barrels; do not normalize deep imports as the public contract.
- Use centralized `queryKeys`, event-driven invalidation, `useCurrentChain()` or `DEFAULT_CHAIN_ID`, `logger`, and typed domain models such as `Address`.
- New user-facing strings must be added to `src/i18n/en.json`, `src/i18n/es.json`, and `src/i18n/pt.json`.
- Shared UI primitive changes should ship with tests, barrel updates, and Storybook coverage in the same change when applicable.
- Validate with `cd packages/shared && bun run test && bun run typecheck`; if shared exports, hook signatures, or cross-package contracts move, also run `node scripts/dev/ci-local.js --quick` from the repo root.
