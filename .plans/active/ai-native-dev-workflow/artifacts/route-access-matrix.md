# Route/Access Matrix

Use this when a feature touches routes, auth gates, role gates, shells, navigation, or public API route paths. Keep the matrix scoped to changed or newly exposed routes; do not copy the full router unless the router itself is the work.

## Template

| Surface | Path | Shell/handler | Access rule | Role gate | Data source | Proof |
|---|---|---|---|---|---|---|
| client public / client PWA / admin / agent API |  |  | public / authenticated / origin-gated / token-gated |  |  |  |

## Current Pilot

| Surface | Path | Shell/handler | Access rule | Role gate | Data source | Proof |
|---|---|---|---|---|---|---|
| agent API | `PUBLIC_AGENT_ROUTES.uploadSign` (`/api/uploads/sign`) | `packages/agent/src/api/server.ts` upload signing handler | public browser exception guarded by origin allowlist, request limits, MIME/size constraints, short TTL, and rate limit | none | shared public contract + Pinata signer config | `bun run test:agent`; `bun run build:agent` |

Route/access matrix requirement for this pass: `N/A` for route changes because the path, origin policy, auth policy, and role gate do not change.
