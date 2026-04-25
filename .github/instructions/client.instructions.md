---
applyTo: "packages/client/**"
---

- `packages/client` is the end-user web app. Hooks, providers, and most business logic should come from `@green-goods/shared`.
- Do not add local hooks or providers when the logic belongs in shared.
- Preserve the offline-first queue flow for work submission; do not bypass the queue for passkey users.
- Keep authentication branches on shared auth APIs and shared default-chain helpers instead of wallet chain state.
- Manage blob URLs through shared utilities such as `mediaResourceManager`; do not leave orphaned `URL.createObjectURL` values behind.
- Prefer event-driven invalidation over polling.
- New user-facing strings must be added to all three locale files.
- Validate with `cd packages/client && bun run test && bun run build`; if the change reaches into shared hooks or providers, also run `node scripts/dev/ci-local.js --quick` from the repo root.
