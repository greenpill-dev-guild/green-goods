# Account Recovery Hardening Spec

## Summary

Implement a passkey-server-first auth path for Green Goods using Pimlico's hosted passkey server and the current `permissionless` passkey server client APIs. LocalStorage remains a fast cache and legacy fallback, but server-backed WebAuthn credential metadata becomes the recovery path for users whose passkeys are synced by Google Password Manager, iCloud Keychain, or a compatible provider. The server path is gated by `VITE_PASSKEY_SERVER_ENABLED` and must be enabled in staging before production.

## Users

- Primary: gardeners using passkeys in the installed PWA or browser.
- Secondary: QA and support operators validating June 10 release hardening.
- Deferred: users who fully lose their passkey provider account or never enrolled recovery before loss.

## Functional Requirements

1. Register new passkeys through Pimlico passkey-server start/verify registration when `VITE_PASSKEY_SERVER_ENABLED=true`, then build the existing Kernel smart account from the verified credential.
2. Authenticate existing users by looking up credentials by normalized username through the passkey server, invoking platform WebAuthn, verifying through the server, and rebuilding the same smart account.
3. Preserve legacy local-only users: if server lookup fails but a local credential exists, same-device login remains possible and the UI can guide re-enrollment.
4. Never clear stored passkey credentials or username only because the passkey server is unavailable or a network request fails.
5. Keep the release scope clear: account continuity for synced passkeys is in scope; same-address recovery after total passkey loss is follow-up research.
6. If local credential cache is missing, show a username/ENS-handle recovery prompt before server lookup instead of routing directly to account creation.
7. Any account creation path after failed recovery must explicitly confirm that it creates a separate smart-account address.

## Gap Closure Decisions

- Rollout: add `VITE_PASSKEY_SERVER_ENABLED=false` by default and enable the server-backed path in staging first.
- Login recovery: keep one-tap passkey login when local credential cache exists; ask for username or ENS handle only when local credential cache is missing.
- Legacy users: preserve same-device login and re-enrollment guidance, but do not promise same-address server migration until an implementation spike proves existing local credentials can be safely attached to the hosted passkey server.
- Identity context: centralize username/handle normalization and use the same normalized value for registration and login.
- Privacy: new server context and analytics must not include wallet address, smart-account address, credential ID, email, or other sensitive identifiers unless a future privacy review explicitly approves it.

## Research Evidence

- Current implementation uses `packages/shared/src/config/passkeyServer.ts` to create client-only credentials and store them in localStorage.
- Current auth services in `packages/shared/src/workflows/authServices.ts` build Kernel smart accounts with `toKernelSmartAccount`, `toWebAuthnAccount`, `permissionless`, `viem`, and Pimlico bundler/paymaster config.
- Local package state includes `permissionless@0.2.57`; installed types expose `createPasskeyServerClient`, `startRegistration`, `verifyRegistration`, `getCredentials`, `startAuthentication`, and `verifyAuthentication`.
- Pimlico docs now recommend a passkey server for sharing the same credential across multiple devices and document the hosted server client flow.
- ZeroDev docs support Kernel guardian recovery, but that is a separate permissions/plugin layer and should not be promised as a June 10 ship item.
- The existing unlisted builder spec `docs/docs/builders/specs/passkey-server-hardening-and-recovery-ready-auth-2026-03.md` already captures canonical RP/origin, browser-context, and account-first recovery constraints; this active hub must carry the release-critical subset forward.

## Remaining Human Judgment Points

- How much warning copy to retain once synced-passkey recovery works better; the warning should become precise rather than fear-based.
- Whether future recovery should use self-recovery, dApp-assisted guardians, or a wallet/social-sign-in recovery identity.

## Production Readiness Requirements

- Canonical auth posture: production ceremonies use RP ID `greengoods.app`, approved HTTPS origin(s) only, and no production credentials from preview URLs, localhost, in-app browsers, or unsupported webviews.
- Environment isolation: staging, production, and localhost/mock passkey-server projects must be separate or explicitly proven isolated in Pimlico dashboard/config evidence.
- Account-first invariant: after server-backed registration/login, the implementation stores or derives the expected smart-account address and proves subsequent login rebuilds the same address before marking the session authenticated.
- Installed API proof: implement against local `permissionless@0.2.57` first; specifically prove the chosen login route because local types expose `getCredentials(context)` but `startAuthentication()` does not accept context.
- Telemetry privacy: either redact existing auth trackers for this flow or add recovery-specific events that use stable reason codes and source flags only. Do not emit username, credential ID, wallet address, or smart-account address in new recovery telemetry.
- Operational rollback: production enablement requires a documented flag rollback path, server-unavailable UX evidence, and no destructive local storage behavior during Pimlico passkey-server incidents.
- Documentation alignment: stale docs that say passkey credential IDs live in IndexedDB or ENS text-record sync supports recovery must be updated or explicitly marked historical before release signoff.

## Non-Functional Constraints

- Package boundaries: shared auth logic belongs in `packages/shared`; PWA copy and flow affordances belong in `packages/client`.
- Security: Pimlico passkey server stores public WebAuthn credential metadata, not private keys. Do not introduce server-side Green Goods custody.
- Reliability: network/server failures must degrade to explicit retry or legacy local fallback, not forced account creation.
- Offline / sync: account recovery requires network access; offline mode must not pretend recovery is possible.
- Localization: new user-facing strings require i18n entries.
- Rollout: production must not depend on the Pimlico hosted passkey-server path until the staging flag has QA evidence.
- Supportability: auth failures must be classifiable as user cancellation, no credential found, unsupported browser/context, RP/origin mismatch, server unavailable, or address mismatch.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Recovery copy, legacy local-user fallback, passkey unavailable states |
| State / API | `state_api` | Pimlico passkey-server client, auth service integration, session/cache behavior |
| Contracts | `contracts` | `n/a` for this release hub; ENS recovery stays in the existing backlog hub |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential manual and regression proof for account continuity |

## Risks

- Risk: passkey server context uses username as lookup key, so username normalization must match registration and login.
- Mitigation: centralize context construction and add unit coverage for registration/login using the same username.
- Risk: existing local-only credentials may not be importable into Pimlico's hosted passkey server.
- Mitigation: treat migration as a proof task; until proven, only promise local fallback plus re-enrollment guidance.
- Risk: provider/browser differences still limit browser-to-PWA continuity on some devices.
- Mitigation: QA records provider-specific results and the UI avoids overclaiming universal recovery.
- Risk: `permissionless@0.2.57` APIs may differ from docs for `0.3.5`.
- Mitigation: implement against installed types first; upgrade only if typecheck/tests prove the current API is insufficient.
- Risk: server lookup may return credential metadata that builds a different smart-account address than the user's expected account.
- Mitigation: treat address mismatch as a hard auth failure and require explicit separate-account confirmation if the user chooses to continue.
- Risk: current docs and test names overstate server-backed passkey readiness.
- Mitigation: add docs/test cleanup to release gates so production support does not rely on stale IndexedDB/ENS recovery claims.
