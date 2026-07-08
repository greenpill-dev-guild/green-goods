# Commitment Pooling: Contract Spec

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Companions**: `corrections-log.md` (verified repo facts, exact UIDs and addresses), `uiux-spec.md` (surface flows), `plan.todo.md` (execution plan). This spec is the contract-layer source of truth for the August release build track.

> **Amendment 2026-07-04 (approved)**: the commitment record, `CreateCommitmentParams`, and `CommitmentCreated` gain an additive `bytes32 needUID` reference (0 = none) linking a commitment to the community Need that motivated it. Additive reference field beside `assessmentUID`; no state-machine change; the module stores it as-is and never reads EAS for it. Specced before the August build starts so it ships in the initial deploy, not as an upgrade. Owning spec: `.plans/active/community-interface/spec.md` (§11).

Every technical claim below carries a repo file path (relative to repo root) or a NET-NEW marker. All contract names, functions, events, and entities introduced here are NET-NEW unless a path says otherwise. Format mirrors the house implementation-spec style of `docs/docs/builders/specs/greenwill-gif-implementation-spec-2026-03.md` (Purpose, Scope, Canonical Implementation Decisions, System Components, per-contract Contract Work, Package-Level Backlog, Launch Milestones).

---

## 1. Purpose

Translate the locked commitment-pooling architecture (27 decisions from the 2026-07-03 alignment session, plus the locked state machines and aggregate semantics from the Linear lifecycle doc) into PR-openable contract, deployment, and indexer work. An implementer should be able to open the first PR from this document without asking questions.

The system lets gardens and the protocol run pools of commitments: offers and requests of concrete support, seeded into season or campaign cycles, claimed by members or gardens, evidenced through the existing Work and WorkApproval rails or lightweight evidence, confirmed by counterparties, and rolled up into promises-kept aggregates and fulfilled-commitment Hypercerts. Vocabulary is mutual aid throughout: offer, request, promise kept, fulfilled, steward, season, campaign, readiness, confirmation. No leaderboard semantics anywhere, ever.

## 2. Scope

### In scope

- `CommitmentPoolingModule`: control plane for pools, cycles, commitments, confirmations, disputes, reward records (NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol`).
- `CommitmentRegister`: non-transferable ERC-1155-style unit accounting companion, functionally controlled by the module (NET-NEW `packages/contracts/src/registries/Commitment.sol`).
- GardenToken wiring: one new module field, setter, event, gap 37 to 36, live 42161 UUPS upgrade (`packages/contracts/src/tokens/Garden.sol`).
- WorkApprovalResolver bridge: optional non-blocking module hook on approval (`packages/contracts/src/resolvers/WorkApproval.sol`).
- Exactly two new EAS schema registrations: assessment v3 and community testimony, each with a new resolver, registered via the standalone badge-schemas path (decision #14, #26).
- Deployment plumbing: `DeployHelper.sol` result fields, `DeploymentBase.sol` helpers, artifact keys, storage-layout baselines.
- Envio indexer plan: two new contract blocks, four new entities, one handler module; all locked stats derivable from module and register events alone.
- Hypercert cut-over: `bundleKind` discriminator, fulfilled-commitment bundling, on-chain allocation-class bps at cycle open with app-computed allowlists.

### Out of scope

- Celo/G$ execution inside the core pooling module or register. August G$ split-state settlement is in scope separately via `settlement-spec.md` / PRD-686; the core pooling contracts never custody G$, call Celo, or flip `settlementEnabled`.
- Borrow-and-repay (mutual credit). A blocked follow-on companion `CreditRegister` (records-only, no-custody, interest-free) is specced separately in `credit-spec.md` — additive, zero pooling-module/register changes; out of scope for this spec and not dispatchable without a new scope lock.
- Sarafu integration or any reading of Sarafu source code (AGPL clean-room, decision #17; grounding is the Grassroots Economics paper and public docs only).
- Bridged G$, bridge custody/unbounded value authority, and GoodDollar rails inside the pooling module. Operator-executed G$ settlement lives in `SettlementModule`; bridge-executor automation is an August stretch owned by the settlement lane, else post-August.
- Leaderboards, rankings, comparison views, countdown or streak mechanics of any kind.
- A separate aggregator contract (PRD-649 locked: aggregates come from events, not an on-chain aggregator).
- CookieJar contract changes (decision #18: rewards are declared references plus operator-executed payouts on existing rails).
- Re-indexing EAS attestations (indexer boundary, `packages/indexer/schema.graphql:282-288`).

## 3. Canonical Implementation Decisions

Settled for v1 unless explicitly revised. Numbers in parentheses reference the locked decision register in the approved session plan.

1. **Commitments are NOT EAS attestations** (#14). Commitment records are module-native storage plus events, shaped by the Grassroots Economics commitment-pooling register grammar. This supersedes Document A and the original PRD-649/650 "commitment schema + FulfillmentConfirmation resolver" language. EAS registrations shrink to exactly two: assessment v3 and community testimony.
2. **Module-event-driven lifecycle because EAS is not indexed.** Envio indexes only Green Goods core contracts; EAS attestations are queried from easscan directly (`packages/indexer/schema.graphql:282-288`, `corrections-log.md` §2 Envio boundary row). Every commitment state and all four locked stats must be derivable from `CommitmentPoolingModule` and `CommitmentRegister` events alone.
3. **Hybrid state weight** (#6). Hard transitions on-chain: pool register/ready/open/pause/close/compost, cycle seed/open/close/compost/cancel, commitment create (offer/request), accept, approved-work count, ReadyForConfirmation, confirm to Fulfilled, cancel, expire, dispute raise/resolve, reward record. Draft states live in app IndexedDB; Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, and Reconciled are derived app/indexer-side from events. Full locked vocabulary is preserved across layers (section 5 table).
4. **Two-contract shape** (#15, #16). `CommitmentPoolingModule` is the control plane (pool registry, cycles, curation, claim modes, permissions, stat events). `CommitmentRegister` is voucher-shaped, non-transferable, ERC-1155-style unit accounting so transferable settlement vouchers can wrap classes 1:1 on the same poolId later. Supersedes PRD-649's single-artifact V1 stance (user-approved). poolId semantics unchanged.
5. **EAS bridge** (#5). `WorkApprovalResolver.onAttest` calls `module.onWorkApproved(...)` in try/catch (non-blocking, module optional), mirroring the existing GAP side effect (`packages/contracts/src/resolvers/WorkApproval.sol:179-183`). Operator-callable `syncApprovedWork` is the catch-up fallback. Work attestations cannot carry commitment refs (schema immutable, `corrections-log.md` H2), so linkage is module-side: claimant or operator links workUID to commitmentId before or after approval; the resolver hook only counts approvals for pre-linked workUIDs. Trust model: operator-curated linkage.
6. **v3 authorship split** (#7). Baseline assessment: evaluator OR operator (analog capture preserved, matches today's `packages/contracts/src/resolvers/Assessment.sol:114-121`). Delta/re-assessment and technical assessment: Evaluator Hat only. Community testimony: Community Hat only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:45` provides `isCommunity`).
7. **Protocol pool = root garden pool** (#8). The root garden (`packages/contracts/deployments/42161-latest.json:40-43`: `0xf401f34378384713222d1d21f63359cc4E8a858a`, tokenId 1) anchors the protocol pool with `poolType = Protocol`. Cross-garden claiming: claimant is a GardenAccount or a hat-wearing individual; the claimant field is an address plus a ClaimType kind enum. Protocol-pool stewardship reuses root-garden Hats.
8. **Rewards are references, not custody** (#18). A commitment carries a declared reward (source address, token, amount). On Fulfilled, the operator or protocol executes the payout on existing rails (jar, treasury) and records `RewardPaid` on the module. Zero CookieJar changes; jars remain pull-based (`packages/contracts/src/modules/CookieJar.sol:243-296`).
9. **Claim mode per commitment** (#19). Open claim vs approval gated, set at seeding. App-level defaults: protocol pool prefills ApprovalGated, garden campaign commitments prefill Open. The module stores what is passed.
10. **Lightweight evidence** (#20). `EvidenceAttached(commitmentId, cid, attacher)` module event, offline-queueable. For SupportService and OperatorCaptured commitments, counterparty confirmation IS the review; no separate approval step. DomainImpact keeps the full Work to WorkApproval path.
11. **Schema registration is the first PR chain of the August track** (#26), via the standalone badge-schemas-style path (`packages/contracts/script/deploy/badge-schemas.ts`, `packages/contracts/script/DeployBadgeSchema.s.sol`), never via `--update-schemas` (which re-registers and overwrites all existing schema artifact keys, `packages/contracts/script/Deploy.s.sol:122-151`).
12. **Allocation classes on-chain as bps at cycle open**. Six-role bps snapshot (gardeners, treasury, operator, evaluator, community, funder) validated to sum exactly 10000 (precedent: `InvalidSplitRatio`, `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`. Per-address allowlist expansion stays app-computed on the existing merkle pipeline (`corrections-log.md` §2 Hypercert row).
13. **Post-MVP garden-to-garden is reserved, not implemented**. `counterpartyPoolId` and `counterpartyGardenAccount` exist as reserved struct fields (always zero in MVP) so the L3 amendment is additive.
14. **Anti-farming posture from day one**: counterparty-first confirmation, self-confirmation blocked (mirrors `SelfAttestation`, `packages/contracts/src/resolvers/WorkApproval.sol:153-156`), operator fallback requires a visible reason, exposure caps in the register, dispute flag with operator resolution.

## 4. System Components

| Component | Responsibility | Location |
|---|---|---|
| `CommitmentPoolingModule` | pool registry, cycle lifecycle, commitment records and transitions, confirmations, disputes, work linkage, evidence events, reward records | NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol` |
| `ICommitmentPoolingModule` | canonical interface, enums, structs, events, errors | NET-NEW `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol` |
| `CommitmentRegister` | non-transferable unit classes, committed/fulfilled balances, quotas, exposure caps | NET-NEW `packages/contracts/src/registries/Commitment.sol` |
| `ICommitmentRegister` | register interface | NET-NEW `packages/contracts/src/interfaces/ICommitmentRegister.sol` |
| GardenToken wiring | module field + setter + mint callback | `packages/contracts/src/tokens/Garden.sol:27-34` (module fields), `181-227` (setter block), `421-456` (phase-2 integration callbacks) |
| WorkApprovalResolver bridge | approval hook into module | `packages/contracts/src/resolvers/WorkApproval.sol:115-185` |
| `AssessmentV3Resolver` | v3 authorship + baseline/delta validation | NET-NEW `packages/contracts/src/resolvers/AssessmentV3.sol` |
| `CommunityTestimonyResolver` | Community-Hat-gated testimony validation | NET-NEW `packages/contracts/src/resolvers/CommunityTestimony.sol` |
| Schema structs | decode layouts for the two new schemas | `packages/contracts/src/Schemas.sol` (append) |
| Schema config | canonical field lists, new keys only | `packages/contracts/config/schemas.json` (append keys `assessmentV3`, `communityTestimony`) |
| Deploy plumbing | CREATE2 proxies, wiring, artifacts | `packages/contracts/test/helpers/DeploymentBase.sol:257-338` (`_deployCorePart2`), `341-385` (`_wireModules`), `718-759` (`_deployCookieJarModule` template); `packages/contracts/script/DeployHelper.sol:42-72,276-347` |
| Standalone schema deploy | two registrations + resolver deploys + artifact merge | NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` + `packages/contracts/script/deploy/commitment-schemas.ts` (template: badge-schemas pair) |
| Indexer | entities + handlers for pools, cycles, commitments, units | `packages/indexer/config.yaml`, `packages/indexer/schema.graphql`, NET-NEW `packages/indexer/src/handlers/commitmentPool.ts` |
| Shared substrate | types, ABIs, hooks, job kinds (consumed by the UI/UX spec) | `packages/shared/src/types/job-queue.ts` (today exactly two kinds, `corrections-log.md` §6) |

Module wiring follows the hub-and-spoke pattern: GardenToken holds the module address and calls it during mint inside try/catch so garden mint never reverts on module failure (`packages/contracts/src/tokens/Garden.sol:421-430` CookieJar precedent).

## 5. State Machines: On-Chain Functions vs Derived States

Locked vocabulary from the lifecycle doc is preserved in full. "On-chain" means a named module function performs the transition and emits the listed event. "Derived" means app/indexer computes the state from the listed events; the chain never stores it. Draft states exist only as IndexedDB drafts in the app (decision #6).

### 5.1 Pool

On-chain enum: `PoolState { None, NotReady, Ready, Open, Paused, Closed, Composted }`. Every pool state is on-chain (transitions are rare, operator console actions).

| Transition | Layer | Mechanism |
|---|---|---|
| (create) -> NotReady | on-chain | `onGardenMinted(garden)` (GardenToken-only, idempotent) or `registerPool(garden, poolType)` (backfill + protocol pool). Event `PoolRegistered`. |
| NotReady -> Ready | on-chain | `markPoolReady(poolId)`, requires non-empty charter CID. Event `PoolReady`. App enforces the readiness checklist (charter + baseline assessment) before offering the action. |
| Ready -> Open | on-chain | `openPool(poolId)`. Event `PoolOpened`. |
| Open <-> Paused | on-chain | `pausePool(poolId)` / `resumePool(poolId)`. Events `PoolPaused` / `PoolResumed`. |
| Open or Paused -> Closed | on-chain | `closePool(poolId)`. Event `PoolClosed`. |
| Closed -> Composted | on-chain | `compostPool(poolId)`. Event `PoolComposted`. |
| Composted -> Ready or Open | on-chain | `reopenPool(poolId, toOpen)`. Event `PoolReopened`. |

### 5.2 Cycle (types: Season, Campaign)

On-chain enum: `CycleState { None, Seeded, Open, Reconciled, Composted, Cancelled }`. `Draft`, `InProgress`, and `Reviewing` are never stored on-chain.

| Transition | Layer | Mechanism |
|---|---|---|
| Draft (exists) | off-chain | Admin IndexedDB draft. No chain state, no event. |
| Draft -> Seeded | on-chain | `seedCycle(poolId, cycleType, startTime, endTime, metadataCID, allocation)`. Event `CycleSeeded`. |
| Seeded -> Open | on-chain | `openCycle(cycleId)`. Event `CycleOpened` carries the six allocation-class bps (sum == 10000 validated at seed). |
| Open -> InProgress | derived | Indexer/app: cycle is Open on-chain AND (first `CommitmentAccepted` with this cycleId OR block time >= startTime). |
| InProgress -> Reviewing | derived | Indexer/app: cycle Open on-chain AND block time > endTime, OR all cycle commitments in terminal or ReadyForConfirmation states. |
| Reviewing <-> InProgress | derived | New `EvidenceAttached` / `WorkLinked` / `ApprovedWorkCounted` on a cycle commitment while still Open on-chain flips back. |
| Reviewing -> Reconciled | on-chain | `closeCycle(cycleId)` (the reconcile act). Event `CycleClosed`. Commitment-level `Reconciled` derivation hangs off this event (5.3). |
| Reconciled -> Composted | on-chain | `compostCycle(cycleId)`. Event `CycleComposted`. |
| Draft/Seeded/Open/InProgress -> Cancelled | on-chain for Seeded and Open (`cancelCycle(cycleId, reasonCID)`, event `CycleCancelled`); off-chain discard for Draft. InProgress is on-chain Open, so the same function covers it. |
| Composted -> Draft/Seeded/Open (next cycle) | on-chain | A fresh `seedCycle` on the same pool. Succession is derived by pool ordering; no on-chain predecessor pointer. |

### 5.3 Commitment

On-chain enum: `CommitmentState { None, Offered, Requested, Accepted, ReadyForConfirmation, Fulfilled, Cancelled, Expired, Disputed }`. `Draft`, `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived.

| Transition | Layer | Mechanism |
|---|---|---|
| Draft (exists) | off-chain | Client/admin IndexedDB draft (offline-first). |
| Draft -> Offered or Requested | on-chain | `createCommitment(params)`. Event `CommitmentCreated` (direction Offer or Request sets the initial state). |
| Offered/Requested -> Accepted | on-chain | Open mode: `claimCommitment(...)` transitions immediately. ApprovalGated mode: `claimCommitment` emits `ClaimRequested` (state unchanged; "claim pending" is derived), then operator `acceptClaim(...)` transitions. Event `CommitmentAccepted`. Register records committed units (`UnitsCommitted`). |
| Accepted -> Active | derived | First `WorkLinked` or `EvidenceAttached` after acceptance. |
| Active -> EvidenceSubmitted | derived | Any `EvidenceAttached` or `WorkLinked` event. |
| EvidenceSubmitted -> PartiallyApproved | derived | `ApprovedWorkCounted` events: 0 < approvedWorkCount < requiredApprovedWorkCount. |
| PartiallyApproved <-> EvidenceSubmitted | derived | New evidence/work after partial approvals flips forward; the counter events flip back. |
| -> ReadyForConfirmation | on-chain | Three paths, all emitting `CommitmentReadyForConfirmation`: (a) automatic inside `onWorkApproved`/`syncApprovedWork` when approvedWorkCount reaches requiredApprovedWorkCount and any declared assessment requirement is satisfied; (b) `submitForConfirmation(commitmentId)` for commitments with requiredApprovedWorkCount == 0 (SupportService/OperatorCaptured review-is-confirmation path; requires >= 1 evidence); (c) `markReadyForConfirmation(commitmentId, reason)` operator/owner override, reason emitted (overrides stay visible, per the locked work-approval gates). |
| ReadyForConfirmation -> Fulfilled | on-chain | `confirmFulfillment(commitmentId)` by a named confirmer (or the counterparty under the default rule); each confirmation emits `ConfirmationRecorded`; reaching threshold N emits `CommitmentFulfilled`. Self-confirmation blocked. Fallback: `confirmFulfillmentAsFallback(commitmentId, reason)` operator/owner with mandatory reason. Register converts units (`UnitsFulfilled`). |
| Fulfilled -> Reconciled | derived | `CycleClosed` for the commitment's cycleId; cycle-less commitments (cycleId == 0) derive Reconciled from `PoolClosed`. |
| -> Cancelled | on-chain | `cancelCommitment(commitmentId, reasonCID)` from Offered/Requested (creator or steward) and Accepted (steward only; derived Active/PartiallyApproved are on-chain Accepted). Event `CommitmentCancelled`. Register releases units (`UnitsReleased`). Not allowed from ReadyForConfirmation except via dispute resolution. |
| -> Expired | on-chain | `expireCommitment(commitmentId)`, permissionless, allowed once block time > dueDate (or the cycle endTime when dueDate == 0), from Offered/Requested/Accepted/ReadyForConfirmation. Event `CommitmentExpired`. Register releases units. |
| -> Disputed | on-chain | `raiseDispute(commitmentId, reasonCID)` from Accepted/ReadyForConfirmation/Expired (the locked EvidenceSubmitted/PartiallyApproved entries map to on-chain Accepted). Raiser: creator, counterparty, named confirmer, or steward. Event `CommitmentDisputed`. |
| Disputed -> ReadyForConfirmation / Fulfilled / Cancelled / Expired / Reconciled | on-chain | `resolveDispute(commitmentId, resolution, reasonCID)` steward-only. Event `DisputeResolved`. Resolution to Reconciled allowed only when the commitment's cycle is already Reconciled on-chain. |
| Cancelled/Expired -> Reconciled at cycle close | derived | `CycleClosed` event; no on-chain per-commitment write (no unbounded loops at close). |

Fulfillment posture (locked): counterparty-first, self-confirmation blocked, operator/owner fallback with reason.

## 6. Contract Work

### 6.1 `CommitmentPoolingModule`

#### Objective

One UUPS module that owns the whole commitment-pooling control plane: durable poolId per garden, cycle lifecycle, module-native commitment records, confirmations, disputes, EAS work-approval bridging, evidence and reward events.

#### Responsibilities

- Register exactly one pool per garden account (idempotent), including the protocol pool anchored to the root garden.
- Drive the three state machines exactly as tabled in section 5, emitting one event per hard transition.
- Hold commitment records: requirement fields, confirmer rule (address[] + threshold N), assessment UID ref, declared reward, claim mode, due date, unit label + target quantity, required approved-work count, reserved counterparty-pool fields.
- Enforce Hats-based permissions per function (gating table below) via the garden-scoped operator check copied from `packages/contracts/src/modules/Hypercerts.sol:282-287`.
- Verify EAS attestations (work, approval, assessment) via `_eas.getAttestation` when linking or syncing, with schema UID checks (zero-bypass convention matching `packages/contracts/src/resolvers/Work.sol:59-66`).
- Call the `CommitmentRegister` for every unit-count change (commit, release, fulfill).

#### Scaffold conventions (copied, not invented)

- `UUPSUpgradeable + OwnableUpgradeable + ReentrancyGuardUpgradeable`, `_disableInitializers()` constructor, initializer with owner transfer: template `packages/contracts/src/modules/CookieJar.sol:17-115`.
- `onlyGardenToken`-style authorized-caller modifier for the mint callback: `packages/contracts/src/modules/CookieJar.sol:65-68`.
- Steward gate `_requirePoolSteward(poolId)` resolves `pools[poolId].garden` and applies `hatsModule.isOperatorOf || isOwnerOf`, falling back to module owner: copy of `_requireOperator` in `packages/contracts/src/modules/Hypercerts.sol:282-287`. For the protocol pool this resolves to root-garden Hats, so the protocol team stewards it by wearing root-garden Operator hats (decision #7).
- Graceful mint integration: GardenToken wraps `onGardenMinted` in try/catch (`packages/contracts/src/tokens/Garden.sol:421-430` pattern); the module itself is idempotent like `packages/contracts/src/modules/CookieJar.sol:138-141`.

#### Storage layout (slot accounting)

Named storage entries, in declaration order. Comment style follows `packages/contracts/src/modules/CookieJar.sol:55-59` ("declares N storage entries above and reserves M more here (50 total); inherited contracts maintain their own storage layouts independently").

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `gardenToken` | `address` |
| 3 | `commitmentRegister` | `ICommitmentRegister` |
| 4 | `workApprovalResolver` | `address` (authorized hook caller) |
| 5 | `eas` | `IEAS` |
| 6 | `workSchemaUID` | `bytes32` |
| 7 | `workApprovalSchemaUID` | `bytes32` |
| 8 | `legacyAssessmentSchemaUID` | `bytes32` (v2, `packages/contracts/deployments/42161-latest.json:48`) |
| 9 | `assessmentV3SchemaUID` | `bytes32` |
| 10 | `paused` | `bool` (module-wide guard, `packages/contracts/src/modules/Hypercerts.sol:69` precedent) |
| 11 | `nextPoolId` | `uint256` (starts at 1; 0 is the null sentinel) |
| 12 | `nextCycleId` | `uint256` |
| 13 | `nextCommitmentId` | `uint256` |
| 14 | `gardenPool` | `mapping(address garden => uint256 poolId)` |
| 15 | `pools` | `mapping(uint256 poolId => Pool)` |
| 16 | `cycles` | `mapping(uint256 cycleId => Cycle)` |
| 17 | `commitments` | `mapping(uint256 commitmentId => Commitment)` |
| 18 | `commitmentConfirmers` | `mapping(uint256 commitmentId => address[])` |
| 19 | `hasConfirmed` | `mapping(uint256 commitmentId => mapping(address => bool))` |
| 20 | `workCommitment` | `mapping(bytes32 workUID => uint256 commitmentId)` |
| 21 | `approvalCounted` | `mapping(bytes32 approvalUID => bool)` |

Gap: `uint256[29] private __gap;` (21 named + 29 reserved = 50 total).

#### Interface (canonical)

Interface style mirrors `packages/contracts/src/interfaces/ICookieJarModule.sol` and `packages/contracts/src/interfaces/IHatsModule.sol` (sectioned events/errors/functions, PascalCase enum members like `IHatsModule.GardenRole`). GraphQL mirrors use SCREAMING_SNAKE.

```solidity
// NET-NEW: packages/contracts/src/interfaces/ICommitmentPoolingModule.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICommitmentPoolingModule {
    // ═════════════════════════════ Types ═════════════════════════════

    enum PoolType { Garden, Protocol }

    enum PoolState { None, NotReady, Ready, Open, Paused, Closed, Composted }

    enum CycleType { Season, Campaign }

    /// @notice On-chain subset. Draft is an app-side IndexedDB state;
    ///         InProgress and Reviewing are derived (spec section 5.2).
    enum CycleState { None, Seeded, Open, Reconciled, Composted, Cancelled }

    enum CommitmentDirection { Offer, Request }

    enum CommitmentType { DomainImpact, SupportService, SeasonCampaign, OperatorCaptured }

    /// @notice On-chain subset. Draft is app-side; Active, EvidenceSubmitted,
    ///         PartiallyApproved, Reconciled are derived (spec section 5.3).
    enum CommitmentState { None, Offered, Requested, Accepted, ReadyForConfirmation, Fulfilled, Cancelled, Expired, Disputed }

    /// @notice Claimant class. Garden = a GardenAccount claims (protocol pool
    ///         cross-garden reach); Individual = a hat-wearing person claims.
    enum ClaimType { Garden, Individual }

    enum ClaimMode { Open, ApprovalGated }

    enum DisputeResolution { ReadyForConfirmation, Fulfilled, Cancelled, Expired, Reconciled }

    /// @notice Allocation-class snapshot for Hypercert cut-over. Must sum to
    ///         exactly 10_000 bps (Yield.sol InvalidSplitRatio precedent).
    struct AllocationBps {
        uint16 gardeners;
        uint16 treasury;
        uint16 operator;
        uint16 evaluator;
        uint16 community;
        uint16 funder;
    }

    struct Pool {
        address garden;            // ERC-6551 garden account
        PoolType poolType;
        PoolState state;
        bool proofEnabled;         // capability flag; true for MVP pools
        bool settlementEnabled;    // RESERVED: always false in MVP
        string charterCID;         // policy/charter metadata (IPFS)
        uint256 activeCycleId;     // 0 = none
        address settlementAdapter; // RESERVED: always zero in MVP (transferable-voucher layer)
    }

    struct Cycle {
        uint256 poolId;
        CycleType cycleType;
        CycleState state;
        uint64 startTime;
        uint64 endTime;
        string metadataCID;
        AllocationBps allocation;  // snapshot emitted in CycleOpened
    }

    /// @notice Declared reward is a reference, never custody (decision #18).
    struct DeclaredReward {
        address source; // cookie jar or treasury address; informational
        address token;
        uint256 amount; // 0 = no declared reward
    }

    struct Commitment {
        uint256 poolId;
        uint256 cycleId;                 // 0 = not cycle-scoped
        address creator;                 // social source (OperatorCaptured: the member, not the recorder)
        address counterparty;            // provider (Request) or engager (Offer); zero until Accepted
        ClaimType counterpartyKind;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        CommitmentState state;
        ClaimType claimType;             // eligibility class set at seeding
        ClaimMode claimMode;
        uint8 domain;                    // 0-3 for DomainImpact (Schemas.sol domain enum); ignored otherwise
        uint256 requiredActionUID;       // 0 = any action
        uint64 dueDate;                  // 0 = cycle endTime governs
        string unitLabel;                // hours, tasks, meals, rides, plants...
        uint256 targetUnits;
        uint32 requiredApprovedWorkCount;
        uint32 approvedWorkCount;
        uint32 confirmationThreshold;    // N of the named group; 1 under the counterparty default
        uint32 confirmationCount;
        bool requiresAssessment;
        bytes32 assessmentUID;           // attached v2/v3 assessment; zero until attached
        bytes32 needUID;                 // community Need this commitment addresses; 0 = none (amendment 2026-07-04)
        string metadataCID;              // terms/description payload (IPFS)
        DeclaredReward reward;
        bool rewardPaid;
        // RESERVED post-MVP garden-to-garden (L3); never written in MVP:
        uint256 counterpartyPoolId;
        address counterpartyGardenAccount;
    }

    struct CreateCommitmentParams {
        uint256 poolId;
        uint256 cycleId;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        ClaimType claimType;
        ClaimMode claimMode;
        address onBehalfOf;              // OperatorCaptured only: the member who made the promise
        uint8 domain;
        uint256 requiredActionUID;
        string unitLabel;
        uint256 targetUnits;
        uint32 requiredApprovedWorkCount;
        bool requiresAssessment;
        uint64 dueDate;
        string metadataCID;
        bytes32 needUID;                 // 0 = none; stored as-is, module never reads EAS (amendment 2026-07-04)
        address[] confirmers;            // empty = counterparty rule
        uint32 confirmationThreshold;    // ignored (forced 1) when confirmers is empty
        DeclaredReward reward;
    }

    // ═════════════════════════════ Events ════════════════════════════
    // One event per hard transition (spec section 5), plus unit-count and
    // linkage events. All indexed on poolId/commitmentId for Envio.

    event PoolRegistered(uint256 indexed poolId, address indexed garden, PoolType poolType);
    event PoolCharterUpdated(uint256 indexed poolId, string charterCID);
    event PoolReady(uint256 indexed poolId);
    event PoolOpened(uint256 indexed poolId);
    event PoolPaused(uint256 indexed poolId);
    event PoolResumed(uint256 indexed poolId);
    event PoolClosed(uint256 indexed poolId);
    event PoolComposted(uint256 indexed poolId);
    event PoolReopened(uint256 indexed poolId, bool toOpen);

    event CycleSeeded(
        uint256 indexed cycleId,
        uint256 indexed poolId,
        CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string metadataCID
    );
    /// @notice Allocation-class bps ride in the open event (decision #12).
    event CycleOpened(
        uint256 indexed cycleId,
        uint256 indexed poolId,
        uint16 gardenersBps,
        uint16 treasuryBps,
        uint16 operatorBps,
        uint16 evaluatorBps,
        uint16 communityBps,
        uint16 funderBps
    );
    event CycleClosed(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleComposted(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID);

    event CommitmentCreated(
        uint256 indexed commitmentId,
        uint256 indexed poolId,
        uint256 indexed cycleId,
        address creator,
        address recordedBy,          // msg.sender; differs from creator for OperatorCaptured
        CommitmentDirection direction,
        CommitmentType commitmentType,
        ClaimType claimType,
        ClaimMode claimMode,
        string unitLabel,
        uint256 targetUnits,
        uint32 requiredApprovedWorkCount,
        uint64 dueDate,
        bytes32 needUID              // 0 = none; non-indexed (3-indexed budget spent); Envio reads params regardless (amendment 2026-07-04)
    );
    event RewardDeclared(uint256 indexed commitmentId, address source, address token, uint256 amount);
    event ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold);
    event ClaimRequested(uint256 indexed commitmentId, address indexed claimant, ClaimType kind, address gardenContext);
    event CommitmentAccepted(uint256 indexed commitmentId, address indexed counterparty, ClaimType kind);
    event WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address linker);
    event WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker);
    /// @notice Unit-count change event; approvedUnits is the module-computed
    ///         integer floor(targetUnits * approvedWorkCount / requiredApprovedWorkCount).
    event ApprovedWorkCounted(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        bytes32 approvalUID,
        uint32 approvedWorkCount,
        uint256 approvedUnits
    );
    /// @notice Lightweight evidence (decision #20); offline-queueable write.
    event EvidenceAttached(uint256 indexed commitmentId, string cid, address indexed attacher);
    event AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher);
    event CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason);
    event ConfirmationRecorded(
        uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold
    );
    event CommitmentFulfilled(uint256 indexed commitmentId, bool fallbackConfirmation, string reason);
    event CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID);
    event CommitmentExpired(uint256 indexed commitmentId, address indexed caller);
    event CommitmentDisputed(uint256 indexed commitmentId, address indexed raiser, string reasonCID);
    event DisputeResolved(uint256 indexed commitmentId, DisputeResolution resolution, string reasonCID);
    /// @notice Payout executed on existing rails and recorded here (decision #18).
    event RewardPaid(
        uint256 indexed commitmentId, address indexed payer, address token, uint256 amount, bytes32 payoutRef
    );

    // ═════════════════════════════ Errors ════════════════════════════

    error UnauthorizedCaller(address caller);
    error NotPoolSteward(address caller, uint256 poolId);
    error ModulePaused();
    error ZeroAddress();
    error PoolExists(address garden);
    error UnknownPool(uint256 poolId);
    error PoolNotInState(uint256 poolId, PoolState actual);
    error CharterRequired(uint256 poolId);
    error UnknownCycle(uint256 cycleId);
    error CycleNotInState(uint256 cycleId, CycleState actual);
    error InvalidAllocation(); // bps sum != 10_000 (Yield.sol InvalidSplitRatio precedent)
    error InvalidTimeWindow(uint64 startTime, uint64 endTime);
    error UnknownCommitment(uint256 commitmentId);
    error CommitmentNotInState(uint256 commitmentId, CommitmentState actual);
    error NotEligibleClaimant(address claimant);
    error ClaimModeMismatch(uint256 commitmentId);
    error SelfCounterparty(); // creator cannot claim their own commitment
    error SelfConfirmation(); // provider cannot confirm own fulfillment (WorkApproval SelfAttestation precedent)
    error NotConfirmer(address caller);
    error AlreadyConfirmed(address confirmer);
    error InvalidConfirmerRule();
    error InvalidWorkAttestation(bytes32 workUID);
    error InvalidApprovalAttestation(bytes32 approvalUID);
    error InvalidAssessmentAttestation(bytes32 assessmentUID);
    error WorkAlreadyLinked(bytes32 workUID);
    error ApprovalAlreadyCounted(bytes32 approvalUID);
    error WorkNotLinkedToCommitment(bytes32 workUID, uint256 commitmentId);
    error EvidenceRequired(uint256 commitmentId);
    error AssessmentRequired(uint256 commitmentId);
    error NotDue(uint256 commitmentId);
    error RewardAlreadyRecorded(uint256 commitmentId);
    error InvalidDomain(uint8 domain);

    // ══════════════════════ Pool lifecycle ═══════════════════════════

    /// @notice GardenToken mint callback. Idempotent; registers a Garden-type
    ///         pool in NotReady. Gating: gardenToken only (CookieJar onlyGardenToken pattern).
    function onGardenMinted(address garden) external returns (uint256 poolId);

    /// @notice Backfill for pre-upgrade gardens and the protocol pool.
    ///         Gating: PoolType.Protocol requires module owner; PoolType.Garden
    ///         requires garden operator/owner or module owner.
    function registerPool(address garden, PoolType poolType) external returns (uint256 poolId);

    /// @notice Gating for all six below: pool steward (garden operator/owner
    ///         via hatsModule, module owner fallback). Protocol pool resolves
    ///         to root-garden hats.
    function setPoolCharter(uint256 poolId, string calldata charterCID) external;
    function markPoolReady(uint256 poolId) external;
    function openPool(uint256 poolId) external;
    function pausePool(uint256 poolId) external;
    function resumePool(uint256 poolId) external;
    function closePool(uint256 poolId) external;
    function compostPool(uint256 poolId) external;
    function reopenPool(uint256 poolId, bool toOpen) external;

    // ══════════════════════ Cycle lifecycle ══════════════════════════

    /// @notice Gating: pool steward. Pool must be Ready or Open to seed;
    ///         Open to open a cycle. Allocation bps must sum to 10_000.
    function seedCycle(
        uint256 poolId,
        CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataCID,
        AllocationBps calldata allocation
    ) external returns (uint256 cycleId);
    function openCycle(uint256 cycleId) external;
    function closeCycle(uint256 cycleId) external;
    function compostCycle(uint256 cycleId) external;
    function cancelCycle(uint256 cycleId, string calldata reasonCID) external;

    // ══════════════════════ Commitments ══════════════════════════════

    /// @notice Gating by commitment type (creation authority, locked):
    ///         members create own offers/requests (any of the six garden role
    ///         hats in the pool garden, IHatsModule.GardenRole);
    ///         SeasonCampaign and OperatorCaptured require pool steward;
    ///         protocol-pool commitments require root-garden steward or module owner.
    ///         OperatorCaptured must set onBehalfOf (the member stays the
    ///         social source; msg.sender is recorded as recordedBy in the event).
    function createCommitment(CreateCommitmentParams calldata params) external returns (uint256 commitmentId);

    /// @notice Gating: pool steward, pre-acceptance only.
    function setDeclaredReward(uint256 commitmentId, DeclaredReward calldata reward) external;
    function setConfirmerRule(uint256 commitmentId, address[] calldata confirmers, uint32 threshold) external;

    /// @notice Claim eligibility (decision #7, #8):
    ///         Garden pools: caller must hold any role hat in the pool garden
    ///         (gardenContext must equal the pool garden).
    ///         Protocol pool, ClaimType.Garden: gardenContext must be a
    ///         registered garden (gardenPool != 0) and caller its operator/owner;
    ///         counterparty recorded = gardenContext.
    ///         Protocol pool, ClaimType.Individual: caller must hold any role
    ///         hat in gardenContext; counterparty = msg.sender.
    ///         ClaimMode.Open transitions to Accepted; ApprovalGated only emits
    ///         ClaimRequested. Creator cannot claim own commitment.
    function claimCommitment(uint256 commitmentId, ClaimType kind, address gardenContext) external;

    /// @notice Gating: pool steward. ApprovalGated acceptance path; validates
    ///         the same eligibility rules for the named claimant.
    function acceptClaim(uint256 commitmentId, address claimant, ClaimType kind, address gardenContext) external;

    // ─────────────── Work linkage + EAS bridge (decision #5) ─────────

    /// @notice Link a Work attestation to a commitment before or after its
    ///         approval. Verifies via eas.getAttestation: schema == workSchemaUID,
    ///         recipient == pool garden. One work maps to at most one commitment;
    ///         one commitment maps to many works.
    ///         Gating: commitment counterparty, creator, or pool steward.
    function linkWork(uint256 commitmentId, bytes32 workUID) external;

    /// @notice Gating: pool steward; only while the approval is not yet counted.
    function unlinkWork(bytes32 workUID) external;

    /// @notice Called by WorkApprovalResolver inside try/catch after full
    ///         approval validation (WorkApproval.sol:179-183 GAP precedent).
    ///         No-op (returns without revert) when the workUID is unlinked or
    ///         the approvalUID was already counted. Never reverts on state it
    ///         does not recognize: the approval must stand regardless.
    ///         Gating: workApprovalResolver only.
    function onWorkApproved(bytes32 workUID, bytes32 approvalUID, address garden) external;

    /// @notice Operator-callable catch-up when the resolver hook was missed
    ///         (module wired after approvals, or work linked after approval).
    ///         Verifies each approvalUID via eas.getAttestation: schema ==
    ///         workApprovalSchemaUID, decoded approved == true, decoded workUID
    ///         linked to this commitmentId, recipient == pool garden; dedupes
    ///         via approvalCounted. Gating: pool steward.
    function syncApprovedWork(uint256 commitmentId, bytes32[] calldata approvalUIDs) external;

    // ─────────────── Evidence, assessment, confirmation ──────────────

    /// @notice Gating: creator, counterparty, or pool steward. Offline-queueable.
    function attachEvidence(uint256 commitmentId, string calldata cid) external;

    /// @notice Verifies via eas.getAttestation: schema is legacyAssessmentSchemaUID
    ///         or assessmentV3SchemaUID, recipient == pool garden.
    ///         Gating: pool steward or garden evaluator.
    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external;

    /// @notice Path (b) to ReadyForConfirmation: commitments with
    ///         requiredApprovedWorkCount == 0 (SupportService/OperatorCaptured);
    ///         requires >= 1 attached evidence. Gating: counterparty, creator,
    ///         or pool steward.
    function submitForConfirmation(uint256 commitmentId) external;

    /// @notice Path (c): steward override with visible reason.
    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external;

    /// @notice Gating: a named confirmer, or the counterparty under the default
    ///         rule. The unit provider can never confirm their own fulfillment.
    function confirmFulfillment(uint256 commitmentId) external;

    /// @notice Gating: pool steward; reason mandatory (fallback stays visible).
    function confirmFulfillmentAsFallback(uint256 commitmentId, string calldata reason) external;

    // ─────────────── Exits, disputes, rewards ────────────────────────

    /// @notice Gating: creator from Offered/Requested; pool steward from Accepted.
    function cancelCommitment(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Permissionless once past due (dueDate, or cycle endTime when 0).
    function expireCommitment(uint256 commitmentId) external;

    /// @notice Gating: creator, counterparty, named confirmer, or pool steward.
    function raiseDispute(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Gating: pool steward. Reconciled resolution only when the
    ///         commitment's cycle is already Reconciled.
    function resolveDispute(uint256 commitmentId, DisputeResolution resolution, string calldata reasonCID) external;

    /// @notice Records an already-executed payout (no custody). Requires state
    ///         Fulfilled; single record per commitment in MVP.
    ///         Gating: pool steward.
    function recordRewardPaid(uint256 commitmentId, address token, uint256 amount, bytes32 payoutRef) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getPool(uint256 poolId) external view returns (Pool memory);
    function getPoolByGarden(address garden) external view returns (uint256 poolId, Pool memory pool);
    function getCycle(uint256 cycleId) external view returns (Cycle memory);
    function getCommitment(uint256 commitmentId) external view returns (Commitment memory);
    function getConfirmers(uint256 commitmentId) external view returns (address[] memory);
    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId);
    function isApprovalCounted(bytes32 approvalUID) external view returns (bool);

    // ══════════════════════ Admin (module owner) ═════════════════════

    function setGardenToken(address gardenToken) external;
    function setHatsModule(address hatsModule) external;
    function setCommitmentRegister(address register) external;
    function setWorkApprovalResolver(address resolver) external;
    function setEAS(address eas) external;
    function setSchemaUIDs(
        bytes32 workUID,
        bytes32 workApprovalUID,
        bytes32 legacyAssessmentUID,
        bytes32 assessmentV3UID
    ) external;
    function setPaused(bool paused) external;
}
```

#### Permission matrix (the gating table)

Consolidated view of every mutating entry point across both contracts plus the two new resolvers; the per-function doc comments in the interface above remain the enforcement detail. Role legend: **steward** = pool steward via `_requirePoolSteward` (garden operator/owner through hatsModule, module owner fallback; the protocol pool resolves to root-garden hats). **member** = wearer of any of the six garden role hats (`IHatsModule.GardenRole`) in the relevant garden. Pause interplay: module-wide `setPaused` blocks every mutating module function except `resolveDispute` and `cancelCommitment` (stewards can always wind down); pool-level `Paused` additionally blocks new commitments, claims, and confirmations on that pool only.

| Group | Function | Authorized caller | State / other gates |
|---|---|---|---|
| Pool | `onGardenMinted` | GardenToken only | idempotent; creates a Garden-type pool in NotReady |
| Pool | `registerPool` | Protocol type: module owner · Garden type: garden operator/owner or module owner | one pool per garden (`PoolExists`) |
| Pool | `setPoolCharter` | steward | — |
| Pool | `markPoolReady` | steward | NotReady only; charter CID non-empty |
| Pool | `openPool` / `pausePool` / `resumePool` / `closePool` / `compostPool` / `reopenPool` | steward | transitions exactly per the §5.1 table |
| Cycle | `seedCycle` | steward | pool Ready or Open; bps sum == 10_000; valid time window |
| Cycle | `openCycle` | steward | pool Open; cycle Seeded |
| Cycle | `closeCycle` / `compostCycle` | steward | Open → Reconciled → Composted |
| Cycle | `cancelCycle` | steward | from Seeded or Open; reason CID |
| Commitment | `createCommitment` | own Offer/Request: member of the pool garden · SeasonCampaign + OperatorCaptured: steward · protocol-pool commitments: root-garden steward or module owner | pool Open; OperatorCaptured must set `onBehalfOf` |
| Commitment | `setDeclaredReward` / `setConfirmerRule` | steward | pre-acceptance only |
| Commitment | `claimCommitment` | garden pool: member of the pool garden · protocol pool ClaimType.Garden: operator/owner of the claiming garden (`gardenContext`) · protocol pool ClaimType.Individual: member of `gardenContext` | state Offered/Requested; claimant != creator (`SelfCounterparty`); Open mode transitions to Accepted, ApprovalGated only emits `ClaimRequested` |
| Commitment | `acceptClaim` | steward | ApprovalGated path; re-validates the named claimant's eligibility |
| Linkage | `linkWork` | counterparty, creator, or steward | verifies the work attestation via EAS (schema + recipient); one work maps to at most one commitment |
| Linkage | `unlinkWork` | steward | only while the approval is not yet counted |
| Linkage | `onWorkApproved` | WorkApprovalResolver only | never reverts; no-op when unlinked or already counted |
| Linkage | `syncApprovedWork` | steward | verifies each approval on EAS; dedupes via `approvalCounted` |
| Evidence | `attachEvidence` | creator, counterparty, or steward | offline-queueable |
| Evidence | `attachAssessment` | steward or garden evaluator | verifies assessment attestation (v2 or v3 UID; recipient == pool garden) |
| Confirmation | `submitForConfirmation` | counterparty, creator, or steward | requiredApprovedWorkCount == 0; at least 1 evidence attached |
| Confirmation | `markReadyForConfirmation` | steward | override path; reason emitted and visible |
| Confirmation | `confirmFulfillment` | named confirmer, or the counterparty under the default rule | state ReadyForConfirmation; the unit provider is blocked (`SelfConfirmation`); once per confirmer (`AlreadyConfirmed`) |
| Confirmation | `confirmFulfillmentAsFallback` | steward | mandatory reason |
| Exit | `cancelCommitment` | creator (from Offered/Requested) · steward (from Accepted) | reason CID; never from ReadyForConfirmation except via dispute resolution; allowed while module paused |
| Exit | `expireCommitment` | anyone (permissionless) | past dueDate, or cycle endTime when dueDate == 0 |
| Dispute | `raiseDispute` | creator, counterparty, named confirmer, or steward | from Accepted / ReadyForConfirmation / Expired |
| Dispute | `resolveDispute` | steward | Reconciled resolution only when the cycle is already Reconciled; allowed while module paused |
| Reward | `recordRewardPaid` | steward | state Fulfilled; single record per commitment in MVP |
| Module admin | `setGardenToken` / `setHatsModule` / `setCommitmentRegister` / `setWorkApprovalResolver` / `setEAS` / `setSchemaUIDs` / `setPaused` | module owner | — |
| Register | `registerClass` / `setQuota` / `setProviderExposureCap` / `commitUnits` / `releaseUnits` / `fulfillUnits` | CommitmentPoolingModule only (`NotModule`) | quota + provider exposure-cap guards (§6.2) |
| Register admin | `setModule` | register owner (protocol multisig) | — |
| Upgrades | `_authorizeUpgrade` on module, register, and both new resolvers | respective owner (protocol multisig) | UUPS convention repo-wide |

EAS authorship, enforced by the resolvers (§6.4.3), for completeness of the access-control picture:

| Attestation | Authorized attester |
|---|---|
| Assessment v3 — Baseline | garden evaluator OR operator (analog capture preserved, v2 parity) |
| Assessment v3 — Delta / Technical | garden evaluator only |
| Community testimony | Community Hat only (first real attestation gate for that hat) |
| Work / WorkApproval (existing) | unchanged: gardener-or-operator / operator with no self-attestation |

#### Behavior notes an implementer must not miss

- **Confirmer rule storage**: `confirmers` array persisted in `commitmentConfirmers`; empty array means the counterparty confirms (threshold forced to 1 and the group resolves to `[counterparty]` at acceptance time). The named group is data, not a hat (documented divergence from the Hats-everything pattern; the group is operator-set at seeding, locked).
- **Self-checks**: `claimCommitment` reverts `SelfCounterparty` when claimant == creator. `confirmFulfillment` reverts `SelfConfirmation` when msg.sender is the unit provider (counterparty for Requests, creator for Offers), mirroring `packages/contracts/src/resolvers/WorkApproval.sol:153-156`.
- **Register coupling**: `createCommitment` calls `register.registerClass(commitmentId, poolId, unitLabel, targetUnits)`; acceptance calls `commitUnits`; cancel/expire call `releaseUnits`; fulfillment calls `fulfillUnits`. Exact functions in 6.2.
- **approvedUnits math**: computed on-chain as `targetUnits * approvedWorkCount / requiredApprovedWorkCount` (integer floor) and emitted in `ApprovedWorkCounted` so the indexer never re-derives fractional units.
- **ReadyForConfirmation auto-flip** happens inside `onWorkApproved` and `syncApprovedWork` only when `requiresAssessment == false || assessmentUID != 0`. If assessment is still pending, the flip waits for `attachAssessment`, which also checks and flips (emitting path (a)'s event).
- **Pause semantics**: module-wide `paused` blocks all mutating functions except dispute resolution and cancel (stewards must always be able to wind down). Pool-level Paused blocks new commitments, claims, and confirmations on that pool only.
- **onWorkApproved must never revert** for unrecognized state: the EAS approval succeeds regardless (approval flow is `critical` path per repo criticality matrix).

#### Acceptance criteria

- Every transition in the section 5 tables has exactly one emitting function or a documented derivation; no silent state changes.
- `bun run test` unit suite covers: pool registration idempotency, protocol-pool gating via root-garden hats, all three ReadyForConfirmation paths, confirmer threshold with named group and counterparty default, self-claim and self-confirmation reverts, expiry timing (dueDate and cycle-endTime fallback), dispute resolutions, reward record, work-linkage verification against a mocked EAS, sync dedupe.
- Storage layout test asserts 21 named entries + 29 gap (pattern: `packages/contracts/test/StorageLayout.t.sol`), and `script/check-storage-layout.sh` gains a `CommitmentPoolingModule:src/modules/CommitmentPooling.sol` entry (list at `packages/contracts/script/check-storage-layout.sh:23-33`).
- Fork test proves a full Offer -> Accepted -> WorkLinked -> approval-hook count -> ReadyForConfirmation -> confirm -> Fulfilled -> RewardPaid pass against the deployed EAS on an Arbitrum fork (`bun run test:fork`, wrappers only per `.claude/rules/contracts.md`).

### 6.2 `CommitmentRegister`

#### Objective

A non-transferable, ERC-1155-STYLE unit ledger internal to our own contract: commitment classes, committed/fulfilled balances per account, quotas, and exposure caps. It does NOT inherit ERC-1155 and exposes no transfer or approval surface of any kind; balances move only through module calls. This is the voucher-shaped substrate (decisions #15, #16) that transferable settlement vouchers later wrap 1:1 on the same poolId.

#### Grassroots Economics grounding (clean-room, decision #17)

Design vocabulary comes from Ruddick's "Commitment Pooling: an Economic Protocol Inspired by Ancestral Wisdom" (IJCCR) and the Grassroots Economics "Intro to Commitment Pools" docs, used as named design grammar only, never as code reference (the Sarafu Solidity source is AGPL and is not read):

- **Curation**: which commitments enter the pool's register. Implemented as steward-gated `createCommitment`/`acceptClaim` on the module plus module-only `registerClass` here; nothing enters the register except through curated module paths.
- **Limiting**: hard caps per asset in the pool. Implemented as the per-class `quota` (defaults to the commitment's targetUnits) and the per-pool `providerExposureCap` on open committed units per account. `openExposureUnits` is the safety gauge the aggregates surface.
- **Valuing**: relative value against a reference asset. Deliberately NOT implemented in MVP (no swaps, no relative pricing, units are per-commitment labels with no global conversion). Named here as the reserved third primitive that the transferable-voucher layer activates on the same classes.

The GE pool step sequence (seed round, exchange in/out, redemption, cross exchange) maps to MVP as: seed = class registration at curated creation; the exchange and redemption steps stay out of scope until the transferable-voucher layer wraps these balances as transferable vouchers via the pool's reserved `settlementAdapter`.

#### Transferable-voucher attachment path (spec-now, build-later)

- `classId == commitmentId` in MVP (1:1). The classId space is `uint256` and module-controlled, so later class kinds (per provider + unit label groupings) can join without migration.
- A future settlement adapter (address reserved on the Pool struct) reads `fulfilledOf`/`committedOf` and issues transferable vouchers per class on the same poolId. The register itself never gains transfer functions; wrapping happens in the adapter's own token contract.

#### Storage layout (slot accounting)

Comment style follows `packages/contracts/src/modules/CookieJar.sol:55-59`.

| # | Entry | Type |
|---|---|---|
| 1 | `module` | `address` (authorized mutator) |
| 2 | `classes` | `mapping(uint256 classId => CommitmentClass)` |
| 3 | `committedBalance` | `mapping(address account => mapping(uint256 classId => uint256))` |
| 4 | `fulfilledBalance` | `mapping(address account => mapping(uint256 classId => uint256))` |
| 5 | `providerExposureCap` | `mapping(uint256 poolId => uint256)` (0 = uncapped) |
| 6 | `providerOpenUnits` | `mapping(uint256 poolId => mapping(address account => uint256))` |

Gap: `uint256[44] private __gap;` (6 named + 44 reserved = 50 total).

Ownership note: the decision language "owned by the module" is implemented as an `onlyModule` mutation gate (same shape as `onlyGardenToken`, `packages/contracts/src/modules/CookieJar.sol:65-68`). The `OwnableUpgradeable` owner stays the protocol multisig for UUPS upgrade authority, like every other upgradeable contract in the repo (`_authorizeUpgrade onlyOwner`, `packages/contracts/src/modules/CookieJar.sol:302-304`). If the owner were the module, nobody could upgrade the register.

#### Interface (canonical)

```solidity
// NET-NEW: packages/contracts/src/interfaces/ICommitmentRegister.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICommitmentRegister
/// @notice Non-transferable ERC-1155-style unit accounting for commitment
///         pooling. No transfer, no approval, no custody: balances move only
///         through the CommitmentPoolingModule. Grounded in the Grassroots
///         Economics register grammar (curation, limiting, valuing); valuing
///         is reserved for the transferable-voucher settlement layer.
interface ICommitmentRegister {
    // ═════════════════════════════ Types ═════════════════════════════

    struct CommitmentClass {
        uint256 poolId;
        string unitLabel;
        uint256 quota;           // LIMITING: hard cap on committed units for this class
        uint256 totalCommitted;  // live open exposure for this class
        uint256 totalFulfilled;
        bool exists;
    }

    // ═════════════════════════════ Events ════════════════════════════

    event ModuleUpdated(address indexed oldModule, address indexed newModule);
    event ClassRegistered(uint256 indexed classId, uint256 indexed poolId, string unitLabel, uint256 quota);
    event QuotaUpdated(uint256 indexed classId, uint256 quota);
    event ProviderExposureCapUpdated(uint256 indexed poolId, uint256 cap);
    event UnitsCommitted(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted);
    event UnitsReleased(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted);
    event UnitsFulfilled(uint256 indexed classId, address indexed account, uint256 units, uint256 totalFulfilled);

    // ═════════════════════════════ Errors ════════════════════════════

    error NotModule(address caller);
    error ZeroAddress();
    error ClassAlreadyRegistered(uint256 classId);
    error UnknownClass(uint256 classId);
    error QuotaExceeded(uint256 classId, uint256 requested, uint256 available);
    error ExposureCapExceeded(uint256 poolId, address account, uint256 requested, uint256 available);
    error InsufficientCommitted(uint256 classId, address account, uint256 requested, uint256 available);

    // ══════════════════════ Mutations (onlyModule) ═══════════════════

    function registerClass(uint256 classId, uint256 poolId, string calldata unitLabel, uint256 quota) external;
    function setQuota(uint256 classId, uint256 quota) external;
    function setProviderExposureCap(uint256 poolId, uint256 cap) external;

    /// @notice Acceptance: records committed units against quota and the
    ///         provider's per-pool exposure cap.
    function commitUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Cancel/expire: releases committed units without fulfillment.
    function releaseUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Fulfillment: converts committed units into fulfilled balance
    ///         (all-or-nothing per commitment in MVP).
    function fulfillUnits(uint256 classId, address account, uint256 units) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getClass(uint256 classId) external view returns (CommitmentClass memory);
    function committedOf(address account, uint256 classId) external view returns (uint256);
    function fulfilledOf(address account, uint256 classId) external view returns (uint256);
    function openUnitsOf(uint256 poolId, address account) external view returns (uint256);

    // ══════════════════════ Admin (owner) ════════════════════════════

    function setModule(address module) external;

    // Deliberately absent: transferFrom, safeTransferFrom, setApprovalForAll,
    // balanceOfBatch, any ERC-1155 receiver hooks. Non-transferable by
    // construction; adding a transfer surface is a spec violation.
}
```

Scaffold: `UUPSUpgradeable + OwnableUpgradeable`, `_disableInitializers()`, initializer takes `(owner, module)` where module may be zero and set later during wiring (template `packages/contracts/src/modules/CookieJar.sol:74-115`).

#### Acceptance criteria

- No function in the compiled ABI moves balance between two non-module accounts; a dedicated test asserts the ABI contains no `transfer`/`approve` selector.
- Quota and exposure-cap reverts covered by unit tests; `openUnitsOf` matches the sum of live committed balances per pool.
- Register mutations revert `NotModule` for every caller except the wired module.
- Storage layout test (6 named + 44 gap) and `check-storage-layout.sh` entry `CommitmentRegister:src/registries/Commitment.sol` added.
- Transferable-voucher attachment documented: a reviewer can point at the classId, the reserved settlementAdapter field, and the fulfilled balances and see the 1:1 wrap path without register changes.

### 6.3 GardenToken wiring (live UUPS upgrade)

#### Changes to `packages/contracts/src/tokens/Garden.sol`

1. New module field after `communityToken` (module fields block, lines 27-34): `ICommitmentPoolingModule public commitmentPoolingModule;`
2. New setter + event in the setter block (lines 181-227 pattern):
   `setCommitmentPoolingModule(address)` onlyOwner, emitting `CommitmentPoolingModuleUpdated(oldModule, newModule)`.
3. Mint callback in `_initializeIntegrationsAndAccount` (lines 421-456), after the CookieJar block, same graceful shape as lines 423-430: `if (address(commitmentPoolingModule) != address(0)) { try commitmentPoolingModule.onGardenMinted(gardenAccount) returns (uint256) { } catch { } }`. Garden mint MUST NOT revert on module failure.
4. **Gap 37 to 36** with comment rewrite. Current comment (`packages/contracts/src/tokens/Garden.sol:56-62`) reserves 37 slots against 13 used; the new comment reads 14 used slots (adds `commitmentPoolingModule` to the enumerated list) and `uint256[36] private __gap;`.

#### Live-chain implication

GardenToken on 42161 is a live UUPS proxy at `0xe1Da335110b1ed48e7df63209f5D424d02276593` (`packages/contracts/deployments/42161-latest.json:14`) holding real garden state for 13 live gardens. The upgrade appends one variable in gap space (safe append) and shrinks the gap by exactly one, preserving total slot count. Required proof chain before broadcast:

- `script/check-storage-layout.sh` passes against the regenerated baseline (`--update` run committed in the same PR; GardenToken entry already exists at `packages/contracts/script/check-storage-layout.sh:24`).
- `packages/contracts/test/StorageLayout.t.sol` gains assertions for the new field position and updated gap. Known drift, do not silently fix beyond this contract: the existing GardenToken comments there still describe an old 7-named/43-gap layout (`packages/contracts/test/StorageLayout.t.sol:31-35,59-69`) while the source has 13 used + 37 gap; the upgrade PR corrects the GardenToken numbers it touches and logs the tautology-shaped gap tests as debt (section 12).
- Upgrade preserves state test extended (`testGardenTokenUpgradePreservesState`, `packages/contracts/test/StorageLayout.t.sol:270-289`) to set and survive `commitmentPoolingModule`.
- Broadcast via the named root `contracts:*` scripts only (keystore + sender encoding per root CLAUDE.md; never raw forge, `.claude/rules/contracts.md`).

Post-upgrade ops sequence (one-shot, lives in `.plans/`, not `scripts/`): `gardenToken.setCommitmentPoolingModule(module)`, then `registerPool(rootGarden, Protocol)` by the module owner, then `registerPool(garden, Garden)` backfill for the 13 live gardens (steward or module owner per call).

### 6.4 EAS schema work: exactly two registrations (decision #14)

No commitment schema exists or will exist. The two registrations are assessment v3 and community testimony. Both non-revocable, matching every existing Green Goods schema (`packages/contracts/config/schemas.json` `"revocable": false`; resolvers return false from `onRevoke`, e.g. `packages/contracts/src/resolvers/Assessment.sol:173-176`). Note the GreenWill badge schema is revocable (`packages/contracts/script/DeployBadgeSchema.s.sol:23`); ours deliberately are not.

#### 6.4.1 Assessment v3 schema

Deployed v2 stays untouched and readable: UID `0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93`, string `string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location` (`packages/contracts/deployments/42161-latest.json:47-48`). Schemas are immutable (`corrections-log.md` H2), so v3 is a fresh UID following the same thin-schema + config-CID pattern, appending only what resolvers and indexed consumers need (`corrections-log.md` §3).

Proposed canonical v3 string (v2's seven fields first, three appended):

```text
string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,bytes32 baselineUID
```

- `assessmentKind`: 0 = Baseline, 1 = Delta (re-assessment), 2 = Technical.
- `cycleId`: module cycle reference; 0 = not cycle-scoped. The resolver does not cross-check it against the module (deliberate decoupling; validity is an app/indexer concern; the module-to-resolver coupling stays one-way, section 6.5).
- `baselineUID`: required non-zero for Delta; the resolver verifies it resolves to an existing v2-or-v3 assessment attestation with the same recipient garden via `_eas.getAttestation`. Zero for Baseline/Technical.

Struct appended to `packages/contracts/src/Schemas.sol` as `AssessmentV3Schema` (tuple-decode comment convention as in `packages/contracts/src/resolvers/Work.sol:90-95`).

#### 6.4.2 Community testimony schema

Proposed canonical string:

```text
uint256 commitmentId,string title,string testimonyCID
```

- `commitmentId`: module commitment reference; 0 = garden-level story not tied to one commitment.
- `testimonyCID`: IPFS payload with the narrative, media, and attribution. Kept off-chain to stay thin.
- Recipient = garden account, matching every existing schema's recipient convention (`corrections-log.md` §2).
- No numeric score field, on purpose. Testimony gates nothing by itself: when a commitment is explicitly aimed at the community, its confirmation power flows through the module's named-confirmer group (Community-Hat wearers placed in `confirmers` at seeding), never through this schema. Everywhere else testimony is narrative only. "Never averaged" is enforced off-chain (indexer and app never aggregate testimony into scores); flagged in section 12.

Struct appended to `packages/contracts/src/Schemas.sol` as `CommunityTestimonySchema`.

#### 6.4.3 Resolvers

Both NET-NEW, following the four resolver conventions verbatim from `packages/contracts/src/resolvers/{Work,WorkApproval,Assessment}.sol`: validation-order doc comment (`Work.sol:78-84`), flat-tuple decode with explanatory comment (`Work.sol:90-95`), `setSchemaUID` zero-bypass for the deployment window (`Work.sol:59-66`), `onRevoke` returns false, 48-slot-style gap with used-slot comment (`WorkApproval.sol:47-53`), UUPS + Ownable + `_disableInitializers`.

**`AssessmentV3Resolver`** (NET-NEW `packages/contracts/src/resolvers/AssessmentV3.sol`), validation order:

1. Schema UID check (zero-bypass).
2. Decode v3 tuple.
3. IDENTITY by kind (decision #7): Baseline requires `accessControl.isEvaluator || accessControl.isOperator` (exact parity with today's `packages/contracts/src/resolvers/Assessment.sol:114-121`, preserving operator analog capture); Delta and Technical require `accessControl.isEvaluator` only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:25`).
4. REQUIRED FIELDS: title, assessmentConfigCID non-empty; domain <= 3 (`Assessment.sol:124-136` parity).
5. KIND VALIDATION: assessmentKind <= 2; Delta requires baselineUID != 0 and `_eas.getAttestation(baselineUID)` returning an attestation whose schema is the v2 or v3 UID and whose recipient equals `attestation.recipient`; Baseline/Technical require baselineUID == 0.
6. GAP INTEGRATION: same optional KarmaGAP milestone try/catch as v2 (`Assessment.sol:138-141,150-167`), reusing `createMilestone`.

Storage: `karmaGAPModule`, `schemaUID`, `legacySchemaUID` (v2 UID for baseline cross-checks) = 3 used slots, `uint256[47] __gap` (50 total).

**`CommunityTestimonyResolver`** (NET-NEW `packages/contracts/src/resolvers/CommunityTestimony.sol`), validation order:

1. Schema UID check (zero-bypass).
2. Decode tuple.
3. IDENTITY: `accessControl.isCommunity(attestation.attester)` only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:42-45`). Community Hat becomes a real attestation gate for the first time (today it only gates GreenWill genesis eligibility, `corrections-log.md` H6).
4. REQUIRED FIELDS: testimonyCID non-empty.
5. COMMITMENT CHECK (optional module ref, zero-bypass): when `commitmentModule != address(0)` and `commitmentId != 0`, verify `module.getCommitment(commitmentId)` exists and its pool's garden equals `attestation.recipient`.

Storage: `schemaUID`, `commitmentModule` = 2 used slots, `uint256[48] __gap` (matches `Assessment.sol:39-44` accounting style).

#### 6.4.4 Registration path (standalone, decision #26; first PR chain of the August track)

Never use `--update-schemas`: that mode reloads the three legacy resolvers and re-registers ALL legacy schemas, overwriting every schema artifact key (`packages/contracts/script/Deploy.s.sol:122-151`, `_registerSchemas` at `packages/contracts/test/helpers/DeploymentBase.sol:955-990`). Additive registration goes through the badge-schemas standalone precedent instead:

- NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` (template `packages/contracts/script/DeployBadgeSchema.s.sol:15-73`): deploys the two resolver UUPS proxies (CREATE2 + ERC1967Proxy, `_deployAssessmentResolver` shape at `packages/contracts/test/helpers/DeploymentBase.sol:913-953`), registers both schemas with `SchemaRegistry.register(schemaString, resolverAddr, false)` against `eas.schemaRegistry` `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB` (`packages/contracts/deployments/42161-latest.json:10`), then calls `setSchemaUID` on each resolver, then writes `deployments/{chainId}-commitment-schemas.json`.
- NET-NEW `packages/contracts/script/deploy/commitment-schemas.ts` (template `packages/contracts/script/deploy/badge-schemas.ts:76-168`): wraps the forge script with keystore handling and merges the result into `deployments/{chainId}-latest.json` under NEW keys only, exactly like `mergeIntoDeployment` (`badge-schemas.ts:128-168`).
- Artifact keys added (v2 keys untouched): `assessmentV3SchemaUID`, `assessmentV3Schema`, `assessmentV3Name`, `assessmentV3Description`, `communityTestimonySchemaUID`, `communityTestimonySchema`, `communityTestimonyName`, `communityTestimonyDescription`, plus top-level `assessmentV3Resolver` and `communityTestimonyResolver` addresses.
- `packages/contracts/config/schemas.json` gains sibling keys `assessmentV3` and `communityTestimony` (name, description, revocable false, fields array) so `_generateSchemaString` and its bun utility keep producing canonical strings (`packages/contracts/script/DeployHelper.sol:416-462`). The deployed `assessment` key is never edited.
- `packages/contracts/script/validate-resolver-eas.mjs` and `validate-eas-immutables.mjs` extended to cover the two new schema/resolver pairs.
- Invocation: `bun script/deploy.ts commitment-schemas --network <chain> --broadcast` wired into the existing deploy CLI dispatch next to `badge-schemas`.

#### Acceptance criteria

- Both schema strings byte-match between `config/schemas.json`-generated output and the registered on-chain schema record.
- v2 assessment attestations keep resolving and the v2 artifact keys are byte-identical before and after the merge.
- Resolver unit tests cover: baseline by operator (passes), delta by operator (reverts), delta with missing/foreign baselineUID (reverts), testimony by non-community (reverts), testimony with commitmentId pointing at another garden's pool (reverts when module wired).
- Sepolia registration precedes Arbitrum (release-age gate posture of `assertSepoliaGate`, `packages/contracts/script/deploy/badge-schemas.ts:77-81`).
- Registered before cycle 1 opens so baselines exist for seeding (decision #26).

### 6.5 WorkApprovalResolver bridge (upgrade)

Changes to `packages/contracts/src/resolvers/WorkApproval.sol`:

1. New storage: `ICommitmentPoolingModule public commitmentModule;` + `setCommitmentModule(address)` onlyOwner + `CommitmentModuleUpdated` event. Gap 48 to 47 with comment update (`WorkApproval.sol:47-53`).
2. In `onAttest`, after ALL existing validation passes and alongside the GAP block (`WorkApproval.sol:179-183`):

```solidity
// COMMITMENT BRIDGE: count approved work toward a pre-linked commitment.
// Non-blocking: approval must succeed even if the module call fails.
if (schema.approved && address(commitmentModule) != address(0)) {
    // solhint-disable-next-line no-empty-blocks
    try commitmentModule.onWorkApproved(schema.workUID, attestation.uid, attestation.recipient) {
        // Success: module emitted ApprovedWorkCounted (or no-op if unlinked)
    } catch {
        // Intentionally ignored; syncApprovedWork is the recovery path
    }
}
```

Linkage mechanism, stated plainly (decision #5): Work attestations carry no commitment reference and never will (the Work schema is immutable, `corrections-log.md` H2). The mapping lives on the module: claimant or steward calls `linkWork(commitmentId, workUID)` before or after the approval. The resolver hook matches by workUID: the module looks up `workCommitment[workUID]`; if zero it returns without effect. Approvals landing before linkage are recovered by steward-called `syncApprovedWork(commitmentId, approvalUIDs)`, which verifies each approval on EAS and dedupes via `approvalCounted`.

Trust model: linkage is operator-curated (steward and claimant are the only linkers), the resolver hook only counts approvals for pre-linked workUIDs, the module re-verifies garden and schema on every sync, and dedupe makes double-count impossible. The bridge couples resolver to module exactly as loosely as the existing KarmaGAP coupling: optional address, try/catch, disable by setting zero (`WorkApproval.sol:69-78`).

Upgrade mechanics: WorkApprovalResolver is a live UUPS proxy at `0x166732eD81Ab200A099215cF33F6A712309B69F7` (`packages/contracts/deployments/42161-latest.json:59`); baseline entry already exists (`packages/contracts/script/check-storage-layout.sh:30`); regenerate baseline in the same PR; broadcast via `contracts:*` scripts.

Acceptance criteria: approval with module unset behaves byte-identically to today; approval with module set and work unlinked emits nothing from the module and still validates; approval with linked work increments the counter once; a reverting module never blocks an approval (test with a mock module that always reverts).

## 7. Deployment

### 7.1 Deploy helpers

- NET-NEW `_deployCommitmentRegister(...)` and `_deployCommitmentPoolingModule(...)` in `packages/contracts/test/helpers/DeploymentBase.sol`, copying `_deployCookieJarModule` byte-for-byte in shape (implementation `new`, ERC1967Proxy init bytecode, salted CREATE2 predict + deploy-if-absent + mismatch revert; `packages/contracts/test/helpers/DeploymentBase.sol:718-759`). Register deploys first (module address zero in init), module second, wiring closes the loop.
- Call sites appended to `_deployCorePart2` after HypercertsModule (`DeploymentBase.sol:257-338` numbering continues at step 15c).
- `_wireModules` additions (`DeploymentBase.sol:341-385`):
  `commitmentRegister.setModule(module)`; `module.setGardenToken(gardenToken)`; `module.setHatsModule(hatsModule)`; `module.setCommitmentRegister(register)`; `module.setWorkApprovalResolver(workApprovalResolver)`; `module.setEAS(eas)`; `module.setSchemaUIDs(work, workApproval, legacyAssessment, assessmentV3)`; `gardenToken.setCommitmentPoolingModule(module)`; `workApprovalResolver.setCommitmentModule(module)`.

### 7.2 Artifacts

- `DeploymentResult` gains `address commitmentPoolingModule;` and `address commitmentRegister;` (`packages/contracts/script/DeployHelper.sol:42-72`) plus two `vm.serializeAddress` lines in `_saveDeployment` (`DeployHelper.sol:293-316`). Artifact keys: `commitmentPoolingModule`, `commitmentRegister` in `deployments/{chainId}-latest.json`.
- Do NOT extend the fixed `NetworkConfig` struct (`DeployHelper.sol:24-40`); the module has no external network dependency beyond what wiring provides (HypercertsModule precedent: deployed and wired without a NetworkConfig field).
- Schema artifact keys land via the standalone merge path (6.4.4), not `_saveDeployment`.

### 7.3 Order of operations for 42161 (August)

Deployment artifacts are the source of truth for addresses; pre-broadcast zero/missing addresses mean pending broadcast, post-broadcast they are blockers (root CLAUDE.md contract deployment rules).

1. PR chain 1 (schemas): deploy resolvers + register the two schemas on Sepolia, then Arbitrum. Merge artifact keys.
2. PR chain 2 (module + register): deploy `CommitmentRegister` + `CommitmentPoolingModule` proxies, wire module-side references, run `setSchemaUIDs` with the chain's artifact values.
3. PR chain 3 (upgrades): upgrade GardenToken implementation (6.3) and WorkApprovalResolver implementation (6.5); `setCommitmentPoolingModule` / `setCommitmentModule`; register protocol pool on the root garden (`deployments/42161-latest.json:40-43`); backfill `registerPool` for the 13 live gardens.
4. Update `packages/indexer/config.yaml` addresses from zero-address placeholders and bump `start_block` (8.1).

All invocations through bun wrappers and named `contracts:*` root scripts; never raw forge (`.claude/rules/contracts.md`).

## 8. Indexer plan

Boundary restated: Envio indexes Green Goods core state only; EAS attestations are read from easscan (`packages/indexer/schema.graphql:282-288`). Every entity and stat below derives exclusively from `CommitmentPoolingModule` and `CommitmentRegister` events. Rules that bind every entity here: `chainId: Int!` on all entities, composite IDs `${chainId}-${identifier}`, create-if-not-exists in update handlers, `bun codegen` after any `schema.graphql`/`config.yaml` change (`.claude/rules/indexer.md`).

### 8.1 `config.yaml` additions

Contract blocks (event signatures match the 6.1/6.2 interfaces; enum params surface as `uint8`):

```yaml
  - name: CommitmentPoolingModule
    handler: src/EventHandlers.ts
    events:
      - event: PoolRegistered(uint256 indexed poolId, address indexed garden, uint8 poolType)
      - event: PoolCharterUpdated(uint256 indexed poolId, string charterCID)
      - event: PoolReady(uint256 indexed poolId)
      - event: PoolOpened(uint256 indexed poolId)
      - event: PoolPaused(uint256 indexed poolId)
      - event: PoolResumed(uint256 indexed poolId)
      - event: PoolClosed(uint256 indexed poolId)
      - event: PoolComposted(uint256 indexed poolId)
      - event: PoolReopened(uint256 indexed poolId, bool toOpen)
      - event: CycleSeeded(uint256 indexed cycleId, uint256 indexed poolId, uint8 cycleType, uint64 startTime, uint64 endTime, string metadataCID)
      - event: CycleOpened(uint256 indexed cycleId, uint256 indexed poolId, uint16 gardenersBps, uint16 treasuryBps, uint16 operatorBps, uint16 evaluatorBps, uint16 communityBps, uint16 funderBps)
      - event: CycleClosed(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleComposted(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID)
      - event: CommitmentCreated(uint256 indexed commitmentId, uint256 indexed poolId, uint256 indexed cycleId, address creator, address recordedBy, uint8 direction, uint8 commitmentType, uint8 claimType, uint8 claimMode, string unitLabel, uint256 targetUnits, uint32 requiredApprovedWorkCount, uint64 dueDate, bytes32 needUID)
      - event: RewardDeclared(uint256 indexed commitmentId, address source, address token, uint256 amount)
      - event: ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold)
      - event: ClaimRequested(uint256 indexed commitmentId, address indexed claimant, uint8 kind, address gardenContext)
      - event: CommitmentAccepted(uint256 indexed commitmentId, address indexed counterparty, uint8 kind)
      - event: WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address linker)
      - event: WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker)
      - event: ApprovedWorkCounted(uint256 indexed commitmentId, bytes32 indexed workUID, bytes32 approvalUID, uint32 approvedWorkCount, uint256 approvedUnits)
      - event: EvidenceAttached(uint256 indexed commitmentId, string cid, address indexed attacher)
      - event: AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher)
      - event: CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason)
      - event: ConfirmationRecorded(uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold)
      - event: CommitmentFulfilled(uint256 indexed commitmentId, bool fallbackConfirmation, string reason)
      - event: CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID)
      - event: CommitmentExpired(uint256 indexed commitmentId, address indexed caller)
      - event: CommitmentDisputed(uint256 indexed commitmentId, address indexed raiser, string reasonCID)
      - event: DisputeResolved(uint256 indexed commitmentId, uint8 resolution, string reasonCID)
      - event: RewardPaid(uint256 indexed commitmentId, address indexed payer, address token, uint256 amount, bytes32 payoutRef)
  - name: CommitmentRegister
    handler: src/EventHandlers.ts
    events:
      - event: ClassRegistered(uint256 indexed classId, uint256 indexed poolId, string unitLabel, uint256 quota)
      - event: QuotaUpdated(uint256 indexed classId, uint256 quota)
      - event: ProviderExposureCapUpdated(uint256 indexed poolId, uint256 cap)
      - event: UnitsCommitted(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted)
      - event: UnitsReleased(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted)
      - event: UnitsFulfilled(uint256 indexed classId, address indexed account, uint256 units, uint256 totalFulfilled)
```

Network entries for both `42161` and `11155111` start with the zero-address placeholder until broadcast, exactly like OctantVault today (`packages/indexer/config.yaml:81-82,104-105`), then swap to artifact addresses.

### 8.2 `schema.graphql` additions

The existing `PoolType` enum is taken by signal pools (`packages/indexer/schema.graphql:29-32`); all new enums are namespaced `Commitment*` to avoid the collision (also flagged in section 12).

```graphql
enum CommitmentPoolType { GARDEN PROTOCOL }
enum CommitmentPoolState { NOT_READY READY OPEN PAUSED CLOSED COMPOSTED }
enum CommitmentCycleType { SEASON CAMPAIGN }
# On-chain vocabulary only. DRAFT / IN_PROGRESS / REVIEWING are derived in
# shared selectors from these states + timestamps + commitment events.
enum CommitmentCycleState { SEEDED OPEN RECONCILED COMPOSTED CANCELLED }
enum CommitmentDirection { OFFER REQUEST }
enum CommitmentKind { DOMAIN_IMPACT SUPPORT_SERVICE SEASON_CAMPAIGN OPERATOR_CAPTURED }
# On-chain vocabulary only. DRAFT / ACTIVE / EVIDENCE_SUBMITTED /
# PARTIALLY_APPROVED / RECONCILED are derived in shared selectors.
enum CommitmentOnchainState { OFFERED REQUESTED ACCEPTED READY_FOR_CONFIRMATION FULFILLED CANCELLED EXPIRED DISPUTED }
enum CommitmentClaimType { GARDEN INDIVIDUAL }
enum CommitmentClaimMode { OPEN APPROVAL_GATED }
enum CommitmentEventType {
  POOL_REGISTERED POOL_CHARTER_UPDATED POOL_READY POOL_OPENED POOL_PAUSED
  POOL_RESUMED POOL_CLOSED POOL_COMPOSTED POOL_REOPENED
  CYCLE_SEEDED CYCLE_OPENED CYCLE_CLOSED CYCLE_COMPOSTED CYCLE_CANCELLED
  CREATED REWARD_DECLARED CONFIRMER_RULE_SET CLAIM_REQUESTED ACCEPTED
  WORK_LINKED WORK_UNLINKED APPROVED_WORK_COUNTED EVIDENCE_ATTACHED
  ASSESSMENT_ATTACHED READY_FOR_CONFIRMATION CONFIRMATION_RECORDED FULFILLED
  CANCELLED EXPIRED DISPUTED DISPUTE_RESOLVED REWARD_PAID
  UNITS_COMMITTED UNITS_RELEASED UNITS_FULFILLED
}

type CommitmentPool {
  id: ID! # chainId-poolId
  chainId: Int!
  poolId: BigInt!
  garden: String! # garden account address, lowercase
  poolType: CommitmentPoolType!
  state: CommitmentPoolState!
  charterCID: String
  activeCycleId: BigInt # null when no open cycle
  providerExposureCap: BigInt!
  # Lifetime counts (event-driven counters, greenWill dedup pattern)
  commitmentsOffered: BigInt!
  commitmentsRequested: BigInt!
  commitmentsAccepted: BigInt!
  commitmentsReadyForConfirmation: BigInt!
  commitmentsFulfilled: BigInt!
  commitmentsCancelled: BigInt!
  commitmentsExpired: BigInt!
  commitmentsDisputed: BigInt!
  workLinkedCount: BigInt!
  workApprovedCount: BigInt!
  # Unit tallies: numerators and denominators only, BigInt, never floats.
  # Derived rates (computed in shared selectors, never stored):
  #   workApprovalProgress = approvedUnits / expectedUnits
  #   promiseKeptRate      = commitmentsFulfilled / commitmentsDue
  #   cycleCompletionRate  = fulfilledUnits / expectedUnits
  #   openExposureUnits is the safety gauge (not a ratio)
  expectedUnits: BigInt!      # sum targetUnits of accepted commitments
  approvedUnits: BigInt!      # sum approvedUnits from ApprovedWorkCounted
  fulfilledUnits: BigInt!     # sum units from UnitsFulfilled
  openExposureUnits: BigInt!  # committed minus released minus fulfilled
  commitmentsDue: BigInt!     # accepted minus cancelled (mutually released promises are not broken promises)
  createdAt: Int!
  updatedAt: Int!
}

type CommitmentCycle {
  id: ID! # chainId-cycleId
  chainId: Int!
  cycleId: BigInt!
  poolId: BigInt!
  garden: String!
  cycleType: CommitmentCycleType!
  state: CommitmentCycleState!
  startTime: BigInt!
  endTime: BigInt!
  metadataCID: String!
  # Allocation-class snapshot from CycleOpened (Hypercert cut-over input)
  gardenersBps: Int!
  treasuryBps: Int!
  operatorBps: Int!
  evaluatorBps: Int!
  communityBps: Int!
  funderBps: Int!
  # Per-cycle stats, same numerator/denominator discipline as the pool
  commitmentsAccepted: BigInt!
  commitmentsFulfilled: BigInt!
  commitmentsCancelled: BigInt!
  commitmentsExpired: BigInt!
  commitmentsDue: BigInt!
  expectedUnits: BigInt!
  approvedUnits: BigInt!
  fulfilledUnits: BigInt!
  openExposureUnits: BigInt!
  createdAt: Int!
  updatedAt: Int!
}

type Commitment {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  poolId: BigInt!
  cycleId: BigInt # null when not cycle-scoped
  garden: String!
  creator: String!
  recordedBy: String!
  counterparty: String # null until accepted
  counterpartyKind: CommitmentClaimType
  direction: CommitmentDirection!
  commitmentType: CommitmentKind!
  state: CommitmentOnchainState!
  claimType: CommitmentClaimType!
  claimMode: CommitmentClaimMode!
  unitLabel: String!
  targetUnits: BigInt!
  requiredApprovedWorkCount: Int!
  approvedWorkCount: Int!
  approvedUnits: BigInt!
  confirmationThreshold: Int!
  confirmationCount: Int!
  confirmers: [String!]!
  requiresAssessment: Boolean!
  assessmentUID: String
  needUID: String # community Need this commitment addresses; null/zero when none (amendment 2026-07-04)
  workUIDs: [String!]!
  evidenceCIDs: [String!]!
  dueDate: BigInt!
  rewardSource: String
  rewardToken: String
  rewardAmount: BigInt
  rewardPaid: Boolean!
  rewardPayoutRef: String
  readyOverridden: Boolean!
  fulfilledByFallback: Boolean!
  disputeReasonCID: String
  cancelReasonCID: String
  createdAt: Int!
  updatedAt: Int!
}

# Audit trail, one row per event (VaultEvent pattern, schema.graphql:132-144)
type CommitmentEvent {
  id: ID! # chainId-txHash-logIndex
  chainId: Int!
  poolId: BigInt!
  cycleId: BigInt
  commitmentId: BigInt
  eventType: CommitmentEventType!
  actor: String!
  units: BigInt
  data: String # reason / CID / payoutRef payload where the event carries one
  txHash: String!
  timestamp: Int!
}
```

### 8.3 Handler plan

NET-NEW `packages/indexer/src/handlers/commitmentPool.ts`, registered as a side-effect import in `packages/indexer/src/EventHandlers.ts:18-25`. Patterns to copy, by name:

- **Dedup counters**: pool/cycle counters increment exactly the way `holderCount`/`grantCount` do in `packages/indexer/src/handlers/greenWill.ts:66-88` (read existing entity, branch on prior existence, never double-count).
- **Idempotency**: same-tx replay and already-exists guards as `packages/indexer/src/handlers/hypercerts.ts:38-42,71-75`.
- **Create-if-not-exists**: out-of-order events materialize placeholder entities first (`createDefaultGarden` precedent, `packages/indexer/src/handlers/helpers.ts:89-110`; `.claude/rules/indexer.md`).
- **ID helpers**: add `getCommitmentPoolId(chainId, poolId)`, `getCommitmentCycleId(chainId, cycleId)`, `getCommitmentId(chainId, commitmentId)`, `getCommitmentEventId(chainId, txHash, logIndex)` to `packages/indexer/src/handlers/helpers.ts`, re-exported through `packages/indexer/src/handlers/shared.ts`; composite `${chainId}-${identifier}` format throughout.
- **Address normalization**: `normalizeAddress` for every address field (`helpers.ts:68-70`).
- **Register events** update `openExposureUnits`/`fulfilledUnits` on both `CommitmentPool` and `CommitmentCycle` plus append `CommitmentEvent` rows; `UnitsCommitted`/`UnitsReleased`/`UnitsFulfilled` carry running class totals so handlers never re-sum.

Run `bun codegen` in `packages/indexer` after the schema/config edits and before writing handler code (`.claude/rules/indexer.md`).

### 8.4 Stat derivation contract

The four locked aggregates, restated as indexer-owned numerators/denominators plus shared-selector division (no floats stored, no leaderboard semantics):

| Aggregate | Numerator | Denominator | Notes |
|---|---|---|---|
| workApprovalProgress | `approvedUnits` | `expectedUnits` | per pool and per cycle |
| promiseKeptRate | `commitmentsFulfilled` | `commitmentsDue` (accepted minus cancelled) | expiries count against; mutual releases do not |
| cycleCompletionRate | `fulfilledUnits` | `expectedUnits` | per cycle |
| openExposureUnits | running gauge | none | committed minus released minus fulfilled |

## 9. Hypercert cut-over

Zero HypercertsModule contract changes. The cut-over swaps the bundling unit and the allocation source; the mint pipeline is untouched.

### 9.1 Bundling unit

- Today: operator curates approved Work attestations at mint time; UIDs land in `Hypercert.attestationUIDs` via IPFS metadata parse (`corrections-log.md` §2 Hypercert row; `packages/indexer/src/handlers/hypercerts.ts:150-165`).
- After cut-over: the bundling unit is fulfilled commitments. The mint metadata composer (shared, `corrections-log.md` §4 pointer to `packages/shared/src/modules/data/hypercerts-metadata.ts`) writes `bundleKind: "COMMITMENT"`, a `commitmentIds` array, and nests each commitment's work attestation UIDs and evidence CIDs as evidence within the IPFS metadata. Work stays visible as evidence; commitments are the impact claims.
- The legacy work-bundling path stays readable and mintable (`bundleKind: "WORK_LEGACY"`, the default when metadata carries no discriminator). Existing certificates never re-migrate.

### 9.2 Indexer entity change

```graphql
enum HypercertBundleKind { WORK_LEGACY COMMITMENT }

# Fields appended to the existing Hypercert entity (schema.graphql:190-206):
#   bundleKind: HypercertBundleKind!     (default WORK_LEGACY when absent)
#   commitmentIds: [BigInt!]             (optional; present for COMMITMENT bundles)
```

Populated by extending `parseHypercertMetadata` in the ClaimStored handler (`packages/indexer/src/handlers/hypercerts.ts:131-177`); absent or unrecognized metadata resolves to `WORK_LEGACY`.

### 9.3 Allocation classes

- On-chain: only the six-role bps snapshot, set at cycle open, validated `sum == 10_000` (`InvalidAllocation`, mirroring `InvalidSplitRatio` at `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`, stored on the cycle and indexed on `CommitmentCycle` (8.2).
- App-computed: per-address allowlist expansion. The app resolves each class to concrete addresses (fulfilled-commitment providers for gardeners' share, garden treasury, steward, evaluators, community confirmers, funders), multiplies by class bps against `TOTAL_UNITS = 100_000_000` and runs the existing validate + IPFS upload + merkle-root pipeline unchanged (`corrections-log.md` §2: allowlist/merkle/IPFS are already app-side).
- Holder: already satisfied. `createAllowlistAndRegister(garden, ...)` passes the garden as hypercert creator/holder, so the ERC-6551 garden account holds the cert (`packages/contracts/src/modules/Hypercerts.sol:139-166`, holder at line 160).

### 9.4 Protocol-shipped allocation presets (guidance models from Document A)

Shipped as shared constants (app-level presets; the chain enforces only the 10_000 sum). Per-garden policy is chosen at cycle open by the steward.

| Class | Model 1 (default) | Model 2 | Model 3 |
|---|---|---|---|
| gardeners | 6000 | 3000 | 4000 |
| treasury | 1500 | 4500 | 2000 |
| operator | 1000 | 1000 | 2000 |
| evaluator | 500 | 500 | 1000 |
| community | 500 | 500 | 500 |
| funder | 500 | 500 | 500 |

Default is Model 1. Guidance (not chain-enforced): keep the treasury class at a 1500-2000 bps floor so garden regeneration is always funded; the app warns below it.

### 9.5 Acceptance criteria

- A COMMITMENT-bundle mint produces an indexed Hypercert with `bundleKind: COMMITMENT` and populated `commitmentIds`; a legacy mint still resolves `WORK_LEGACY`.
- Cycle-open bps snapshot equals the allocation encoded in the minted allowlist within rounding (app test).
- No change to `HypercertsModule` bytecode; `createAllowlistAndRegister` call shape is identical.

## 10. Package-Level Backlog

Each block below is shaped as a package-level implementation surface with acceptance criteria and validation hints. Historical PRD-671..681 child issue labels roll up to the parent trackers named in `plan.todo.md`; do not create or update child Linear issues unless Afo explicitly expands the Linear footprint. Repo build order applies: contracts -> shared -> indexer -> client/admin/agent surfaces (root CLAUDE.md Build Order; indexer needs contract ABIs, frontends need shared).

### `packages/contracts` PR chain 1: schemas and resolvers (FIRST, decision #26)

Deliverables: `AssessmentV3Schema` + `CommunityTestimonySchema` structs in `src/Schemas.sol`; `src/resolvers/AssessmentV3.sol` + `src/resolvers/CommunityTestimony.sol`; `config/schemas.json` keys `assessmentV3` + `communityTestimony`; `script/DeployCommitmentSchemas.s.sol` + `script/deploy/commitment-schemas.ts` + deploy CLI wiring; validate-script extensions; resolver unit tests; storage-layout entries + baselines.

Acceptance: 6.4 acceptance criteria pass; Sepolia registration broadcast, then Arbitrum; artifact keys merged with v2 keys byte-identical; `bun run test` green in `packages/contracts`.

### `packages/contracts` PR chain 2: module + register

Deliverables: `src/modules/CommitmentPooling.sol`, `src/registries/Commitment.sol`, both interfaces, unit + fork tests, `DeploymentBase.sol` deploy helpers + wiring, `DeployHelper.sol` result fields + serialization, storage-layout entries + baselines + `StorageLayout.t.sol` additions.

Acceptance: 6.1 and 6.2 acceptance criteria pass; deployed to Sepolia and smoke-tested with a scripted offer -> fulfilled pass; Arbitrum broadcast gated on chain-3 readiness.

### `packages/contracts` PR chain 3: live upgrades + backfill

Deliverables: GardenToken change set (6.3), WorkApprovalResolver bridge (6.5), 42161 broadcast runbook (one-shot ops doc in `.plans/active/commitment-pooling/`, not `scripts/`), protocol pool registration, 13-garden pool backfill.

Acceptance: storage-layout gates green pre-broadcast; post-broadcast artifact shows both new addresses and non-zero pool count; a live approval on an existing garden emits `ApprovedWorkCounted` for a linked work.

### `packages/indexer`

Deliverables: `config.yaml` blocks (8.1, zero-address placeholders until broadcast), `schema.graphql` entities + enums (8.2, 9.2), `src/handlers/commitmentPool.ts`, hypercerts handler `bundleKind` extension, helper ID functions, `EventHandlers.ts` import, handler tests, `bun codegen` artifacts.

Acceptance: local Docker stack replays a scripted Sepolia fixture and produces correct pool/cycle counters and unit gauges; the four aggregates in 8.4 derive with integer math only; no EAS reads anywhere in handlers.

### `packages/shared`

Deliverables: domain types (`CommitmentPool`, `CommitmentCycle`, `Commitment`, allocation preset constants; `Address` type per repo rules); ABI + address exports from the deployment artifact (import pattern per root CLAUDE.md Contract Integration); query hooks + `queryKeys.*` entries; derived-state selectors implementing the section 5 overlays (Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, Reconciled) and the 8.4 rate math; **six August action/job kinds**: offline queue kinds `commitment` (create offer/request), `claim` (claim/accept), `evidence` (attach evidence CID), `workLink` (link approved work), and `confirmation` (confirm fulfillment), plus online-only wallet action `transfer` (settlement-chain G$ send), extending the exactly-two-kinds baseline where applicable (`packages/shared/src/types/job-queue.ts` + `packages/shared/src/modules/job-queue/`, `corrections-log.md` §6); mutation hooks with `createMutationErrorHandler`.

Acceptance: hooks exported from the barrel only; the five offline pool job kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) run through the existing IndexedDB + XState machine with MAX_RETRIES parity; `transfer` is an online-only settlement wallet action with no offline queue entry and no MAX_RETRIES replay (per `uiux-spec.md` §4.2 and `settlement-spec.md` §5); locale keys mirrored es/pt (repo i18n gate); `bun run --filter @green-goods/shared test` green.

### `packages/admin`

Deliverables (full flows in `uiux-spec.md`; contract touchpoints listed here): steward seeding console (createCommitment with confirmer rule + declared reward + claim mode), cycle management across 5.2, claims queue (`acceptClaim`), analog capture (OperatorCaptured via `onBehalfOf`, extending the `SubmitWork` on-behalf precedent), per-cycle assessment creation against the v3 schema, allocation preset picker at cycle open, dispute handling, `RewardPaid` recording. Garden workspace + new Pools workspace per decision #10.

Acceptance: every module write goes through shared mutation hooks; no direct contract calls in views; admin remains restrained (no hero moments).

### `packages/client`

Deliverables (full flows in `uiux-spec.md`): offer/request creation, browse/claim, work linkage through the existing MDR flow, evidence capture, counterparty confirmation, commitment + cycle views in the Garden tab; personal commitments + pending-confirmations panel on the Profile wallet surface; settlement reward status + G$ send affordance per `settlement-spec.md`; Fulfilled and cycle-close hero moments (decision #27, client only). The five August offline job kinds cover field actions where applicable; G$ send is an explicit online wallet action on Celo.

Acceptance: offline queue proof for each field action; mutual-aid copy only (banned-vocab lint passes).

### Editorial website (client public routes)

Deliverables: `/gardens/:id` GardenDialog pool view, cycle progress, promises-kept stats; `/impact` protocol-wide pool aggregates. Read-only, aggregate-only, no new routes (decision #21).

Acceptance: renders exclusively from indexer aggregates; no per-person listings; small-community sensitivity respected (readiness copy before live numbers).

## 11. Launch Milestones

### Milestone 1: July dry run (no code)

Goal: run the commitment loop socially on existing rails while the build proceeds.
Exit criteria: methodology + scoping surveys complete (mandate artifact per garden); activations recorded; rewards flowing through existing Cookie Jar/treasury paths; zero contract dependencies.

### Milestone 2: August release (the hard commitment)

Goal: pools, cycles, commitments, confirmations, aggregates, commitment-bundled Hypercerts, and the first operator-executed G$ settlement leg live with proof on Arbitrum One plus the Celo value leg.
Exit criteria, in dependency order:

1. Schemas registered on Sepolia + Arbitrum with resolvers live (PR chain 1); baselines attestable before cycle 1 opens.
2. Module + register deployed, wired, storage baselines committed (PR chain 2).
3. GardenToken + WorkApprovalResolver upgraded on 42161; protocol pool + 13 garden pools registered (PR chain 3).
4. Indexer serving the four core aggregates plus settlement/disbursement status from Green Goods core events alone.
5. Shared substrate (types, hooks, five offline queue job kinds plus online wallet `transfer`, settlement selectors) consumed by admin + client + editorial surfaces.
6. First real cycle seeded and opened with an allocation preset; first commitment fulfilled with counterparty confirmation; first Arbitrum-rail `RewardPaid` recorded; first G$ disbursement queued on Arbitrum, executed from a garden Celo Safe, `recordSettled(celoTxHash)`, and visible in the PWA reward row.

### Milestone 3: September community interface

Goal: `packages/community` PWA (view/signal/confirm-when-named) consuming the same shared substrate.
Exit criteria: contract layer requires zero changes for it (view + confirm paths already exist in this spec); community testimony attestable from the new surface.

## 12. Risks and Open Questions

Carried verbatim from the session-plan skeleton (1-6), plus findings from this pass (7-12). Items marked DO-NOT-SILENTLY-FIX must be logged or decided, never patched in passing.

1. **On-chain vs derived state weight.** The module carries more transition logic than the repo's thin-module convention (modules today mostly wire external protocols). Decision #6 accepts this deliberately; reviewers should challenge any FURTHER on-chain state before it lands, not the tabled set.
2. **EAS -> module bridge coupling.** The resolver -> module hook has GAP precedent (`packages/contracts/src/resolvers/WorkApproval.sol:179-183`) but couples the approval path (criticality: critical) to a new module. Mitigations specced: optional address, try/catch, never-revert no-op semantics, sync fallback, mock-revert test. The bridge and trust model are named in 6.5; any change to linkage authority is a spec change.
3. **Schema key versioning.** `assessmentV3*` keys sit beside untouched `assessment*` (v2) keys. Consumers must select by key, never by "latest". A future v4 repeats the pattern; nothing may ever rewrite an existing key (the `--update-schemas` overwrite hazard, `packages/contracts/script/Deploy.s.sol:122-151`).
4. **Storage-layout script drift** (DO-NOT-SILENTLY-FIX). `script/check-storage-layout.sh:23-33` never gained CookieJarModule, HypercertsModule, GardensModule, OctantModule, YieldResolver, or UnifiedPowerRegistry. This spec adds ONLY its own two contracts plus touches to already-listed GardenToken/WorkApprovalResolver; the missing-module backfill is separate debt (log to the docs-freshness/debt Linear issue).
5. **"Campaign" naming collision** (DO-NOT-SILENTLY-FIX). `CycleType.Campaign` collides conceptually with the existing `CampaignCookieJar` indexer entity (`packages/indexer/schema.graphql:259-280`) and the admin Cookies workspace. They are different things (a cycle type vs a funding jar). Copy, docs, and glossary entries must always say "campaign cycle" vs "campaign cookie jar"; do not rename either side in code.
6. **Testimony "never averaged" is off-chain law only.** The schema deliberately has no score field, but nothing on-chain stops a future consumer from scoring testimony. Enforcement lives in indexer/app review (no aggregation of testimony into numbers) and the banned-vocab/design gates. Flag any PR that counts testimony.
7. **StorageLayout.t.sol GardenToken drift** (DO-NOT-SILENTLY-FIX beyond the touched contract). Comments and gap tests describe a 7-named/43-gap layout (`packages/contracts/test/StorageLayout.t.sol:31-35,59-69`) while the source is 13 used + 37 gap (`packages/contracts/src/tokens/Garden.sol:56-62`); the gap tests are arithmetic tautologies (`expectedNamed + expectedGap == 50`). PR chain 3 corrects the GardenToken numbers it touches and must add real slot assertions for the new field; the tautology pattern across other contracts is logged debt.
8. **Expiry timing with cycle fallback.** `expireCommitment` with `dueDate == 0` reads the cycle's endTime; commitments that are cycle-less AND dueDate-less can never expire (only cancel). Accepted for MVP; seeding UX should require one of the two.
9. **Protocol-pool individual claims.** ClaimType.Individual accepts any role hat in any registered garden via a caller-supplied `gardenContext`. This is broad by design (protocol commitments are curated + default ApprovalGated per decision #19); if farming appears, tighten eligibility in the module without schema impact. Sarafu-precedent reclamation posture applies (suspend via pool pause, dispute, cancel).
10. **GraphQL `PoolType` collision.** Existing enum at `packages/indexer/schema.graphql:29-32` is kept for signal pools; all new enums are `Commitment*`-namespaced. Do not "clean up" the old enum in this workstream.
11. **Partial fulfillment is out of MVP.** Units convert all-or-nothing at Fulfilled. If gardens need partial credit mid-cycle, that is a module v1.1 (`fulfillUnits` already takes a units argument, so the register is ready).
12. **Register upgrade authority.** The register is UUPS-owned by the multisig while mutations are module-gated (6.2). Anyone proposing owner==module must answer who upgrades the register.

---

Build order restated for the August track: contracts (schemas -> module/register -> upgrades) -> indexer -> shared -> admin + client PWA + editorial in parallel -> September community interface. The July dry run needs none of it.
