# Commitment Pooling: Diagrams

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (source of truth for every contract name, function, event, and state), `settlement-spec.md` (SettlementModule + Celo Safe topology, D8–D10), `uiux-spec.md` (surface flows), `wireframes.md` (screens). These diagrams are execution reference for implementers and reviewers; they introduce nothing the specs do not already define.

**Docs-site promotion**: these diagrams live here until the August release ships. Promotion into `docs/docs/builders/architecture/` (sequence-diagrams, ERD, plus a commitment journey doc) rides [PRD-680](https://linear.app/greenpill-dev-guild/issue/PRD-680); see §8 for the two *edits* to existing docs diagrams that ship at the same time.

**Role vocabulary (decision 2026-07-18)**: these diagrams say **Garden steward** (protocol pool: **Protocol steward**) for the pool-authority role — the holder of the garden's operator/owner Hats (`_requirePoolSteward`). The shipped app and community glossary still say "Operator"; the app-wide rename is a recorded follow-up, so treat steward = operator/owner Hats wherever the two vocabularies meet.

## Visual coverage matrix

This is the cross-hub inventory of 23 assets, not a table of contents for this file: 18 named D-diagram sections (D1–D14, including D1b, D7b, D7c, and D13b) render as 20 Architecture Mermaid blocks below because D6 carries its overview plus three acts, D13 includes a capability-separation mini-diagram, and D13b is a semantic table rather than Mermaid. The rows naming Community assets resolve to `.plans/active/community-interface/` (`diagrams.md`, `wireframes.md`, `journeys.md`), and rows 15–16 resolve to the two `wireframes.md` files. “Ready” means the implementation question is answered in the named repo-native artifact; it does **not** mean the feature is live. Every Mermaid block is parsed in the final validation pass, while text frames and permission tables are checked against their owning spec and route contract.

| # | Asset | Audience | Question answered | Source of truth | Current status | Correction needed | Validation method |
|---:|---|---|---|---|---|---|---|
| 1 | Unified system context | all lanes | Which users, apps, chains, read models, Safes, CCIP routes, and token participate? | CP `contract-spec.md` §4; `settlement-spec.md` §2–5; Community `spec.md` §3 | Ready: D1 | None; keep planned/live labels current | Mermaid parse + architecture cross-read |
| 2 | Module topology and trust boundaries | contracts, security, ops | Which component may queue, authorize, attest, index, execute, or verify? | CP `contract-spec.md` §4–7; `settlement-spec.md` §3–4 | Ready: D1b | Split CP jobs, EAS jobs/actions, and Celo transfer; include both new resolvers | Mermaid parse + interface/event cross-read |
| 3 | Capability responsibility summary | contracts, stewards, QA | Which capability groups belong to each role? | CP `contract-spec.md` §6.3; `settlement-spec.md` §3.3–4 | Ready: D13 | Keep distinct from the exact action table | Matrix cross-read + Mermaid parse |
| 4 | Commitment-pooling ERD | indexer, shared | What is stored, how do composite IDs relate, and where do count-safe/exact-label summaries live? | CP `contract-spec.md` §8.2 | Ready: D7 | Ten pooling entities; key fields only | Mermaid parse + GraphQL field cross-read |
| 5 | Claim-request/indexer ERD | contracts, indexer | How are stored terms, direct lookup, decline, and supersession represented? | CP `contract-spec.md` §5.3, §8.2 | Ready: D7 | None | Mermaid parse + handler acceptance cross-read |
| 6 | Settlement ERD | settlement, indexer, admin | How do accounts, immutable batches, members, and verification attempts relate? | `settlement-spec.md` §3, §6 | Ready: D7b | None | Mermaid parse + event/entity cross-read |
| 7 | Community EAS/Envio joined-read ERD | Community, indexer, evaluator | Which system owns Needs records versus protocol progress? | Community `spec.md` §4–7 | Ready: Community `diagrams.md` D3 | None | Mermaid parse + four-schema cross-read |
| 8 | Pool/cycle/commitment/NeedStatus/disbursement state machines | contracts, UI, QA | Which states are stored, derived, terminal, or recoverable? | both specs; `settlement-spec.md` §3.2 | Ready: D4–D6, D10; Community D4–D5 | None | Mermaid parse + transition-table cross-read |
| 9 | Offer/request → work → approval → confirmation → fulfillment | member, provider, implementers | How do direction, provider garden, Work, and confirmer defaults interact? | CP `contract-spec.md` §5.3, §6.1 | Ready: D2 | None | Mermaid parse + happy-path acceptance |
| 10 | Approval-gated request/accept/decline/supersede | steward, contracts, indexer | Which stored terms are consumed, and how do competing requests end? | CP `contract-spec.md` §5.3, §6.1, §8.2 | Ready: D11 | None | Mermaid parse + named claim tests |
| 11 | Protocol-to-garden funding route (HoA stream upstream) | settlement, treasury, ops | What does Green Goods authorize, and what remains upstream? | `settlement-spec.md` §2–3 | Ready: D12 | None | Mermaid parse + derived-route tests |
| 12 | CCIP command/ack settlement | settlement, admin, QA | How do command retry, idempotent Celo execution, and acknowledgment retry converge? | `settlement-spec.md` §3.3 | Ready: D9–D10 | None | Mermaid parse + command/ack acceptance |
| 13 | Need → operator triage → commitment seed | member, steward | How does community intent become protocol work without changing authorship? | Community `spec.md` §6, §8 | Ready: Community D9 | None | Mermaid parse + route/spec cross-read |
| 14 | Community offline/waiting-for-membership | member, shared, research | How does the September Community queue specialize the shared substrate? | Community `spec.md` §8.3–8.4 | Ready: Community D8 | Companion detail; CP core is D14 | Mermaid parse + offline acceptance |
| 15 | Cross-surface flow map | product, frontend | What stays in Community, admin `/community`, and existing public client surfaces? | Community `spec.md` §3; CP `uiux-spec.md` | Ready: `wireframes.md` §1 | None | Mermaid parse + monorepo/route cross-read |
| 16 | Low-fidelity frames | member, steward, evaluator, funder | Are entry, state, failure, and recovery screens defined without decorative polish? | both UI specs | Ready: both `wireframes.md` files | None | frame inventory + accessibility review |
| 17 | Persona journeys | research, product, QA | Can every named role reach completion and recovery? | Community `journeys.md` | Ready | None | persona/role checklist |
| 18 | Customer/community journey | research, operators | What happens from discovery through withdrawal or verified outcome? | Community `journeys.md` | Ready | None | stage/recovery checklist |
| 19 | Operator service blueprint | operations, research | Which frontstage, backstage, support, and failure-recovery steps must connect? | Community `journeys.md` | Ready | None | Mermaid parse + handoff cross-read |
| 20 | Research/onboarding/review/rehearsal timeline | research, delivery leads | Who must decide what, by when, before implementation and gathering rehearsal? | Community `research-plan.md`; `journeys.md` | Ready: Community `journeys.md` timeline | None | Mermaid parse + owner/date review |
| 21 | Exact sensitive-action permissions | contracts, settlement, security, QA | Which named function can each actor call, with which gates? | CP `contract-spec.md` §6.3; `settlement-spec.md` §3.3 | Ready: D13b | Generated by cross-reading both canonical tables | Function-by-function table diff |
| 22 | Hypercert cut-over and indexer delta | indexer, shared, admin | How do fulfilled commitments replace Work as the bundle without migrating legacy certificates? | CP `contract-spec.md` §9 | Ready: D7c | Keep legacy and commitment bundles readable | Mermaid parse + metadata/schema cross-read |
| 23 | Commitment offline job lifecycle | shared, client, QA | Which five CP jobs queue, wait for membership without retry use, retry, exhaust, or discard? | CP `uiux-spec.md` §5.11 | Ready: D14 | Self-contained CP view; Community D8 remains companion | Mermaid parse + queue acceptance |

**Visual status contract**: solid green node/edge = Built/live; dashed stone node/edge = Planned/gated. Dashes never mean read, boundary, derived, or app-only. Relationship meaning is written on the arrow. State provenance is explicit in the node label and fill: paper = on-chain, amber = derived, grey = app-only.

---

## D1. Unified system context

**How to read this**: top to bottom — people use surfaces; surfaces write into the Arbitrum protocol layer; Envio turns explicit Green Goods protocol events into the read model every surface queries; value moves only on Celo. CCIP carries data-only commands and acknowledgments, never G$. Node outlines encode built/live versus planned/gated status; arrow labels state whether an edge is a write, read, event, protocol message, or value movement. The client is ONE codebase with two presentations — the **installed PWA** and the **editorial website** — and the docs site is a separate Docusaurus app; the planned Community PWA is a third, independent app.

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
  CE["CeloSettlementExecutor<br/>bounded Zodiac Roles member"]
  CCIP["Chainlink CCIP<br/>message-only command + acknowledgment"]

  MEM -->|"needs · promises"| COM
  MEM -->|"commitments · wallet"| PWA
  PROV -->|"work · evidence"| PWA
  STW -->|"seed · accept · approve · queue"| ADMIN
  EVA -->|"assessments · export"| ADMIN
  FUND -->|"stories · funding"| WEB
  COM -->|"Need attestations"| EAS
  PWA -->|"commitment · claim · evidence jobs"| MOD
  ADMIN -->|"pool + cycle control"| MOD
  ADMIN -->|"queue · dispatch · recovery controls"| SET
  MOD -->|"attestation checks"| EAS
  MOD -->|"events"| ENV
  SET -->|"events"| ENV
  ENV -->|"joined reads"| COM
  ENV -->|"queries"| PWA
  ENV -->|"queries"| WEB
  ENV -->|"queries"| ADMIN
  HOA -->|"G$ stream (upstream fact)"| PS
  PS -->|"ProtocolToGarden funding"| GS
  CE -->|"protocol-pool disbursements"| GD
  CE -->|"garden disbursements"| GD
  SET -->|"versioned command, no token amounts"| CCIP
  CCIP -->|"authenticated command"| CE
  CE -->|"versioned acknowledgment, no token amounts"| CCIP
  CCIP -->|"authenticated success/failure"| SET
  DOCS -->|"built / planned / CCIP-confirmed disclosure"| people

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class DOCS,EAS,HOA,PS,GD built
  class COM,PWA,WEB,ADMIN,MOD,SET,ENV,GS,CE,CCIP planned
```

Notes:

- The installed PWA and the editorial website are the same client app in two presentation modes (`getClientPresentationMode`); the docs site is separate. Every surface carries built / planned / queued / dispatched / confirming / confirmed status labels so a reader never mistakes a plan for a live feature.
- The GoodDollar House of Alignment pool streams G$ directly into the Green Goods protocol Safe; Green Goods models only the ProtocolToGarden route onward (corrections-log §9).
- EAS and raw Celo transfers are outside Envio. The joined Community read is owned in shared/query composition, not fabricated in an Envio handler.
- The indexer records only SettlementModule and CeloSettlementExecutor protocol events. A Celo execution is visible before its acknowledgment, but only an authenticated success acknowledgment marks the Arbitrum attempt `Confirmed`.

## D1b. Contract/module topology and trust boundaries

**How to read this**: four trust boundaries, one job each. The application boundary queues intent but authorizes nothing. The Arbitrum boundary owns source state. Envio restates explicit events from both Green Goods contracts. The Celo executor moves value under a reviewed Safe + Zodiac scope, stores its idempotent outcome, then uses CCIP to acknowledge it.

```mermaid
flowchart TB
  subgraph APP["Application boundary — queues intent, authorizes nothing"]
    CPJOBS["CP offline jobs (planned)<br/>commitment · claim · evidence · workLink · confirmation"]
    EASJOBS["Community offline EAS jobs (planned)<br/>need · needSignal · testimony"]
    EASACTIONS["Online EAS actions (planned)<br/>NeedStatus · FundingAttribution"]
    TRANSFER["Online Celo wallet action (planned)<br/>canonical G$ send · never queued"]
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
    V3["AssessmentV3Resolver (planned)<br/>Baseline: evaluator or steward<br/>Delta/technical: evaluator only"]
    CTR["CommunityTestimonyResolver (planned)<br/>Community Hat only"]
  end
  ENV["Envio boundary<br/>only Green Goods contract events"]
  subgraph CELO["Celo trust boundary — moves value under scope"]
    SAFE["2-of-3 recovery Safes<br/>owners != Roles executors"]
    GD["Canonical G$ transfers"]
  end
  CCIP["Chainlink CCIP routers<br/>data-only command + acknowledgment"]
  CE["CeloSettlementExecutor<br/>immutable peer + bounded route"]

  CPJOBS -->|"module writes after on-chain revalidation"| CPM
  EASJOBS -->|"attestations after resolver checks"| EAS
  EASACTIONS -->|"online attestations"| EAS
  TRANSFER -->|"chain 42220 wallet transaction"| GD
  HATS --> CPM
  HATS --> SM
  GT -->|"try/catch"| CPM
  CPM --> REG
  CPM --> EAS
  EAS --> WAR
  WAR -->|"try/catch"| CPM
  EAS --> NR
  EAS --> NSR
  EAS --> NSTR
  EAS --> FAR
  EAS --> V3
  EAS --> CTR
  CPM -->|"events"| ENV
  REG -->|"events"| ENV
  SM -->|"events"| ENV
  SM -->|"versioned command; no token amounts"| CCIP
  CCIP --> CE
  CE -->|"typed canonical-G$ route only"| SAFE
  SAFE --> GD
  CE -->|"stored outcome + versioned acknowledgment"| CCIP
  CCIP --> SM

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class HATS,GT,WAR,EAS,GD built
  class CPJOBS,EASJOBS,EASACTIONS,TRANSFER,CPM,REG,SM,NR,NSR,NSTR,FAR,V3,CTR,ENV,SAFE,CCIP,CE planned
```

Boundary rules:

- **Application**: drafts and queued jobs are intent, never authority — every write is re-validated on-chain; nothing trusts a client claim.
- **Arbitrum**: HatsModule decides who may act; the pooling module owns state machines and EAS checks; the register counts units only for the module; the settlement module records value authorization but never custodies or calls Celo. Each Community resolver validates exactly one schema — **NeedResolver** (Need records), **NeedSignalResolver** (member signals on a Need), **NeedStatusResolver** (steward status updates), **FundingAttributionResolver** (receipt-checked funding references).
- **Envio**: restates emitted events into the read model — explicit fields only, no actor inference from `transaction.from`.
- **Celo + CCIP**: the executor validates its immutable source chain/sender and empty token amounts, then calls only the typed canonical-G$ route. Recovery owners are never executor owners. An authenticated Celo acknowledgment, not a human report or timeout, finalizes Arbitrum state.

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
    Note over M,R: Work attester must equal stored provider<br/>(Offer creator / Request counterparty)
  else garden claim
    Note over M,R: Work attester must be gardener/steward<br/>of stored providerGarden
  end
  Note over M,EAS: protocol-pool Work and assessment recipient = providerGarden<br/>while commitment pool remains root protocol pool
  alt Offer
    A->>EAS: provider submits Work matching a required action
  else Request
    B->>EAS: provider submits Work matching a required action
  end
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
  opt reward.rail == ArbitrumExternal
    OP->>RAILS: execute payout on an existing rail (jar / treasury)
    OP->>M: recordRewardPaid(commitmentId, payoutRef)
    M-->>IDX: RewardPaid(derived source, provider, token, amount)
    Note over WAR,IDX: CeloSettlement rewards never use this lane —<br/>they queue on the SettlementModule (D9, D12)
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
  NotReady --> Ready : markPoolReady (charter CID + non-zero open-commitment cap)
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
| Ready | onchain charter + non-zero provider open-commitment cap are present; the app offered the write only after a current non-revoked Baseline preflight | seed cycles; open the pool | steward |
| Open | promises can flow | create / claim / confirm commitments; seed and open cycles | members + steward |
| Paused | **the emergency freeze** | create, claim, Ready-submit, and confirm are disabled; browse, evidence/work linkage, cancellation, expiry, and dispute recovery remain available | steward (resume); existing actors keep allowed evidence/recovery paths |
| Closed | wind-down | no new activity; terminal cleanup of open commitments | steward |
| Composted | **archival rest — history + "ready for the next season"** | read everything; `reopenPool` back to Ready or Open; nothing else | steward |

Composting is archival, not deletion and not the freeze — `Paused` is the freeze. A composted pool keeps its full promise history visible and can wake for a new season via `reopenPool`. Pool-level `Paused` blocks new commitments, claims, and confirmations on that pool only; module-wide `setPaused` blocks operational mutations but keeps owner configuration, unpause, `cancelCommitment`, `expireCommitment`, and `resolveDispute` available for safe wind-down.

## D5. Cycle state machine (types: Season, Campaign)

On-chain enum stores `Seeded / Open / Reconciled / Composted / Cancelled`. `Draft` is app-only; `InProgress` and `Reviewing` are derived overlays of on-chain `Open`.

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e
  classDef appOnly fill:#ececec,stroke:#8a8a8a

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
  InProgress --> Reconciled : closeCycle (underlying Open)
  Open --> Reconciled : closeCycle
  Reconciled --> Composted : compostCycle
  Seeded --> Cancelled : cancelCycle(reasonCID)
  Open --> Cancelled : cancelCycle(reasonCID)
  InProgress --> Cancelled : cancelCycle(reasonCID) on underlying Open
  Reviewing --> Cancelled : cancelCycle(reasonCID) on underlying Open
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
  state "Disputed - recoverable" as DSP
  state "Ended (Cancelled / Expired)" as END
  [*] --> CRE : createCommitment
  CRE --> ACC : claim accepted (act 1)
  ACC --> RFC : delivery proven (act 2)
  RFC --> Fulfilled : counterparty confirms (act 3)
  CRE --> END : cancel / expire
  ACC --> END : cancel / expire (act 3)
  RFC --> END : expire (act 3)
  ACC --> DSP : dispute (act 3)
  RFC --> DSP : dispute (act 3)
  DSP --> ACC : RestorePrevious
  DSP --> RFC : RestorePrevious
  DSP --> END : cancel / expire resolution
  DSP --> Fulfilled : fulfill resolution when allowed
  Fulfilled --> [*] : reconciled at cycle close
  END --> [*] : reconciled at cycle close
```

#### D6a. Act 1 — Claim & acceptance

```mermaid
stateDiagram-v2
  classDef appOnly fill:#ececec,stroke:#8a8a8a
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
  classDef derived fill:#f6ecdc,stroke:#b98a3e
  Active: Active (derived)
  EvidenceSubmitted: EvidenceSubmitted (derived)
  PartiallyApproved: PartiallyApproved (derived)
  [*] --> Accepted
  Accepted --> Active : first WorkLinked or EvidenceAttached
  Active --> EvidenceSubmitted : EvidenceAttached / WorkLinked
  EvidenceSubmitted --> PartiallyApproved : ApprovedWorkCounted — some per-action counters below quota
  PartiallyApproved --> EvidenceSubmitted : new evidence or work
  EvidenceSubmitted --> ReadyForConfirmation : (a) first counted approval completes every requirement + assessment
  PartiallyApproved --> ReadyForConfirmation : (a) every per-action required count met + assessment satisfied
  Accepted --> ReadyForConfirmation : (b) submitForConfirmation — eligible evidence-only kind · no work requirement · at least 1 evidence · declared assessment attached · (c) steward override with reason
  ReadyForConfirmation --> [*]
  class Active derived
  class EvidenceSubmitted derived
  class PartiallyApproved derived
```

While the derived overlays are showing, the on-chain state remains `Accepted` — so the cancel/expire/dispute transitions in act 3 apply to all of them. The two delivery styles by kind: **DomainImpact** runs the full Work → WorkApproval rail with per-action required counts (`requirementIndex` credits exactly one requirement per approval — amendment 2026-07-18); **SupportService / OperatorCaptured / SeasonCampaign** seeded with no work requirement go through path (b), where the counterparty's confirmation IS the review (D3).

#### D6c. Act 3 — Resolution (confirmation, endings, disputes, reconciliation)

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e
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
- acceptance commits units and acquires one provider open-commitment slot once, regardless of `targetUnits`;
- cancellation or expiry from `Accepted`/`ReadyForConfirmation` releases those committed units and that one slot once;
- fulfillment converts committed units with `fulfillUnits` and releases that one slot;
- raising or restoring a dispute has no unit or slot effect;
- resolving to `Fulfilled`, `Cancelled`, or `Expired` applies the same conversion/release only when units and the slot are still held; a pre-dispute `Expired` record cannot become `Fulfilled` and never releases twice.

Cycle-less commitments (`cycleId == 0`) derive `Reconciled` from `PoolClosed`; cycle-scoped terminal commitments derive it from `CycleClosed`.

## D7. Indexer entity delta (ERD)

Ten NET-NEW pooling entities, all derived exclusively from module + register events (`chainId-identifier` composite IDs). `GARDEN` is the existing entity; settlement entities are shown separately in D7b. The docs-site ERD gains this delta at ship via PRD-680.

**Count-safe units model**: every commitment keeps its own exact `unitLabel`, `targetUnits`, and per-commitment `approvedUnits`. Pool/cycle totals never add unlike labels. `CommitmentUnitSummary` groups only exact UTF-8 label matches (`hours` and `Hours` are distinct), while `CommitmentProviderExposure` counts concurrent accepted commitments regardless of their quantities:

- `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the only cross-commitment percentage;
- `openCommitmentCount` is a count, not a unit total, and the provider cap consumes one slot per accepted commitment;
- exact-label summaries keep `expectedUnits`, `approvedUnits`, `fulfilledUnits`, and `openUnits` for operational detail;
- active-cycle surfaces show state counts plus exact-label groups, never a synthetic mixed-unit progress rate.

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
  NEED_COMMITMENT_INDEX |o--o{ COMMITMENT : "zero or many commitments for one non-zero needUID"
  COMMITMENT_POOL ||--o{ COMMITMENT_UNIT_SUMMARY : "exact-label pool groups"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_UNIT_SUMMARY : "exact-label cycle groups"
  COMMITMENT_POOL ||--o{ COMMITMENT_PROVIDER_EXPOSURE : "one current count per provider"

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
    BigInt providerOpenCommitmentCap "non-zero concurrent-count readiness gate"
    BigInt openCommitmentCount "accepted commitments not released or fulfilled"
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
    String provider "Offer creator or Request counterparty"
    String providerGarden "EAS recipient and role scope"
    CommitmentDirection direction "OFFER or REQUEST"
    CommitmentKind commitmentType "DOMAIN_IMPACT, SUPPORT_SERVICE, OPERATOR_CAPTURED, SEASON_CAMPAIGN"
    CommitmentOnchainState state "derived overlays computed in shared selectors"
    CommitmentClaimType claimType "INDIVIDUAL or GARDEN eligibility"
    CommitmentClaimMode claimMode "OPEN or APPROVAL_GATED"
    Int domains "optional array, unique, max 4"
    BigInt requiredActionUIDs "optional array, positional with domains"
    Int requiredApprovedWorkCounts "per-action quotas, positional (amendment 2026-07-18)"
    Int approvedWorkCounts "per-action counters, positional"
    Boolean requiresAssessment "creation fact"
    String metadataCID "creation terms"
    String needUID "optional community Need this promise answers"
    String unitLabel "exact stored bytes define summary identity"
    BigInt targetUnits "class quota in unitLabel units, immutable at creation"
    BigInt approvedUnits "per-commitment only"
    Int confirmationCount "recorded confirmations"
    String confirmers "resolved eligible group"
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
    String requestedBy "authenticated caller; differs for Garden claims"
    CommitmentClaimType claimType "INDIVIDUAL or GARDEN"
    String gardenContext "stored request / eligibility context"
    String gardenContextId "chainId-address relationship"
    Int requestedAt "event timestamp"
    CommitmentClaimRequestState state "PENDING ACCEPTED DECLINED SUPERSEDED"
    String reasonCID "decline only"
    String resolutionCode "accepted declined cancelled expired"
    Int resolvedAt "nullable"
  }
  COMMITMENT_UNIT_SUMMARY {
    ID id "chainId-scope-scopeId-unitLabelHash"
    CommitmentUnitScope scope "POOL or CYCLE"
    BigInt scopeId "poolId or cycleId"
    BigInt poolId "required parent"
    BigInt cycleId "nullable for POOL scope"
    String unitLabel "exact stored UTF-8 label"
    String unitLabelHash "keccak256 exact label bytes"
    BigInt expectedUnits "accepted targetUnits in this label only"
    BigInt approvedUnits "approval deltas in this label only"
    BigInt fulfilledUnits "fulfilled units in this label only"
    BigInt openUnits "committed minus released minus fulfilled in this label only"
  }
  COMMITMENT_PROVIDER_EXPOSURE {
    ID id "chainId-poolId-provider"
    BigInt poolId "relationship key"
    String provider "normalized address"
    BigInt openCommitmentCount "current concurrent commitment count"
    Int updatedAt "event timestamp"
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

Full field lists: contract-spec §8.2. The ERD intentionally shows the key identity, relationship, state, and accounting fields needed to review trust and cardinality; it is not a substitute for the canonical GraphQL block. Only `promiseKeptRate` divides across commitments. Exact-label unit rows and provider count rows remain integer event-derived facts.

## D7b. Settlement ERD

**How to read this**: the planned read model keeps the logical attempt separate from immutable
protocol-message rows. `SettlementAttempt` is keyed by its execution key and relates back to
the canonical disbursement or batch; `SettlementMessage` records source commands, Celo
execution outcomes, and acknowledgments from Green Goods contracts only. This distinguishes
Celo execution from a received acknowledgment without indexing or inferring raw G$ transfers.

```mermaid
erDiagram
  SETTLEMENT_ATTEMPT ||--o{ SETTLEMENT_MESSAGE : "one logical command/ack lifecycle"

  SETTLEMENT_ATTEMPT {
    ID id "sourceChainId-destinationChainId-executionKey"
    String executionKey "immutable idempotency key"
    BigInt settlementId "source-defined logical settlement"
    Int attempt "new only after authenticated failure"
    String garden "command fact"
    Int disbursementKind "0 reward; 1 funding"
    SettlementAttemptStatus status "pending/succeeded/failed/cancelled"
    SettlementAttemptStage stage "queued through acknowledged"
    String commandMessageId "current command transport id"
    String acknowledgmentMessageId "ack transport id"
    Int failureCode "bounded executor failure"
  }
  SETTLEMENT_MESSAGE {
    ID id "eventChainId-txHash-logIndex"
    String executionKey "attempt relation"
    SettlementMessageType messageType "immutable protocol event"
    String commandMessageId "when present"
    String acknowledgmentMessageId "when present"
    Boolean success "ack result when present"
    Int failureCode "negative ack code when present"
    String reasonHash "ack deferral reason when present"
  }
```

Commitment/disbursement joins, settlement accounts, batches, per-member recovery, and Safe
configuration follow the canonical entities in `settlement-spec.md` §6. None are claims about
currently deployed or indexed state.

## D7c. Fulfilled-commitment Hypercert cut-over and indexer delta

**How to read this**: the existing Work-attestation certificate path stays intact for legacy work. Commitment Pooling adds a second input only after a commitment is `Fulfilled`: its immutable terms, Need lineage, approved Work/evidence, and six-share BPS class allocation are composed into the existing IPFS → Merkle → mint pipeline. The certificate indexer stores the bundle kind and Commitment/Need lineage; it does not reinterpret promise state or combine unit labels.

```mermaid
flowchart LR
  subgraph LIVE["Built / live certificate path"]
    WORK["Approved Work bundle<br/>bundleKind=WORK_LEGACY"]
    IPFS["IPFS metadata"]
    MERKLE["Merkle tree"]
    MINT["Hypercert mint"]
  end

  subgraph PLANNED["Planned / gated Commitment Pooling delta"]
    FUL["Fulfilled Commitment<br/>immutable terms + exact unitLabel"]
    LINEAGE["NeedCommitmentIndex<br/>Need UID + fulfilled lineage"]
    EVIDENCE["Approved Work + evidence links"]
    COMPOSE["Commitment certificate composer<br/>bundleKind=COMMITMENT"]
    BPS["Six BPS classes<br/>expanded to recipient allowlist"]
    HCIDX["Hypercert read-model delta<br/>commitmentIds · needUIDs · bundleKind"]
  end

  WORK --> IPFS
  FUL -->|"stored Fulfilled state"| COMPOSE
  LINEAGE -->|"indexed lineage"| COMPOSE
  EVIDENCE -->|"approved evidence"| COMPOSE
  BPS -->|"class quotas total 10,000 BPS"| COMPOSE
  COMPOSE -->|"canonical metadata"| IPFS
  IPFS --> MERKLE
  MERKLE --> MINT
  MINT -->|"mint event"| HCIDX

  classDef built fill:#E4EFE2,stroke:#426A45,color:#2A2722,stroke-width:2px
  classDef planned fill:#F4EFE6,stroke:#6E6857,color:#2A2722,stroke-width:2px,stroke-dasharray:6 4
  class WORK,IPFS,MERKLE,MINT built
  class FUL,LINEAGE,EVIDENCE,COMPOSE,BPS,HCIDX planned
```

---

## D8. G$ funding topology, Safe recovery, and CCIP boundary

**How to read this**: canonical G$ stays on Celo. Arbitrum sends a data-only command; the Celo executor derives the Safe/token call, executes through a bounded Zodiac role, stores the outcome, and sends a data-only acknowledgment. The executor is never a Safe owner. A message timeout never creates a second payment attempt.

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
  EXEC["CeloSettlementExecutor<br/>CCIP receiver/sender · Zodiac Roles member<br/>never Safe owner · no arbitrary calldata"]

  subgraph ARB["Arbitrum command/ack control plane"]
    HATS["Hats<br/>steward gates"]
    CPM2["CommitmentPoolingModule<br/>Fulfilled commitments"]
    SM["SettlementModule<br/>derived command · native ETH fees<br/>authenticated acknowledgment receiver"]
  end
  CCIP["Chainlink CCIP<br/>message-only both directions<br/>no token amounts"]

  HOA -->|"G$ stream — upstream fact,<br/>not a queued action"| GG
  GG -->|"ProtocolToGarden<br/>source + recipient derived"| GS
  GG -->|"protocol-pool disbursements"| MEM
  GS -->|"garden disbursements"| MEM

  HATS --> SM
  CPM2 -->|"Fulfilled read at queue time"| SM
  SM -->|"versioned command tuple<br/>isBatch-domain key · same-key retry"| CCIP
  CCIP -->|"authenticated command"| EXEC
  EXEC -->|"derived canonical G$ transfer<br/>Roles + caps"| GG
  EXEC -->|"derived canonical G$ transfer<br/>Roles + caps"| GS
  EXEC -->|"ack tuple<br/>independent retry"| CCIP
  CCIP -->|"authenticated success/failure"| SM
  PM --> GS
  DM --> GS
  GR --> GS
```

The Safe owner set remains exactly protocol recovery multisig, Dev Guild recovery multisig, and one named garden recovery delegate, threshold 2. The `CeloSettlementExecutor` is installed only as the reviewed Zodiac Roles v2 member with an exact `bytes32` role key, canonical G$ transfer conditions, and per-transfer/batch/period caps. Source commands and automatic acknowledgments are sponsored from monitored native reserves; a permissionless acknowledgment retry may instead supply the exact CELO quote without reducing the reserve. Protocol-Safe inflow remains an external treasury fact; the command path models ProtocolToGarden and commitment rewards only.

## D9. Settlement sequence with failure/retry

**How to read this**: command delivery retry and acknowledgment retry are independent. Both reuse one immutable execution key; neither may execute G$ twice. Only the authenticated success acknowledgment for the subject's current key and attempt turns Arbitrum state into `Confirmed`.

```mermaid
sequenceDiagram
  autonumber
  actor OP as Garden steward (via Admin Operations)
  participant SM as SettlementModule (Arbitrum)
  participant CPM as CommitmentPoolingModule
  participant AR as CCIP Router (Arbitrum)
  participant CE as CeloSettlementExecutor
  participant CR as CCIP Router (Celo)
  participant SAFE as Owning-pool Celo Safe
  participant GD as G$ token (Celo)
  participant IDX as Indexer

  OP->>SM: queueDisbursement(commitmentId) or queueFunding(garden, amount)
  SM->>CPM: read canonical eligible facts
  SM-->>IDX: DisbursementQueued ("support is queued")
  OP->>SM: dispatchDisbursement or dispatchBatch
  SM->>AR: ccipSend(command tuple, no tokens; snapshotted peer/version/gas)
  SM-->>IDX: SettlementCommandDispatched (key, messageId, peer, payloadHash)
  AR-->>CR: CCIP delivery
  CR->>CE: authenticated command
  alt executionKey already has a stored terminal outcome
    CE-->>IDX: DuplicateSettlementMessage
    Note over CE,SAFE: reuse stored outcome; Safe is not called again
  else new executionKey
    CE->>SAFE: fixed G$ transfer/batch through Zodiac Roles
    alt bounded Safe execution succeeds
      SAFE->>GD: canonical G$ transfers
      CE-->>IDX: SettlementExecutionStored(Succeeded, originating module/version) ("confirming arrival")
      Note over CE: store success before acknowledgment
    else authenticated policy or bounded execution fails
      CE-->>IDX: SettlementExecutionStored(Failed, failureCode)
      Note over CE: store failure before acknowledgment
    end
  end
  CE->>CR: ccipSend(ack tuple, no tokens)
  alt acknowledgment delivery succeeds
    CR-->>AR: CCIP delivery
    AR->>SM: authenticated acknowledgment
    alt success
      SM-->>IDX: SettlementAcknowledged(success=true) → Confirmed
    else execution failure
      SM-->>IDX: SettlementAcknowledged(success=false) → Failed
    end
  else native CELO or delivery is delayed
    CE-->>IDX: AcknowledgmentDeferred
    OP->>CE: quote + retryAcknowledgment{value: exact CELO fee}(executionKey)
    Note over CE,SAFE: stored outcome only; Safe is not called again
  end
  opt command delivery is delayed
    OP->>SM: retryCommand(disbursementId) / retryBatchCommand(batchId)
    SM->>AR: ccipSend(same tuple + same destination snapshot, new messageId)
    CE->>CE: duplicate executionKey → reuse stored outcome
    Note over CE,SAFE: no second G$ execution
  end
  opt authenticated failure needs a new logical attempt
    OP->>SM: requeue(disbursementId)
    Note over OP,SM: explicit next attempt after authenticated failure only
  end
```

## D10. Disbursement state machine (all module-native, on-chain)

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Queued : queueDisbursement / queueFunding — canonical facts
  Queued --> Dispatched : dispatch command (executionKey + messageId)
  Dispatched --> Dispatched : same-key command retry / delivery delay / Celo executed ack pending
  Dispatched --> Confirmed : authenticated success acknowledgment for current key/attempt
  Dispatched --> Failed : authenticated current failure acknowledgment
  Failed --> Queued : requeue(disbursementId) — next attempt
  Failed --> Cancelled : cancelDisbursement(disbursementId, reasonCID)
  Queued --> Cancelled : cancelDisbursement(unbatched disbursementId, reasonCID)
  Confirmed --> [*]
  Cancelled --> [*] : frees the commitment for a fresh queue
```

**What each state allows**:

| State | What it means | What's allowed next | Who acts |
|---|---|---|---|
| Queued | steward has queued canonical eligible facts; nothing dispatched | dispatch through the frozen entrypoint; cancel an unbatched item or cancel the whole immutable batch | resolved settlement steward |
| Dispatched | command sent; execution or acknowledgment may still be pending | wait; retry same command; retry stored acknowledgment from Celo | resolved steward / anyone for destination ack retry |
| Confirmed | authenticated success acknowledgment for the current key/attempt received | terminal — “support arrived” | Celo executor through CCIP |
| Failed | authenticated current execution-failure acknowledgment received | explicitly requeue a new next attempt; or terminally cancel | resolved settlement steward |
| Cancelled | withdrawn while Queued, or closed after authenticated Failed delivery | terminal for that execution key | resolved settlement steward |

For a Queued batch, the `Queued -> Cancelled` transition is
`cancelBatch(batchId, reasonCID)`: one atomic transition over the immutable member
set. `cancelDisbursement` rejects a Queued member whose `batchId != 0`, so no
partial queued-batch state can exist.

A failed Celo leg never changes Commitment Pooling state. `SettlementExecutionStored(Succeeded)` without the Arbitrum acknowledgment derives “confirming arrival” while stored Arbitrum state remains `Dispatched`. A delivery timeout cannot cancel or create a new attempt. Cancellation is allowed from Queued or an authenticated Failed result, never from Dispatched; a Failed member may instead be explicitly requeued as a new attempt.

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

**How to read this**: the House of Alignment stream arriving in the protocol Safe is an upstream fact — Green Goods never queues, executes, or verifies it. The planned protocol → garden top-up uses the same CCIP command → bounded Celo execution → acknowledgment discipline as D9 and cannot be enabled until the production Safe/Zodiac route is approved.

```mermaid
sequenceDiagram
  autonumber
  actor HOA as GoodDollar House of Alignment
  actor OP as Protocol steward
  participant SM as SettlementModule (Arbitrum)
  participant CCIP as CCIP routers
  participant CE as CeloSettlementExecutor
  participant PS as GG protocol Safe (Celo)
  participant GS as Garden Safe (Celo)

  HOA->>PS: G$ stream lands in the protocol Safe (upstream fact)
  Note over SM,GS: SettlementModule derives the only allowed ProtocolToGarden route
  OP->>SM: queueFunding(garden, amount)
  SM->>CCIP: data-only command
  CCIP->>CE: authenticated command
  CE->>PS: typed canonical-G$ route to GS
  CE->>CCIP: stored outcome acknowledgment
  CCIP->>SM: authenticated success/failure acknowledgment
```

If the Celo AA/paymaster spike fails, this Safe-to-Safe route remains available while `memberDeliveryEnabled` stays false. There is no garden-custody member-claim fallback.

## D13. Capability responsibility summary

**How to read this**: this is a capability summary for audience orientation, not the function-level authorization source. One row appears per capability-bearing role and one column per capability group — ✓ means the role may act within the listed scope, — means no access, ✗ marks an enforced prohibition. "Garden steward" = holder of the garden's operator/owner Hats; the protocol pool resolves stewardship to the root garden. The scoped executor is the `CeloSettlementExecutor` contract itself, never a human steward or Safe owner. D13b carries the exact function-level permission table.

| Role | Pool & cycle control | Create / claim promises | Evidence & work | Approve work | Confirm fulfillment | Queue & execute value | Confirm settlement | Configure protocol |
|---|---|---|---|---|---|---|---|---|
| **Module owner** | ✓ fallback steward | — | — | — | — | ✓ queue protocol funding · dispatch/retry within frozen routes | — | ✓ pause · peer/module wiring · measured limits · UUPS upgrade |
| **Garden steward** | ✓ seed / open / pause / compost · accept / decline claims | ✓ seed SeasonCampaign · OperatorCaptured (`onBehalfOf`) | ✓ attach for members | ✓ WorkApproval (existing flow) | fallback only, with reason, never as provider | ✓ queue/dispatch/retry/requeue/cancel within resolved scope | — | — |
| **Member / gardener** | — | ✓ own Offer / Request · claim open commitments | ✓ own evidence · link work | — | ✓ when eligible confirmer | — | — | — |
| **Accepted provider** | — | — | ✓ deliver + evidence | — | ✗ never own delivery | — | — | — |
| **Evaluator** | — | — | ✓ assessments (baseline / delta / technical) | — | ✓ when named confirmer | — | — | — |
| **Community member** | — | ✓ needs + signals (Community PWA) | ✓ testimony | — | ✓ when named confirmer | — | — | — |
| **CeloSettlementExecutor (Zodiac Roles member)** | — | — | — | — | — | ✓ typed canonical-G$ transfer only | ✓ sends CCIP acknowledgment | — |
| **Recovery owner (2-of-3)** | — | — | — | — | — | ✗ execution | — | ✓ recover / rotate Safe modules only |
| **CCIP routers** | — | — | — | — | — | — | transports authenticated protocol messages only | — |
| **Envio handlers** | — | — | — | — | — | — | — | read model from explicit event fields only |

**Hard prohibitions (the red lines)**:

- No provider may confirm their own delivery — including through steward fallback.
- No recovery owner may be a Safe executor, and no executor may be a recovery owner (deployment and `addExecutor` both reject overlap).
- No human report, timeout, or Celo transfer log can mark a source attempt `Confirmed` or `Failed`; only the authenticated Celo executor acknowledgment can do so.
- No handler infers an actor from `transaction.from`.
- No contract enumerates all cycles or claims to make a transition.

**Capability separation (why value stays bounded)**:

```mermaid
flowchart LR
  OWN["SettlementModule owner<br/>queues / dispatches / pauses"] -->|"data-only command"| SM["SettlementModule"]
  SM -->|"CCIP command"| EX["CeloSettlementExecutor<br/>typed G$ route only"]
  EX -->|"CCIP acknowledgment"| SM
  RO["Recovery owners<br/>rotate Safe modules, never executor owners"] -->|"reviewed no-overlap gate"| EX
```

The Arbitrum module owner and the Celo executor owner are separate implementation roles. The production route must prove that the Celo executor is a narrowly scoped Zodiac Roles member, never a Safe owner; external Safe authority configuration remains a Release gate. No human capability or timeout can certify a source settlement outcome.

## D13b. Exact sensitive-action permission table

This table is the Architecture-tab copy of the two canonical permission matrices in `contract-spec.md` and `settlement-spec.md`. A caller must satisfy both the named role and every listed gate; a broad capability in D13 never widens these rows.

| Function or family | Authorized caller | Non-negotiable gate |
|---|---|---|
| `onGardenMinted` | GardenToken only | Idempotent; creates one Garden pool in NotReady |
| `registerPool` | Protocol: module owner; Garden: garden operator/owner or module owner | One pool per garden |
| `setPoolCharter`, `markPoolReady` | Resolved pool steward | Ready requires non-empty charter and a previously configured non-zero provider open-commitment cap; Baseline remains an app preflight |
| `openPool`, `pausePool`, `resumePool`, `closePool`, `compostPool`, `reopenPool` | Resolved pool steward | Exact D4 transition; pause reason mandatory |
| `seedCycle`, `openCycle`, `closeCycle`, `compostCycle`, `cancelCycle` | Resolved pool steward | Exact D5 transition; allocation exists only on open and totals 10,000 BPS; cancel reason mandatory |
| `createCommitment` | Pool member for own Offer/Request; steward for SeasonCampaign/OperatorCaptured; root steward or owner in protocol pool | Pool/cycle accepts; stored authorship and `onBehalfOf` determine provider; DomainImpact arrays are valid |
| `setDeclaredReward`, `setConfirmerRule` | Resolved pool steward | Pre-acceptance only |
| `claimCommitment` | Garden member; or protocol-pool garden operator/owner / individual garden member according to stored `claimType` | Runtime kind equals stored type; canonical claimant and `requestedBy` are derived, not substituted |
| `acceptClaim`, `declineClaim` | Resolved pool steward | Named pending claimant exists; acceptance consumes stored terms and one provider count slot; decline reason mandatory |
| `linkWork` | Accepted canonical claimant/counterparty or steward | Accepted; schema/action/provider authorship/provider-garden recipient checks pass |
| `unlinkWork`, `syncApprovedWork` | Resolved pool steward | Unlink only before counting; sync verifies EAS and dedupes |
| `onWorkApproved` | WorkApprovalResolver only | Non-blocking; unlinked/already-counted approval is a no-op |
| `attachEvidence` | Creator, counterparty, or steward | Commitment state allows attachment; offline-queueable |
| `attachAssessment` | Steward or evaluator of `providerGarden` | Resolver/schema/kind/recipient valid; Ready predicate re-evaluated |
| `submitForConfirmation` | Creator, counterparty, or steward | Evidence-only eligible kind; no Work requirement; evidence and declared assessment present |
| `markReadyForConfirmation` | Resolved pool steward | Override reason mandatory and emitted |
| `confirmFulfillment` | Named confirmer, Offer counterparty, or Request creator | ReadyForConfirmation; provider excluded; once per confirmer |
| `confirmFulfillmentAsFallback` | Resolved pool steward | Mandatory reason; provider-steward excluded |
| `cancelCommitment` | Creator or steward before acceptance; steward after acceptance | Allowed state only; accepted record releases units and one slot once |
| `expireCommitment` | Anyone | Past due date/cycle end; accepted record releases units and one slot once |
| `raiseDispute`, `resolveDispute` | Creator/counterparty/named confirmer/steward may raise; steward resolves | Allowed state and mandatory reason; prior slot state preserved; expired prior state cannot resolve Fulfilled |
| `recordRewardPaid` | Resolved pool steward | Fulfilled; `reward.rail == ArbitrumExternal`; one record; earned-reward facts derive from storage; every other rail reverts |
| `setGardenToken`, `setHatsModule`, `setActionRegistry`, `setCommitmentRegister`, `setWorkApprovalResolver`, `setEAS`, `setSchemaUIDs`, `setPaused` | Module owner | Owner-only configuration; documented pre-wiring module links are the only allowed zero-address exception |
| `setProviderOpenCommitmentCap` | Resolved pool steward | Non-zero concurrent commitment count; module forwards to the register; required before Ready |
| `registerClass`, register `setProviderOpenCommitmentCap`, `commitUnits`, `releaseUnits`, `fulfillUnits` | Commitment Pooling module only | Class quota is immutable; concurrent provider slot changes are idempotent and bounded |
| Register `setModule`; pooling/register/resolver `_authorizeUpgrade` | Respective protocol-multisig owner | Owner-only UUPS/admin path |
| Assessment v3, Community Testimony, Need, NeedSignal, NeedStatus, FundingAttribution attestations | Exact evaluator/steward/community/funder attester named by the resolver matrix | Resolver-specific Hat, schema, recipient, reference, and receipt checks |
| `queueDisbursement` | Commitment-pool steward | Fulfilled commitment; `reward.rail == CeloSettlement`; member-delivery gate; canonical G$; active owning-pool source account; Individual derives provider AA while Garden derives active providerGarden Safe; no caller-selected recipient/token/amount |
| `queueFunding` | Protocol steward or `SettlementModule` owner | Only the derived ProtocolToGarden route; active source/destination accounts; no caller-selected token/Safe/target/calldata |
| `createBatch` | Resolved settlement steward for the immutable executor garden | Unique Queued members share executor garden/source/token/kind/funding route; membership is immutable; measured configured limit is non-zero and at or below hard ceiling 24 |
| `dispatchDisbursement`, `dispatchBatch`, `retryCommand`, `retryBatchCommand` | Stored steward, `SettlementModule` owner, or configured dispatcher | Frozen data-only payload; adequate native fee reserve; initial dispatch snapshots destination selector/executor/gas/version/payload hash; retry preserves the snapshot, attempt, execution key, and payload while producing only a new message ID |
| `requeue` | Resolved settlement steward | Authenticated `Failed` member only; increments the individual attempt; immutable failed batch is never rewritten |
| `cancelDisbursement` | Resolved settlement steward | unbatched `Queued` or authenticated `Failed` only, with reason; dispatched work cannot be cancelled for a timeout or missing acknowledgment |
| `cancelBatch` | Resolved batch steward | whole immutable batch while `Queued`, with reason; no partial-member cancellation |
| `fundFees` / `withdrawExcessFees` | Anyone / `SettlementModule` owner | Native ETH only; owner withdrawal preserves the configured reserve minimum |
| `setCcipRoute`, `setBatchSizeLimit`, pause/module wiring, `_authorizeUpgrade` | `SettlementModule` owner | Pause gates configuration and source dispatch; peer replacement may retain one bounded predecessor; the router is immutable per implementation and replacement requires disposition of old-router in-flight messages plus a verified UUPS implementation upgrade |
| `configureGardenRoute`, cap/reserve/peer-rotation setters, `setPaused` | `CeloSettlementExecutor` owner | Safe/Role changes require pause and live one-to-one Safe, avatar/target, executor membership, exact `bytes32` role key, and non-owner proof; one previous peer may expire after a bounded grace period; no mutable router setter |
| Celo command receive | Immutable implementation CCIP router only | Exact active/unexpired Arbitrum selector/sender peer, versioned tuple with `isBatch`, no token amounts, one-recipient unbatched or enabled/bounded batch shape, caps; stored result includes originating module/version and prevents duplicate G$ execution |
| `retryAcknowledgment` / sponsored variant | Anyone with exact quoted CELO fee / executor owner | Stored result exists; resends use the stored originating module/version even after peer rotation; caller-funded path never consumes reserve, sponsored path preserves the onchain minimum, and neither calls the Safe route |
| Arbitrum acknowledgment receive | Immutable implementation CCIP router only | Selector/executor/version equal the command's stored destination snapshot and remain active/unexpired globally; known originating command message, empty token amounts, consistent success/bounded failure code; terminal duplicates are emitted and ignored |

## D14. Commitment offline job lifecycle

**How to read this**: offline-safe writes are explicit jobs, not optimistic state mutations. A job may wait for the required membership Hat indefinitely without spending a retry. Once membership is present, normal submission attempts begin; only a failed submission consumes one of five attempts. A human can manually retry an exhausted job or discard it.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Draft : save offline-capable action
  Draft --> Queued : enqueue commitment / claim / evidence / work link / confirmation
  Queued --> WaitingForMembership : required Hat is absent
  WaitingForMembership --> WaitingForMembership : poll or reconnect / retries unchanged
  WaitingForMembership --> Queued : membership observed
  Queued --> Syncing : network + membership ready
  Syncing --> Completed : transaction and indexed confirmation
  Syncing --> RetryableFailure : submission failed and attempts less than 5
  RetryableFailure --> Queued : retry with backoff / attempts incremented once
  Syncing --> Exhausted : fifth submission failure
  Exhausted --> Queued : manual retry
  Exhausted --> Discarded : explicit user discard
  Completed --> [*]
  Discarded --> [*]

  classDef derived fill:#F6ECDC,stroke:#B98A3E,color:#2A2722,stroke-width:2px
  classDef apponly fill:#F4EFE6,stroke:#8A6C3E,color:#2A2722,stroke-width:2px
  class Draft,Queued,WaitingForMembership,Syncing,RetryableFailure,Exhausted,Discarded apponly
  class Completed derived
```

Only commitment creation, claim, evidence attachment, Work linking, and eligible confirmation enter this queue. Accept/decline, assessment attachment, steward override, dispute actions, and value transfer stay online-only because their authorization or freshness cannot be safely deferred. `WaitingForMembership` is app-only provenance, not an on-chain state and not a failed attempt. `Completed` is derived after the corresponding transaction is indexed; it is not a state stored by the protocol contract.

---

## Appendix: Edits to EXISTING docs diagrams at ship (PRD-680 scope)

Not performed now — the docs site describes what is live. Flagged on the Linear issue so they ship with the release:

1. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Work submission and approval**: after WorkApprovalResolver validation, add the optional bridge step — `WorkApprovalResolver → CommitmentPoolingModule.onWorkApproved (try/catch, non-blocking)` with a one-line note that approvals count toward pre-linked commitments only.
2. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Assessment flow**: add the v3 authorship split — baseline by evaluator OR operator; delta/re-assessment and technical by Evaluator Hat only; community testimony (Community Hat) as its own thin sequence.
3. **`docs/docs/builders/architecture/erd.mdx`**: append the D7 entity delta and the two new contract blocks to the contract-to-indexer event mapping.
