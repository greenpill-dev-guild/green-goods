---
applyTo: "packages/agent/**"
---

- `packages/agent` is the bot and webhook service. Keep handlers pure where possible and inject dependencies that need mocking.
- Keep services behind stable helper APIs or singleton accessors rather than leaking ad hoc wiring into handlers.
- Never store plaintext private keys. Use the repo's crypto helpers for storage and retrieval.
- Rate-limit externally triggered actions and keep user-facing failures generic; do not leak internal error details.
- When handlers, adapters, or service contracts change, review response-shape drift and type safety carefully because those changes ripple quickly.
- Validate with `cd packages/agent && bun run test && bun run typecheck`; for security-sensitive or handler-heavy work, also run `cd packages/agent && bun run test:coverage`.
- If shared types or shared APIs move, also run `node scripts/dev/ci-local.js --quick` from the repo root.
