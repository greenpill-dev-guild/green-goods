# Commitment Pooling: Diagrams

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (source of truth for every contract name, function, event, and state), `settlement-spec.md` (SettlementModule + Celo Safe topology, D8–D10), `uiux-spec.md` (surface flows), `wireframes.md` (screens). These diagrams are execution reference for implementers and reviewers; they introduce nothing the specs do not already define.

**Docs-site promotion**: these diagrams live here until the August release ships. Promotion into `docs/docs/builders/architecture/` (sequence-diagrams, ERD, plus a commitment journey doc) rides [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680); see §8 for the two *edits* to existing docs diagrams that ship at the same time.

**Role vocabulary (decision 2026-07-18)**: these diagrams say **Garden steward** (protocol pool: **Protocol steward**) for the pool-authority role — the holder of the garden's operator/owner Hats (`_requirePoolSteward`). The shipped app and community glossary still say "Operator"; the app-wide rename is a recorded follow-up, so treat steward = operator/owner Hats wherever the two vocabularies meet.

## Visual coverage matrix

This is the cross-hub inventory of 20 assets, not a table of contents for this file: 15 named D-diagram sections (D1–D13, including D1b and D7b) render as 18 Mermaid blocks below because D6 carries its overview plus three acts and D13 includes a capability-separation mini-diagram. The rows naming Community assets resolve to `.plans/active/community-interface/` (`diagrams.md`, `wireframes.md`, `journeys.md`), and rows 15–16 resolve to the two `wireframes.md` files. “Ready” means the implementation question is answered in the named repo-native artifact; it does **not** mean the feature is live. Every Mermaid block is parsed in the final validation pass, while text frames are checked against their owning spec and route contract.

| # | Asset | Audience | Question answered | Source of truth | Current status | Correction needed | Validation method |
|---:|---|---|---|---|---|---|---|
| 1 | Unified system context | all lanes | Which users, apps, chains, read models, Safes, oracle, and token participate? | CP `contract-spec.md` §4; `settlement-spec.md` §2–5; Community `spec.md` §3 | Ready: D1 | None; keep planned/live labels current | Mermaid parse + architecture cross-read |
| 2 | Module topology and trust boundaries | contracts, security, ops | Which component may authorize, attest, index, execute, or verify? | CP `contract-spec.md` §4–7; `settlement-spec.md` §3–4 | Ready: D1b | None | Mermaid parse + interface/event cross-read |
| 3 | Permission and responsibility matrix | contracts, stewards, QA | Who may perform each sensitive action, and who must not? | CP `contract-spec.md` §6.3; `settlement-spec.md` §3.3–4 | Ready: D13 (matrix + separation mini-diagram, 2026-07-18) | None | Matrix ↔ permission-table cross-read + Mermaid parse |
| 4 | Commitment-pooling ERD | indexer, shared | What is stored and how do composite IDs relate? | CP `contract-spec.md` §8.2 | Ready: D7 | None | Mermaid parse + GraphQL field cross-read |
| 5 | Claim-request/indexer ERD | contracts, indexer | How are stored terms, direct lookup, decline, and supersession represented? | CP `contract-spec.md` §5.3, §8.2 | Ready: D7 | None | Mermaid parse + handler acceptance cross-read |
| 6 | Settlement ERD | settlement, indexer, admin | How do accounts, immutable batches, members, and verification attempts relate? | `settlement-spec.md` §3, §6 | Ready: D7b | None | Mermaid parse + event/entity cross-read |
| 7 | Community EAS/Envio joined-read ERD | Community, indexer, evaluator | Which system owns Needs records versus protocol progress? | Community `spec.md` §4–7 | Ready: Community `diagrams.md` D3 | None | Mermaid parse + four-schema cross-read |
| 8 | Pool/cycle/commitment/NeedStatus/disbursement state machines | contracts, UI, QA | Which states are stored, derived, terminal, or recoverable? | both specs; `settlement-spec.md` §3.2 | Ready: D4–D6, D10; Community D4–D5 | None | Mermaid parse + transition-table cross-read |
| 9 | Offer/request → work → approval → confirmation → fulfillment | member, provider, implementers | How do direction, provider garden, Work, and confirmer defaults interact? | CP `contract-spec.md` §5.3, §6.1 | Ready: D2 | None | Mermaid parse + happy-path acceptance |
| 10 | Approval-gated request/accept/decline/supersede | steward, contracts, indexer | Which stored terms are consumed, and how do competing requests end? | CP `contract-spec.md` §5.3, §6.1, §8.2 | Ready: D11 | None | Mermaid parse + named claim tests |
| 11 | Protocol-to-garden funding route (HoA stream upstream) | settlement, treasury, ops | What does Green Goods authorize, and what remains upstream? | `settlement-spec.md` §2–3 | Ready: D12 | None | Mermaid parse + derived-route tests |
| 12 | Report → oracle receipt verification | settlement, admin, QA | Why is Reported not Verified, and how do retry/stale callbacks work? | `settlement-spec.md` §3.3 | Ready: D9–D10 | None | Mermaid parse + oracle-path acceptance |
| 13 | Need → operator triage → commitment seed | member, steward | How does community intent become protocol work without changing authorship? | Community `spec.md` §6, §8 | Ready: Community D9 | None | Mermaid parse + route/spec cross-read |
| 14 | Offline/waiting-for-membership | member, shared, research | Which jobs wait without retry consumption, and how can users recover? | Community `spec.md` §8.3–8.4 | Ready: Community D8 | None | Mermaid parse + offline acceptance |
| 15 | Cross-surface flow map | product, frontend | What stays in Community, admin `/community`, and existing public client surfaces? | Community `spec.md` §3; CP `uiux-spec.md` | Ready: `wireframes.md` §1 | None | Mermaid parse + monorepo/route cross-read |
| 16 | Low-fidelity frames | member, steward, evaluator, funder | Are entry, state, failure, and recovery screens defined without decorative polish? | both UI specs | Ready: both `wireframes.md` files | None | frame inventory + accessibility review |
| 17 | Persona journeys | research, product, QA | Can every named role reach completion and recovery? | Community `journeys.md` | Ready | None | persona/role checklist |
| 18 | Customer/community journey | research, operators | What happens from discovery through withdrawal or verified outcome? | Community `journeys.md` | Ready | None | stage/recovery checklist |
| 19 | Operator service blueprint | operations, research | Which frontstage, backstage, support, and failure-recovery steps must connect? | Community `journeys.md` | Ready | None | Mermaid parse + handoff cross-read |
| 20 | Research/onboarding/review/rehearsal timeline | research, delivery leads | Who must decide what, by when, before implementation and gathering rehearsal? | Community `research-plan.md`; `journeys.md` | Ready: Community `journeys.md` timeline | None | Mermaid parse + owner/date review |

**Legend for state diagrams**: solid = on-chain state (a named module function performs the transition and emits the listed event); dashed = derived state (indexer/app computes it from events; the chain never stores it); grey dashed = app-only (IndexedDB draft, no chain or indexer presence).

---

## D1. Unified system context

**How to read this**: top to bottom — people use surfaces; surfaces write into the Arbitrum protocol layer; Envio turns protocol events into the read model every surface queries; value moves only on Celo; the oracle carries *facts* (never funds) between the two chains. Solid arrows = writes or value movement, dashed = reads or boundary crossings. The client is ONE codebase with two presentations — the **installed PWA** and the **editorial website** — and the docs site is a separate Docusaurus app; the planned Community PWA is a third, independent app.

```mermaid
flowchart TB
  subgraph people["People"]
    MEM["Community member"]
    PROV["Gardener / provider"]
    STW["Garden steward"]
    EVA["Evaluator"]
    FUND["Funder / collaborator"]
  end
  subgraph surfaces["Green Goods surfaces"]
    COM["Community PWA (planned)<br/>Needs · Create · Profile"]
    PWA["Client — installed PWA<br/>member commitments · work · wallet"]
    WEB["Client — editorial website<br/>public garden + funding stories"]
    ADMIN["Admin<br/>steward pools · evaluator export · Operations"]
    DOCS["Docs site (Docusaurus)<br/>builder + user reference"]
  end
  subgraph arb["Arbitrum — control and proof"]
    MOD["CommitmentPoolingModule + Register"]
    SET["SettlementModule"]
    EAS["EAS + Green Goods resolvers"]
  end
  ENV["Envio read model<br/>Green Goods protocol events only"]
  subgraph celo["Celo — value execution"]
    HOA["GoodDollar pool<br/>(House of Alignment)"]
    PS["GG protocol Safe"]
    GS["Per-garden 2-of-3 Safes"]
    GD["Canonical G$"]
  end
  CL["Chainlink Functions<br/>finalized Celo receipt oracle"]

  MEM -->|"needs · promises"| COM
  MEM -->|"commitments · wallet"| PWA
  PROV -->|"work · evidence"| PWA
  STW -->|"seed · accept · approve · queue"| ADMIN
  EVA -->|"assessments · export"| ADMIN
  FUND -->|"stories · funding"| WEB
  COM -->|"Need attestations"| EAS
  PWA -->|"commitment · claim · evidence jobs"| MOD
  ADMIN -->|"pool + cycle control"| MOD
  ADMIN -->|"queue · report · verify"| SET
  MOD -->|"attestation checks"| EAS
  MOD -. "events" .-> ENV
  SET -. "events" .-> ENV
  ENV -. "joined reads" .-> COM
  ENV -. "queries" .-> PWA
  ENV -. "queries" .-> WEB
  ENV -. "queries" .-> ADMIN
  HOA -. "G$ stream (upstream fact)" .-> PS
  PS -->|"ProtocolToGarden funding"| GS
  PS -->|"protocol-pool disbursements"| GD
  GS -->|"garden disbursements"| GD
  SET -. "authorizes + records; never calls Celo" .-> PS
  SET -. "authorizes + records; never calls Celo" .-> GS
  SET -->|"verification request"| CL
  CL -. "finalized receipt result" .-> SET
  DOCS -. "built / planned / oracle-verified disclosure" .-> people
```

Notes:

- The installed PWA and the editorial website are the same client app in two presentation modes (`getClientPresentationMode`); the docs site is separate. Every surface carries built / planned / reported / oracle-verified status labels so a reader never mistakes a plan for a live feature.
- The GoodDollar House of Alignment pool streams G$ directly into the Green Goods protocol Safe; Green Goods models only the ProtocolToGarden route onward (corrections-log §9).
- EAS and raw Celo transfers are outside Envio. The joined Community read is owned in shared/query composition, not fabricated in an Envio handler.
- A report stores a Celo transaction hash but is not proof. Only a matching Chainlink Functions callback can mark the Arbitrum record `Verified`.

## D1b. Contract/module topology and trust boundaries

**How to read this**: four trust boundaries, one job each. The application boundary queues intent but authorizes nothing. The Arbitrum boundary is the only place state changes are authorized and counted. Envio only restates what Arbitrum emitted. The Celo boundary moves value under Safe + Zodiac scope, and the oracle is the only party that can certify a Celo receipt back to Arbitrum.

```mermaid
flowchart TB
  subgraph APP["Application boundary — queues intent, authorizes nothing"]
    JOBS["Shared offline jobs<br/>commitment · claim · evidence · workLink · confirmation<br/>need · needSignal · testimony"]
    ONLINE["Online-only actions<br/>NeedStatus · FundingAttribution · G$ send"]
  end
  subgraph ARB["Arbitrum trust boundary — authorizes and counts"]
    HATS["HatsModule<br/>membership and scoped roles"]
    GT["GardenToken<br/>optional non-blocking pool hook"]
    CPM["CommitmentPoolingModule<br/>state + access + EAS checks"]
    REG["CommitmentRegister<br/>onlyModule unit accounting"]
    SM["SettlementModule<br/>immutable route/source/executor scope"]
    WAR["WorkApprovalResolver<br/>non-blocking approval hook"]
    EAS["EAS + SchemaRegistry"]
    subgraph RESV["Community EAS resolvers (Sept)"]
      NR["NeedResolver"]
      NSR["NeedSignalResolver"]
      NSTR["NeedStatusResolver"]
      FAR["FundingAttributionResolver"]
    end
  end
  ENV["Envio boundary<br/>only Green Goods contract events"]
  subgraph CELO["Celo trust boundary — moves value under scope"]
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
  EAS --> NR
  EAS --> NSR
  EAS --> NSTR
  EAS --> FAR
  CPM -. "events" .-> ENV
  REG -. "events" .-> ENV
  SM -. "events" .-> ENV
  SM -. "authorization record" .-> SAFE
  SAFE --> GD
  SM --> ORACLE
  ORACLE -. "callback: valid / receipt-invalid / infrastructure" .-> SM
```

Boundary rules:

- **Application**: drafts and queued jobs are intent, never authority — every write is re-validated on-chain; nothing trusts a client claim.
- **Arbitrum**: HatsModule decides who may act; the pooling module owns state machines and EAS checks; the register counts units only for the module; the settlement module records value authorization but never custodies or calls Celo. Each Community resolver validates exactly one schema — **NeedResolver** (Need records), **NeedSignalResolver** (member signals on a Need), **NeedStatusResolver** (steward status updates), **FundingAttributionResolver** (receipt-checked funding references).
- **Envio**: restates emitted events into the read model — explicit fields only, no actor inference from `transaction.from`.
- **Celo + oracle**: Safes move G$ under Zodiac Roles + Allowance scope; recovery owners are never executors; no human can verify a receipt — only the pinned Functions callback.

Trust rules: no provider may confirm their own delivery, including steward fallback; no recovery owner may be a Safe executor; no human can verify a receipt; no handler infers an actor from `transaction.from`; no contract enumerates all cycles or claims to make a transition.

## D2. Offer/request → work → approval → confirmation → fulfillment

**How to read this**: the full happy path of one promise, left to right in time — created, claimed, delivered through the existing Work → WorkApproval rail, confirmed by the counterparty, and rewarded. The steward performs every one of their steps in the Admin app (Hub work stage + garden Pool tab — W7/W13); the member acts in the client PWA. The payout lane at the end covers **non-G$ declared rewards only** — G$ rewards leave this diagram and queue on the SettlementModule (D9, D12).

Preconditions: pool `Open`; an optional cycle exists, belongs to the pool, and is `Open`. For an Offer, the creator is provider and accepted recipient confirms. For a Request, the accepted claimant is provider and the creator confirms. The stored `providerGarden` controls DomainImpact Work and assessment validation even when the commitment remains in the root protocol pool. Provider self-confirmation fails on every path.

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Claimant
  actor OP as Garden steward (via Admin)
  participant PWA as Client PWA + offline queue
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister
  participant EAS as EAS
  participant WAR as WorkApprovalResolver
  participant RAILS as Existing payout rails (jar / treasury)
  participant IDX as Indexer

  A->>PWA: create Offer or Request (Draft in IndexedDB)
  PWA->>M: createCommitment(params) on sync
  M->>R: registerClass(commitmentId, poolId, unitLabel, targetUnits)
  M-->>IDX: CommitmentCreated (Offered or Requested)
  alt ClaimMode.Open (garden campaign default)
    B->>M: claimCommitment(commitmentId, kind, gardenContext)
    Note over M,R: provider is creator for Offer, claimant for Request
    Note over M,R: providerGarden is pool garden for Offer<br/>validated gardenContext for Request
    Note over M,R: confirmer is claimant for Offer, creator for Request
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
    Note over M,R: Work attester must equal accepted counterparty
  else garden claim
    Note over M,R: Work attester must be gardener/steward<br/>of stored providerGarden
  end
  Note over M,EAS: protocol-pool Work and assessment recipient = providerGarden<br/>while commitment pool remains root protocol pool
  B->>EAS: submit Work matching a required action
  B->>M: linkWork(commitmentId, workUID)
  M->>EAS: check schema, action ∈ requirements, attester, providerGarden recipient
  M-->>IDX: WorkLinked (derived state flips to Active)
  OP->>EAS: attest WorkApproval (existing approval flow, in Admin Hub)
  EAS->>WAR: onAttest — full existing validation
  WAR->>M: onWorkApproved(workUID, approvalUID, garden) in try/catch
  M-->>IDX: ApprovedWorkCounted(requirementIndex, count, approvedUnits, newlyApprovedUnits)
  Note over M,EAS: every per-action required count met (requirementIndex credits one requirement)<br/>and assessment requirement satisfied → auto-flip
  M-->>IDX: CommitmentReadyForConfirmation
  alt Offer
    B->>M: confirmFulfillment(commitmentId)
  else Request
    A->>M: confirmFulfillment(commitmentId)
  end
  Note over M,EAS: accepted provider is excluded —<br/>acceptance reverts if threshold becomes unreachable
  M-->>IDX: ConfirmationRecorded (n of N)
  M->>R: fulfillUnits(class, derived provider, units)
  M-->>IDX: CommitmentFulfilled (client hero moment fires)
  opt declared non-G$ reward
    OP->>RAILS: execute payout on an existing rail (jar / treasury)
    OP->>M: recordRewardPaid(commitmentId, payoutRef)
    M-->>IDX: RewardPaid(derived source, provider, token, amount)
    Note over WAR,IDX: G$ rewards never use this lane —<br/>they queue on the SettlementModule (D9, D12)
  end
  OP->>M: closeCycle(cycleId)
  M-->>IDX: CycleClosed (derived Reconciled for the cycle's commitments)
```

Recovery: approvals that land before `linkWork` are recovered by bounded steward call `syncApprovedWork(commitmentId, approvalUIDs)`; each UID is EAS-verified and deduped through `approvalCounted`. Steward fallback still rejects the provider and records a reason.

## D3. Analog capture + lightweight evidence (review-is-confirmation)

The SupportService / OperatorCaptured path: no Work/WorkApproval rails, no work requirement, counterparty confirmation IS the review (register #20). The member stays the named promise source; the steward is metadata (`recordedBy`).

**When this happens (use cases)**: an elder gardener makes a promise in conversation and the steward records it from a paper field log; a member offers childcare, meals, or transport for a community work day — help that has no Work/approval rail; a field visit is captured fully offline and the evidence photos sync hours later. In every case the member stays the named promise source (`recordedBy` marks the steward as scribe, never as owner), and because these kinds carry no work requirement, the counterparty's confirmation *is* the review — no separate approval step exists.

```mermaid
sequenceDiagram
  autonumber
  actor MEM as Member (promise source)
  actor OP as Garden steward
  actor CP as Counterparty (confirmer)
  participant ADM as Admin capture flow
  participant PWA as Client PWA + offline queue
  participant M as CommitmentPoolingModule
  participant IDX as Indexer

  MEM--)OP: promise made off-app (conversation, field visit)
  OP->>ADM: analog capture — member, kind, terms
  ADM->>M: createCommitment(OperatorCaptured, onBehalfOf = member)
  M-->>IDX: CommitmentCreated(creator = member, recordedBy = steward)
  Note over ADM,M: member's detail shows<br/>"Recorded by your steward on your behalf.<br/>The promise stays yours."
  MEM->>PWA: attach evidence offline (photo, link, note)
  Note over ADM,PWA: evidence job queued in IndexedDB,<br/>media serialized, survives restart
  PWA->>M: attachEvidence(commitmentId, cid) on sync
  M-->>IDX: EvidenceAttached (derived EvidenceSubmitted)
  MEM->>M: submitForConfirmation(commitmentId)
  Note over PWA,IDX: allowed because the commitment carries no work requirement<br/>and at least one evidence is attached
  M-->>IDX: CommitmentReadyForConfirmation
  CP->>M: confirmFulfillment(commitmentId)
  M-->>IDX: ConfirmationRecorded → CommitmentFulfilled
  Note over CP,M: provider self-confirmation is blocked on-chain.<br/>Steward fallback also rejects the provider<br/>and always carries a visible reason
```

## D4. Pool state machine

Every pool transition is on-chain (rare steward console actions). One pool per garden, idempotent registration; the protocol pool is the root garden's pool (tokenId 1).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> NotReady : onGardenMinted / registerPool
  NotReady --> Ready : markPoolReady (charter CID + non-zero exposure cap)
  Ready --> Open : openPool
  Open --> Paused : pausePool
  Paused --> Open : resumePool
  Open --> Closed : closePool
  Paused --> Closed : closePool
  Closed --> Composted : compostPool
  Composted --> Ready : reopenPool(toOpen = false)
  Composted --> Open : reopenPool(toOpen = true)
```

**What each state allows**:

| State | What it means | What's allowed | Who acts |
|---|---|---|---|
| NotReady | garden minted, pool registered, onchain charter/cap predicate not yet met or app Baseline preflight still missing | configuration only | steward |
| Ready | onchain charter + non-zero exposure cap are present; the app offered the write only after a current non-revoked Baseline preflight | seed cycles; open the pool | steward |
| Open | promises can flow | create / claim / confirm commitments; seed and open cycles | members + steward |
| Paused | **the emergency freeze** | nothing new — create, claim, ready-submit, and confirm are disabled; existing records stay readable | steward (resume) |
| Closed | wind-down | no new activity; terminal cleanup of open commitments | steward |
| Composted | **archival rest — history + "ready for the next season"** | read everything; `reopenPool` back to Ready or Open; nothing else | steward |

Composting is archival, not deletion and not the freeze — `Paused` is the freeze. A composted pool keeps its full promise history visible and can wake for a new season via `reopenPool`. Pool-level `Paused` blocks new commitments, claims, and confirmations on that pool only; module-wide `setPaused` blocks operational mutations but keeps owner configuration, unpause, `cancelCommitment`, `expireCommitment`, and `resolveDispute` available for safe wind-down.

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
  Draft --> Seeded : seedCycle — metadata and window only
  Seeded --> Open : openCycle(allocation) — validate, lock, emit six-role snapshot
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

**Reading the middle of the machine**: `InProgress` and `Reviewing` are indexer-derived overlays of on-chain `Open` — the chain never stores them. A cycle sits `Open`, starts reading as `InProgress` at the first accepted commitment (or when `startTime` arrives), flips to `Reviewing` when the window ends or every commitment is terminal/ready, and flips back whenever new evidence lands. `closeCycle` is the reconcile act.

**There is deliberately no loop here**: `Composted` is terminal *for a cycle*. The loop lives at the pool — a fresh `seedCycle` (Season or Campaign) on the same pool is how the next round begins, and the composted cycle's aggregates roll into pool history. (The pool machine, D4, is the one that can reopen.)

**Allocation split**: the six role percentages — gardeners / treasury / steward / evaluator / community / funder, stored on-chain as basis points where 10000 bps = 100% — are supplied atomically to `openCycle`, validated, stored as the immutable cycle snapshot, emitted in `CycleOpened`, and become the cycle's impact-certificate allowlist allocation at close (contract-spec §9.4; default Model 1: 60 / 15 / 10 / 5 / 5 / 5). `seedCycle` carries no allocation.

## D6. Commitment state machine (overview + three acts)

On-chain enum stores `Offered / Requested / Accepted / ReadyForConfirmation / Fulfilled / Cancelled / Expired / Disputed`. `Draft` is app-only; `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived. The single all-states diagram was accurate but hard to digest, so it is drawn as one compact overview plus three lifecycle acts — the acts zoom into the overview and never disagree with it.

#### D6.0 Overview — the whole life at a glance

```mermaid
stateDiagram-v2
  direction LR
  state "Created (Offered / Requested)" as CRE
  state "Accepted - delivery underway" as ACC
  state "ReadyForConfirmation" as RFC
  state "Ended (Cancelled / Expired)" as END
  [*] --> CRE : createCommitment
  CRE --> ACC : claim accepted (act 1)
  ACC --> RFC : delivery proven (act 2)
  RFC --> Fulfilled : counterparty confirms (act 3)
  CRE --> END : cancel / expire
  ACC --> END : cancel / expire / dispute (act 3)
  RFC --> END : expire / dispute (act 3)
  Fulfilled --> [*] : reconciled at cycle close
  END --> [*] : reconciled at cycle close
```

#### D6a. Act 1 — Claim & acceptance

```mermaid
stateDiagram-v2
  classDef appOnly fill:#ececec,stroke:#8a8a8a,stroke-dasharray: 2 3
  Draft: Draft (client/admin IndexedDB)
  [*] --> Draft
  Draft --> Offered : createCommitment (direction Offer)
  Draft --> Requested : createCommitment (direction Request)
  Offered --> Accepted : ClaimMode Open — claimCommitment
  Requested --> Accepted : ClaimMode Open — claimCommitment
  Offered --> Accepted : ApprovalGated — acceptClaim consumes the stored PendingClaim
  Requested --> Accepted : ApprovalGated — acceptClaim
  Offered --> Cancelled : cancelCommitment (creator)
  Requested --> Cancelled : cancelCommitment (creator)
  Offered --> Expired : expireCommitment (permissionless, past due)
  Requested --> Expired : expireCommitment
  class Draft appOnly
```

An approval-gated `claimCommitment` stores a PendingClaim and leaves the on-chain state untouched; `declineClaim` clears only that claimant; acceptance consumes the stored terms, derives provider and providerGarden, and commits units exactly once. Competing pending claims resolve by supersession — the full decline/accept/supersede choreography is D11.

#### D6b. Act 2 — Delivery & evidence (`Accepted` → `ReadyForConfirmation`)

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e,stroke-dasharray: 6 4
  Active: Active (derived)
  EvidenceSubmitted: EvidenceSubmitted (derived)
  PartiallyApproved: PartiallyApproved (derived)
  [*] --> Accepted
  Accepted --> Active : first WorkLinked or EvidenceAttached
  Active --> EvidenceSubmitted : EvidenceAttached / WorkLinked
  EvidenceSubmitted --> PartiallyApproved : ApprovedWorkCounted — some per-action counters below quota
  PartiallyApproved --> EvidenceSubmitted : new evidence or work
  PartiallyApproved --> ReadyForConfirmation : (a) every per-action required count met + assessment satisfied
  Accepted --> ReadyForConfirmation : (b) submitForConfirmation — no work requirement · (c) steward override with reason
  ReadyForConfirmation --> [*]
  class Active derived
  class EvidenceSubmitted derived
  class PartiallyApproved derived
```

While the derived overlays are showing, the on-chain state remains `Accepted` — so the cancel/expire/dispute transitions in act 3 apply to all of them. The two delivery styles by kind: **DomainImpact** runs the full Work → WorkApproval rail with per-action required counts (`requirementIndex` credits exactly one requirement per approval — amendment 2026-07-18); **SupportService / OperatorCaptured / SeasonCampaign** seeded with no work requirement go through path (b), where the counterparty's confirmation IS the review (D3).

#### D6c. Act 3 — Resolution (confirmation, endings, disputes, reconciliation)

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e,stroke-dasharray: 6 4
  Reconciled: Reconciled (derived)
  [*] --> Accepted
  Accepted --> ReadyForConfirmation : act 2
  ReadyForConfirmation --> Fulfilled : confirmFulfillment reaches threshold N / steward fallback with reason
  Accepted --> Cancelled : cancelCommitment (steward) — committed units released
  Accepted --> Expired : expireCommitment
  ReadyForConfirmation --> Expired : expireCommitment
  Accepted --> Disputed : raiseDispute(reasonCID)
  ReadyForConfirmation --> Disputed : raiseDispute(reasonCID)
  Expired --> Disputed : raiseDispute(reasonCID)
  Disputed --> Accepted : resolveDispute (RestorePrevious)
  Disputed --> ReadyForConfirmation : resolveDispute (RestorePrevious)
  Disputed --> Expired : resolveDispute (RestorePrevious or Expired)
  Disputed --> Fulfilled : resolveDispute (never from pre-dispute Expired)
  Disputed --> Cancelled : resolveDispute (Cancelled)
  Fulfilled --> Reconciled : CycleClosed
  Cancelled --> Reconciled : CycleClosed
  Expired --> Reconciled : CycleClosed
  class Reconciled derived
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

Eight NET-NEW pooling entities, all derived exclusively from module + register events (`chainId-identifier` composite IDs). `GARDEN` is the existing entity; settlement entities are shown separately in D7b. The docs-site ERD gains this delta at ship via PRD-680.

**Units model — how pools measure things** (the legend the ERD fields hang on): every commitment declares its own measure — `unitLabel` (hours, tasks, meals, rides, plants…) and `targetUnits`, the class quota locked at creation. Pools and cycles aggregate those units without ever mixing labels arithmetically in the UI:

- `expectedUnits` = Σ `targetUnits` of accepted commitments — the promised total;
- `approvedUnits` = Σ `newlyApprovedUnits` deltas — how much delivery stewards have approved so far (per-commitment: `floor(targetUnits × Σ min(approvedᵢ, requiredᵢ) / Σ requiredᵢ)`);
- `fulfilledUnits` = Σ units from `UnitsFulfilled` — promises actually confirmed kept;
- `openExposureUnits` = committed − released − fulfilled — the live "how much is promised and not yet resolved" safety gauge, capped per provider by the pool's `providerExposureCap` (the Grassroots-Economics "limiting" primitive);
- derived rates (shared selectors, never stored): `workApprovalProgress = approvedUnits / expectedUnits`, `cycleCompletionRate = fulfilledUnits / expectedUnits`, `promiseKeptRate = commitmentsFulfilled / commitmentsDue`.

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
  COMMITMENT ||--o{ COMMITMENT_REQUIREMENT : "per-action progress rows"
  COMMITMENT |o--o| NEED_COMMITMENT_INDEX : "non-zero needUID lineage"

  GARDEN {
    ID id "chainId-address"
    Int chainId "required on every entity"
    String address "normalized garden account"
  }

  COMMITMENT_POOL {
    ID id "chainId-poolId"
    String garden "garden account address"
    CommitmentPoolType poolType "GARDEN or PROTOCOL"
    CommitmentPoolState state "NOT_READY to COMPOSTED, the D4 vocabulary"
    BigInt expectedUnits "promised total: sum of accepted targetUnits"
    BigInt approvedUnits "numerator for workApprovalProgress"
    BigInt fulfilledUnits "numerator for cycleCompletionRate"
    BigInt openExposureUnits "live committed minus released minus fulfilled; provider-capped"
    BigInt commitmentsDue "accepted minus cancelled"
    BigInt commitmentsFulfilled "numerator for promiseKeptRate"
  }
  COMMITMENT_CYCLE {
    ID id "chainId-cycleId"
    CommitmentCycleType cycleType "SEASON or CAMPAIGN"
    CommitmentCycleState state "on-chain vocabulary only; InProgress-Reviewing derived"
    Int gardenersBps "allocation snapshot from CycleOpened; 10000 bps = 100%"
    Int treasuryBps "garden-regeneration share; 1500-2000 bps floor guidance"
    Int operatorBps "steward share of the cycle certificate"
    Int evaluatorBps "evaluator share"
    Int communityBps "community share"
    Int funderBps "funder share"
  }
  COMMITMENT {
    ID id "chainId-commitmentId"
    String creator "social source of the promise"
    String recordedBy "differs for OperatorCaptured: steward as scribe"
    String counterparty "null until accepted"
    CommitmentDirection direction "OFFER or REQUEST"
    CommitmentKind commitmentType "DOMAIN_IMPACT, SUPPORT_SERVICE, OPERATOR_CAPTURED, SEASON_CAMPAIGN"
    CommitmentOnchainState state "derived overlays computed in shared selectors"
    CommitmentClaimMode claimMode "OPEN or APPROVAL_GATED"
    Int domains "optional array, unique, max 4"
    BigInt requiredActionUIDs "optional array, positional with domains"
    Int requiredApprovedWorkCounts "per-action quotas, positional (amendment 2026-07-18)"
    Int approvedWorkCounts "per-action counters, positional"
    Boolean requiresAssessment "creation fact"
    String metadataCID "creation terms"
    String needUID "optional community Need this promise answers"
    BigInt targetUnits "class quota in unitLabel units, immutable at creation"
    Int confirmationThreshold "N of named group; 1 under counterparty default"
  }
  COMMITMENT_REQUIREMENT {
    ID id "chainId-commitmentId-requirementIndex"
    Int requirementIndex "position in requiredActionUIDs"
    Int domain "positional domains entry"
    BigInt actionUID "the required action"
    Int requiredCount "approved works needed for this action"
    Int approvedCount "credited by ApprovedWorkCounted requirementIndex"
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
  NEED_COMMITMENT_INDEX {
    ID id "chainId-needUID"
    String needUID "non-zero Need attestation UID"
    String commitmentEntityIds "unique composite commitment IDs"
    String cycleEntityIds "unique composite cycle IDs"
    String fulfilledCommitmentEntityIds "fulfilled lineage"
    String hypercertEntityIds "certificate lineage"
  }
```

On acceptance, the handler loads `COMMITMENT_CLAIM_REQUEST_INDEX` by `chainId-commitmentId`, marks the accepted request `ACCEPTED`, and marks every other still-pending indexed request `SUPERSEDED`. Pre-acceptance commitment cancellation or expiry uses the same indexed IDs to supersede every pending row with its resolution code. Decline updates only the named request. No handler performs a database-wide scan, and no audit-event actor is inferred from `transaction.from`. `Garden.id` migration requires a full replay/backfill and shared-query cutover; every relationship uses `chainId-*` IDs.

Full field lists: contract-spec §8.2. The four locked aggregates stay numerator/denominator pairs (integer math; division happens in shared selectors, never stored): `workApprovalProgress`, `promiseKeptRate`, `cycleCompletionRate`, `openExposureUnits`.

## D7b. Settlement ERD

**How to read this**: four entities, one story — the singleton `SETTLEMENT_CONFIGURATION` exposes the member-delivery gate; a garden registers its Celo Safe once (`SETTLEMENT_ACCOUNT`); earned rewards and funding top-ups become `DISBURSEMENT` rows; and executors group them into immutable `SETTLEMENT_BATCH` attempts. Verification request IDs, timestamps, expiry, evidence, and failure fields live on the disbursement/batch records and events rather than in a fifth entity.

Every batch is an immutable attempt with 1–24 persisted member IDs. Receipt-invalid batches remain immutable; recovery happens per member and clears the member's old `batchId`. A verification request is replay protection, not a new disbursement state.

```mermaid
erDiagram
  GARDEN ||--o| SETTLEMENT_ACCOUNT : "registered Celo Safe"
  GARDEN ||--o{ DISBURSEMENT : "garden attribution"
  COMMITMENT |o--o| DISBURSEMENT : "one live earned-reward record"
  SETTLEMENT_BATCH ||--|{ DISBURSEMENT : "immutable 1..24 member IDs"
  SETTLEMENT_CONFIGURATION ||--o{ SETTLEMENT_ACCOUNT : "global delivery gate"

  SETTLEMENT_CONFIGURATION {
    ID id "chainId-settlement-config"
    Int chainId "Arbitrum entity chain"
    Boolean memberDeliveryEnabled "AA-paymaster evidence gate"
    Int updatedAt "event timestamp"
  }

  SETTLEMENT_ACCOUNT {
    ID id "chainId-garden"
    Int chainId "Arbitrum entity chain"
    Int accountChainId "42220: value always executes on Celo"
    String garden "composite Garden relationship"
    String account "the garden's Celo Safe"
    String recoveryConfigHash "hash of 2-of-3 owners plus Roles-Allowance modules"
    Boolean active "inactive accounts cannot be queued against"
  }
  DISBURSEMENT {
    ID id "chainId-disbursementId"
    Int chainId "Arbitrum entity chain"
    BigInt commitmentId "the earned-reward commitment; null for funding top-ups"
    DisbursementKind kind "COMMITMENT_REWARD or FUNDING (Safe top-up)"
    FundingRoute fundingRoute "PROTOCOL_TO_GARDEN for funding; NONE for rewards"
    String executorGarden "immutable Hats scope: who may execute"
    String source "derived sender Celo Safe, never caller-supplied"
    String recipient "derived member AA account or garden Safe"
    String token "canonical Celo G$, configured"
    BigInt amount "derived from the declared reward or queued funding"
    DisbursementState state "QUEUED to VERIFIED-FAILED-CANCELLED, the D10 vocabulary"
    BigInt batchId "cleared on per-member requeue"
    String executionRef "reported Celo tx hash; assertion, not proof"
    String reportedBy "executor who asserted the execution"
    String verifiedBy "Functions router only, never a human"
    String verificationRequestId "active oracle request replay guard"
    String failureCode "bounded machine code: receipt-invalid vs infrastructure"
  }
  SETTLEMENT_BATCH {
    ID id "chainId-batchId"
    Int chainId "Arbitrum entity chain"
    BigInt disbursementIds "immutable member array, length 1..24"
    String executorGarden "one executor scope per batch"
    String source "one sender Safe per batch"
    String token "one token per batch"
    DisbursementState state "one immutable attempt state"
    String executionRef "one Celo tx for the whole attempt"
    String reportedBy "executor who reported"
    String verifiedBy "Functions router only"
    String verificationRequestId "active oracle request"
  }
```

---

## D8. G$ funding topology, Safe recovery, and oracle boundary

**How to read this**: three clusters. The **value chain** down the left — the GoodDollar pool streams into the Green Goods protocol Safe, which funds garden Safes, which pay members. The **Arbitrum control plane** authorizes and records but never touches Celo. The **guard rails** — recovery owners, scoped executors, and the oracle — each hold exactly one power. Split-state settlement per `settlement-spec.md`: authorization on Arbitrum (garden-account-anchored, Hats-gated), execution on Celo from garden-attributed Safes with Zodiac-scoped signers. Canonical G$ never leaves Celo; no bridge carries value authority.

```mermaid
flowchart TD
  HOA["GoodDollar pool — House of Alignment<br/>G$ stream (Celo)"]
  GG["Green Goods protocol Safe (Celo, exists,<br/>receiving the HoA stream today)<br/>settlement account of the PROTOCOL pool"]
  GS["Garden Celo Safes NET-NEW<br/>one per garden<br/>exactly 2-of-3 recovery"]
  MEM["Members<br/>same-address smart accounts (Celo)"]

  subgraph OWN["Each garden Safe recovery owners"]
    PM["Protocol recovery multisig"]
    DM["Dev Guild recovery multisig"]
    GR["Named garden recovery delegate"]
  end
  EX["Bounded Zodiac Roles executors<br/>never Safe owners"]

  subgraph ARB["Arbitrum control plane"]
    HATS["Hats<br/>steward gates"]
    CPM2["CommitmentPoolingModule<br/>Fulfilled commitments"]
    SM["SettlementModule NET-NEW<br/>derived source/route · immutable executor scope<br/>Reported remains unverified"]
  end
  CL["Chainlink Functions router + DON<br/>pinned source · request ID · finalized receipt"]

  HOA -->|"G$ stream — upstream fact,<br/>not a queued action"| GG
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

The owner set is exactly protocol recovery multisig, Dev Guild recovery multisig, and one named garden recovery delegate, threshold 2. Deployment fails on duplicate/zero/unnamed owners or owner/executor overlap. Protocol-Safe *inflow* (the HoA stream) is a Celo balance read + external treasury reporting, surfaced on the admin Operations funding view — the module records only the ProtocolToGarden hop onward. The Chainlink callback verifies one finalized Celo receipt: chain 42220, successful status, exact Safe sender, canonical G$, expected recipients and amounts, and complete transfer-log coverage.

## D9. Settlement sequence with failure/retry

**How to read this**: one G$ reward's journey from "queued" to "support arrived", including every way it can fail and recover. The steward authorizes from the Admin Operations console; the executor (a distinct back-office Zodiac Roles member, never a Safe owner) moves value on Celo; only the oracle callback can turn a report into `Verified`. Zodiac Roles scopes *what* the executor may call, and the Allowance module caps *how much* per period.

```mermaid
sequenceDiagram
  autonumber
  actor OP as Garden steward (via Admin Operations)
  actor EX as Executor (Zodiac Roles member)
  participant SM as SettlementModule (Arbitrum)
  participant CPM as CommitmentPoolingModule
  participant SAFE as Garden Celo Safe (Zodiac-scoped)
  participant GD as G$ token (Celo)
  participant CL as Chainlink Functions router / DON
  participant RPC as Celo RPC
  participant IDX as Indexer

  Note over SM,SAFE: prerequisite: registerSettlementAccount(garden, 42220, safe)
  OP->>SM: queueDisbursement(commitmentId)
  SM->>CPM: derive Fulfilled reward, provider, G$, amount
  SM-->>IDX: DisbursementQueued (PWA reward row: "support on its way")
  EX->>SM: createBatch(ids) then markExecuting(batchId)
  Note over SM,SAFE: 1..24 immutable member IDs<br/>with one executorGarden, derived source, and token
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
        Note over SM,CPM: requeue clears the member's prior batchId
      end
    else RPC / DON / subscription / decode / timeout failure
      CL->>SM: infrastructure result, or authorized timeout recovery
      SM-->>IDX: VerificationInfrastructureFailed
      Note over SM,CPM: state remains Reported and active request clears
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

**What each state allows**:

| State | What it means | What's allowed next | Who acts |
|---|---|---|---|
| Queued | authorized on Arbitrum, nothing moved | batch, mark executing, cancel | steward / executor |
| Executing | executor is moving value on Celo | report the tx hash, or record failure | executor |
| Reported | a Celo tx hash is asserted — **not proof** | request oracle verification | executor / steward / owner |
| Reported + active request | "checking receipt" (derived) | wait for callback, or permissioned timeout expiry | oracle / authorized caller |
| Verified | oracle matched the finalized receipt | terminal — "support arrived" | Functions router only |
| Failed | execution failed or receipt invalid | per-member requeue (attempts++) or cancel | steward |
| Cancelled | withdrawn before completion | terminal — frees the commitment for a fresh queue | steward |

A failed Celo leg never touches commitment state — `Fulfilled` on the pooling module is permanent; only the disbursement record cycles. “Checking receipt” is derived from an active verification request while the stored state remains `Reported`. Only the configured Functions router can produce `Verified` or receipt-invalid `Failed`; no human fallback exists. Reward-status precedence for UI: settlement-module record when a disbursement exists, else pooling-module `rewardPaid` (settlement-spec §3.3). Member-facing `Cancelled` copy (closing the gap flagged in prototypes MF review): “This support was withdrawn before it was sent — your promise and its record stay intact.”

## D11. Approval-gated claim request, decline, acceptance, and supersession

**How to read this**: two people want the same commitment. Each `claimCommitment` stores its own PendingClaim (the on-chain commitment state does not move). The steward may decline one claimant without touching the others, or accept one — at which point every other pending request reads as superseded. Declines and supersessions carry distinct member-facing meanings via `resolutionCode`.

```mermaid
sequenceDiagram
  autonumber
  actor A as Claimant A
  actor B as Claimant B
  actor OP as Garden steward (pool)
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
    Note over M,IDX: clear only A's stored PendingClaim
    M-->>IDX: ClaimDeclined(id, A, reasonCID)
    Note over IDX,RI: A=DECLINED and B remains PENDING
  else steward accepts B
    OP->>M: acceptClaim(id, B)
    Note over M,IDX: consume B's stored claimant, requestedBy, kind,<br/>gardenContext, requestedAt, and active terms —<br/>then derive provider and providerGarden
    M-->>IDX: CommitmentAccepted(id, B, counterparty, kind, gardenContext, provider, providerGarden)
    IDX->>RI: load request IDs by chainId-id
    Note over IDX,RI: B=ACCEPTED and every other<br/>pending request=SUPERSEDED
  end
  opt separate path: commitment cancelled or expired before acceptance
    OP->>M: cancelCommitment(id) or expireCommitment(id)
    M-->>IDX: CommitmentCancelled or CommitmentExpired
    IDX->>RI: load request IDs by chainId-id
    Note over IDX,RI: every pending row=SUPERSEDED<br/>resolutionCode names cancellation or expiry
  end
```

There is no numeric sentinel or database-wide query. A later request after a decline is a fresh active request with a new timestamp; acceptance is deterministic because it cannot substitute caller-provided terms. Superseded copy distinguishes another accepted provider from commitment cancellation/expiry through `resolutionCode`.

## D12. Protocol-to-garden funding route

**How to read this**: the House of Alignment stream arriving in the protocol Safe is an upstream fact — Green Goods never queues, executes, or verifies it. The only queued funding action is the protocol → garden top-up, and it follows the same queue → execute → report → verify discipline as every disbursement (D9).

```mermaid
sequenceDiagram
  autonumber
  actor HOA as GoodDollar House of Alignment
  actor OP as Protocol steward
  actor EX as Protocol-scoped Roles executor
  participant SM as SettlementModule (Arbitrum)
  participant PS as GG protocol Safe (Celo)
  participant GS as Garden Safe (Celo)
  participant CL as Chainlink Functions

  HOA->>PS: G$ stream lands in the protocol Safe (upstream fact)
  OP->>SM: queueFunding(garden, amount)
  Note over SM,PS: derive source=PS, recipient=GS, token=G$<br/>route recorded as ProtocolToGarden<br/>executorGarden=protocolGarden
  EX->>PS: execute scoped G$ transfer to GS
  EX->>SM: reportExecution(id, celoTxHash)
  SM->>CL: requestVerification(id)
  CL-->>SM: valid finalized receipt callback
```

If the Celo AA/paymaster spike fails, this Safe-to-Safe route remains available while `memberDeliveryEnabled` stays false. There is no garden-custody member-claim fallback.

## D13. Permission and responsibility matrix

**How to read this**: one row per capability-bearing role, one column per capability group — ✓ means the role may act within the listed scope, — means no access, ✗ marks an enforced prohibition. "Garden steward" = holder of the garden's operator/owner Hats; the protocol pool resolves stewardship to the root garden. A pilot steward may also hold the scoped executor role. The enforced separations are executor versus recovery ownership and human operation versus oracle verification, not steward versus executor identity.

| Role | Pool & cycle control | Create / claim promises | Evidence & work | Approve work | Confirm fulfillment | Queue & execute value | Verify receipts | Configure protocol |
|---|---|---|---|---|---|---|---|---|
| **Module owner** | ✓ fallback steward | — | — | — | — | ✓ queue funding | — | ✓ pause · Functions config · module wiring |
| **Garden steward** | ✓ seed / open / pause / compost · accept / decline claims | ✓ seed SeasonCampaign · OperatorCaptured (`onBehalfOf`) | ✓ attach for members | ✓ WorkApproval (existing flow) | fallback only, with reason, never as provider | ✓ queue disbursements · requeue / cancel | — | — |
| **Member / gardener** | — | ✓ own Offer / Request · claim open commitments | ✓ own evidence · link work | — | ✓ when eligible confirmer | — | — | — |
| **Accepted provider** | — | — | ✓ deliver + evidence | — | ✗ never own delivery | — | — | — |
| **Evaluator** | — | — | ✓ assessments (baseline / delta / technical) | — | ✓ when named confirmer | — | — | — |
| **Community member** | — | ✓ needs + signals (Community PWA) | ✓ testimony | — | ✓ when named confirmer | — | — | — |
| **Executor (Zodiac Roles member)** | — | — | — | — | — | ✓ execute scoped G$ transfer · report tx hash | — | — |
| **Recovery owner (2-of-3)** | — | — | — | — | — | ✗ execution | — | ✓ recover / rotate Safe modules only |
| **Chainlink Functions router** | — | — | — | — | — | — | ✓ sole Verified / receipt-invalid authority | — |
| **Envio handlers** | — | — | — | — | — | — | — | read model from explicit event fields only |

**Hard prohibitions (the red lines)**:

- No provider may confirm their own delivery — including through steward fallback.
- No recovery owner may be a Safe executor, and no executor may be a recovery owner (deployment and `addExecutor` both reject overlap).
- No human can mark a receipt `Verified` or receipt-invalid `Failed` — only the configured Functions router callback.
- No handler infers an actor from `transaction.from`.
- No contract enumerates all cycles or claims to make a transition.

**Capability separation (why value stays bounded)**:

```mermaid
flowchart LR
  STW["Pilot steward<br/>may authorize and also execute"] -->|"queue"| SM["SettlementModule<br/>records"]
  SM -->|"scoped authorization"| EX["Executor capability<br/>moves G$ (bounded)"]
  STW -.->|"same pilot account allowed"| EX
  EX -->|"reports tx hash"| SM
  SM -->|"request"| OR["Oracle<br/>certifies the receipt"]
  RO["Recovery owners<br/>rotate modules, never execute"] -. "no overlap" .-> EX
```

The pilot may combine steward and executor capabilities, so one person can queue and move value within the exact Zodiac selector and allowance scope. That person cannot be a recovery owner and cannot verify a receipt. The oracle verifies but holds no funds; recovery owners can rotate a compromised executor but never execute. No human capability can certify value, and no recovery owner can move it.

---

## Appendix: Edits to EXISTING docs diagrams at ship (PRD-680 scope)

Not performed now — the docs site describes what is live. Flagged on the Linear issue so they ship with the release:

1. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Work submission and approval**: after WorkApprovalResolver validation, add the optional bridge step — `WorkApprovalResolver → CommitmentPoolingModule.onWorkApproved (try/catch, non-blocking)` with a one-line note that approvals count toward pre-linked commitments only.
2. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Assessment flow**: add the v3 authorship split — baseline by evaluator OR operator; delta/re-assessment and technical by Evaluator Hat only; community testimony (Community Hat) as its own thin sequence.
3. **`docs/docs/builders/architecture/erd.mdx`**: append the D7 entity delta and the two new contract blocks to the contract-to-indexer event mapping.
