---
title: "Passkey Server Hardening and Recovery-Ready Auth (March 2026)"
sidebar_label: Passkey Server Hardening
slug: /builders/specs/passkey-server-hardening-and-recovery-ready-auth-2026-03
audience: developer
owner: docs
last_verified: 2026-03-26
feature_status: Proposed
---

# Passkey Server Hardening and Recovery-Ready Authentication

Date: 2026-03-26  
Author: Green Goods research draft  
Status: Proposed implementation spec

## Purpose

This spec defines how Green Goods should move from its current local-only passkey model to a hardened passkey-server model that:

- preserves the current passkey-first UX
- supports multi-device login for the same smart account
- minimizes Android RP ID and origin failures
- prepares the auth stack for operator-assisted Kernel recovery

This is the delivery-facing companion to the account recovery design work and should be treated as the authentication foundation for any future recovery or signer-rotation work.

---

## Claim validation

### Validated

- Pimlico supports a passkey server flow for Kernel smart accounts.  
  Source: [Pimlico passkey server guide](https://docs.pimlico.io/guides/how-to/signers/passkey-server)
- Pimlico states that passkeys in `permissionless` are currently supported only with Kernel accounts.  
  Source: [Pimlico passkey server guide](https://docs.pimlico.io/guides/how-to/signers/passkey-server)
- Pimlico supports multiple alternative signer integrations, including Privy, Dynamic, Web3Auth, Turnkey, Para, and Magic.  
  Sources:  
  [Pimlico Privy](https://docs.pimlico.io/guides/how-to/signers/privy)  
  [Pimlico Dynamic](https://docs.pimlico.io/guides/how-to/signers/dynamic)  
  [Pimlico Web3Auth](https://docs.pimlico.io/guides/how-to/signers/web3auth)  
  [Pimlico Turnkey](https://docs.pimlico.io/guides/how-to/signers/turnkey)  
  [Pimlico Para](https://docs.pimlico.io/guides/how-to/signers/para)  
  [Pimlico Magic](https://docs.pimlico.io/guides/how-to/signers/magic)
- Passkeys.dev recommends a single common RP ID for greenfield multi-origin deployments and documents Related Origin Requests as an advanced option rather than the default path.  
  Source: [passkeys.dev Related Origin Requests](https://passkeys.dev/docs/advanced/related-origins/)
- Related Origin Requests require a well-known configuration and client support, and existing deployments still need identifier-first fallback when credentials were minted under different RP IDs.  
  Source: [passkeys.dev Related Origin Requests](https://passkeys.dev/docs/advanced/related-origins/)

### Validated against current Green Goods code

- Green Goods currently fixes production RP ID to `greengoods.app` and explicitly notes Android strictness around RP continuity.  
  Source: `packages/shared/src/config/passkeyServer.ts:18`
- Green Goods currently stores passkey credential metadata locally and reconstructs the smart account from the stored credential.  
  Sources:  
  `packages/shared/src/modules/auth/session.ts:220`  
  `packages/shared/src/workflows/authServices.ts:107`
- Green Goods currently fails login if the stored credential is gone.  
  Source: `packages/shared/src/workflows/authServices.ts:298`
- Green Goods already detects unsupported browser contexts and prompts users to move to Chrome or Safari.  
  Source: `packages/client/src/views/Login/index.tsx:20`
- Green Goods already warns users that current passkey access is device-local and can be lost if browser data is cleared.  
  Source: `packages/client/src/views/Profile/AccountInfo.tsx:126`

### Inference

- The most likely root cause of previous Android issues was not "using a passkey server" by itself, but inconsistent alignment between `rp.id`, `expectedOrigin`, the actual auth origin, and Android/browser context.
- The simplest stable production configuration for Green Goods is a single canonical auth origin plus one production RP ID, rather than multi-origin passkey ceremonies.

---

## Problem statement

The current Green Goods passkey flow is intentionally simple, but that simplicity now blocks three product requirements:

1. multi-device continuity
2. recovery-ready signer rotation
3. diagnosable Android/browser passkey behavior

Today, account continuity depends too heavily on local browser state. That creates a brittle user experience and makes recovery integration more complicated than it needs to be.

---

## Goals

- support login to the same Green Goods smart account across multiple devices
- preserve Kernel + Pimlico bundler/paymaster architecture
- keep passkey UX as a first-class onboarding path
- reduce Android/WebAuthn support issues through canonical RP/origin discipline
- make the auth model account-first rather than credential-first
- prepare the authentication layer for operator-assisted recovery and future signer rotation

## Non-goals

- replace passkeys with embedded wallets
- support arbitrary preview URLs or staging URLs inside the same passkey namespace
- build social recovery in this spec
- solve support-team identity verification policy in this spec

---

## Current architecture and gaps

## What exists today

- Passkey creation uses `createWebAuthnCredential(...)` with a fixed production RP ID.  
  Source: `packages/shared/src/config/passkeyServer.ts:72`
- The app stores credential metadata in localStorage.  
  Source: `packages/shared/src/modules/auth/session.ts:227`
- The app builds the Kernel smart account from the stored credential at login and session restore time.  
  Source: `packages/shared/src/workflows/authServices.ts:107`
- The passkey login path assumes the credential already exists locally.  
  Source: `packages/shared/src/workflows/authServices.ts:298`

## Why it is insufficient

- device loss or browser-storage loss strands the user
- second-device login is not a first-class flow
- recovery cannot be layered cleanly when the app derives identity primarily from the local credential
- Android/WebView issues are hard to debug if auth may begin from many origins or contexts

---

## Canonical implementation decisions

These decisions should be treated as settled unless explicitly revised.

1. Production RP ID is `greengoods.app`.
2. Production passkey ceremonies run only from approved HTTPS origins.
3. Green Goods should prefer one canonical auth origin for passkey login.
4. In-app browsers and unsupported webviews are not passkey-capable environments for Green Goods.
5. The smart-account address is first-class stored account state.
6. Passkey-server credential discovery replaces local-only credential lookup.
7. Staging and localhost are isolated from production passkey credentials.

---

## Recommended production topology

## RP and origin model

- `rp.id`: `greengoods.app`
- `rp.name`: `Green Goods`
- canonical auth origin: `https://www.greengoods.app`
- optional secondary supported origin only if unavoidable and explicitly allowlisted

### Rationale

- one RP ID
- one common auth origin
- fewer Android/browser mismatches
- simpler support and logging
- cleaner documentation for users and operators

## Environment separation

- production passkey server project
- staging passkey server project
- localhost development passkey server project or local mock

Production credentials must never be created from preview URLs or localhost.

---

## Target architecture

| Component | Responsibility | Primary location |
|---|---|---|
| passkey client | start registration, verify registration, fetch credentials | `packages/shared` |
| auth state machine | account-first auth and signer selection | `packages/shared` |
| account session storage | canonical account metadata, not only credential metadata | `packages/shared` |
| passkey server integration | credential registration and lookup | backend service or Pimlico-hosted configuration |
| browser-context guardrails | wrong-browser / in-app-browser enforcement | `packages/shared` + `packages/client` |
| auth diagnostics | log RP/origin/context failure class | `packages/shared` |

---

## Data model

Green Goods should add explicit account identity records.

### Minimum account fields

- `accountId`
- `smartAccountAddress`
- `primaryAuthMode`
- `passkeyAccountIdentifier`
- `recoveryEnabled`
- `createdAt`
- `lastAuthenticatedAt`

### Minimum passkey fields

- `credentialIds`
- `rpId`
- `registeredOrigin`
- `lastSuccessfulOrigin`
- `lastSuccessfulPlatform`
- `lastSuccessfulBrowser`

### Storage guidance

- local session state may cache the active account identifier and smart-account address
- credential metadata may be cached locally for UX optimization, but local cache is not the source of truth
- backend-side account records must be the canonical source for account discovery and recovery preparation

---

## Auth flow design

## New registration

1. User starts from canonical auth origin.
2. Client calls passkey-server `startRegistration`.
3. Client performs WebAuthn registration.
4. Client calls `verifyRegistration`.
5. Server returns verified credential metadata.
6. Client creates Kernel smart account using the verified credential.
7. Client stores:
   - smart-account address
   - account identifier
   - auth mode
8. Client proceeds to post-registration onboarding.

## Returning login

1. User starts from canonical auth origin.
2. User identifies account via remembered session or identifier-first flow.
3. Client requests matching credential metadata from passkey server.
4. Client prompts WebAuthn login using server-provided credential context.
5. Client rebuilds signer/account client against the canonical smart-account address.
6. Client restores authenticated session.

## Second-device login

1. User opens Green Goods on new device.
2. User enters account identifier or equivalent account lookup handle.
3. Client fetches matching credential references from passkey server.
4. WebAuthn prompts for the user passkey on the new device.
5. Same smart-account address is restored.

---

## Browser and platform policy

## Allowed contexts

- Chrome on Android
- Safari on iOS
- major desktop browsers that support Green Goods passkey requirements

## Blocked or discouraged contexts

- in-app browsers
- embedded webviews
- unknown browsers with incomplete WebAuthn support

## UX requirements

- do not begin passkey registration or login if `useInstallGuidance()` identifies `wrong-browser` or `in-app-browser`
- redirect or instruct before ceremony start
- log the blocked context so support can distinguish product failure from browser-context failure

---

## Security requirements

- server `expectedRPID` must exactly match `greengoods.app` in production
- server `expectedOrigin` must be an explicit allowlist
- no wildcard production origin handling
- no production passkey operations from non-production hosts
- all passkey server requests must be HTTPS
- auth logs must exclude private credential material
- support tools must classify failures into:
  - missing credential discovery
  - origin mismatch
  - RP mismatch
  - user cancellation
  - unsupported browser context
  - network failure

---

## Package boundaries

This implementation should follow Green Goods package rules:

- auth hooks/providers remain in `@green-goods/shared`
- `packages/client` owns views and interaction surfaces only
- passkey utilities and auth state machine changes belong in `packages/shared`
- any server adapter or backend service should be isolated behind a small integration boundary

Do not create client-local auth hooks.

---

## Coding patterns and practices

### Required

- make the auth layer account-first, not credential-first
- keep browser-context detection centralized
- keep RP/origin configuration centralized
- use explicit typed session records rather than ad hoc localStorage keys spread across modules
- log structured auth failures with stable categories
- keep authentication side effects inside the shared auth workflow layer

### Avoid

- deriving the canonical account only from the local credential
- starting passkey ceremonies from multiple production origins
- environment-specific hidden auth behavior
- passkey-only assumptions in code that should be signer-agnostic for recovery work

---

## Testing strategy

## Unit tests

- RP ID resolution logic
- canonical-origin enforcement
- account-first session restoration
- credential-discovery fallback
- auth failure classification

## Integration tests

- registration on canonical origin
- login after browser storage clear when account is still server-discoverable
- second-device login
- blocked in-app browser flow
- Android-specific login path with server discovery

## Manual QA matrix

- Android Chrome
- iOS Safari
- desktop Chrome
- desktop Safari
- desktop Firefox if supported
- in-app browser negative tests

---

## Rollout plan

## Phase 1: account-first auth foundations

- add canonical smart-account address to stored session model
- add explicit account identifier
- refactor auth restore/login around account identity

## Phase 2: passkey-server integration

- integrate registration verification and credential discovery
- remove local-only dependency for login

## Phase 3: platform hardening

- enforce canonical auth origin
- improve wrong-browser / in-app-browser handling
- add structured auth telemetry

## Phase 4: recovery readiness

- ensure signer rotation can restore the same smart-account address
- prepare state model for recovery-enabled accounts

---

## Acceptance criteria

- a user can create an account on device A and log in on device B
- clearing local browser data no longer guarantees permanent account loss
- Android production login works reliably when initiated from supported contexts
- auth diagnostics identify whether failure came from RP/origin mismatch, browser context, discovery failure, or user cancellation
- the auth model can support future recovery without changing account address semantics

---

## Risks and mitigations

- Risk: Android login failures persist because unsupported contexts still leak through.  
  Mitigation: block ceremony start in unsupported contexts and funnel all passkey auth through one canonical origin.
- Risk: support confusion across prod/staging/localhost credentials.  
  Mitigation: isolate passkey projects and document environment boundaries clearly.
- Risk: partial migration leaves both credential-first and account-first logic alive.  
  Mitigation: centralize auth state transitions in shared workflows and remove duplicated assumptions.
- Risk: multi-origin requirements return later.  
  Mitigation: treat Related Origin Requests as a later enhancement, not a prerequisite.

---

## Future-looking simplifications

The following may simplify Green Goods auth over time:

- a mature passkey-server deployment solves multi-device continuity now
- recoverable embedded signers may reduce need for support-led recovery for some cohorts
- signer rotation inside the same smart account can let users move between passkey, embedded, and wallet control without changing addresses
- Related Origin Requests may help if Green Goods truly needs multiple passkey-capable origins later

---

## Sources

- [Pimlico passkey server guide](https://docs.pimlico.io/guides/how-to/signers/passkey-server)
- [Pimlico account comparison](https://docs.pimlico.io/guides/how-to/accounts/comparison)
- [passkeys.dev Related Origin Requests](https://passkeys.dev/docs/advanced/related-origins/)
- `packages/shared/src/config/passkeyServer.ts`
- `packages/shared/src/workflows/authServices.ts`
- `packages/shared/src/modules/auth/session.ts`
- `packages/client/src/views/Login/index.tsx`
- `packages/client/src/views/Profile/AccountInfo.tsx`
