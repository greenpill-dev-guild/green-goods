# Codex State/API Handoff

## Lane

- Branch signal: `codex/state-api/account-recovery-hardening`
- Linear issue: `PRD-537`
- Source plan: `.plans/active/account-recovery-hardening/`

## Scope

Implement Pimlico passkey-server-first auth continuity in `packages/shared`.

- Add and respect `VITE_PASSKEY_SERVER_ENABLED`; default false and keep server path staging-first.
- Add a shared Pimlico passkey-server client using existing Pimlico config and installed `permissionless@0.2.57` APIs first.
- Centralize normalized username/ENS-handle context construction and use the same value for registration and lookup.
- Register through passkey-server start/verify registration, then build the existing Kernel smart account from the verified credential.
- Authenticate through server-backed credential lookup/verification and rebuild the same smart-account address.
- Keep localStorage as cache and legacy same-device fallback.
- Do not clear credential or username data only because server/network lookup failed.
- Prove whether legacy local-only credentials can be migrated/imported into Pimlico's hosted server; until proven, keep the implementation fallback-only for legacy users.
- New analytics/server context must not add wallet address, smart-account address, credential ID, email, or other sensitive identifiers.
- Prove the exact installed `permissionless@0.2.57` login flow before coding around newer docs; local types expose `getCredentials(context)` while `startAuthentication()` has no context parameter.
- Store or derive the expected smart-account address and fail closed if server-discovered credential metadata rebuilds a different address.
- Enforce or classify canonical origin/RP failures: production RP ID `greengoods.app`, approved HTTPS origins only, and no preview/localhost production ceremonies.
- Add privacy-safe recovery telemetry with reason/source/outcome codes, or explicitly redact reused auth trackers for recovery paths.
- Document rollback via `VITE_PASSKEY_SERVER_ENABLED=false`.

## Proof

- Target `packages/shared` auth service/machine tests for server-backed register/login, legacy fallback, server failure, and storage preservation.
- Include rollout-flag-off and no-server-credential cases.
- Include address-mismatch, unsupported-context classification, telemetry payload shape, and installed API route proof.
- Run `node scripts/harness/plan-hub.mjs validate`.
- Run `bun run build:shared`.

## Boundaries

- Do not add a Green Goods-owned passkey API or database.
- Do not implement Kernel guardian recovery in this lane.
- Do not touch ENS L2 sender contracts in this hub.
- Do not rely on stale IndexedDB/ENS text-record recovery docs as implementation truth.
