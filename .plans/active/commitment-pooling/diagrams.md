# Commitment Pooling: Diagrams

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (source of truth for every contract name, function, event, and state), `settlement-spec.md` (SettlementModule + Celo Safe topology, D8–D10), `uiux-spec.md` (surface flows), `wireframes.md` (screens). These diagrams are execution reference for implementers and reviewers; they introduce nothing the specs do not already define.

**Docs-site promotion**: these diagrams live here until the August release ships. Promotion into `docs/docs/builders/architecture/` (sequence-diagrams, ERD, plus a commitment journey doc) rides [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680); see §8 for the two *edits* to existing docs diagrams that ship at the same time.

## Visual coverage matrix

This is the cross-hub inventory of 20 assets, not a table of contents for this file: 15 Mermaid diagrams (D1–D13, including D1b and D7b) render below; the rows naming Community assets resolve to `.plans/active/community-interface/` (`diagrams.md`, `wireframes.md`, `journeys.md`), and rows 15–16 resolve to the two `wireframes.md` files. “Ready” means the implementation question is answered in the named repo-native artifact; it does **not** mean the feature is live. Every Mermaid block is parsed in the final validation pass, while text frames are checked against their owning spec and route contract.

| # | Asset | Audience | Question answered | Source of truth | Current status | Correction needed | Validation method |
|---:|---|---|---|---|---|---|---|
| 1 | Unified system context | all lanes | Which users, apps, chains, read models, Safes, oracle, and token participate? | CP `contract-spec.md` §4; `settlement-spec.md` §2–5; Community `spec.md` §3 | Ready: D1 | None; keep planned/live labels current | Mermaid parse + architecture cross-read |
| 2 | Module topology and trust boundaries | contracts, security, ops | Which component may authorize, attest, index, execute, or verify? | CP `contract-spec.md` §4–7; `settlement-spec.md` §3–4 | Ready: D1b | None | Mermaid parse + interface/event cross-read |
| 3 | Permission and responsibility map | contracts, operators, QA | Who may perform each sensitive action, and who must not? | CP `contract-spec.md` §6.3; `settlement-spec.md` §3.3–4 | Ready: D13 | None | Mermaid parse + permission-matrix cross-read |
| 4 | Commitment-pooling ERD | indexer, shared | What is stored and how do composite IDs relate? | CP `contract-spec.md` §8.2 | Ready: D7 | None | Mermaid parse + GraphQL field cross-read |
| 5 | Claim-request/indexer ERD | contracts, indexer | How are stored terms, direct lookup, decline, and supersession represented? | CP `contract-spec.md` §5.3, §8.2 | Ready: D7 | None | Mermaid parse + handler acceptance cross-read |
| 6 | Settlement ERD | settlement, indexer, admin | How do accounts, immutable batches, members, and verification attempts relate? | `settlement-spec.md` §3, §6 | Ready: D7b | None | Mermaid parse + event/entity cross-read |
| 7 | Community EAS/Envio joined-read ERD | Community, indexer, evaluator | Which system owns Needs records versus protocol progress? | Community `spec.md` §4–7 | Ready: Community `diagrams.md` D3 | None | Mermaid parse + four-schema cross-read |
| 8 | Pool/cycle/commitment/NeedStatus/disbursement state machines | contracts, UI, QA | Which states are stored, derived, terminal, or recoverable? | both specs; `settlement-spec.md` §3.2 | Ready: D4–D6, D10; Community D4–D5 | None | Mermaid parse + transition-table cross-read |
| 9 | Offer/request → work → approval → confirmation → fulfillment | member, provider, implementers | How do direction, provider garden, Work, and confirmer defaults interact? | CP `contract-spec.md` §5.3, §6.1 | Ready: D2 | None | Mermaid parse + happy-path acceptance |
| 10 | Approval-gated request/accept/decline/supersede | operator, contracts, indexer | Which stored terms are consumed, and how do competing requests end? | CP `contract-spec.md` §5.3, §6.1, §8.2 | Ready: D11 | None | Mermaid parse + named claim tests |
| 11 | WorkingCapitalToProtocol and ProtocolToGarden | settlement, treasury, ops | What does Green Goods authorize, and what remains upstream? | `settlement-spec.md` §2–3 | Ready: D12 | None | Mermaid parse + derived-route tests |
| 12 | Report → oracle receipt verification | settlement, admin, QA | Why is Reported not Verified, and how do retry/stale callbacks work? | `settlement-spec.md` §3.3 | Ready: D9–D10 | None | Mermaid parse + oracle-path acceptance |
| 13 | Need → operator triage → commitment seed | member, operator | How does community intent become protocol work without changing authorship? | Community `spec.md` §6, §8 | Ready: Community D9 | None | Mermaid parse + route/spec cross-read |
| 14 | Offline/waiting-for-membership | member, shared, research | Which jobs wait without retry consumption, and how can users recover? | Community `spec.md` §8.3–8.4 | Ready: Community D8 | None | Mermaid parse + offline acceptance |
| 15 | Cross-surface flow map | product, frontend | What stays in Community, admin `/community`, and existing public client surfaces? | Community `spec.md` §3; CP `uiux-spec.md` | Ready: `wireframes.md` §1 | None | Mermaid parse + monorepo/route cross-read |
| 16 | Low-fidelity frames | member, operator, evaluator, funder | Are entry, state, failure, and recovery screens defined without decorative polish? | both UI specs | Ready: both `wireframes.md` files | None | frame inventory + accessibility review |
| 17 | Persona journeys | research, product, QA | Can every named role reach completion and recovery? | Community `journeys.md` | Ready | None | persona/role checklist |
| 18 | Customer/community journey | research, operators | What happens from discovery through withdrawal or verified outcome? | Community `journeys.md` | Ready | None | stage/recovery checklist |
| 19 | Operator service blueprint | operations, research | Which frontstage, backstage, support, and failure-recovery steps must connect? | Community `journeys.md` | Ready | None | Mermaid parse + handoff cross-read |
| 20 | Research/onboarding/review/rehearsal timeline | research, delivery leads | Who must decide what, by when, before implementation and gathering rehearsal? | Community `research-plan.md`; `journeys.md` | Ready: Community `journeys.md` timeline | None | Mermaid parse + owner/date review |

**Legend for state diagrams**: solid = on-chain state (a named module function performs the transition and emits the listed event); dashed = derived state (indexer/app computes it from events; the chain never stores it); grey dashed = app-only (IndexedDB draft, no chain or indexer presence).

---

## D1. Unified system context

Green Goods has two application roles in this plan: the existing adaptive client/public surfaces and admin, plus the **planned independent Community PWA**. Commitments are module-native on Arbitrum; EAS holds attestation records; Envio indexes only Green Goods protocol events; canonical G$ stays on Celo. Dashed arrows cross a read or operational boundary, not value custody.

```mermaid
flowchart LR
  subgraph people["People"]
    MEM["Community member"]
    PROV["Gardener / provider"]
    OP["Garden operator"]
    EVA["Evaluator"]
    FUND["Funder / collaborator"]
  end
  subgraph apps["Green Goods applications"]
    COM["Community PWA (planned)<br/>Needs · Create · Profile"]
    CLIENT["Existing client adaptive shell<br/>member commitments + public garden/funding stories"]
    ADMIN["Existing admin<br/>/community operator pools + evaluator export"]
    DOCS["Public docs/editorial<br/>built · planned · reported · oracle-verified labels"]
  end
  subgraph arb["Arbitrum control and proof"]
    MOD["CommitmentPoolingModule + Register"]
    SET["SettlementModule"]
    EAS["EAS + Green Goods resolvers"]
  end
  ENV["Envio<br/>Green Goods protocol events only"]
  subgraph celo["Celo value execution"]
    WC["Dev Guild working-capital Safe"]
    PS["Protocol Safe"]
    GS["Per-garden 2-of-3 Safes"]
    GD["Canonical G$"]
  end
  CL["Chainlink Functions<br/>finalized Celo receipt oracle"]

  MEM --> COM
  PROV --> CLIENT
  OP --> ADMIN
  EVA --> ADMIN
  FUND --> CLIENT
  COM --> EAS
  CLIENT --> MOD
  ADMIN --> MOD
  ADMIN --> SET
  MOD --> EAS
  MOD -. "events" .-> ENV
  SET -. "events" .-> ENV
  ENV -. "joined reads" .-> COM
  ENV -. "queries" .-> CLIENT
  ENV -. "queries" .-> ADMIN
  WC -->|"WorkingCapitalToProtocol"| PS
  PS -->|"ProtocolToGarden"| GS
  PS --> GD
  GS --> GD
  SET -. "authorizes + records; never calls Celo" .-> PS
  SET -. "authorizes + records; never calls Celo" .-> GS
  SET -->|"verification request"| CL
  CL -. "finalized receipt result" .-> SET
  DOCS -. "planned/live disclosure" .-> people
```

Notes:

- House of Alignment funds the Dev Guild working-capital wallet upstream; Green Goods models only the two downstream routes shown.
- EAS and raw Celo transfers are outside Envio. The joined Community read is owned in shared/query composition, not fabricated in an Envio handler.
- A report stores a Celo transaction hash but is not proof. Only a matching Chainlink Functions callback can mark the Arbitrum record `Verified`.

## D1b. Contract/module topology and trust boundaries

```mermaid
flowchart TB
  subgraph APP["Application boundary"]
    JOBS["Shared offline jobs<br/>commitment · claim · evidence · workLink · confirmation<br/>need · needSignal · testimony"]
    ONLINE["Online-only actions<br/>NeedStatus · FundingAttribution · G$ send"]
  end
  subgraph ARB["Arbitrum trust boundary"]
    HATS["HatsModule<br/>membership and scoped roles"]
    GT["GardenToken<br/>optional non-blocking pool hook"]
    CPM["CommitmentPoolingModule<br/>state + access + EAS checks"]
    REG["CommitmentRegister<br/>onlyModule unit accounting"]
    SM["SettlementModule<br/>immutable route/source/executor scope"]
    WAR["WorkApprovalResolver<br/>non-blocking approval hook"]
    RES["Need / Signal / Status / Funding resolvers"]
    EAS["EAS + SchemaRegistry"]
  end
  ENV["Envio boundary<br/>only Green Goods contract events"]
  subgraph CELO["Celo trust boundary"]
    SAFE["2-of-3 recovery Safes<br/>owners != Roles executors"]
    GD["Canonical G$ transfers"]
  end
  ORACLE["Chainlink Functions router + DON<br/>pinned source and request ID"]

  JOBS --> CPM
  JOBS --> EAS
  ONLINE --> EAS
  HATS --> CPM
  HATS --> SM
  GT -. "try/catch" .-> CPM
  CPM --> REG
  CPM --> EAS
  EAS --> WAR
  WAR -. "try/catch" .-> CPM
  EAS --> RES
  CPM -. "events" .-> ENV
  REG -. "events" .-> ENV
  SM -. "events" .-> ENV
  SM -. "authorization record" .-> SAFE
  SAFE --> GD
  SM --> ORACLE
  ORACLE -. "callback: valid / receipt-invalid / infrastructure" .-> SM
```

Trust rules: no provider may confirm their own delivery, including steward fallback; no recovery owner may be a Safe executor; no human can verify a receipt; no handler infers an actor from `transaction.from`; no contract enumerates all cycles or claims to make a transition.

## D2. Offer/request → work → approval → confirmation → fulfillment

Preconditions: pool `Open`; an optional cycle exists, belongs to the pool, and is `Open`. For an Offer, the creator is provider and accepted recipient confirms. For a Request, the accepted claimant is provider and the creator confirms. The stored `providerGarden` controls DomainImpact Work and assessment validation even when the commitment remains in the root protocol pool. Provider self-confirmation fails on every path.

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Claimant
  actor OP as Steward (operator)
  participant PWA as PWA + offline queue
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister
  participant EAS as EAS
  participant WAR as WorkApprovalResolver
  participant JAR as CookieJar / treasury
  participant IDX as Indexer

  A->>PWA: create Offer or Request (Draft in IndexedDB)
  PWA->>M: createCommitment(params) on sync
  M->>R: registerClass(commitmentId, poolId, unitLabel, targetUnits)
  M-->>IDX: CommitmentCreated (Offered or Requested)
  alt ClaimMode.Open (garden campaign default)
    B->>M: claimCommitment(commitmentId, kind, gardenContext)
    Note over M: provider is creator for Offer, claimant for Request
    Note over M: providerGarden is pool garden for Offer<br/>validated gardenContext for Request
    Note over M: confirmer is claimant for Offer, creator for Request
    M->>R: commitUnits(class, provider, units)
    M-->>IDX: CommitmentAccepted
  else ClaimMode.ApprovalGated (protocol pool default)
    B->>M: claimCommitment(commitmentId, kind, gardenContext)
    M-->>IDX: ClaimRequested (stored terms, state unchanged)
    OP->>M: acceptClaim(commitmentId, claimant)
    M->>R: commitUnits(class, derived provider, units)
    M-->>IDX: CommitmentAccepted
  end
  alt individual claim
    Note over M: Work attester must equal accepted counterparty
  else garden claim
    Note over M: Work attester must be gardener/operator<br/>of stored providerGarden
  end
  Note over M,EAS: protocol-pool Work and assessment recipient = providerGarden<br/>while commitment pool remains root protocol pool
  B->>EAS: submit Work matching required action
  B->>M: linkWork(commitmentId, workUID)
  M->>EAS: check schema, action, attester, providerGarden recipient
  M-->>IDX: WorkLinked (derived state flips to Active)
  OP->>EAS: attest WorkApproval (existing approval flow)
  EAS->>WAR: onAttest — full existing validation
  WAR->>M: onWorkApproved(workUID, approvalUID, garden) in try/catch
  M-->>IDX: ApprovedWorkCounted(count, approvedUnits, newlyApprovedUnits)
  Note over M: approvedWorkCount reaches requiredApprovedWorkCount<br/>and assessment requirement satisfied → auto-flip
  M-->>IDX: CommitmentReadyForConfirmation
  alt Offer
    B->>M: confirmFulfillment(commitmentId)
  else Request
    A->>M: confirmFulfillment(commitmentId)
  end
  Note over M: accepted provider is excluded, acceptance reverts if threshold becomes unreachable
  M-->>IDX: ConfirmationRecorded (n of N)
  M->>R: fulfillUnits(class, derived provider, units)
  M-->>IDX: CommitmentFulfilled (client hero moment fires)
  OP->>JAR: execute payout on existing rail
  OP->>M: recordRewardPaid(commitmentId, payoutRef)
  M-->>IDX: RewardPaid(derived source, provider, token, amount)
  OP->>M: closeCycle(cycleId)
  M-->>IDX: CycleClosed (derived Reconciled for the cycle's commitments)
```

Recovery: approvals that land before `linkWork` are recovered by bounded steward call `syncApprovedWork(commitmentId, approvalUIDs)`; each UID is EAS-verified and deduped through `approvalCounted`. Steward fallback still rejects the provider and records a reason.

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
  Note over CP,M: provider self-confirmation is blocked on-chain.<br/>Steward fallback also rejects the provider<br/>and always carries a visible reason
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

Pool-level `Paused` blocks new commitments, claims, and confirmations on that pool only; module-wide `setPaused` blocks operational mutations but keeps owner configuration, unpause, `cancelCommitment`, `expireCommitment`, and `resolveDispute` available for safe wind-down.

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

`InProgress` is on-chain `Open`, so `cancelCycle` covers it; Draft cancels are an off-chain discard. Succession is derived by pool ordering — no on-chain predecessor pointer. Opening validates cycle existence, pool ownership, and `Seeded` state. `Pool.openSeasonCycleId` permits exactly one open Season in O(1); any number of Campaigns may be open concurrently and no transition enumerates cycles.

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
  Disputed --> Accepted : resolveDispute (RestorePrevious)
  Disputed --> ReadyForConfirmation : resolveDispute (RestorePrevious)
  Disputed --> Expired : resolveDispute (RestorePrevious or Expired)
  Disputed --> Fulfilled : resolveDispute (Fulfilled, never from pre-dispute Expired)
  Disputed --> Cancelled : resolveDispute (Cancelled)
  Fulfilled --> Reconciled : CycleClosed
  Cancelled --> Reconciled : CycleClosed
  Expired --> Reconciled : CycleClosed

  class Active derived
  class EvidenceSubmitted derived
  class PartiallyApproved derived
  class Reconciled derived
  class Draft appOnly
```

The module stores `preDisputeState` before entering `Disputed`; `RestorePrevious` restores that exact state. There is no `Reconciled` dispute resolution. Unit accounting is exact:

- create registers the class but commits no units;
- cancellation or expiry from `Offered`/`Requested` releases nothing;
- acceptance commits units once;
- cancellation or expiry from `Accepted`/`ReadyForConfirmation` releases those committed units once;
- fulfillment converts committed units with `fulfillUnits`;
- raising or restoring a dispute has no unit effect;
- resolving to `Fulfilled`, `Cancelled`, or `Expired` applies the same conversion/release only when units are still committed; a pre-dispute `Expired` record cannot become `Fulfilled` and never releases twice.

Cycle-less commitments (`cycleId == 0`) derive `Reconciled` from `PoolClosed`; cycle-scoped terminal commitments derive it from `CycleClosed`.

## D7. Indexer entity delta (ERD)

Five NET-NEW pooling entities, all derived exclusively from module + register events (`chainId-identifier` composite IDs). `GARDEN` is the existing entity; settlement entities are shown separately in `settlement-spec.md` §6. The docs-site ERD gains this delta at ship via PRD-680.

```mermaid
erDiagram
  GARDEN ||--|| COMMITMENT_POOL : "one pool per garden"
  COMMITMENT_POOL ||--o{ COMMITMENT_CYCLE : "cycles"
  COMMITMENT_POOL ||--o{ COMMITMENT : "commitments"
  COMMITMENT_CYCLE |o--o{ COMMITMENT : "cycle-scoped, optional"
  COMMITMENT_POOL ||--o{ COMMITMENT_EVENT : "audit trail"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_EVENT : "cycle events"
  COMMITMENT |o--o{ COMMITMENT_EVENT : "commitment events"
  COMMITMENT ||--o{ COMMITMENT_CLAIM_REQUEST : "approval-gated requests"
  COMMITMENT ||--o| COMMITMENT_CLAIM_REQUEST_INDEX : "direct handler lookup"
  COMMITMENT_CLAIM_REQUEST_INDEX ||--o{ COMMITMENT_CLAIM_REQUEST : "requestIds for direct supersession"

  GARDEN {
    ID id "chainId-address"
    Int chainId "required on every entity"
    String address "normalized garden account"
  }

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
    Int domains "optional array, unique, max 4"
    BigInt requiredActionUIDs "optional array, positional"
    Boolean requiresAssessment "creation fact"
    String metadataCID "creation terms"
    String needUID "optional community Need"
    BigInt targetUnits ""
    Int confirmationThreshold "N of named group"
  }
  COMMITMENT_CLAIM_REQUEST {
    ID id "chainId-commitmentId-claimant"
    Int chainId "required"
    BigInt commitmentId "relationship key"
    String claimant "normalized address"
    CommitmentClaimType claimType "INDIVIDUAL or GARDEN"
    String gardenContext "stored request / eligibility context"
    String gardenContextId "chainId-address relationship"
    Int requestedAt "event timestamp"
    CommitmentClaimRequestState state "PENDING ACCEPTED DECLINED SUPERSEDED"
    String reasonCID "decline only"
    String resolutionCode "accepted declined cancelled expired"
    Int resolvedAt "nullable"
  }
  COMMITMENT_CLAIM_REQUEST_INDEX {
    ID id "chainId-commitmentId"
    BigInt commitmentId "handler lookup key"
    String requestIds "stable unique ID array"
    Int updatedAt ""
  }
  COMMITMENT_EVENT {
    ID id "chainId-txHash-logIndex"
    CommitmentEventType eventType "one row per event"
    String actor "nullable; explicit event field only"
    String data "reason / CID / payoutRef"
    Int timestamp ""
  }
```

On acceptance, the handler loads `COMMITMENT_CLAIM_REQUEST_INDEX` by `chainId-commitmentId`, marks the accepted request `ACCEPTED`, and marks every other still-pending indexed request `SUPERSEDED`. Pre-acceptance commitment cancellation or expiry uses the same indexed IDs to supersede every pending row with its resolution code. Decline updates only the named request. No handler performs a database-wide scan, and no audit-event actor is inferred from `transaction.from`. `Garden.id` migration requires a full replay/backfill and shared-query cutover; every relationship uses `chainId-*` IDs.

Full field lists: contract-spec §8.2. The four locked aggregates stay numerator/denominator pairs (integer math; division happens in shared selectors, never stored): `workApprovalProgress`, `promiseKeptRate`, `cycleCompletionRate`, `openExposureUnits`.

## D7b. Settlement ERD

Every batch is an immutable attempt with 1–24 persisted member IDs. Receipt-invalid batches remain immutable; recovery happens per member and clears the member's old `batchId`. A verification request is replay protection, not a new disbursement state.

```mermaid
erDiagram
  GARDEN ||--o| SETTLEMENT_ACCOUNT : "registered Celo Safe"
  GARDEN ||--o{ DISBURSEMENT : "garden attribution"
  COMMITMENT |o--o| DISBURSEMENT : "one live earned-reward record"
  SETTLEMENT_BATCH ||--|{ DISBURSEMENT : "immutable 1..24 member IDs"
  SETTLEMENT_BATCH ||--o{ VERIFICATION_REQUEST : "retry attempts"
  DISBURSEMENT ||--o{ VERIFICATION_REQUEST : "single verification attempts"

  SETTLEMENT_ACCOUNT {
    ID id "chainId-garden"
    Int chainId "Arbitrum entity chain"
    Int accountChainId "42220"
    String garden "composite Garden relationship"
    String account "Celo Safe"
    String recoveryConfigHash "2-of-3 owners and modules"
    Boolean active
  }
  DISBURSEMENT {
    ID id "chainId-disbursementId"
    Int chainId
    BigInt commitmentId "nullable for funding"
    DisbursementKind kind
    FundingRoute fundingRoute
    String executorGarden "immutable Hats scope"
    String source "derived Celo Safe"
    String recipient "derived"
    String token "canonical G$"
    BigInt amount "derived for reward"
    DisbursementState state
    BigInt batchId "cleared on per-member requeue"
    String executionRef "reported Celo tx hash"
    String reportedBy
    String verifiedBy "Functions router only"
    String verificationRequestId
    String failureCode
  }
  SETTLEMENT_BATCH {
    ID id "chainId-batchId"
    Int chainId
    BigInt disbursementIds "immutable array length 1..24"
    String executorGarden
    String source
    String token
    DisbursementState state
    String executionRef
    String reportedBy
    String verifiedBy
    String verificationRequestId
  }
  VERIFICATION_REQUEST {
    ID id "chainId-requestId"
    Int chainId
    Boolean isBatch
    BigInt subjectId
    String executionRef
    Int requestedAt
    Boolean active
    String outcome "valid receipt-invalid infrastructure stale"
  }
```

---

## D8. G$ funding topology, Safe recovery, and oracle boundary

Split-state settlement per `settlement-spec.md`: authorization on Arbitrum (garden-account-anchored, Hats-gated), execution on Celo from garden-attributed Safes with Zodiac-scoped signers. Canonical G$ never leaves Celo; no bridge carries value authority.

```mermaid
flowchart TD
  HOA["House of Alignment<br/>G$ stream (Celo)"]
  WC["Dev Guild Working Capital Safe<br/>(Celo, exists, receiving today)"]
  GG["Green Goods protocol Safe (Celo, exists)<br/>settlement account of the PROTOCOL pool"]
  GS["Garden Celo Safes NET-NEW<br/>one per garden<br/>exactly 2-of-3 recovery"]
  MEM["Members<br/>same-address smart accounts (Celo)"]

  subgraph OWN["Each garden Safe recovery owners"]
    PM["Protocol recovery multisig"]
    DM["Dev Guild / working-capital recovery multisig"]
    GR["Named garden recovery delegate"]
  end
  EX["Bounded Zodiac Roles executors<br/>never Safe owners"]

  subgraph ARB["Arbitrum control plane"]
    HATS["Hats<br/>steward gates"]
    CPM2["CommitmentPoolingModule<br/>Fulfilled commitments"]
    SM["SettlementModule NET-NEW<br/>derived source/route · immutable executor scope<br/>Reported remains unverified"]
  end
  CL["Chainlink Functions router + DON<br/>pinned source · request ID · finalized receipt"]

  HOA -->|stream| WC
  WC -->|"WorkingCapitalToProtocol<br/>source + recipient derived"| GG
  GG -->|"ProtocolToGarden<br/>source + recipient derived"| GS
  GG -->|"protocol-pool disbursements"| MEM
  GS -->|"garden disbursements"| MEM

  HATS --> SM
  CPM2 -->|"Fulfilled read at queue time"| SM
  SM -. "queued batches authorize execution" .-> GG
  SM -. " " .-> GS
  GG -. "reportExecution(celoTxHash)" .-> SM
  GS -. "reportExecution(celoTxHash)" .-> SM
  SM -->|"VerificationRequested"| CL
  CL -->|"router callback: valid / receipt-invalid / infrastructure"| SM
  PM --> GS
  DM --> GS
  GR --> GS
  EX -->|"G$ transfer / approved multisend only<br/>Allowance-capped"| GS
```

The owner set is exactly protocol recovery multisig, Dev Guild/working-capital recovery multisig, and one named garden recovery delegate, threshold 2. Deployment fails on duplicate/zero/unnamed owners or owner/executor overlap. The Chainlink callback verifies one finalized Celo receipt: chain 42220, successful status, exact Safe sender, canonical G$, expected recipients and amounts, and complete transfer-log coverage.

## D9. Settlement sequence with failure/retry

```mermaid
sequenceDiagram
  autonumber
  actor OP as Steward (Arbitrum)
  actor EX as Executor (Zodiac Roles member)
  participant SM as SettlementModule (Arbitrum)
  participant CPM as CommitmentPoolingModule
  participant SAFE as Garden Celo Safe (Zodiac-scoped)
  participant GD as G$ token (Celo)
  participant CL as Chainlink Functions router / DON
  participant RPC as Celo RPC
  participant IDX as Indexer

  Note over SM: prerequisite: registerSettlementAccount(garden, 42220, safe)
  OP->>SM: queueDisbursement(commitmentId)
  SM->>CPM: derive Fulfilled reward, provider, G$, amount
  SM-->>IDX: DisbursementQueued (PWA reward row: "support on its way")
  EX->>SM: createBatch(ids) then markExecuting(batchId)
  Note over SM: 1..24 immutable member IDs with one executorGarden, derived source, and token
  SM-->>IDX: BatchExecuting
  EX->>SAFE: execute batch (Roles-scoped: G$ transfer only, Allowance-capped)
  SAFE->>GD: transfer / approved multisend
  alt execution fails before any report
    EX->>SM: recordFailed(id, reasonCID)
    SM-->>IDX: DisbursementFailed (PWA: "still arranging support — your promise is recorded")
    OP->>SM: requeue(id) — attempts increments
    SM-->>IDX: DisbursementRequeued
  else executor has Celo tx hash
    EX->>SM: reportBatchExecution(batchId, celoTxHash)
    SM-->>IDX: BatchExecutionReported (state Reported)
    OP->>SM: requestBatchVerification(batchId)
    SM->>CL: send request with pinned source/config
    CL-->>SM: requestId
    SM-->>IDX: VerificationRequested (UI derives "checking receipt")
    CL->>RPC: fetch finalized receipt and Transfer logs
    alt exact finalized receipt is valid
      CL->>SM: router callback(requestId, Valid, evidenceHash)
      SM-->>IDX: BatchVerified (verifiedBy = router, "support arrived")
    else receipt is final but invalid
      CL->>SM: router callback(requestId, ReceiptInvalid, failureCode)
      SM-->>IDX: ReceiptVerificationFailed (batch + members Failed)
      loop each immutable member
        OP->>SM: requeue(id) or cancelDisbursement(id, reasonCID)
        Note over SM: requeue clears the member's prior batchId
      end
    else RPC / DON / subscription / decode / timeout failure
      CL->>SM: infrastructure result, or authorized timeout recovery
      SM-->>IDX: VerificationInfrastructureFailed
      Note over SM: state remains Reported and active request clears
      OP->>SM: requestBatchVerification(batchId) with a new requestId
    end
    opt callback for an old requestId arrives later
      CL->>SM: stale callback(oldRequestId)
      SM-->>IDX: StaleVerificationIgnored (no state mutation)
    end
  end
```

## D10. Disbursement state machine (all module-native, on-chain)

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Queued : queueDisbursement / queueFunding(route, garden, amount)
  Queued --> Executing : markExecuting (executor)
  Executing --> Reported : reportExecution(executionRef)
  Reported --> Reported : requestVerification (derive checking receipt)
  Reported --> Verified : Functions callback Valid
  Reported --> Failed : Functions callback ReceiptInvalid
  Reported --> Reported : infrastructure error / timeout / stale callback
  Executing --> Failed : recordFailed(reasonCID)
  Failed --> Queued : per-member requeue (clear old batchId; attempts++)
  Queued --> Cancelled : cancelDisbursement(reasonCID)
  Failed --> Cancelled : cancelDisbursement(reasonCID)
  Verified --> [*]
  Cancelled --> [*] : frees the commitment for a fresh queue
```

A failed Celo leg never touches commitment state — `Fulfilled` on the pooling module is permanent; only the disbursement record cycles. “Checking receipt” is derived from an active verification request while the stored state remains `Reported`. Only the configured Functions router can produce `Verified` or receipt-invalid `Failed`; no human fallback exists. Reward-status precedence for UI: settlement-module record when a disbursement exists, else pooling-module `rewardPaid` (settlement-spec §3.3).

## D11. Approval-gated claim request, decline, acceptance, and supersession

```mermaid
sequenceDiagram
  autonumber
  actor A as Claimant A
  actor B as Claimant B
  actor OP as Pool steward
  participant M as CommitmentPoolingModule
  participant IDX as Envio handler
  participant RI as CommitmentClaimRequestIndex

  A->>M: claimCommitment(id, kind, gardenContext)
  M-->>IDX: ClaimRequested(id, claimantA, requestedByA, kind, gardenContext, requestedAt)
  IDX->>RI: append request A to chainId-id index
  B->>M: claimCommitment(id, kind, gardenContext)
  M-->>IDX: ClaimRequested(id, claimantB, requestedByB, kind, gardenContext, requestedAt)
  IDX->>RI: append request B
  alt steward declines A
    OP->>M: declineClaim(id, A, reasonCID)
    Note over M: clear only A's stored PendingClaim
    M-->>IDX: ClaimDeclined(id, A, reasonCID)
    Note over IDX: A=DECLINED and B remains PENDING
  else steward accepts B
    OP->>M: acceptClaim(id, B)
    Note over M: consume B's stored claimant, requestedBy, kind, gardenContext, requestedAt, and active terms<br/>then derive provider and providerGarden
    M-->>IDX: CommitmentAccepted(id, B, counterparty, kind, gardenContext, provider, providerGarden)
    IDX->>RI: load request IDs by chainId-id
    Note over IDX: B=ACCEPTED and every other pending request=SUPERSEDED
  end
  opt separate path: commitment cancelled or expired before acceptance
    OP->>M: cancelCommitment(id) or expireCommitment(id)
    M-->>IDX: CommitmentCancelled or CommitmentExpired
    IDX->>RI: load request IDs by chainId-id
    Note over IDX: every pending row=SUPERSEDED<br/>resolutionCode names cancellation or expiry
  end
```

There is no numeric sentinel or database-wide query. A later request after a decline is a fresh active request with a new timestamp; acceptance is deterministic because it cannot substitute caller-provided terms. Superseded copy distinguishes another accepted provider from commitment cancellation/expiry through `resolutionCode`.

## D12. Working-capital and protocol-to-garden funding routes

House of Alignment → working capital is reported upstream and is not fabricated as a Green Goods module action.

```mermaid
sequenceDiagram
  autonumber
  actor HOA as House of Alignment
  actor OP as Protocol steward
  actor EX as Protocol-scoped Roles executor
  participant WC as Dev Guild working-capital Safe
  participant SM as SettlementModule (Arbitrum)
  participant PS as Protocol Safe (Celo)
  participant GS as Garden Safe (Celo)
  participant CL as Chainlink Functions

  HOA->>WC: fund working-capital wallet (upstream fact)
  OP->>SM: queueFunding(WorkingCapitalToProtocol, protocolGarden, amount)
  Note over SM: derive source=WC, recipient=PS, token=G$<br/>executorGarden=protocolGarden
  EX->>WC: execute scoped G$ transfer to PS
  EX->>SM: reportExecution(id, celoTxHash)
  SM->>CL: requestVerification(id)
  CL-->>SM: valid finalized receipt callback
  OP->>SM: queueFunding(ProtocolToGarden, garden, amount)
  Note over SM: derive source=PS, recipient=GS, token=G$<br/>executorGarden remains protocolGarden
  EX->>PS: execute scoped G$ transfer to GS
  EX->>SM: reportExecution(id, celoTxHash)
  SM->>CL: requestVerification(id)
  CL-->>SM: valid finalized receipt callback
```

If the Celo AA/paymaster spike fails, these two Safe-to-Safe routes remain available while `memberDeliveryEnabled` stays false. There is no garden-custody member-claim fallback.

## D13. Permission and responsibility map

```mermaid
flowchart LR
  OWNER["Module owner"] -->|"configuration · pause · Functions config"| CFG["Protocol configuration"]
  STEWARD["Pool / protocol steward"] -->|"pool/cycle · gated claims · queue · retry/cancel"| CTRL["Scoped control actions"]
  MEMBER["Garden member"] -->|"own Offer/Request · evidence · eligible confirmation"| CPM["CommitmentPoolingModule"]
  PROVIDER["Accepted provider"] -. "must not confirm own delivery" .-> CPM
  EXEC["Zodiac Roles executor<br/>not a Safe owner"] -->|"bounded G$ execution · report hash"| SAFE["Celo Safe"]
  RECOVERY["2 of 3 recovery owners<br/>not executors"] -->|"recover/rotate modules"| SAFE
  ROUTER["Configured Functions router"] -->|"only valid/receipt-invalid callback authority"| VERIFY["Settlement verification result"]
  HUMAN["Reporter / steward / owner"] -. "cannot mark Verified or receipt-invalid Failed" .-> VERIFY
  ENV["Envio handlers"] -->|"explicit event fields only"| AUDIT["Composite-ID audit read model"]
  TX["transaction.from"] -. "never used to infer AA actor" .-> AUDIT
```

---

## Appendix: Edits to EXISTING docs diagrams at ship (PRD-680 scope)

Not performed now — the docs site describes what is live. Flagged on the Linear issue so they ship with the release:

1. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Work submission and approval**: after WorkApprovalResolver validation, add the optional bridge step — `WorkApprovalResolver → CommitmentPoolingModule.onWorkApproved (try/catch, non-blocking)` with a one-line note that approvals count toward pre-linked commitments only.
2. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Assessment flow**: add the v3 authorship split — baseline by evaluator OR operator; delta/re-assessment and technical by Evaluator Hat only; community testimony (Community Hat) as its own thin sequence.
3. **`docs/docs/builders/architecture/erd.mdx`**: append the D7 entity delta and the two new contract blocks to the contract-to-indexer event mapping.
