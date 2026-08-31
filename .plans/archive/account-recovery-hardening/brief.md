# Account Recovery Hardening

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

**Slug**: `account-recovery-hardening`
**Stage**: `archive`
**Priority**: `p1`
**Created**: `2026-05-24T04:21:07.501Z`

## Problem

Green Goods passkey auth currently depends on browser-local credential metadata. That gives users a smooth first-run flow, but it fails in the exact lifecycle moments users expect recovery to work: logout and relogin, PWA reinstall, browser-to-installed-PWA handoff, clearing site data, and new-device setup with a synced passkey provider.

The product is considering removing passkeys because the current experience can strand users or create a new smart account unexpectedly. The better June 10 path is to keep passkeys, but stop treating localStorage as the recovery source of truth.

## Desired Outcome

- Users who created a Green Goods passkey can sign back in after logout, reinstall, or local data loss when their passkey provider still has the credential.
- The app uses Pimlico's hosted passkey server path instead of introducing a Green Goods-owned credential API or database.
- The Pimlico server path ships behind a public staging-first rollout flag, not as an unguarded production default.
- Returning users without local credential cache can recover through a username/ENS-handle prompt instead of being pushed toward new account creation.
- Legacy local-only passkey users are not broken; they get a same-device fallback and a clear re-enrollment path.
- The release scope is honest: synced-passkey continuity improves now, while true lost-passkey same-address recovery remains a follow-up.

## Scope Notes

- In scope: shared auth/passkey service changes, user-facing recovery and fallback states, QA matrix for browser/PWA/reinstall/new-device flows, and Linear visibility for June 10 release hardening.
- Out of scope: a Green Goods-owned passkey server, a new centralized user database, Kernel guardian/signer recovery implementation, and ENS L2 sender admin recovery implementation.
- Related follow-up: `.plans/backlog/ens-l2-sender-admin-recovery/` stays the username-recovery dependency for operator-assisted exact-name repair.
- Related research: Kernel guardian recovery is real, but is treated as a non-blocking spike because it requires account/plugin setup before loss and is not a small config flip in the current `permissionless` Kernel flow.
- Guardrail: failed recovery stays in the recovery surface with retry/back only. Fresh account creation remains a separate entry/create flow and must not be started implicitly from recovery.
- Production readiness gate: the implementation must prove canonical RP/origin configuration, address continuity, outage rollback, privacy-safe telemetry, and stale passkey docs cleanup before production enablement.
- Historical research: the March 2026 passkey-hardening proposal remains recoverable through Git history. This archived hub carries the durable release constraints and implementation record.

## Success Signal

A returning passkey user can create an account, sign out, lose local Green Goods browser/PWA storage, and sign back into the same smart-account address using the provider-backed passkey path, with QA evidence recorded before the June 10 release.
