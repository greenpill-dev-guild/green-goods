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

## 2026-06-09 Codex Result

### Implemented

- Added shared Pimlico hosted passkey-server helpers in `packages/shared/src/config/passkeyServer.ts`:
  - `VITE_PASSKEY_SERVER_ENABLED` gate remains default-off.
  - `createPasskeyServerClient(chainId)` uses the existing Pimlico bundler URL/API-key config.
  - `normalizePasskeyAccountIdentifier()` and `buildPasskeyRecoveryContext()` centralize username/ENS-handle context.
  - `classifyPasskeyCeremonyContext()` classifies unsupported browser/origin/RP contexts without starting a ceremony.
- Updated `packages/shared/src/workflows/authServices.ts`:
  - flag-on registration calls `startRegistration({ context })`, `createWebAuthnCredential()`, `verifyRegistration({ credential, context })`, then rebuilds the existing Kernel smart account from the verified credential.
  - flag-on recovery calls `getCredentials({ context })`, `startAuthentication()` with no context, WebAuthn `navigator.credentials.get()`, `verifyAuthentication({ raw, uuid })`, then rebuilds the smart account.
  - local credential cache remains the flag-off path and the fallback when the server has no credential or is unavailable.
  - server/network failure does not clear credential, username, auth mode, or expected-address metadata.
  - expected smart-account address is cached and recovered server metadata fails closed on mismatch.
- Updated auth storage/provider behavior:
  - regular `signOut()` keeps username, credential, and expected smart-account address for same-device fallback.
  - explicit `clearPasskey()` clears credential, username, and expected smart-account address.
- Updated auth telemetry payloads to source/outcome/reason codes only; no username, credential ID, wallet address, or smart-account address.
- Updated client login recovery UI:
  - missing local cache shows username/ENS recovery before lookup.
  - failed recovery shows retry/fallback guidance and a guarded separate-account confirmation before new account creation.
  - unsupported browser/in-app-browser guidance blocks passkey ceremonies before starting registration/login.
  - one-tap passkey login remains for users with a local credential.
  - new strings added to `en`, `es`, and `pt`.
- Updated `.env.template` with `VITE_PASSKEY_SERVER_ENABLED=false` and refreshed stale onboarding/sequence docs away from IndexedDB/ENS recovery claims.

### Installed API Proof

- Verified local `permissionless@0.2.57` exports `createPasskeyServerClient` from `permissionless/clients/passkeyServer`.
- Verified installed passkey-server methods:
  - `startRegistration({ context })`
  - `verifyRegistration({ credential, context })`
  - `getCredentials({ context })`
  - `startAuthentication()` with no context parameter
  - `verifyAuthentication({ raw, uuid })`
- No installed hosted-server import/migration API for existing local-only credentials was found. Legacy local-only credentials remain fallback-only and re-enrollment/migration stays a release risk for QA/support.

### Validation Evidence

- RED: `bun run --cwd packages/shared test -- src/__tests__/workflows/authServices.test.ts` failed before implementation for hosted server registration/login, no-credential fallback, server-unavailable fallback, and address mismatch.
- GREEN: `bun run --cwd packages/shared test -- src/__tests__/config/passkeyServer.test.ts src/__tests__/workflows/authServices.test.ts src/__tests__/modules/session.test.ts src/__tests__/workflows/authMachine.test.ts src/__tests__/hooks/useAuth.test.ts` passed: 5 files, 92 tests.
- GREEN: `bun run --cwd packages/client test -- src/__tests__/views/Login.test.tsx` passed: 18 tests.
- GREEN: `bun run build:shared` passed; shared is source-consumed and has no separate build artifact.
- GREEN: `bun run --cwd packages/client build` passed. Existing Rollup pure-annotation/chunk-size and Browserslist warnings remain.
- GREEN: `bun run lint:vocab`, `bun run check:design-md`, and `bun run check:design-tokens` passed.
- CAVEAT: `bun run check:design-generated` failed on unrelated stale generated artifact `docs/docs/builders/packages/client-pwa-token-audit.generated.md`.
- CAVEAT: `node scripts/harness/plan-hub.mjs validate` failed on unrelated malformed active hub `.plans/active/sentry-stack-observability`; no feature-scoped validate command exists.

### Browser Proof

Using the in-app Browser against `https://127.0.0.1:5173/home/login?presentation=pwa`:

- Default no-local-cache state rendered username/ENS recovery input, synced/legacy passkey guidance, disabled recovery until input, wallet fallback, separate-account link, and address-continuity notice.
- Failed recovery with no local cache and flag-off behavior rendered a recoverable error, retained the typed username, kept retry/fallback actions visible, and exposed guarded separate-account creation without overlap on a 1280x720 viewport.
- Separate-account confirmation rendered explicit copy that the new account uses a different address and will not recover access tied to the previous passkey, with `Continue to new account` and `Back to recovery` actions.

### Remaining QA Risks

- Real synced-passkey recovery still needs staging provider evidence across browser/PWA/platform combinations.
- Production enablement still needs RP/origin and staging/prod passkey-server isolation evidence.
- Address mismatch is unit-simulated; live mismatch proof depends on QA harness capability.
- Legacy local-only hosted-server import/migration is explicitly not implemented or proven.
- `PRD-540` can start QA pass 1 from this handoff; `PRD-541` remains blocked until QA pass 1 completes.

## Boundaries

- Do not add a Green Goods-owned passkey API or database.
- Do not implement Kernel guardian recovery in this lane.
- Do not touch ENS L2 sender contracts in this hub.
- Do not rely on stale IndexedDB/ENS text-record recovery docs as implementation truth.
