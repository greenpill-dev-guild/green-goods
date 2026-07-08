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
  - failed recovery shows retry/fallback guidance and keeps account creation out of the recovery sub-flow.
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

### 2026-07-06 Fix Validation

- GREEN: `bun run --cwd packages/shared test -- src/__tests__/workflows/authServices.test.ts src/__tests__/modules/app/error-categories.test.ts src/__tests__/modules/app/sentry-redaction.test.ts` passed: 3 files, 44 tests.
- GREEN: `bun run --cwd packages/shared test -- src/__tests__/config/passkeyServer.test.ts src/__tests__/workflows/authServices.test.ts src/__tests__/modules/session.test.ts src/__tests__/workflows/authMachine.test.ts src/__tests__/hooks/useAuth.test.ts src/__tests__/modules/app/error-categories.test.ts src/__tests__/modules/app/sentry-redaction.test.ts` passed: 7 files, 117 tests.
- GREEN: `bun run --cwd packages/client test -- src/__tests__/views/Login.test.tsx src/__tests__/manifest/pwa-routing.test.ts src/__tests__/manifest/pwa-manifest.test.ts src/__tests__/manifest/vercel-routing.test.ts src/__tests__/routes/PwaRuntime.test.tsx src/__tests__/views/InstallCta.test.tsx src/__tests__/components/PublicInstallAction.test.tsx` passed: 7 files, 54 tests.
- GREEN: `bun run --cwd packages/shared typecheck` passed.

### Browser Proof

Using the in-app Browser against `https://127.0.0.1:5173/home/login?presentation=pwa`:

- Default no-local-cache state rendered username/ENS recovery input, synced/legacy passkey guidance, disabled recovery until input, wallet fallback, and entry/create separation without an in-recovery account-creation fork.
- Failed recovery with no local cache rendered a recoverable error, retained the typed username, and kept retry/back visible without exposing a separate-account fork on the recovery surface.
- Fresh account creation remains available only by returning to the entry screen and choosing the normal create-account flow.

### Remaining QA Risks

- Real synced-passkey recovery still needs staging provider evidence across browser/PWA/platform combinations.
- Production enablement still needs RP/origin and staging/prod passkey-server isolation evidence.
- Address mismatch is unit-simulated; live mismatch proof depends on QA harness capability.
- Legacy local-only hosted-server import/migration is explicitly not implemented or proven.
- `PRD-540` can start QA pass 1 from this handoff; `PRD-541` remains blocked until QA pass 1 completes.

### Support Runbook

| Failure category | User-facing behavior | Support / rollback action |
|---|---|---|
| `cancelled` | Keep the user on the current login/recovery form with retry available. | No escalation needed unless repeated across browsers/devices. |
| `credential_not_found` | Recovery stays on retry/back; no account is created or authenticated from the recovery sub-flow. | Confirm the typed recovery name, provider passkey sync, and whether the user can use same-device passkey login. |
| `legacy_fallback` | Same-device cached passkey can authenticate only when it has a stored local username; missing username fails closed instead of adopting the typed recovery name. | Ask the user to use the saved passkey entry path or re-enroll from an authenticated session. |
| `server_unavailable` | Local fallback may be used only when safe local metadata exists; otherwise recovery fails recoverably without clearing local data. | If incident-wide, set `VITE_PASSKEY_SERVER_ENABLED=false`, redeploy, and verify same-device passkey login remains available. |
| `unsupported_context` | Passkey ceremony is blocked before launch and browser guidance is shown. | Have the user open the supported browser/PWA context for the same RP/origin. |
| `address_mismatch` | Authentication fails closed; stored credential, username, and expected-address data are preserved. | Do not instruct the user to clear passkeys as a first step; escalate as account-continuity investigation. |

## Boundaries

- Do not add a Green Goods-owned passkey API or database.
- Do not implement Kernel guardian recovery in this lane.
- Do not touch ENS L2 sender contracts in this hub.
- Do not rely on stale IndexedDB/ENS text-record recovery docs as implementation truth.
