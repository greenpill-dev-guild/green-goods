# Account Recovery Hardening Plan

**Feature Slug**: `account-recovery-hardening`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-05-24T04:21:07.501Z`
**Last Updated**: `2026-05-24T04:59:58Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Ship passkey-server continuity first for June 10 | It addresses logout/reinstall/browser-PWA recovery without adding a Green Goods-owned centralized API. |
| 2 | Keep localStorage as cache and legacy fallback | Current users should not be broken while the server-backed path becomes default for new credentials. |
| 3 | Mark contracts `n/a` in this hub | ENS L2 sender recovery is username recovery, not passkey credential recovery, and remains a linked follow-up. |
| 4 | Treat Kernel guardian recovery as a spike | Same-address lost-passkey recovery is valuable but requires deeper account/plugin work and setup before loss. |
| 5 | Gate passkey-server auth behind `VITE_PASSKEY_SERVER_ENABLED` | Staging-first rollout gives QA a kill switch and avoids making the hosted path an untested production dependency. |
| 6 | Ask for username/ENS handle only when local credential cache is missing | This preserves the low-friction same-device path while creating a recovery path after storage loss. |
| 7 | Treat legacy local-only users as fallback-only until migration is proven | Existing credentials may not be attachable to Pimlico's hosted server; do not promise same-address migration without proof. |
| 8 | Require canonical RP/origin and address-continuity proof before production enablement | Passkey recovery can only be trusted if server-discovered credentials rebuild the expected smart-account address from approved origins. |
| 9 | Add privacy-safe recovery telemetry and stale-doc cleanup to release gates | Support needs reason codes and current docs without leaking identifiers or repeating old IndexedDB/ENS recovery claims. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror: `packages/shared/src/workflows/authServices.ts` and Pimlico config helpers
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Server-backed passkey registration/login | `state_api` | Step 1 | todo |
| Staging-first rollout flag | `state_api` | Step 1 | todo |
| Legacy local credential fallback | `state_api`, `ui` | Step 2 | todo |
| Username recovery prompt and guarded new-account path | `ui`, `state_api` | Step 3 | todo |
| Production RP/origin/address gates | `state_api`, `qa_pass_1` | Step 4 | todo |
| Kernel/ENS recovery boundary | `state_api` | Step 5 | spike |
| Browser/PWA/reinstall QA matrix | `qa_pass_1`, `qa_pass_2` | Step 6 | blocked |
| Docs/support readiness | `ui`, `state_api`, `qa_pass_2` | Step 7 | todo |

## Implementation Steps

### Step 1: Add Pimlico Passkey Server Client

- Create a shared passkey-server client from existing Pimlico chain/API-key config.
- Read `VITE_PASSKEY_SERVER_ENABLED` through the existing env/config surface; keep the default disabled.
- Centralize normalized username/ENS-handle context construction and use it for both registration and lookup.
- Register via `startRegistration` -> `createWebAuthnCredential` -> `verifyRegistration`.
- Login via `getCredentials` / WebAuthn authentication / `verifyAuthentication` where supported by installed APIs.
- Build the Kernel smart account exactly as today after a verified credential is available.
- Add a proof note or test fixture for whether existing local credentials can be migrated/imported into the hosted passkey server; until proven, do not implement migration as a promised path.
- Prove the exact installed `permissionless@0.2.57` login route before implementation hardens around it. If `startAuthentication()` cannot be scoped by username/context, use `getCredentials(context)` as the account-discovery boundary and document whether server-side auth verification is available or deferred.

### Step 2: Preserve Legacy Local Users

- Keep same-device login working when a local credential exists.
- Do not delete local credential data on server/network failure.
- Record whether the active session came from server-backed credential lookup or legacy local fallback so UI can guide re-enrollment.
- If server lookup returns no credential and local credential exists, keep local fallback as the primary path and show re-enrollment guidance after login.
- Store or derive the expected smart-account address for the active account and fail closed if a recovered credential rebuilds a different address.

### Step 3: Add User-Facing Recovery States

- Replace broad "this device only" warning with more precise copy:
  - synced passkeys can recover across devices/providers that support sync;
  - old local-only passkeys may need re-enrollment;
  - lost-passkey same-address recovery is not yet available.
- When local credential cache is missing, show a username/ENS-handle recovery prompt before attempting server-backed lookup.
- If recovery lookup fails, show retry/fallback guidance and require explicit confirmation before creating a separate new account/address.
- Do not begin passkey registration/login from in-app browsers, unsupported webviews, or known wrong-browser contexts; route to existing browser guidance before the ceremony.
- Add i18n for new strings.

### Step 4: Add Production Readiness Gates

- Confirm Pimlico dashboard/config has isolated staging and production passkey-server settings, approved RP ID, and approved origin(s).
- Require production RP ID `greengoods.app`; record any allowed origin beyond the canonical Green Goods origin as an explicit exception.
- Add structured failure categories for user cancellation, no credential, unsupported context, RP/origin mismatch, server unavailable, and smart-account address mismatch.
- Ensure new recovery telemetry emits source/outcome/reason codes only, not username, credential ID, wallet address, or smart-account address.
- Document rollback: set `VITE_PASSKEY_SERVER_ENABLED=false`, redeploy, and verify legacy local fallback remains available.

### Step 5: Record Follow-Up Recovery Boundary

- Link `.plans/backlog/ens-l2-sender-admin-recovery/` as username/exact-name recovery dependency.
- Create a non-blocking Linear spike for Kernel guardian recovery and ENS username-recovery boundaries.
- Do not add contract work to this release hub.

### Step 6: QA Matrix And Release Evidence

- Create account, logout, and log back in with the same username.
- Clear local storage or reinstall PWA, then log back in with synced passkey.
- Create passkey in browser, test installed PWA sign-in where the platform/provider supports passkey sync.
- Verify server has no credential but local credential exists.
- Verify passkey server unavailable does not wipe session data or force account creation.
- Verify failed recovery followed by guarded new-account creation copy.
- Verify unsupported/in-app browser contexts do not start a passkey ceremony.
- Verify address mismatch fails closed and does not authenticate as the wrong account.
- Record tested platform/provider combinations, including desktop Chrome, Android Chrome/PWA, iOS Safari/PWA if available, and unsupported/in-app browser negative coverage.

### Step 7: Clean Up Docs And Support Surfaces

- Update or annotate stale docs that claim passkey credential IDs are stored in IndexedDB or ENS text records are the recovery path.
- Add `VITE_PASSKEY_SERVER_ENABLED` to developer environment docs.
- Rename or rewrite stale test descriptions that currently claim "Pimlico Server Flow" while covering client-only behavior.
- Add a short support runbook section in the plan report or handoff for common failure categories and the rollback flag.

## Lane Checklists

### UI (`claude/ui/account-recovery-hardening`)

- [ ] Add recovery/fallback copy and i18n.
- [ ] Show legacy local-only re-enrollment guidance without blocking same-device login.
- [ ] Avoid overclaiming recovery when provider sync is unavailable.
- [ ] Write `handoffs/claude-ui.md`.

### State / API (`codex/state-api/account-recovery-hardening`)

- [ ] Add shared Pimlico passkey-server client.
- [ ] Add and respect `VITE_PASSKEY_SERVER_ENABLED`.
- [ ] Centralize normalized username/ENS-handle context construction.
- [ ] Replace local-only registration/login with server-backed first path.
- [ ] Keep local credential fallback and failure-safe storage behavior.
- [ ] Prove or explicitly defer legacy credential server migration/import.
- [ ] Prove canonical RP/origin and same-address continuity for server-backed login.
- [ ] Add privacy-safe recovery telemetry or redact reused auth telemetry for recovery paths.
- [ ] Document exact installed `permissionless` passkey-server API usage and any upgrade requirement.
- [ ] Add focused auth service/machine tests.
- [ ] Write `handoffs/codex-state-api.md`.

### Contracts (`n/a`)

- [x] No contract implementation in this release hub.
- [x] Keep ENS L2 sender recovery in `.plans/backlog/ens-l2-sender-admin-recovery/`.

### QA Pass 1 (`claude/qa-pass-1/account-recovery-hardening`)

- [ ] Run the account recovery QA matrix.
- [ ] Verify staging/prod passkey-server environment isolation evidence is attached.
- [ ] Verify unsupported browser/webview negative cases.
- [ ] Verify acceptance criteria from `eval.md`.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/account-recovery-hardening`)

- [ ] Start only after QA pass 1 is passed.
- [ ] Re-run targeted shared auth tests and release gates.
- [ ] Confirm docs/support cleanup and rollback instructions are complete.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] Targeted shared auth tests, for example `bun run --cwd packages/shared test -- src/__tests__/workflows/authServices.test.ts src/__tests__/workflows/authMachine.test.ts`
- [ ] `bun run build:shared`
- [ ] Manual passkey QA matrix evidence in `reports/`
- [ ] Docs/support cleanup evidence in `reports/` or lane handoffs
