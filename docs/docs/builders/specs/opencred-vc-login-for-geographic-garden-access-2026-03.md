---
title: "OpenCred VC Login for Geographic Garden Access (March 2026)"
sidebar_label: OpenCred VC Login
slug: /builders/specs/opencred-vc-login-for-geographic-garden-access-2026-03
audience: developer
owner: docs
last_verified: 2026-03-26
feature_status: Proposed
---

# OpenCred / Verifiable Credential Login for Geographic Garden Access

Date: 2026-03-26  
Author: Green Goods research draft  
Status: Proposed implementation spec

## Purpose

This spec defines how Green Goods should add verifiable-credential login using OpenCred so that users can prove eligibility attributes such as ZIP code and be routed into the appropriate garden context.

This spec is intentionally separate from the signer layer. It treats verifiable credentials as an identity and eligibility mechanism, not as the blockchain transaction signer.

---

## Claim validation

### Validated

- California DMV documents OpenCred as an open source verifier platform for relying parties and developers.  
  Source: [California DMV mDL for Businesses](https://www.dmv.ca.gov/portal/ca-dmv-wallet/mdl-for-business/)
- California DMV states OpenCred can be used by websites for secure login and other relying-party workflows.  
  Source: [California DMV mDL for Businesses](https://www.dmv.ca.gov/portal/ca-dmv-wallet/mdl-for-business/)
- California DMV states OpenCred supports W3C Verifiable Credentials, W3C DIDs, OIDC, OID4VP, VC API, and CHAPI.  
  Source: [California DMV mDL for Businesses](https://www.dmv.ca.gov/portal/ca-dmv-wallet/mdl-for-business/)
- OpenCred supports native workflows, OIDC integration, HTTP API integration, and configurable claim extraction into an `id_token`.  
  Source: [OpenCred repository](https://github.com/stateofca/opencred)
- OpenCred OIDC currently returns an `id_token`, exposes discovery endpoints, and documents that PKCE is not yet supported.  
  Source: [OpenCred repository](https://github.com/stateofca/opencred)

### Inference

- Green Goods can use OpenCred as a verifier and identity bridge while continuing to use passkey, embedded wallet, or external wallet signers for smart-account control.
- ZIP-based garden suggestion or access policy is feasible if the chosen credential workflow exposes a locality claim and Green Goods maps that claim into a policy engine.

---

## Problem statement

Green Goods currently authenticates users by signer choice:

- passkey
- embedded wallet
- external wallet

That establishes transaction control, but it does not establish verified real-world eligibility such as geography, residency, or regulated identity attributes.

Green Goods needs a privacy-preserving way to:

- verify selected claims from a trusted issuer
- map those claims to garden eligibility
- link verified identity to an existing or new Green Goods account

without forcing users to use the credential wallet as their blockchain wallet.

---

## Goals

- allow verified login using OpenCred-compatible credential presentations
- support California mDL as the first target credential
- extract only the claims required for geographic routing and policy
- suggest or gate gardens based on verified locality
- keep verified identity and signer choice decoupled
- allow verified identity to link to the same Green Goods account over time even if signer methods change

## Non-goals

- use government-issued credentials as transaction signers
- store raw credential payloads unless legally required
- require California-only architecture forever
- redesign all community admission logic in one release

---

## Core implementation decision

Green Goods should adopt a two-layer model:

1. `identity and eligibility layer`
   - OpenCred verifies a credential and returns selected claims
2. `transaction control layer`
   - Green Goods asks the user to create or link a signer for the smart account

This separation is critical for maintainability, privacy, and future signer portability.

---

## Architecture

| Component | Responsibility | Primary location |
|---|---|---|
| OpenCred verifier | verify credential presentations and produce trusted login result | external service or Green Goods-hosted verifier |
| identity service | store verified identity records and policy decisions | backend service |
| garden eligibility engine | map verified claims to garden eligibility | backend service |
| auth linking layer | connect verified identity to signer methods and Green Goods accounts | backend + `packages/shared` auth model |
| client login UI | launch VC login and post-verification flows | `packages/client` |

---

## Recommended first integration

Use OpenCred OIDC login first.

### Why

- lower integration complexity
- standard browser redirect model
- OpenCred can return claims in `id_token`
- enough for initial ZIP-based garden eligibility use cases

### When to use the HTTP API instead

- if Green Goods needs tighter UI control
- if Green Goods needs richer raw presentation data
- if Green Goods wants same-device wallet UX orchestration beyond a redirect flow

---

## Identity model

## Verified identity

Represents a verified relationship between:

- issuer
- subject
- verification event
- selected claims

This is not the wallet.

## Green Goods account

Represents the persistent user account in Green Goods:

- user record
- smart-account address
- signer methods
- recovery settings

## Link model

One Green Goods account may be linked to:

- one verified identity
- multiple signer methods over time

The verified identity should survive signer migration.

---

## User flows

## New user with verifiable credential

1. User chooses `Verify with digital ID`.
2. Green Goods redirects to OpenCred login.
3. User presents an accepted credential, such as California mDL.
4. OpenCred verifies the presentation and returns an `id_token` with selected claims.
5. Green Goods backend validates the OpenCred result.
6. Green Goods creates:
   - verified identity record
   - provisional Green Goods user record
7. Garden eligibility engine evaluates locality rules.
8. UI shows:
   - eligible gardens
   - suggested gardens
   - any manual review requirement
9. User chooses a signer:
   - passkey
   - embedded wallet
   - external wallet

## Existing user linking verifiable identity

1. Authenticated user opens profile or onboarding step.
2. User chooses `Verify location with digital ID`.
3. OpenCred flow runs.
4. Verified identity record is linked to the existing Green Goods account.
5. Garden eligibility is refreshed.

## Returning user with prior verified identity

1. User signs in with existing signer.
2. Backend loads verified identity and policy decisions.
3. UI restores eligible garden context and prompts for re-verification if stale.

---

## Claim model

Green Goods should request only the minimum required claims.

### Minimum v1 claims

- stable subject identifier or pairwise identifier
- issuer identifier
- verification timestamp
- geographic routing claim

### Preferred geographic claim order

1. ZIP code
2. postal code equivalent
3. county or locality
4. state or region

### Optional future claims

- age threshold proof
- residency category
- organizational or program membership

Only request optional claims when tied to a concrete product rule.

---

## Data minimization policy

Green Goods should not default to storing full credential payloads.

### Store

- issuer
- subject identifier or privacy-preserving equivalent
- claim values used for policy
- verification timestamp
- policy version
- verification status

### Avoid storing by default

- full license number
- raw VC document
- unnecessary birthdate or address fields
- portrait or biometric artifacts

If legal or compliance requirements later require expanded retention, that should be defined in a separate policy spec.

---

## Garden eligibility policy model

Green Goods should treat VC-based access as a policy engine problem, not a hard-coded login branch.

### Minimum policy fields

- `policyId`
- `acceptedIssuers`
- `acceptedCredentialTypes`
- `requiredClaims`
- `zipAllowlist`
- `countyAllowlist`
- `stateAllowlist`
- `manualReviewRequired`
- `expiresAfter`
- `policyVersion`

### Example v1 policy

- issuer: California DMV approved workflow
- credential type: accepted California mDL workflow
- required claim: ZIP code
- decision:
  - if ZIP matches garden ZIP policy, suggest or allow access
  - else route to manual review or alternate garden discovery

---

## Package and service boundaries

Follow Green Goods architecture rules:

- client views remain in `packages/client`
- auth and user hooks remain in `@green-goods/shared`
- policy evaluation and verifier result processing should be backend-side
- do not put issuer trust rules in client code
- do not put garden-access decisions in presentation-only components

---

## Coding patterns and practices

### Required

- treat verified identity as separate domain state from signer state
- use backend-enforced policy evaluation
- define typed identity and eligibility records
- use explicit workflow IDs for issuer-specific integrations
- support re-verification and claim expiry without breaking account access
- keep claim extraction and mapping declarative where possible

### Avoid

- using raw unstructured credential payloads directly in UI/business logic
- letting client-provided variables decide trust
- making ZIP-based routing depend on unverifiable profile input when a VC was presented
- tying verified identity to only one signer type

---

## Security and privacy requirements

- only trust OpenCred results from configured workflows and clients
- validate `id_token` signatures and issuer metadata server-side
- treat Green Goods account-linking as a privileged operation
- prefer pairwise or hashed subject IDs over reusable raw identifiers
- support claim expiry or staleness windows
- log verification results and policy decisions without over-collecting sensitive data

### OIDC-specific note

Because OpenCred documents no PKCE support at this time, token exchange should be performed server-side and client credentials must not be exposed to browsers.

---

## UX requirements

- explain clearly that digital ID verification helps match users to the right local garden
- explain that credential verification does not replace wallet/passkey creation
- show what data is being requested before redirecting
- show what was verified after completion
- show whether garden access is:
  - automatically eligible
  - suggested
  - pending review

---

## Testing strategy

## Unit tests

- claim extraction mapping
- eligibility policy evaluation
- identity linking rules
- verification expiry handling

## Integration tests

- successful OpenCred OIDC login round trip
- ZIP-based garden suggestion
- verified identity linked to existing account
- stale verification refresh path
- manual review routing

## Manual QA

- cross-device wallet presentation flow
- same-device wallet presentation flow if enabled
- no-credential-presented failure path
- unsupported-credential failure path
- allowed issuer / disallowed issuer distinction

---

## Rollout plan

## Phase 1: verifier integration

- deploy or configure OpenCred verifier
- implement OIDC callback handling
- validate and store minimal verified identity record

## Phase 2: policy engine

- add ZIP-based garden eligibility rules
- expose suggested or eligible gardens in onboarding

## Phase 3: account linking

- link verified identity to existing or new Green Goods account
- preserve verified identity across signer changes

## Phase 4: broader issuer support

- add additional state or federal issuers
- add non-geographic policy rules as needed

---

## Acceptance criteria

- a user can complete a verifiable credential login and reach a Green Goods onboarding or account session
- Green Goods can derive geographic eligibility from verified claims
- Green Goods can suggest or allow access to gardens based on policy
- verified identity can be linked to an account regardless of signer method
- no unnecessary government-ID data is stored by default

---

## Risks and mitigations

- Risk: chosen credential workflow does not expose the exact locality claim needed.  
  Mitigation: start with a discovery spike and map available claims before committing to ZIP-only policy.
- Risk: OIDC flow is too rigid for desired UX.  
  Mitigation: start with OIDC, fall back to OpenCred HTTP API only if needed.
- Risk: VC verification is mistaken for wallet creation.  
  Mitigation: keep signer selection as an explicit post-verification step.
- Risk: privacy overreach through claim retention.  
  Mitigation: store only policy-relevant claims and adopt a data minimization rule set.

---

## Future-looking simplifications

The following developments can make this easier over time:

- broader credential issuer coverage beyond California mDL
- stronger OpenID4VP and Digital Credentials API interoperability
- improved same-device wallet invocation UX
- signer-agnostic Green Goods accounts that let verified identity remain stable while users switch between passkey, embedded wallet, and external wallet login

---

## Sources

- [California DMV mDL for Businesses](https://www.dmv.ca.gov/portal/ca-dmv-wallet/mdl-for-business/)
- [OpenCred repository](https://github.com/stateofca/opencred)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [OpenID for Verifiable Credentials whitepaper](https://openid.net/wordpress-content/uploads/2022/05/OIDF-Whitepaper_OpenID-for-Verifiable-Credentials_FINAL_2022-05-12.pdf)
- [Pimlico Privy](https://docs.pimlico.io/guides/how-to/signers/privy)
- [Pimlico Dynamic](https://docs.pimlico.io/guides/how-to/signers/dynamic)
- [Pimlico Web3Auth](https://docs.pimlico.io/guides/how-to/signers/web3auth)
- [Pimlico Turnkey](https://docs.pimlico.io/guides/how-to/signers/turnkey)
- [Pimlico Para](https://docs.pimlico.io/guides/how-to/signers/para)
- [Pimlico Magic](https://docs.pimlico.io/guides/how-to/signers/magic)
- [Pimlico EIP-7702 external wallets](https://docs.pimlico.io/guides/eip7702/external)
