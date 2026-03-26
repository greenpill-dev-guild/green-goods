---
title: "GreenWill Implementation Spec (March 2026)"
sidebar_label: GreenWill Implementation
slug: /builders/specs/greenwill-gif-implementation-spec-2026-03
audience: developer
owner: docs
last_verified: 2026-03-25
feature_status: Proposed
---

# GreenWill Implementation Spec

## Purpose

This document translates the GreenWill architecture into an implementation-facing plan.

It is the delivery companion to:

- [GreenWill Badging + GIF Analysis](/builders/specs/greenwill-gif-analysis-2026-03)
- [GreenWill One-Pager](/builders/specs/greenwill-gif-one-pager-2026-03)
- [GreenWill Evaluation Plan](/builders/specs/greenwill-gif-evaluation-plan-2026-03)

Its job is to answer:

- what has to be built
- in which package or layer
- in what order
- with which dependencies
- what each milestone should prove before the next one starts

---

## Scope

This implementation spec covers GreenWill v1 and the immediate follow-on phase.

### In scope

- canonical GreenWill badge issuance on Celo
- a minimal on-chain `GreenWillRegistry`
- one lock per badge class
- role-specific Genesis badges
- starter, domain, stewardship, support, and seasonal badges
- cross-chain provenance for source events from Celo and Arbitrum
- automatic asynchronous badge issuance
- profile and proof surfaces
- evaluation hooks needed to assess badge quality and usefulness

### Out of scope

- badge-weighted governance power
- a full generalized onchain rule engine
- marketplace parity on every chain
- leaderboards
- streak systems
- broad garden competition mechanics

---

## Canonical Implementation Decisions

These are treated as settled for v1 unless explicitly revised:

1. GreenWill badges are **network-wide**.
2. Celo is the **canonical GreenWill mint chain**.
3. Source activity may occur on **Celo or Arbitrum**.
4. Seasonal badges may expire as **active** credentials while remaining permanently visible as historical credentials.
5. Operators and evaluators are separate badge families.
6. A qualifying first support action can be a:
   - vault deposit
   - cookie jar funding transaction
   - Hypercert purchase
7. GreenWillRegistry is a required early contract, not a later optional abstraction.

---

## Delivery Strategy

The recommended delivery strategy is:

1. define the canonical badge model
2. deploy the canonical registry on Celo
3. create and register Unlock locks by badge class
4. implement cross-chain source attribution
5. implement the asynchronous badge engine
6. surface earned badges and proof details in the app
7. evaluate correctness and usefulness before broadening the catalog

The system should be delivered as a thin, traceable layer rather than an all-at-once reputation economy.

---

## System Components

| Component | Responsibility | Primary location |
|---|---|---|
| `GreenWillRegistry` | canonical class registry, season model, lock mapping, status rules | `packages/contracts` |
| badge metadata catalog | class definitions, names, descriptions, CIDs, role variants | `docs` + `shared` + publishing scripts |
| badge engine | evaluates source events and determines awards | likely `packages/ops` or a dedicated service script |
| Unlock issuer | grants keys on Celo based on engine decisions | ops / service layer |
| source adapters | reads EAS, Envio, and support-source data | `packages/shared` |
| proof pages / UI | badge display, detail pages, earned moments | `packages/client`, possibly `packages/admin` |
| evaluation instrumentation | telemetry, audit logs, survey hooks, acceptance reporting | cross-package |

---

## Contract Work

## 1. `GreenWillRegistry`

### Objective

Create a minimal on-chain registry on Celo that acts as the canonical source of truth for badge classes.

### Responsibilities

- register badge classes
- map `classId -> lock address`
- map badge classes to:
  - family
  - role
  - domain
  - seasonality
  - active-expiry behavior
- store season definitions
- emit canonical registry events for offchain services and UIs

### Minimum v1 fields

```solidity
struct BadgeClass {
    bytes32 classId;
    address lock;
    uint8 family;
    uint8 role;
    uint8 domain;
    bool seasonal;
    bool activeExpires;
    string metadataCID;
}
```

### Minimum v1 functions

- `registerBadgeClass`
- `updateBadgeClassMetadata`
- `setSeason`
- `setSeasonStatus`
- `getBadgeClass`
- `getSeason`

### Required events

- `BadgeClassRegistered`
- `BadgeClassUpdated`
- `SeasonRegistered`
- `SeasonUpdated`

### Acceptance criteria

- class IDs and lock addresses are readable onchain
- season records are readable onchain
- role-specific Genesis classes can be registered without ambiguity
- registry events are sufficient for offchain consumers to mirror catalog changes

## 2. Optional v1.1 contract work

If the first release proves stable, the next contract-level addition is an explicit issuer helper or module that emits canonical `BadgeIssued` events. That is not required for v1 if the offchain engine is sufficient.

---

## Unlock Work

## 1. Lock creation model

Use one lock per badge class.

That means:

- `participant.genesis.gardener.s1` gets its own lock
- `participant.genesis.operator.s1` gets its own lock
- `starter.first_approval` gets its own lock
- `role.operator.season.q2_2026` gets its own lock

### Acceptance criteria

- every launch class has a unique lock on Celo
- every launch lock is registered in `GreenWillRegistry`
- every launch lock has published metadata and art

## 2. Issuance model

Use asynchronous issuance.

### Reasons

- source data is already split across EAS and Envio
- not every qualifying source lives on one chain
- badge mint failures should not block work approval or assessment flows

### Acceptance criteria

- the engine can issue badges without user-side manual minting
- reprocessing the same source event does not mint duplicates
- failures are logged and replayable

---

## Source Attribution Work

## 1. Canonical provenance model

Every GreenWill award should preserve the origin of the event that caused it.

### Required fields

- `mintChainId`
- `sourceChainId`
- `sourceType`
- `sourceRef`
- `sourceTxHash` or attestation UID
- `gardenAddress` or garden identifier
- `issuedAt`
- `activeUntil` when applicable

### Source types for v1

- `eas.work`
- `eas.workApproval`
- `eas.assessment`
- `vault.deposit`
- `cookieJar.deposit`
- `hypercert.purchase`

### Acceptance criteria

- every badge proof can show where the qualifying action happened
- Celo-issued badges can reference Arbitrum source events cleanly
- provenance survives UI refreshes and indexer lag

---

## Package-Level Backlog

## `packages/contracts`

### Deliverables

- `GreenWillRegistry.sol`
- tests for class registration and season handling
- deployment script support for Celo
- update deployment outputs to include registry address

### Acceptance criteria

- registry deploys on Celo via existing bun-based contract workflow
- deployment artifacts include the registry address
- tests cover role/domain/season field correctness

## `packages/shared`

### Deliverables

- badge domain types
- GreenWill registry ABI and read helpers
- badge proof data types
- source-attribution mapping utilities
- query hooks for badge lists, badge detail, and active-vs-historical status

### Acceptance criteria

- client and admin can consume one shared badge model
- active and historical seasonal status are represented distinctly
- source provenance is typed, not stringly glued together ad hoc

## `packages/indexer`

### Deliverables

- determine whether GreenWill events are indexed directly or badge views remain service-driven
- add indexing for support surfaces that are not already covered, especially if cookie jar funding is part of `support.first_support`

### Acceptance criteria

- support-source coverage is explicit
- missing sources are not silently assumed
- if a source is not indexed, the implementation spec documents the fallback read path

## `packages/client`

### Deliverables

- earned badge modal or toast
- badge summary rail
- badge detail / proof surface
- active vs historical seasonal display
- favorites / hide controls if included in v1.1 rather than v1

### Acceptance criteria

- a newly earned badge is visible without manual mint steps
- users can tell whether a seasonal badge is active or historical
- role-specific Genesis variants are readable at a glance

## `packages/admin`

### Deliverables

- badge catalog visibility for operators/admins
- season roster or Genesis qualification review tools if needed
- potential badge replay/audit tooling for manual recovery

### Acceptance criteria

- admins can understand which classes exist and which season is live
- replay or audit tooling is available for misfired issuances

## Service / ops layer

### Deliverables

- badge engine job
- lock registration workflow
- metadata publishing workflow
- issuance logging and replay support

### Acceptance criteria

- engine can be rerun safely
- failed issuances are recoverable
- lock and metadata registration are documented and reproducible

---

## Launch Milestones

## Milestone 1: Registry and Class Model

### Goal

Make badge classes canonical.

### Exit criteria

- registry deployed on Celo
- launch class IDs defined
- role-specific Genesis classes defined
- seasonal status model defined

## Milestone 2: Issuance Pipeline

### Goal

Issue badges automatically from verified source data.

### Exit criteria

- asynchronous badge engine working
- Celo lock issuance working
- no duplicate issuance on replay
- source attribution included in proof payloads

## Milestone 3: First UI Surfaces

### Goal

Make GreenWill visible and legible.

### Exit criteria

- earned badge moment visible
- user can inspect badge proof
- Genesis, starter, and domain badges render correctly

## Milestone 4: Evaluation Gate

### Goal

Validate correctness and usefulness before broadening the system.

### Exit criteria

- acceptance checks pass
- badge proof audit passes
- initial user usefulness/value feedback collected
- unresolved source-attribution gaps documented

---

## Key Risks

## 1. Over-complex v1

If too many badge families are implemented before the registry and provenance model are stable, the system becomes hard to trust.

## 2. Weak source coverage

If `support.first_support` claims to support vaults, cookie jars, and Hypercert purchases, but only one of those is reliably indexed, the badge becomes misleading.

## 3. Chain confusion

If the UI does not clearly explain “minted on Celo, sourced from Arbitrum,” the reputation model will feel inconsistent.

## 4. Missing auditability

If badges can mint automatically but there is no replay and audit tooling, operational trust will erode quickly.

---

## Implementation-Ready Deliverables

At the end of this implementation phase, the repo should contain:

- the architecture spec
- the one-pager
- this implementation spec
- a dedicated evaluation plan
- registry contract and tests
- metadata and catalog definitions
- an issuance pipeline
- at least one public badge proof surface

The evaluation plan is the next companion document and should be used as a release gate, not as a retrospective afterthought.
