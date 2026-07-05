# Commitment Pooling: Diagrams

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (source of truth for every contract name, function, event, and state), `settlement-spec.md` (SettlementModule + Celo Safe topology, D8–D10), `uiux-spec.md` (surface flows), `wireframes.md` (screens). These diagrams are execution reference for implementers and reviewers; they introduce nothing the specs do not already define.

**Docs-site promotion**: these diagrams live here until the August release ships. Promotion into `docs/docs/builders/architecture/` (sequence-diagrams, ERD, plus a commitment journey doc) rides [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680); see §8 for the two *edits* to existing docs diagrams that ship at the same time.

| # | Diagram | Grounding |
|---|---|---|
| D1 | Contract topology + EAS bridge | contract-spec §4, §6.5 |
| D2 | Happy path: offer → claim → work → approval bridge → confirm → fulfilled → reward | contract-spec §5.3, §6.1, §6.5 |
| D3 | Analog capture + lightweight evidence (review-is-confirmation) | contract-spec §5.3 paths (b), uiux-spec §6.5, §5.5–5.6 |
| D4 | Pool state machine (all on-chain) | contract-spec §5.1 |
| D5 | Cycle state machine (on-chain + derived) | contract-spec §5.2 |
| D6 | Commitment state machine (on-chain + derived) | contract-spec §5.3 |
| D7 | Indexer entity delta (ERD) | contract-spec §8.2 |
| D8 | G$ fund-flow topology (HoA → Safes → members) | settlement-spec §2, §4 |
| D9 | Settlement sequence with failure/retry | settlement-spec §3.3 |
| D10 | Disbursement state machine | settlement-spec §3.2–3.3 |

**Legend for state diagrams**: solid = on-chain state (a named module function performs the transition and emits the listed event); dashed = derived state (indexer/app computes it from events; the chain never stores it); grey dashed = app-only (IndexedDB draft, no chain or indexer presence).

---

## D1. Contract topology + EAS bridge

Two NET-NEW contracts, two live upgrades, two new EAS schema/resolver pairs. Commitments are module-native records; EAS carries only assessment v3 and community testimony (decision #14). The module never custodies funds.

```mermaid
flowchart LR
  subgraph apps["Apps: client PWA · admin · editorial · community"]
    Q["Offline job queue<br/>IndexedDB + XState<br/>5 new job kinds"]
  end

  IDX["Envio indexer<br/>CommitmentPool · CommitmentCycle<br/>Commitment · CommitmentEvent"]

  subgraph chain["Arbitrum One"]
    GT["GardenToken<br/>(live UUPS, upgrade: module field)"]
    HM["HatsModule<br/>six garden role hats"]
    CPM["CommitmentPoolingModule<br/>NET-NEW control plane"]
    CR["CommitmentRegister<br/>NET-NEW non-transferable unit ledger"]
    WAR["WorkApprovalResolver<br/>(live UUPS, upgrade: bridge hook)"]
    AV3["AssessmentV3Resolver<br/>NET-NEW"]
    CTR["CommunityTestimonyResolver<br/>NET-NEW"]
    EAS["EAS<br/>SchemaRegistry + attestations"]
    JAR["CookieJar / treasury<br/>reward rails, unchanged"]
  end

  GT -- "onGardenMinted (try/catch,<br/>mint never reverts)" --> CPM
  CPM -- "onlyModule mutations:<br/>registerClass · commitUnits ·<br/>releaseUnits · fulfillUnits" --> CR
  CPM -- "steward + member gates" --> HM
  EAS -- "onAttest" --> WAR
  EAS -- "onAttest" --> AV3
  EAS -- "onAttest" --> CTR
  WAR -- "onWorkApproved (try/catch,<br/>approval never blocked)" --> CPM
  CPM -- "getAttestation verify<br/>(work · approval · assessment)" --> EAS
  CPM -. "events only" .-> IDX
  CR -. "events only" .-> IDX
  IDX -.-> apps
  Q -- "module writes on sync" --> CPM
  JAR --- CPM
```

Notes:

- The `JAR — CPM` link is informational only: payouts execute on existing rails (jar withdrawal, treasury tx); the module records `RewardPaid` after the fact (decision #18).
- EAS is **not** indexed (`packages/indexer/schema.graphql:282-288` boundary). Every entity and stat derives from module + register events alone — that is why the dashed event edges are the indexer's only inputs.
- The resolver → module hook mirrors the existing KarmaGAP coupling: optional address, try/catch, disable by setting zero.

## D2. Happy path: DomainImpact offer, open claim

Preconditions: pool `Open`, cycle `Open` (steward already ran `seedCycle` → `openCycle`). Direction `Offer` means the creator is the unit provider; the claimant becomes the counterparty and confirms. Self-confirmation is blocked on-chain.

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator (gardener, provider)
  actor B as Claimant (counterparty)
  actor OP as Steward (operator)
  participant PWA as PWA + offline queue
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister
  participant EAS as EAS
  participant WAR as WorkApprovalResolver
  participant JAR as CookieJar / treasury
  participant IDX as Indexer

  A->>PWA: create offer (Draft in IndexedDB)
  PWA->>M: createCommitment(params) on sync
  M->>R: registerClass(commitmentId, poolId, unitLabel, targetUnits)
  M-->>IDX: CommitmentCreated (state Offered)
  alt ClaimMode.Open (garden campaign default)
    B->>M: claimCommitment(commitmentId, kind, gardenContext)
    M->>R: commitUnits(class, provider = A, units)
    M-->>IDX: CommitmentAccepted
  else ClaimMode.ApprovalGated (protocol pool default)
    B->>M: claimCommitment(commitmentId, kind, gardenContext)
    M-->>IDX: ClaimRequested (state unchanged)
    OP->>M: acceptClaim(commitmentId, claimant, kind, gardenContext)
    M->>R: commitUnits(class, provider = A, units)
    M-->>IDX: CommitmentAccepted
  end
  A->>EAS: submit Work (existing work flow, unchanged)
  A->>M: linkWork(commitmentId, workUID)
  M->>EAS: getAttestation(workUID) — schema + recipient check
  M-->>IDX: WorkLinked (derived state flips to Active)
  OP->>EAS: attest WorkApproval (existing approval flow)
  EAS->>WAR: onAttest — full existing validation
  WAR->>M: onWorkApproved(workUID, approvalUID, garden) in try/catch
  M-->>IDX: ApprovedWorkCounted(count, approvedUnits)
  Note over M: approvedWorkCount reaches requiredApprovedWorkCount<br/>and assessment requirement satisfied → auto-flip
  M-->>IDX: CommitmentReadyForConfirmation
  B->>M: confirmFulfillment(commitmentId)
  M-->>IDX: ConfirmationRecorded (n of N)
  M->>R: fulfillUnits(class, provider = A, units)
  M-->>IDX: CommitmentFulfilled (client hero moment fires)
  OP->>JAR: execute payout on existing rail
  OP->>M: recordRewardPaid(commitmentId, token, amount, payoutRef)
  M-->>IDX: RewardPaid
  OP->>M: closeCycle(cycleId)
  M-->>IDX: CycleClosed (derived Reconciled for the cycle's commitments)
```

Recovery path not shown: approvals that land before `linkWork` are recovered by steward-called `syncApprovedWork(commitmentId, approvalUIDs)` (verifies each approval on EAS, dedupes via `approvalCounted`).

## D3. Analog capture + lightweight evidence (review-is-confirmation)

The SupportService / OperatorCaptured path: no Work/WorkApproval rails, `requiredApprovedWorkCount == 0`, counterparty confirmation IS the review (decision #20). The member stays the named promise source; the operator is metadata (`recordedBy`).

```mermaid
sequenceDiagram
  autonumber
  actor MEM as Member (promise source)
  actor OP as Steward (operator)
  actor CP as Counterparty (confirmer)
  participant ADM as Admin capture flow
  participant PWA as Member PWA + offline queue
  participant M as CommitmentPoolingModule
  participant IDX as Indexer

  MEM--)OP: promise made off-app (conversation, field visit)
  OP->>ADM: analog capture — member, kind, terms
  ADM->>M: createCommitment(OperatorCaptured, onBehalfOf = member)
  M-->>IDX: CommitmentCreated(creator = member, recordedBy = operator)
  Note over PWA: member's detail shows<br/>"Recorded by your operator on your behalf.<br/>The promise stays yours."
  MEM->>PWA: attach evidence offline (photo, link, note)
  Note over PWA: evidence job queued in IndexedDB,<br/>media serialized, survives restart
  PWA->>M: attachEvidence(commitmentId, cid) on sync
  M-->>IDX: EvidenceAttached (derived EvidenceSubmitted)
  MEM->>M: submitForConfirmation(commitmentId)
  Note over M: allowed because requiredApprovedWorkCount == 0<br/>and at least one evidence is attached
  M-->>IDX: CommitmentReadyForConfirmation
  CP->>M: confirmFulfillment(commitmentId)
  M-->>IDX: ConfirmationRecorded → CommitmentFulfilled
  Note over CP,M: self-confirmation blocked on-chain.<br/>Steward fallback confirmFulfillmentAsFallback<br/>always carries a visible reason
```

## D4. Pool state machine

Every pool transition is on-chain (rare operator console actions). One pool per garden, idempotent registration; the protocol pool is the root garden's pool (tokenId 1).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> NotReady : onGardenMinted / registerPool
  NotReady --> Ready : markPoolReady (charter CID required)
  Ready --> Open : openPool
  Open --> Paused : pausePool
  Paused --> Open : resumePool
  Open --> Closed : closePool
  Paused --> Closed : closePool
  Closed --> Composted : compostPool
  Composted --> Ready : reopenPool(toOpen = false)
  Composted --> Open : reopenPool(toOpen = true)
```

Pool-level `Paused` blocks new commitments, claims, and confirmations on that pool only; module-wide `setPaused` blocks all mutations except dispute resolution and cancel (stewards can always wind down).

## D5. Cycle state machine (types: Season, Campaign)

On-chain enum stores `Seeded / Open / Reconciled / Composted / Cancelled`. `Draft` is app-only; `InProgress` and `Reviewing` are derived overlays of on-chain `Open`.

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e,stroke-dasharray: 6 4
  classDef appOnly fill:#ececec,stroke:#8a8a8a,stroke-dasharray: 2 3

  Draft: Draft (admin IndexedDB only)
  InProgress: InProgress (derived)
  Reviewing: Reviewing (derived)

  [*] --> Draft
  Draft --> Seeded : seedCycle (allocation bps sum = 10000)
  Seeded --> Open : openCycle (CycleOpened carries the bps snapshot)
  Open --> InProgress : first CommitmentAccepted, or startTime reached
  InProgress --> Reviewing : endTime passed, or all commitments terminal / ready
  Reviewing --> InProgress : new evidence, work link, or approval count
  Reviewing --> Reconciled : closeCycle (the reconcile act)
  Open --> Reconciled : closeCycle
  Reconciled --> Composted : compostCycle
  Seeded --> Cancelled : cancelCycle(reasonCID)
  Open --> Cancelled : cancelCycle(reasonCID)
  Composted --> [*] : succession = fresh seedCycle on the same pool

  class InProgress derived
  class Reviewing derived
  class Draft appOnly
```

`InProgress` is on-chain `Open`, so `cancelCycle` covers it; Draft cancels are an off-chain discard. Succession is derived by pool ordering — no on-chain predecessor pointer.

## D6. Commitment state machine

On-chain enum stores `Offered / Requested / Accepted / ReadyForConfirmation / Fulfilled / Cancelled / Expired / Disputed`. `Draft` is app-only; `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived. While the derived overlays are showing, the on-chain state remains `Accepted` — so the cancel/expire/dispute transitions drawn from `Accepted` apply to all three overlays.

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e,stroke-dasharray: 6 4
  classDef appOnly fill:#ececec,stroke:#8a8a8a,stroke-dasharray: 2 3

  Draft: Draft (client/admin IndexedDB)
  Active: Active (derived)
  EvidenceSubmitted: EvidenceSubmitted (derived)
  PartiallyApproved: PartiallyApproved (derived)
  Reconciled: Reconciled (derived)

  [*] --> Draft
  Draft --> Offered : createCommitment (direction Offer)
  Draft --> Requested : createCommitment (direction Request)
  Offered --> Accepted : claimCommitment (Open) / acceptClaim (gated)
  Requested --> Accepted : claimCommitment (Open) / acceptClaim (gated)
  Accepted --> Active : first WorkLinked or EvidenceAttached
  Active --> EvidenceSubmitted : EvidenceAttached / WorkLinked
  EvidenceSubmitted --> PartiallyApproved : ApprovedWorkCounted (0 < n < required)
  PartiallyApproved --> EvidenceSubmitted : new evidence or work
  PartiallyApproved --> ReadyForConfirmation : path (a) approvals complete + assessment satisfied
  Accepted --> ReadyForConfirmation : path (b) submitForConfirmation (zero-work types) · path (c) steward override with reason
  ReadyForConfirmation --> Fulfilled : confirmFulfillment reaches threshold N / steward fallback with reason
  Offered --> Cancelled : cancelCommitment (creator)
  Requested --> Cancelled : cancelCommitment (creator)
  Accepted --> Cancelled : cancelCommitment (steward)
  Offered --> Expired : expireCommitment (permissionless, past due)
  Requested --> Expired : expireCommitment
  Accepted --> Expired : expireCommitment
  ReadyForConfirmation --> Expired : expireCommitment
  Accepted --> Disputed : raiseDispute(reasonCID)
  ReadyForConfirmation --> Disputed : raiseDispute(reasonCID)
  Expired --> Disputed : raiseDispute(reasonCID)
  Disputed --> ReadyForConfirmation : resolveDispute (steward)
  Disputed --> Fulfilled : resolveDispute (steward)
  Disputed --> Cancelled : resolveDispute (steward)
  Disputed --> Expired : resolveDispute (steward)
  Disputed --> Reconciled : resolveDispute (only when cycle already Reconciled)
  Fulfilled --> Reconciled : CycleClosed
  Cancelled --> Reconciled : CycleClosed
  Expired --> Reconciled : CycleClosed

  class Active derived
  class EvidenceSubmitted derived
  class PartiallyApproved derived
  class Reconciled derived
  class Draft appOnly
```

Register coupling per transition: create → `registerClass`; accept → `commitUnits`; cancel/expire → `releaseUnits`; fulfill → `fulfillUnits` (all-or-nothing in MVP). Cycle-less commitments (cycleId 0) derive `Reconciled` from `PoolClosed` instead of `CycleClosed`.

## D7. Indexer entity delta (ERD)

Four NET-NEW entities, all derived exclusively from module + register events (`chainId-identifier` composite IDs). `GARDEN` is the existing entity; the docs-site ERD gains this delta at ship via PRD-680.

```mermaid
erDiagram
  GARDEN ||--|| COMMITMENT_POOL : "one pool per garden"
  COMMITMENT_POOL ||--o{ COMMITMENT_CYCLE : "cycles"
  COMMITMENT_POOL ||--o{ COMMITMENT : "commitments"
  COMMITMENT_CYCLE |o--o{ COMMITMENT : "cycle-scoped, optional"
  COMMITMENT_POOL ||--o{ COMMITMENT_EVENT : "audit trail"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_EVENT : "cycle events"
  COMMITMENT |o--o{ COMMITMENT_EVENT : "commitment events"

  COMMITMENT_POOL {
    ID id "chainId-poolId"
    String garden "garden account address"
    CommitmentPoolType poolType "GARDEN or PROTOCOL"
    CommitmentPoolState state
    BigInt expectedUnits "denominator for progress"
    BigInt approvedUnits "numerator for workApprovalProgress"
    BigInt fulfilledUnits "numerator for cycleCompletionRate"
    BigInt openExposureUnits "safety gauge"
    BigInt commitmentsDue "accepted minus cancelled"
    BigInt commitmentsFulfilled "numerator for promiseKeptRate"
  }
  COMMITMENT_CYCLE {
    ID id "chainId-cycleId"
    CommitmentCycleType cycleType "SEASON or CAMPAIGN"
    CommitmentCycleState state "on-chain vocabulary only"
    Int gardenersBps "allocation snapshot from CycleOpened"
    Int treasuryBps ""
    Int operatorBps ""
    Int evaluatorBps ""
    Int communityBps ""
    Int funderBps ""
  }
  COMMITMENT {
    ID id "chainId-commitmentId"
    String creator "social source"
    String recordedBy "differs for OperatorCaptured"
    String counterparty "null until accepted"
    CommitmentDirection direction "OFFER or REQUEST"
    CommitmentKind commitmentType
    CommitmentOnchainState state "derived overlays computed in shared selectors"
    CommitmentClaimMode claimMode "OPEN or APPROVAL_GATED"
    BigInt targetUnits ""
    Int confirmationThreshold "N of named group"
  }
  COMMITMENT_EVENT {
    ID id "chainId-txHash-logIndex"
    CommitmentEventType eventType "34 values, one row per event"
    String actor ""
    String data "reason / CID / payoutRef"
    Int timestamp ""
  }
```

Full field lists: contract-spec §8.2. The four locked aggregates stay numerator/denominator pairs (integer math; division happens in shared selectors, never stored): `workApprovalProgress`, `promiseKeptRate`, `cycleCompletionRate`, `openExposureUnits`.

---

## D8. G$ fund-flow topology (settlement, August)

Split-state settlement per `settlement-spec.md`: authorization on Arbitrum (garden-account-anchored, Hats-gated), execution on Celo from garden-attributed Safes with Zodiac-scoped signers. Canonical G$ never leaves Celo; no bridge carries value authority.

```mermaid
flowchart TD
  HOA["House of Alignment<br/>G$ stream (Celo)"]
  WC["Dev Guild Working Capital Safe<br/>(Celo, exists, receiving today)"]
  GG["Green Goods protocol Safe (Celo, exists)<br/>settlement account of the PROTOCOL pool"]
  GS["Garden Celo Safes NET-NEW<br/>ONE per garden, 1:1, owned by the garden account<br/>deployed on demand (script or admin trigger,<br/>deterministic salt from the garden account)"]
  MEM["Members<br/>same-address smart accounts (Celo)"]

  subgraph ARB["Arbitrum control plane"]
    HATS["Hats<br/>steward gates"]
    CPM2["CommitmentPoolingModule<br/>Fulfilled commitments"]
    SM["SettlementModule NET-NEW<br/>accounts · queue · states · executionRefs"]
  end

  HOA -->|stream| WC
  WC -->|"funding hop (recorded as Funding disbursement)"| GG
  GG -->|"funding hop (recorded)"| GS
  GG -->|"protocol-pool disbursements"| MEM
  GS -->|"garden disbursements"| MEM

  HATS --> SM
  CPM2 -->|"Fulfilled read at queue time"| SM
  SM -. "queued batches authorize execution<br/>(human executor in August;<br/>bridge-executor module post-August)" .-> GG
  SM -. " " .-> GS
  GG -. "recordSettled(celoTxHash)" .-> SM
```

## D9. Settlement sequence with failure/retry

```mermaid
sequenceDiagram
  autonumber
  actor OP as Steward (Arbitrum)
  actor EX as Executor (Celo Safe signer)
  participant SM as SettlementModule (Arbitrum)
  participant CPM as CommitmentPoolingModule
  participant SAFE as Garden Celo Safe (Zodiac-scoped)
  participant GD as G$ token (Celo)
  participant MEM as Member smart account (Celo)
  participant IDX as Indexer

  Note over SM: prerequisite: registerSettlementAccount(garden, 42220, safe)
  OP->>SM: queueDisbursement(commitmentId, recipient, G$, amount)
  SM->>CPM: getCommitment — state must be Fulfilled
  SM-->>IDX: DisbursementQueued (PWA reward row: "support on its way")
  EX->>SM: createBatch(garden, ids) then markExecuting(batchId)
  SM-->>IDX: BatchExecuting
  EX->>SAFE: execute batch (Roles-scoped: G$ transfer only, Allowance-capped)
  SAFE->>GD: transfer(recipient, amount)
  GD->>MEM: G$ received at counterfactual address (no member gas)
  alt execution succeeds
    EX->>SM: recordBatchSettled(batchId, celoTxHash)
    SM-->>IDX: DisbursementSettled (PWA: "support arrived")
  else execution fails
    EX->>SM: recordFailed(id, reasonCID)
    SM-->>IDX: DisbursementFailed (PWA: "still arranging support — your promise is recorded")
    OP->>SM: requeue(id) — attempts increments
    SM-->>IDX: DisbursementRequeued
  end
```

## D10. Disbursement state machine (all module-native, on-chain)

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Queued : queueDisbursement / queueFunding (steward)
  Queued --> Executing : markExecuting (executor)
  Executing --> Settled : recordSettled(executionRef)
  Queued --> Settled : recordSettled (manual single, executionRef)
  Executing --> Failed : recordFailed(reasonCID)
  Failed --> Queued : requeue (steward, attempts increments)
  Queued --> Cancelled : cancelDisbursement(reasonCID)
  Failed --> Cancelled : cancelDisbursement(reasonCID)
  Settled --> [*]
  Cancelled --> [*] : frees the commitment for a fresh queue
```

A failed Celo leg never touches commitment state — `Fulfilled` on the pooling module is permanent; only the disbursement record cycles. Reward-status precedence for UI: settlement-module record when a disbursement exists, else pooling-module `rewardPaid` (settlement-spec §3.3).

---

## Appendix: Edits to EXISTING docs diagrams at ship (PRD-680 scope)

Not performed now — the docs site describes what is live. Flagged on the Linear issue so they ship with the release:

1. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Work submission and approval**: after WorkApprovalResolver validation, add the optional bridge step — `WorkApprovalResolver → CommitmentPoolingModule.onWorkApproved (try/catch, non-blocking)` with a one-line note that approvals count toward pre-linked commitments only.
2. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Assessment flow**: add the v3 authorship split — baseline by evaluator OR operator; delta/re-assessment and technical by Evaluator Hat only; community testimony (Community Hat) as its own thin sequence.
3. **`docs/docs/builders/architecture/erd.mdx`**: append the D7 entity delta and the two new contract blocks to the contract-to-indexer event mapping.
