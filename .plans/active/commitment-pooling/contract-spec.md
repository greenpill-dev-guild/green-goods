# Commitment Pooling: Contract Spec

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Companions**: `corrections-log.md` (verified repo facts, exact UIDs and addresses), `uiux-spec.md` (surface flows), `plan.todo.md` (execution plan). This spec is the contract-layer source of truth for the August release build track.

> **Amendment 2026-07-04 (approved)**: the commitment record, `CreateCommitmentParams`, and `CommitmentCreated` gain an additive `bytes32 needUID` reference (0 = none) linking a commitment to the community Need that motivated it. Additive reference field beside `assessmentUID`; no state-machine change; the module stores it as-is and never reads EAS for it. Specced before the August build starts so it ships in the initial deploy, not as an upgrade. Owning spec: `.plans/active/community-interface/spec.md` (§11).
>
> **Amendment 2026-07-09 (approved architecture contract)**: commitment domains are optional multi-domain arrays. `uint8[] domains` replaces the singular domain; `uint256[] requiredActionUIDs` is positional with domains when action-bound. `DomainImpact` requires 1–4 unique valid domains and one registered, domain-matching action UID per domain. Action UID `0` is valid in the existing registry; array presence, never a numeric sentinel, expresses whether action binding exists. Other commitment kinds may use no domains and no action UIDs. `CommitmentCreated` emits all immutable creation facts needed by Envio (`domains`, `requiredActionUIDs`, `requiresAssessment`, `metadataCID`, `needUID`). Approval-gated claims gain an indexed request entity, a commitment-keyed request index, and explicit decline/supersede semantics. This is pre-build contract shape, not a storage migration.
>
> **Readiness correction 2026-07-10 (scope-locked)**: confirmer defaults are direction-aware (Offer recipient; Request creator), pending claims persist their requested terms, disputes restore an explicit pre-dispute state, and only states with committed units release them. One Season may be open per pool while Campaigns may overlap. DomainImpact Work and assessments anchor to the accepted provider garden. The Envio/deployment contract includes a full Garden composite-ID replay, nullable event actors, and preservation tests for generated contract blocks. These are initial-deploy requirements, not upgrade migrations.
>
> **Amendment 2026-07-18 (approved, user visual-asset audit)**: per-action required counts. The scalar `requiredApprovedWorkCount`/`approvedWorkCount` pair becomes positional `uint32[] requiredApprovedWorkCounts` / `uint32[] approvedWorkCounts`, aligned with `requiredActionUIDs` (same length; the max-4 bound carries over from domains). A creator states "this promise needs [Action] × [count]" per bound action; `onWorkApproved`/`syncApprovedWork` credit the counter of the requirement whose action UID matches the approved Work; ReadyForConfirmation auto-flips only when **every** requirement meets its non-zero count (assessment predicate unchanged); `approvedUnits = floor(targetUnits × Σ min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ requiredApprovedWorkCounts)` — the single-requirement case degenerates to the previous formula. Evidence-only kinds (SupportService/OperatorCaptured/SeasonCampaign) express "no work requirement" as empty or all-zero counts, preserving the prior `== 0` semantics. `ApprovedWorkCounted` gains `requirementIndex`; the indexer gains a per-requirement `CommitmentRequirement` entity. Pre-build contract shape, not a storage migration. Recorded in `corrections-log.md` §10.

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
7. **Protocol pool = root garden pool** (#8). The root garden (`packages/contracts/deployments/42161-latest.json:40-43`: `0xf401f34378384713222d1d21f63359cc4E8a858a`, tokenId 1) anchors the protocol pool with `poolType = Protocol`. Cross-garden claiming uses one canonical identity formula: Individual claim → `claimant = requestedBy = msg.sender`; Garden claim → `claimant = gardenContext` (the GardenAccount) and `requestedBy = msg.sender` (its authenticated operator/owner). The creation-time `claimType` is immutable eligibility and must equal the runtime claim `kind`. Protocol-pool stewardship reuses root-garden Hats.
8. **Rewards are references, not custody** (#18). A commitment carries a declared reward (source address, token, amount), and acceptance stores the direction-aware provider recipient. On Fulfilled, the operator or protocol executes the payout on existing rails (jar, treasury) and records only a payout reference; `RewardPaid` derives/emits source, recipient, token, and amount from the commitment. Zero CookieJar changes; jars remain pull-based (`packages/contracts/src/modules/CookieJar.sol:243-296`).
9. **Claim mode per commitment** (#19). Open claim vs approval gated, set at seeding. App-level defaults: protocol pool prefills ApprovalGated, garden campaign commitments prefill Open. The module stores what is passed.
10. **Lightweight evidence** (#20). `EvidenceAttached(commitmentId, cid, attacher)` module event, offline-queueable. For SupportService and OperatorCaptured commitments, counterparty confirmation IS the review; no separate approval step. DomainImpact keeps the full Work to WorkApproval path.
11. **Schema registration is the first PR chain of the August track** (#26), via the standalone badge-schemas-style path (`packages/contracts/script/deploy/badge-schemas.ts`, `packages/contracts/script/DeployBadgeSchema.s.sol`), never via `--update-schemas` (which re-registers and overwrites all existing schema artifact keys, `packages/contracts/script/Deploy.s.sol:122-151`).
12. **Allocation classes on-chain as bps at cycle open**. Six-role bps snapshot (gardeners, treasury, operator, evaluator, community, funder) validated to sum exactly 10000 (precedent: `InvalidSplitRatio`, `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`. Per-address allowlist expansion stays app-computed on the existing merkle pipeline (`corrections-log.md` §2 Hypercert row).
13. **Post-MVP garden-to-garden is reserved, not implemented**. `counterpartyPoolId` and `counterpartyGardenAccount` exist as reserved struct fields (always zero in MVP) so the L3 amendment is additive.
14. **Anti-farming posture from day one**: direction-aware independent confirmation (Offer recipient; Request creator), provider self-confirmation blocked on both ordinary and steward-fallback paths (mirrors `SelfAttestation`, `packages/contracts/src/resolvers/WorkApproval.sol:153-156`), operator fallback requires a visible reason, exposure caps in the register, and disputes restore an explicitly stored prior state.

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
| NotReady -> Ready | on-chain | `markPoolReady(poolId)`, requires non-empty charter CID and a non-zero register provider-exposure cap. Event `PoolReady`. App additionally requires one current non-revoked Baseline assessment for the pool garden before offering the action. |
| Ready -> Open | on-chain | `openPool(poolId)`. Event `PoolOpened`. |
| Open <-> Paused | on-chain | `pausePool(poolId, reasonCID)` / `resumePool(poolId)`. `reasonCID` is mandatory and emitted in `PoolPaused`; the indexer keeps it as the current pause reason until resume. |
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

Concurrency invariant: a pool may have **one open Season** and any number of open Campaigns. `Pool.openSeasonCycleId` is the bounded O(1) Season guard: opening a Season requires it to be zero and stores the cycle ID; closing or cancelling that open Season clears it. Campaign open/close never reads or writes that field and no contract function enumerates cycles. Multiple Seeded Seasons may exist, but only one can become Open.

### 5.3 Commitment

On-chain enum: `CommitmentState { None, Offered, Requested, Accepted, ReadyForConfirmation, Fulfilled, Cancelled, Expired, Disputed }`. `Draft`, `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived.

| Transition | Layer | Mechanism |
|---|---|---|
| Draft (exists) | off-chain | Client/admin IndexedDB draft (offline-first). |
| Draft -> Offered or Requested | on-chain | `createCommitment(params)`. Event `CommitmentCreated` (direction Offer or Request sets the initial state). |
| Offered/Requested -> Accepted | on-chain | `claimCommitment` requires runtime `kind == commitment.claimType`. Individual claims use caller as claimant/requester; Garden claims use `gardenContext` as canonical claimant and caller as `requestedBy`. Open mode transitions immediately. ApprovalGated mode emits `ClaimRequested` (state unchanged; "claim pending" is derived), then operator `acceptClaim(commitmentId, claimant)` consumes the canonical claimant-keyed terms. Event `CommitmentAccepted`. Register records committed units (`UnitsCommitted`). |
| Accepted -> Active | derived | First `WorkLinked` or `EvidenceAttached` after acceptance. |
| Active -> EvidenceSubmitted | derived | Any `EvidenceAttached` or `WorkLinked` event. |
| EvidenceSubmitted -> PartiallyApproved | derived | `ApprovedWorkCounted` events: at least one requirement counter above zero while any requirement remains below its required count. |
| PartiallyApproved <-> EvidenceSubmitted | derived | New evidence/work after partial approvals flips forward; the counter events flip back. |
| -> ReadyForConfirmation | on-chain | Three paths, all emitting `CommitmentReadyForConfirmation`: (a) automatic inside `onWorkApproved`, `syncApprovedWork`, or `attachAssessment` once every per-action requirement reaches its non-zero required count and any declared assessment is attached (so assessment arriving after the final approval remains reachable); (b) `submitForConfirmation(commitmentId)` only for SupportService, OperatorCaptured, or SeasonCampaign commitments explicitly seeded with no work requirement (empty or all-zero `requiredApprovedWorkCounts`), with >= 1 evidence and any declared assessment attached; DomainImpact can never use this path; (c) `markReadyForConfirmation(commitmentId, reason)` steward override, reason emitted. |
| ReadyForConfirmation -> Fulfilled | on-chain | `confirmFulfillment(commitmentId)` by a named confirmer or the direction-aware default (Offer recipient; Request creator); each confirmation emits `ConfirmationRecorded`; reaching threshold N emits `CommitmentFulfilled`. The unit provider is excluded from every confirmation path. Fallback: `confirmFulfillmentAsFallback(commitmentId, reason)` operator/owner with mandatory reason, also forbidden when the caller is the provider. Register converts units (`UnitsFulfilled`). |
| Fulfilled -> Reconciled | derived | `CycleClosed` for the commitment's cycleId; cycle-less commitments (cycleId == 0) derive Reconciled from `PoolClosed`. |
| -> Cancelled | on-chain | `cancelCommitment(commitmentId, reasonCID)` from Offered/Requested (creator or steward) and Accepted (steward only; derived Active/PartiallyApproved are on-chain Accepted). Event `CommitmentCancelled`. Offered/Requested have no committed units and emit no register release; Accepted releases exactly `targetUnits`. Not allowed from ReadyForConfirmation except via dispute resolution. Envio uses the commitment request index to mark any still-Pending claim requests Superseded with terminal reason `COMMITMENT_CANCELLED`. |
| -> Expired | on-chain | `expireCommitment(commitmentId)`, permissionless, allowed once block time > dueDate (or the cycle endTime when dueDate == 0), from Offered/Requested/Accepted/ReadyForConfirmation. Event `CommitmentExpired`. Offered/Requested emit no register release; Accepted/ReadyForConfirmation release exactly `targetUnits`. Envio marks any still-Pending indexed claim requests Superseded with terminal reason `COMMITMENT_EXPIRED`. |
| -> Disputed | on-chain | `raiseDispute(commitmentId, reasonCID)` from Accepted/ReadyForConfirmation/Expired (the locked EvidenceSubmitted/PartiallyApproved entries map to on-chain Accepted). Before setting Disputed, the module stores the exact prior state in `preDisputeState`. Raiser: creator, counterparty, named confirmer, or steward. Event `CommitmentDisputed`. |
| Disputed -> previous state / Fulfilled / Cancelled / Expired | on-chain | `resolveDispute(commitmentId, RestorePrevious|Fulfilled|Cancelled|Expired, reasonCID)` steward-only. `RestorePrevious` restores the stored state. An Expired prior state may only restore Expired or resolve Cancelled; it can never resolve Fulfilled. Unit effects depend on `preDisputeState`: Fulfilled converts still-committed units; Cancelled/Expired release still-committed units; no resolution releases units that Expired already released. Event `DisputeResolved` carries the restored/final state. |
| Cancelled/Expired -> Reconciled at cycle close | derived | `CycleClosed` event; no on-chain per-commitment write (no unbounded loops at close). |

Fulfillment posture (locked): the party receiving the provider's work confirms by default—Offer recipient/counterparty or Request creator/requester—provider self-confirmation is blocked, and operator/owner fallback requires a reason and is also blocked for a provider who is an operator.

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
- Import and type the existing concrete `ActionRegistry` from `packages/contracts/src/registries/Action.sol` (the repo has no `IActionRegistry`). Validate every action-bound domain with its deployed ABI: `actionToOwner(actionUID) != address(0)` proves registration and `getAction(actionUID).domain` must equal the positional domain. UID `0` remains valid because `ActionRegistry.registerAction` allocates from `_nextActionUID++` (`packages/contracts/src/registries/Action.sol:185-188`).
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
| 4 | `actionRegistry` | `ActionRegistry` (the existing concrete registry in `packages/contracts/src/registries/Action.sol`; no nonexistent `IActionRegistry` is introduced) |
| 5 | `workApprovalResolver` | `address` (authorized hook caller) |
| 6 | `eas` | `IEAS` |
| 7 | `workSchemaUID` | `bytes32` |
| 8 | `workApprovalSchemaUID` | `bytes32` |
| 9 | `legacyAssessmentSchemaUID` | `bytes32` (v2, `packages/contracts/deployments/42161-latest.json:48`) |
| 10 | `assessmentV3SchemaUID` | `bytes32` |
| 11 | `paused` | `bool` (module-wide guard, `packages/contracts/src/modules/Hypercerts.sol:69` precedent) |
| 12 | `nextPoolId` | `uint256` (starts at 1; 0 is the null sentinel) |
| 13 | `nextCycleId` | `uint256` |
| 14 | `nextCommitmentId` | `uint256` |
| 15 | `gardenPool` | `mapping(address garden => uint256 poolId)` |
| 16 | `pools` | `mapping(uint256 poolId => Pool)` |
| 17 | `cycles` | `mapping(uint256 cycleId => Cycle)` |
| 18 | `commitments` | `mapping(uint256 commitmentId => Commitment)` |
| 19 | `commitmentConfirmers` | `mapping(uint256 commitmentId => address[])` |
| 20 | `hasConfirmed` | `mapping(uint256 commitmentId => mapping(address => bool))` |
| 21 | `workCommitment` | `mapping(bytes32 workUID => uint256 commitmentId)` |
| 22 | `approvalCounted` | `mapping(bytes32 approvalUID => bool)` |
| 23 | `pendingClaim` | `mapping(uint256 commitmentId => mapping(address claimant => PendingClaim))` |

Gap: `uint256[27] private __gap;` (23 named + 27 reserved = 50 total).

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

    enum DisputeResolution { RestorePrevious, Fulfilled, Cancelled, Expired }

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
        uint256 openSeasonCycleId; // 0 = none; Campaigns may overlap and are indexed from events
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
        address provider;                // immutable at acceptance: Offer creator; Request counterparty
        ClaimType counterpartyKind;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        CommitmentState state;
        ClaimType claimType;             // eligibility class set at seeding
        ClaimMode claimMode;
        uint8[] domains;                 // optional, unique, max 4; DomainImpact requires 1-4
        uint256[] requiredActionUIDs;    // positional with domains when action-bound
        uint64 dueDate;                  // 0 = cycle endTime governs
        string unitLabel;                // hours, tasks, meals, rides, plants...
        uint256 targetUnits;
        uint32[] requiredApprovedWorkCounts; // positional with requiredActionUIDs: per-action quota (amendment 2026-07-18)
        uint32[] approvedWorkCounts;         // positional counters, same length; credited by matched action UID
        uint32 confirmationThreshold;    // N of the named group; 1 under the counterparty default
        uint32 confirmationCount;
        bool requiresAssessment;
        bytes32 assessmentUID;           // attached v2/v3 assessment; zero until attached
        bytes32 needUID;                 // community Need this commitment addresses; 0 = none (amendment 2026-07-04)
        string metadataCID;              // terms/description payload (IPFS)
        DeclaredReward reward;
        bool rewardPaid;
        CommitmentState preDisputeState; // exact state captured by raiseDispute
        address providerGarden;          // EAS recipient and provider-role scope
        // RESERVED post-MVP garden-to-garden (L3); never written in MVP:
        uint256 counterpartyPoolId;
    }

    struct PendingClaim {
        address claimant;                // canonical key: individual caller or GardenAccount
        address requestedBy;             // authenticated caller; differs for Garden claims
        ClaimType kind;
        address gardenContext;
        uint64 requestedAt;
        bool active;
    }

    struct CreateCommitmentParams {
        uint256 poolId;
        uint256 cycleId;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        ClaimType claimType;
        ClaimMode claimMode;
        address onBehalfOf;              // OperatorCaptured only: the member who made the promise
        uint8[] domains;
        uint256[] requiredActionUIDs;
        uint32[] requiredApprovedWorkCounts; // positional with requiredActionUIDs (amendment 2026-07-18)
        string unitLabel;
        uint256 targetUnits;
        bool requiresAssessment;
        uint64 dueDate;
        string metadataCID;
        bytes32 needUID;                 // 0 = none; stored as-is, module never reads EAS (amendment 2026-07-04)
        address[] confirmers;            // empty = Offer recipient / Request creator default
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
    event PoolPaused(uint256 indexed poolId, string reasonCID);
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
        uint8[] domains,
        uint256[] requiredActionUIDs,
        uint32[] requiredApprovedWorkCounts,
        string unitLabel,
        uint256 targetUnits,
        bool requiresAssessment,
        uint64 dueDate,
        string metadataCID,
        bytes32 needUID              // 0 = none; non-indexed (3-indexed budget spent); Envio reads params regardless (amendment 2026-07-04)
    );
    event RewardDeclared(uint256 indexed commitmentId, address source, address token, uint256 amount);
    event ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold);
    event ClaimRequested(
        uint256 indexed commitmentId,
        address indexed claimant,
        address indexed requestedBy,
        ClaimType kind,
        address gardenContext,
        uint64 requestedAt
    );
    event ClaimDeclined(uint256 indexed commitmentId, address indexed claimant, string reasonCID);
    event CommitmentAccepted(
        uint256 indexed commitmentId,
        address indexed claimant,
        address indexed counterparty,
        ClaimType kind,
        address gardenContext,
        address provider,
        address providerGarden
    );
    event WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address linker);
    event WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker);
    /// @notice Unit-count change event. requirementIndex is the matched position
    ///         in requiredActionUIDs and approvedWorkCount is that requirement's
    ///         new counter (amendment 2026-07-18). approvedUnits is the new cumulative
    ///         integer floor(targetUnits * sum(min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]))
    ///         / sum(requiredApprovedWorkCounts)); newlyApprovedUnits is its delta
    ///         from the prior cumulative value.
    event ApprovedWorkCounted(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        bytes32 approvalUID,
        uint8 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 newlyApprovedUnits
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
    event CommitmentDisputed(
        uint256 indexed commitmentId, address indexed raiser, CommitmentState previousState, string reasonCID
    );
    event DisputeResolved(
        uint256 indexed commitmentId,
        DisputeResolution resolution,
        CommitmentState finalState,
        string reasonCID
    );
    /// @notice Payout executed on existing rails and recorded here (decision #18).
    event RewardPaid(
        uint256 indexed commitmentId,
        address indexed source,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 payoutRef,
        address recordedBy
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
    error CyclePoolMismatch(uint256 cycleId, uint256 expectedPoolId, uint256 actualPoolId);
    error CycleNotAcceptingCommitments(uint256 cycleId, CycleState actual);
    error InvalidAllocation(); // bps sum != 10_000 (Yield.sol InvalidSplitRatio precedent)
    error InvalidTimeWindow(uint64 startTime, uint64 endTime);
    error SeasonAlreadyOpen(uint256 poolId, uint256 cycleId);
    error UnknownCommitment(uint256 commitmentId);
    error CommitmentNotInState(uint256 commitmentId, CommitmentState actual);
    error NotEligibleClaimant(address claimant);
    error ClaimModeMismatch(uint256 commitmentId);
    error ClaimTypeMismatch(uint256 commitmentId, ClaimType expected, ClaimType actual);
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
    error WorkApprovalRequired(uint256 commitmentId);
    error ExposureCapRequired(uint256 poolId);
    error NotDue(uint256 commitmentId);
    error RewardAlreadyRecorded(uint256 commitmentId);
    error RewardNotDeclared(uint256 commitmentId);
    error ReasonRequired();
    error InvalidDomains();
    error DuplicateDomain(uint8 domain);
    error InvalidDomainActionScope();
    error UnknownAction(uint256 actionUID);
    error ActionDomainMismatch(uint256 actionUID, uint8 expected, uint8 actual);
    error ClaimNotPending(uint256 commitmentId, address claimant);
    error ProviderMismatch(address attester, address providerGarden);
    error WorkActionMismatch(uint256 actionUID);
    error InvalidDisputeResolution(uint256 commitmentId, DisputeResolution resolution);

    // ══════════════════════ Pool lifecycle ═══════════════════════════

    /// @notice GardenToken mint callback. Idempotent; registers a Garden-type
    ///         pool in NotReady. Gating: gardenToken only (CookieJar onlyGardenToken pattern).
    function onGardenMinted(address garden) external returns (uint256 poolId);

    /// @notice Backfill for pre-upgrade gardens and the protocol pool.
    ///         Gating: PoolType.Protocol requires module owner; PoolType.Garden
    ///         requires garden operator/owner or module owner.
    function registerPool(address garden, PoolType poolType) external returns (uint256 poolId);

    /// @notice Gating for the pool lifecycle functions below: pool steward (garden operator/owner
    ///         via hatsModule, module owner fallback). Protocol pool resolves
    ///         to root-garden hats.
    function setPoolCharter(uint256 poolId, string calldata charterCID) external;
    function markPoolReady(uint256 poolId) external;
    function openPool(uint256 poolId) external;
    function pausePool(uint256 poolId, string calldata reasonCID) external;
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

    /// @notice Forwards to the module-only register setter. Gating: pool
    ///         steward; cap must be non-zero and is required before markPoolReady.
    function setProviderExposureCap(uint256 poolId, uint256 cap) external;

    /// @notice Gating: pool steward, pre-acceptance only.
    function setDeclaredReward(uint256 commitmentId, DeclaredReward calldata reward) external;
    function setConfirmerRule(uint256 commitmentId, address[] calldata confirmers, uint32 threshold) external;

    /// @notice Claim eligibility (decision #7, #8):
    ///         Garden pools: caller must hold any role hat in the pool garden
    ///         (gardenContext must equal the pool garden).
    ///         Runtime kind must equal the immutable creation-time claimType.
    ///         Protocol pool, ClaimType.Garden: gardenContext must be a
    ///         registered garden (gardenPool != 0) and caller its operator/owner;
    ///         canonical claimant and counterparty = gardenContext, requestedBy = caller.
    ///         Protocol pool, ClaimType.Individual: caller must hold any role
    ///         hat in gardenContext; claimant = requestedBy = counterparty = caller.
    ///         ClaimMode.Open transitions to Accepted; ApprovalGated only emits
    ///         ClaimRequested and persists one pending request per canonical claimant.
    ///         Creator cannot claim own commitment.
    function claimCommitment(uint256 commitmentId, ClaimType kind, address gardenContext) external;

    /// @notice Gating: pool steward. ApprovalGated acceptance path; validates
    ///         the terms persisted by claimCommitment. The accepter cannot
    ///         substitute a different kind or gardenContext.
    function acceptClaim(uint256 commitmentId, address claimant) external;

    /// @notice Gating: pool steward. ApprovalGated decline path; reason is
    ///         mandatory. Clears the claimant's pending flag so a later request
    ///         is possible and emits ClaimDeclined for the audit trail.
    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external;

    // ─────────────── Work linkage + EAS bridge (decision #5) ─────────

    /// @notice Link a Work attestation to a commitment before or after its
    ///         approval. Verifies via eas.getAttestation: schema == workSchemaUID,
    ///         recipient == providerGarden. DomainImpact additionally requires
    ///         decoded Work.actionUID in requiredActionUIDs and provider authorship.
    ///         For an Individual claim, attester must equal the stored provider
    ///         (Offer creator; Request counterparty). For a Garden claim, attester
    ///         must be a gardener/operator of providerGarden. One work maps to at most one
    ///         commitment; one commitment maps to many works.
    ///         Gating: accepted canonical claimant/counterparty or pool steward;
    ///         only after acceptance. Creator is not an additional linker path.
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
    ///         linked to this commitmentId, recipient == providerGarden; dedupes
    ///         via approvalCounted. Gating: pool steward.
    function syncApprovedWork(uint256 commitmentId, bytes32[] calldata approvalUIDs) external;

    // ─────────────── Evidence, assessment, confirmation ──────────────

    /// @notice Gating: creator, counterparty, or pool steward. Offline-queueable.
    function attachEvidence(uint256 commitmentId, string calldata cid) external;

    /// @notice Verifies via eas.getAttestation: schema is legacyAssessmentSchemaUID
    ///         or assessmentV3SchemaUID, recipient == providerGarden.
    ///         Gating: pool steward or garden evaluator.
    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external;

    /// @notice Path (b) to ReadyForConfirmation: SupportService,
    ///         OperatorCaptured, or SeasonCampaign commitments with no work
    ///         requirement (empty or all-zero requiredApprovedWorkCounts);
    ///         requires >= 1 evidence and any declared assessment. DomainImpact
    ///         always reverts WorkApprovalRequired. Gating: counterparty,
    ///         creator, or steward.
    function submitForConfirmation(uint256 commitmentId) external;

    /// @notice Path (c): steward override with visible reason.
    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external;

    /// @notice Gating: a named confirmer, or Offer counterparty / Request creator
    ///         under the direction-aware default. The unit provider can never
    ///         confirm their own fulfillment.
    function confirmFulfillment(uint256 commitmentId) external;

    /// @notice Gating: pool steward; reason mandatory (fallback stays visible).
    ///         Reverts SelfConfirmation when the steward is also the provider.
    function confirmFulfillmentAsFallback(uint256 commitmentId, string calldata reason) external;

    // ─────────────── Exits, disputes, rewards ────────────────────────

    /// @notice Gating: creator from Offered/Requested; pool steward from Accepted.
    function cancelCommitment(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Permissionless once past due (dueDate, or cycle endTime when 0).
    function expireCommitment(uint256 commitmentId) external;

    /// @notice Gating: creator, counterparty, named confirmer, or pool steward.
    function raiseDispute(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Gating: pool steward. RestorePrevious uses preDisputeState;
    ///         an Expired prior state can never resolve Fulfilled.
    function resolveDispute(uint256 commitmentId, DisputeResolution resolution, string calldata reasonCID) external;

    /// @notice Records an already-executed payout (no custody). Requires state
    ///         Fulfilled and a non-zero declared source/token/amount; single record
    ///         per commitment in MVP. Source, recipient, token, and amount are
    ///         derived from the commitment and cannot be supplied by the caller.
    ///         Gating: pool steward.
    function recordRewardPaid(uint256 commitmentId, bytes32 payoutRef) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getPool(uint256 poolId) external view returns (Pool memory);
    function getPoolByGarden(address garden) external view returns (uint256 poolId, Pool memory pool);
    function getCycle(uint256 cycleId) external view returns (Cycle memory);
    function getCommitment(uint256 commitmentId) external view returns (Commitment memory);
    function getPendingClaim(uint256 commitmentId, address claimant) external view returns (PendingClaim memory);
    function getConfirmers(uint256 commitmentId) external view returns (address[] memory);
    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId);
    function isApprovalCounted(bytes32 approvalUID) external view returns (bool);

    // ══════════════════════ Admin (module owner) ═════════════════════

    function initialize(address owner_) external;
    function setGardenToken(address gardenToken) external;
    function setHatsModule(address hatsModule) external;
    function setActionRegistry(address actionRegistry) external;
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

Consolidated view of every mutating entry point across both contracts plus the two new resolvers; the per-function doc comments in the interface above remain the enforcement detail. Role legend: **steward** = pool steward via `_requirePoolSteward` (garden operator/owner through hatsModule, module owner fallback; the protocol pool resolves to root-garden hats). **member** = wearer of any of the six garden role hats (`IHatsModule.GardenRole`) in the relevant garden. Pause interplay: module pause blocks operational mutations but never `setPaused`, owner configuration setters, `cancelCommitment`, `expireCommitment`, or `resolveDispute`; pool-level Paused additionally blocks new commitments, claims, Ready submissions, and confirmations on that pool only.

| Group | Function | Authorized caller | State / other gates |
|---|---|---|---|
| Pool | `onGardenMinted` | GardenToken only | idempotent; creates a Garden-type pool in NotReady |
| Pool | `registerPool` | Protocol type: module owner · Garden type: garden operator/owner or module owner | one pool per garden (`PoolExists`) |
| Pool | `setPoolCharter` | steward | — |
| Pool | `markPoolReady` | steward | NotReady only; charter CID non-empty; non-zero provider exposure cap already set in the register. The app additionally requires one current non-revoked Baseline assessment (v2 or v3, recipient = pool garden, resolver-validated Baseline kind) before enabling this write. |
| Pool | `openPool` / `pausePool` / `resumePool` / `closePool` / `compostPool` / `reopenPool` | steward | transitions exactly per the §5.1 table; pause reason CID mandatory and indexed until resume |
| Cycle | `seedCycle` | steward | pool Ready or Open; bps sum == 10_000; valid time window |
| Cycle | `openCycle` | steward | pool Open; cycle Seeded; Season requires `openSeasonCycleId == 0`, Campaigns may overlap |
| Cycle | `closeCycle` / `compostCycle` | steward | Open → Reconciled → Composted |
| Cycle | `cancelCycle` | steward | from Seeded or Open; reason CID |
| Commitment | `createCommitment` | own Offer/Request: member of the pool garden · SeasonCampaign + OperatorCaptured: steward · protocol-pool commitments: root-garden steward or module owner | pool Open; `cycleId == 0` or cycle exists in the same pool; member-created commitments require an Open cycle, while steward seeding permits Seeded or Open; OperatorCaptured must set `onBehalfOf`; domains unique/max 4; every action exists/matches domain; DomainImpact requires 1–4 actions with a non-zero `requiredApprovedWorkCounts[i]` per action; SupportService/OperatorCaptured/SeasonCampaign may explicitly use evidence-only (empty or all-zero counts) |
| Commitment | `setDeclaredReward` / `setConfirmerRule` | steward | pre-acceptance only |
| Commitment | `claimCommitment` | garden pool: member of the pool garden · protocol pool ClaimType.Garden: operator/owner of the claiming garden (`gardenContext`) · protocol pool ClaimType.Individual: member of `gardenContext` | runtime kind equals stored claimType; canonical claimant is caller for Individual and `gardenContext` for Garden; `requestedBy` is caller; claimant != creator; Open accepts, ApprovalGated emits `ClaimRequested` |
| Commitment | `acceptClaim` | steward | ApprovalGated path; consumes the stored kind/gardenContext and re-validates eligibility |
| Commitment | `declineClaim` | steward | ApprovalGated pending request; mandatory reason; claimant may request again later |
| Linkage | `linkWork` | accepted canonical claimant/counterparty or steward | Accepted only; verifies schema, providerGarden recipient, DomainImpact action, and provider authorship; one work maps to at most one commitment |
| Linkage | `unlinkWork` | steward | only while the approval is not yet counted |
| Linkage | `onWorkApproved` | WorkApprovalResolver only | never reverts; no-op when unlinked or already counted |
| Linkage | `syncApprovedWork` | steward | verifies each approval on EAS; dedupes via `approvalCounted` |
| Evidence | `attachEvidence` | creator, counterparty, or steward | offline-queueable |
| Evidence | `attachAssessment` | steward or evaluator of providerGarden | verifies assessment attestation (v2 or v3 UID; recipient == providerGarden); if the non-zero Work threshold was already met, re-runs the automatic Ready predicate |
| Confirmation | `submitForConfirmation` | counterparty, creator, or steward | SupportService/OperatorCaptured/SeasonCampaign only; no work requirement (empty or all-zero `requiredApprovedWorkCounts`); at least 1 evidence; declared assessment attached; DomainImpact rejected |
| Confirmation | `markReadyForConfirmation` | steward | override path; reason emitted and visible |
| Confirmation | `confirmFulfillment` | named confirmer, Offer counterparty, or Request creator | state ReadyForConfirmation; the unit provider is blocked (`SelfConfirmation`); once per confirmer (`AlreadyConfirmed`) |
| Confirmation | `confirmFulfillmentAsFallback` | steward | mandatory reason; provider-steward is blocked (`SelfConfirmation`) |
| Exit | `cancelCommitment` | creator or steward (from Offered/Requested) · steward only (from Accepted) | reason CID; never from ReadyForConfirmation except via dispute resolution; allowed while module paused |
| Exit | `expireCommitment` | anyone (permissionless) | past dueDate, or cycle endTime when dueDate == 0 |
| Dispute | `raiseDispute` | creator, counterparty, named confirmer, or steward | from Accepted / ReadyForConfirmation / Expired |
| Dispute | `resolveDispute` | steward | RestorePrevious or terminal resolution; Expired cannot become Fulfilled; allowed while module paused |
| Reward | `recordRewardPaid` | steward | state Fulfilled; single record per commitment in MVP |
| Module admin | `setGardenToken` / `setHatsModule` / `setActionRegistry` / `setCommitmentRegister` / `setWorkApprovalResolver` / `setEAS` / `setSchemaUIDs` / `setPaused` | module owner | zero addresses rejected except documented pre-wiring module links |
| Module limiting admin | `setProviderExposureCap` | pool steward | non-zero; module forwards to the register; required before Ready |
| Register | `registerClass` / `setProviderExposureCap` / `commitUnits` / `releaseUnits` / `fulfillUnits` | CommitmentPoolingModule only (`NotModule`) | class quota is immutable at creation (`targetUnits`); provider exposure-cap guard (§6.2) |
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

- **Confirmer rule storage**: `confirmers` persists in `commitmentConfirmers`; empty means Offer counterparty or Request creator, threshold 1. At acceptance, a named group is de-duplicated and the resolved provider is excluded. The module persists and emits the resolved group; acceptance reverts `InvalidConfirmerRule` when the threshold exceeds remaining eligible addresses. The named group is data, not a hat.
- **Provider identity (one formula everywhere)**: acceptance stores `provider = direction == Offer ? creator : counterparty`. For an Individual claim, DomainImpact Work attester must equal this stored provider. For a Garden claim, Work attester must be a gardener/operator of `providerGarden`. The same stored `provider` is the `CommitmentRegister` account, reward recipient, exposure-cap subject, and self-confirmation exclusion. `counterparty` remains the accepted recipient for an Offer and accepted provider for a Request; no lane may substitute claimant or `msg.sender` for the stored provider.
- **Self-checks**: `claimCommitment` reverts `SelfCounterparty` when claimant == creator. `confirmFulfillment` reverts `SelfConfirmation` when msg.sender equals the stored provider, mirroring `packages/contracts/src/resolvers/WorkApproval.sol:153-156`.
- **Register coupling**: `createCommitment` registers the class with immutable quota `targetUnits`. A pool steward configures the non-zero per-pool provider exposure cap through the module forwarder before `markPoolReady`; the register itself remains module-only. Acceptance calls `commitUnits(commitmentId, commitment.provider, targetUnits)`. Cancel/expiry release only from Accepted/ReadyForConfirmation (or a Disputed record whose prior state held units), always against `commitment.provider`; Offered/Requested never release. Fulfillment converts only still-committed units for `commitment.provider`. Every path changes the register at most once.
- **Canonical claim identity + traceability**: creation-time `claimType` is immutable eligibility; `claimCommitment` reverts `ClaimTypeMismatch` when runtime `kind` differs. Individual: `claimant = requestedBy = msg.sender`. Garden: `claimant = gardenContext`, `requestedBy = msg.sender`, after operator/owner authorization. The module stores `{claimant, requestedBy, kind, gardenContext, requestedAt, active}` keyed by `(commitmentId, canonical claimant)` and rejects an active duplicate. `acceptClaim`/`declineClaim` consume that key. Envio marks accepted and sibling requests without an arbitrary scan.
- **Provider anchor**: acceptance stores `providerGarden` (Offer: pool garden; Request: accepted claimant's validated gardenContext) and emits both `provider` and `providerGarden` in `CommitmentAccepted`. DomainImpact Work must use a required action and the provider-authorship rule above; Work and assessment EAS recipients equal `providerGarden`, including protocol-pool commitments that remain owned by the root pool.
- **Reward binding**: `recordRewardPaid` accepts only `commitmentId` and `payoutRef`. It requires Fulfilled, `rewardPaid == false`, and a declared non-zero source/token/amount, then emits the stored source, stored provider recipient, stored token/amount, payout ref, and `recordedBy = msg.sender`. The caller never supplies an earned-reward route or value.
- **Mandatory reasons**: `declineClaim`, steward cancellation, `markReadyForConfirmation`, fallback confirmation, `raiseDispute`, and every `resolveDispute` call reject an empty reason/CID with `ReasonRequired`. This error is the only empty-reason error; handlers preserve the emitted reason exactly.
- **Domain/action scope**: `domains.length <= 4`; each entry uses the existing 0–3 enum and is unique. `requiredActionUIDs` is empty or has the same length as `domains`; `requiredApprovedWorkCounts` is empty or has the same length as `requiredActionUIDs` (amendment 2026-07-18). `DomainImpact` requires matching non-empty arrays. For every supplied action UID, including UID `0`, `actionRegistry.actionToOwner(uid) != address(0)` and `uint8(actionRegistry.getAction(uid).domain) == domains[i]`; array length, not a zero sentinel, distinguishes unbound commitments. SupportService, SeasonCampaign, and OperatorCaptured may remain unclassified (`[]`) or carry optional multi-domain tags without action UIDs; if they do carry action UIDs, the same existence/domain checks apply.
- **approvedUnits math**: computed on-chain as `targetUnits * Σ min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ requiredApprovedWorkCounts` (integer floor; approvals beyond one requirement's quota never add units) and emitted in `ApprovedWorkCounted` so the indexer never re-derives fractional units. A single requirement degenerates to the previous `targetUnits * approvedWorkCount / requiredApprovedWorkCount` formula (amendment 2026-07-18).
- **ReadyForConfirmation gates**: DomainImpact creation requires a non-zero required count for every bound action; SupportService, OperatorCaptured, and SeasonCampaign may choose evidence-only (no work requirement). Work-gated auto-flip is evaluated after any requirement counter changes and after `attachAssessment`, and happens only when every non-zero requirement is met and `requiresAssessment == false || assessmentUID != 0`; this makes both approval-first and assessment-first ordering reachable. Evidence-only `submitForConfirmation` enforces the same assessment predicate and rejects DomainImpact. Steward override remains the only bypass and always emits its reason.
- **Pause semantics**: module pause blocks operational entry points, but owner setters and `setPaused(false)` remain callable; cancel, expire, and dispute resolution remain available for safe wind-down. Pool-level Paused blocks new commitments, claims, Ready submissions, and confirmations only; browse, evidence/linkage, cancellation/expiry, and dispute recovery remain available. `PoolPaused` carries the mandatory reason CID and `PoolResumed` clears the indexed reason.
- **Cycle binding**: `cycleId == 0` is the only cycle-less sentinel. Any non-zero cycle must exist and belong to `params.poolId`. Member-created commitments require an Open cycle; steward-seeded SeasonCampaign/OperatorCaptured commitments permit Seeded or Open. Cancelled, Reconciled, Composted, or cross-pool cycles always revert before class registration.
- **onWorkApproved must never revert** for unrecognized state: the EAS approval succeeds regardless (approval flow is `critical` path per repo criticality matrix).

#### Acceptance criteria

- Every transition in the section 5 tables has exactly one emitting function or a documented derivation; no silent state changes.
- `bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol` covers pool/cycle invariants (including cross-pool/terminal-cycle rejection), one open Season plus concurrent Campaigns, baseline/exposure-cap readiness, mandatory pause reason, domains/actions including UID `0`, DomainImpact non-zero approval count, assessment gating on every non-override Ready path, claim-type mismatch, canonical Garden claimant versus `requestedBy`, direction-aware provider/counterparty resolution, provider exclusion, exact cancel/expiry/dispute unit effects, provider-account unit mutations, derived reward facts, provider-garden Work/assessment validation, and sync dedupe.
- Storage layout test asserts 23 named entries + 27 gap (pattern: `packages/contracts/test/StorageLayout.t.sol`), and `script/check-storage-layout.sh` gains a `CommitmentPoolingModule:src/modules/CommitmentPooling.sol` entry (list at `packages/contracts/script/check-storage-layout.sh:23-33`).
- Fork test proves a full Offer -> Accepted -> WorkLinked -> approval-hook count -> ReadyForConfirmation -> confirm -> Fulfilled -> RewardPaid pass against the deployed EAS on an Arbitrum fork (`bun run test:fork`, wrappers only per `.claude/rules/contracts.md`).

### 6.2 `CommitmentRegister`

#### Objective

A non-transferable, ERC-1155-STYLE unit ledger internal to our own contract: commitment classes, committed/fulfilled balances per account, quotas, and exposure caps. It does NOT inherit ERC-1155 and exposes no transfer or approval surface of any kind; balances move only through module calls. This is the voucher-shaped substrate (register #15, #16) that transferable settlement vouchers later wrap 1:1 on the same poolId.

#### Grassroots Economics grounding (clean-room, register #17)

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
    function providerExposureCapOf(uint256 poolId) external view returns (uint256);

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
- `registerClass` fixes quota to the commitment's `targetUnits`; there is no post-creation quota mutation. Exposure-cap reverts are covered by unit tests; `providerExposureCapOf` exposes readiness configuration and `openUnitsOf` matches the sum of live committed balances per pool.
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

The external/configuration ABI is frozen below. `onAttest` and `onRevoke` remain the inherited internal `SchemaResolver` overrides; EAS is their only caller. Constructors hold EAS as an immutable exactly like the existing resolvers, while all mutable configuration is owner-gated and observable.

```solidity
interface IAssessmentV3ResolverConfig {
    event SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);
    event LegacySchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    error NotAuthorizedAttester(address attester, address garden);
    error TitleRequired();
    error ConfigCIDRequired();
    error InvalidDomain(uint8 domain);
    error InvalidAssessmentKind(uint8 kind);
    error BaselineRequired();
    error BaselineForbidden();
    error InvalidBaseline(bytes32 baselineUID);
    error BaselineGardenMismatch(bytes32 baselineUID, address expectedGarden, address actualGarden);

    // implementation constructor: constructor(address eas)
    function initialize(address owner_) external;
    function setSchemaUID(bytes32 uid) external;
    function setLegacySchemaUID(bytes32 uid) external;
    function setKarmaGAPModule(address module) external; // zero disables the optional hook
    function schemaUID() external view returns (bytes32);
    function legacySchemaUID() external view returns (bytes32);
    function karmaGAPModule() external view returns (address);
    function isPayable() external pure returns (bool);
}

interface ICommunityTestimonyResolverConfig {
    event SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);
    event CommitmentModuleUpdated(address indexed oldModule, address indexed newModule);

    error NotCommunityMember(address attester, address garden);
    error TestimonyRequired();
    error InvalidCommitment(uint256 commitmentId);
    error CommitmentGardenMismatch(uint256 commitmentId, address expectedGarden, address actualGarden);

    // implementation constructor: constructor(address eas)
    function initialize(address owner_) external;
    function setSchemaUID(bytes32 uid) external;
    function setCommitmentModule(address module) external; // zero disables optional reference validation
    function schemaUID() external view returns (bytes32);
    function commitmentModule() external view returns (address);
    function isPayable() external pure returns (bool);
}
```

For both implementations: constructor calls `_disableInitializers`; `initialize` rejects zero owner, calls `__Ownable_init`, and transfers ownership; `_authorizeUpgrade` is `onlyOwner`; schema UID zero-bypass is allowed only before standalone registration and the post-deploy verifier rejects zero. `AssessmentV3Resolver.setLegacySchemaUID` rejects zero after initialization because Delta validation cannot be safe without the deployed v2 UID. Every setter emits the exact old/new event above.

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

- NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` (template `packages/contracts/script/DeployBadgeSchema.s.sol:15-73`): deploys the two resolver UUPS proxies (CREATE2 + ERC1967Proxy, `_deployAssessmentResolver` shape at `packages/contracts/test/helpers/DeploymentBase.sol:913-953`), registers both schemas with `SchemaRegistry.register(schemaString, resolverAddr, false)` against `eas.schemaRegistry` `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB` (`packages/contracts/deployments/42161-latest.json:10`), calls `AssessmentV3Resolver.setSchemaUID`, `setLegacySchemaUID(deployment.schemas.assessmentSchemaUID)`, and `setKarmaGAPModule(deployment.karmaGAPModule)`, calls `CommunityTestimonyResolver.setSchemaUID` and `setCommitmentModule(deployment.commitmentPoolingModule)` (zero only when schema PR lands before module PR; PR chain 2 must wire it before any testimony), then writes `deployments/{chainId}-commitment-schemas.json`.
- NET-NEW `packages/contracts/script/deploy/commitment-schemas.ts` (template `packages/contracts/script/deploy/badge-schemas.ts:76-168`): wraps the forge script with keystore handling and merges the result into `deployments/{chainId}-latest.json` under NEW keys only, exactly like `mergeIntoDeployment` (`badge-schemas.ts:128-168`).
- Artifact keys added (v2 keys untouched): `assessmentV3SchemaUID`, `assessmentV3Schema`, `assessmentV3Name`, `assessmentV3Description`, `communityTestimonySchemaUID`, `communityTestimonySchema`, `communityTestimonyName`, `communityTestimonyDescription`, plus top-level `assessmentV3Resolver` and `communityTestimonyResolver` addresses.
- `packages/contracts/config/schemas.json` gains sibling keys `assessmentV3` and `communityTestimony` (name, description, revocable false, fields array) so `_generateSchemaString` and its bun utility keep producing canonical strings (`packages/contracts/script/DeployHelper.sol:416-462`). The deployed `assessment` key is never edited.
- `packages/contracts/script/validate-resolver-eas.mjs` and `validate-eas-immutables.mjs` extended to cover the two new schema/resolver pairs.
- Invocation: `bun script/deploy.ts commitment-schemas --network <chain> --broadcast` wired into the existing deploy CLI dispatch next to `badge-schemas`.

#### Acceptance criteria

- Both schema strings byte-match between `config/schemas.json`-generated output and the registered on-chain schema record.
- v2 assessment attestations keep resolving and the v2 artifact keys are byte-identical before and after the merge.
- `bun run --filter @green-goods/contracts test:match -- test/unit/AssessmentV3Resolver.t.sol` covers baseline by operator (passes), delta by operator (reverts), invalid kind/domain, forbidden/missing/foreign baselineUID, setter events, zero-bypass deployment window, initializer lock, and owner-only upgrade/configuration.
- `bun run --filter @green-goods/contracts test:match -- test/unit/CommunityTestimonyResolver.t.sol` covers testimony by non-community, empty testimony, commitmentId pointing at another garden's pool when the module is wired, module-zero bypass, setter events, initializer lock, and owner-only upgrade/configuration.
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

Acceptance criteria: approval with module unset behaves byte-identically to today; approval with module set and work unlinked emits nothing from the module and still validates; approval with linked work increments the counter once; a reverting module never blocks an approval. Exact proof: `bun run --filter @green-goods/contracts test:match -- test/unit/WorkApprovalResolver.t.sol`, extended with unset/unlinked/linked/reverting-module cases, plus `bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol` for the 48-to-47 gap change.

## 7. Deployment

### 7.1 Deploy helpers

- NET-NEW `_deployCommitmentRegister(...)` and `_deployCommitmentPoolingModule(...)` in `packages/contracts/test/helpers/DeploymentBase.sol`, copying `_deployCookieJarModule` byte-for-byte in shape (implementation `new`, ERC1967Proxy init bytecode, salted CREATE2 predict + deploy-if-absent + mismatch revert; `packages/contracts/test/helpers/DeploymentBase.sol:718-759`). Register deploys first (module address zero in init), module second, wiring closes the loop.
- Call sites appended to `_deployCorePart2` after HypercertsModule (`DeploymentBase.sol:257-338` numbering continues at step 15c).
- `_wireModules` additions (`DeploymentBase.sol:341-385`):
  `commitmentRegister.setModule(module)`; `module.setGardenToken(gardenToken)`; `module.setHatsModule(hatsModule)`; `module.setActionRegistry(actionRegistry)`; `module.setCommitmentRegister(register)`; `module.setWorkApprovalResolver(workApprovalResolver)`; `module.setEAS(eas)`; `module.setSchemaUIDs(work, workApproval, legacyAssessment, assessmentV3)`; `gardenToken.setCommitmentPoolingModule(module)`; `workApprovalResolver.setCommitmentModule(module)`.

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

The runnable command contract is exact:

```sh
# From packages/contracts. These targets are added by this lane.
bun script/deploy.ts commitment-schemas --network sepolia --dry-run --pure-simulation
bun script/deploy.ts commitment-pooling --network sepolia --dry-run --pure-simulation
bun script/upgrade.ts commitment-pooling --network sepolia --dry-run --pure-simulation
bun script/deploy.ts commitment-schemas --network arbitrum --dry-run --pure-simulation
bun script/deploy.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
bun script/upgrade.ts commitment-pooling --network arbitrum --dry-run --pure-simulation

# One-shot backfill stays in the plan hub, not scripts/. It reads the deployment
# artifact, prints the root + 13 garden calls, and writes no state in dry-run mode.
bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

# Post-broadcast only, after separately authorized broadcasts and config address replacement.
bun run verify:post-deploy:sepolia
bun run verify:post-deploy:indexer:sepolia
bun run verify:post-deploy:arbitrum
bun run verify:post-deploy:indexer:arbitrum
```

`upgrade.ts commitment-pooling` upgrades exactly GardenToken and WorkApprovalResolver, verifies implementation slots and storage baselines, wires both module setters, and merges no schema keys. `backfill-pools.ts` persists a resumable result artifact at `.plans/active/commitment-pooling/artifacts/{chainId}-pool-backfill.json` keyed by garden; dry-run produces a simulation artifact under `.generated/runtime` only, while an explicitly authorized broadcast records tx hash, receipt block, and resulting poolId per garden. Deploy dry-runs write simulation output only; broadcasts merge only the named append-only keys. All invocations use bun wrappers; never raw forge (`.claude/rules/contracts.md`).

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
      - event: PoolPaused(uint256 indexed poolId, string reasonCID)
      - event: PoolResumed(uint256 indexed poolId)
      - event: PoolClosed(uint256 indexed poolId)
      - event: PoolComposted(uint256 indexed poolId)
      - event: PoolReopened(uint256 indexed poolId, bool toOpen)
      - event: CycleSeeded(uint256 indexed cycleId, uint256 indexed poolId, uint8 cycleType, uint64 startTime, uint64 endTime, string metadataCID)
      - event: CycleOpened(uint256 indexed cycleId, uint256 indexed poolId, uint16 gardenersBps, uint16 treasuryBps, uint16 operatorBps, uint16 evaluatorBps, uint16 communityBps, uint16 funderBps)
      - event: CycleClosed(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleComposted(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID)
      - event: CommitmentCreated(uint256 indexed commitmentId, uint256 indexed poolId, uint256 indexed cycleId, address creator, address recordedBy, uint8 direction, uint8 commitmentType, uint8 claimType, uint8 claimMode, uint8[] domains, uint256[] requiredActionUIDs, uint32[] requiredApprovedWorkCounts, string unitLabel, uint256 targetUnits, bool requiresAssessment, uint64 dueDate, string metadataCID, bytes32 needUID)
      - event: RewardDeclared(uint256 indexed commitmentId, address source, address token, uint256 amount)
      - event: ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold)
      - event: ClaimRequested(uint256 indexed commitmentId, address indexed claimant, address indexed requestedBy, uint8 kind, address gardenContext, uint64 requestedAt)
      - event: ClaimDeclined(uint256 indexed commitmentId, address indexed claimant, string reasonCID)
      - event: CommitmentAccepted(uint256 indexed commitmentId, address indexed claimant, address indexed counterparty, uint8 kind, address gardenContext, address provider, address providerGarden)
      - event: WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address linker)
      - event: WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker)
      - event: ApprovedWorkCounted(uint256 indexed commitmentId, bytes32 indexed workUID, bytes32 approvalUID, uint8 requirementIndex, uint32 approvedWorkCount, uint256 approvedUnits, uint256 newlyApprovedUnits)
      - event: EvidenceAttached(uint256 indexed commitmentId, string cid, address indexed attacher)
      - event: AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher)
      - event: CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason)
      - event: ConfirmationRecorded(uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold)
      - event: CommitmentFulfilled(uint256 indexed commitmentId, bool fallbackConfirmation, string reason)
      - event: CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID)
      - event: CommitmentExpired(uint256 indexed commitmentId, address indexed caller)
      - event: CommitmentDisputed(uint256 indexed commitmentId, address indexed raiser, uint8 previousState, string reasonCID)
      - event: DisputeResolved(uint256 indexed commitmentId, uint8 resolution, uint8 finalState, string reasonCID)
      - event: RewardPaid(uint256 indexed commitmentId, address indexed source, address indexed recipient, address token, uint256 amount, bytes32 payoutRef, address recordedBy)
  - name: CommitmentRegister
    handler: src/EventHandlers.ts
    events:
      - event: ClassRegistered(uint256 indexed classId, uint256 indexed poolId, string unitLabel, uint256 quota)
      - event: ProviderExposureCapUpdated(uint256 indexed poolId, uint256 cap)
      - event: UnitsCommitted(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted)
      - event: UnitsReleased(uint256 indexed classId, address indexed account, uint256 units, uint256 totalCommitted)
      - event: UnitsFulfilled(uint256 indexed classId, address indexed account, uint256 units, uint256 totalFulfilled)
```

Network entries for both `42161` and `11155111` start with the zero-address placeholder until broadcast, exactly like OctantVault today (`packages/indexer/config.yaml:81-82,104-105`), then swap to artifact addresses.

### 8.2 `schema.graphql` additions

The existing `PoolType` enum is taken by signal pools (`packages/indexer/schema.graphql:29-32`); all new enums are namespaced `Commitment*` to avoid the collision (also flagged in section 12).

```graphql
enum CommitmentPoolType { UNKNOWN GARDEN PROTOCOL }
enum CommitmentPoolState { UNKNOWN NOT_READY READY OPEN PAUSED CLOSED COMPOSTED }
enum CommitmentCycleType { UNKNOWN SEASON CAMPAIGN }
# On-chain vocabulary only. DRAFT / IN_PROGRESS / REVIEWING are derived in
# shared selectors from these states + timestamps + commitment events.
enum CommitmentCycleState { UNKNOWN SEEDED OPEN RECONCILED COMPOSTED CANCELLED }
enum CommitmentDirection { UNKNOWN OFFER REQUEST }
enum CommitmentKind { UNKNOWN DOMAIN_IMPACT SUPPORT_SERVICE SEASON_CAMPAIGN OPERATOR_CAPTURED }
# On-chain vocabulary only. DRAFT / ACTIVE / EVIDENCE_SUBMITTED /
# PARTIALLY_APPROVED / RECONCILED are derived in shared selectors.
enum CommitmentOnchainState { UNKNOWN OFFERED REQUESTED ACCEPTED READY_FOR_CONFIRMATION FULFILLED CANCELLED EXPIRED DISPUTED }
enum CommitmentClaimType { UNKNOWN GARDEN INDIVIDUAL }
enum CommitmentClaimMode { UNKNOWN OPEN APPROVAL_GATED }
enum CommitmentClaimRequestState { PENDING ACCEPTED DECLINED SUPERSEDED }
enum CommitmentEventType {
  POOL_REGISTERED POOL_CHARTER_UPDATED POOL_READY POOL_OPENED POOL_PAUSED
  POOL_RESUMED POOL_CLOSED POOL_COMPOSTED POOL_REOPENED
  CYCLE_SEEDED CYCLE_OPENED CYCLE_CLOSED CYCLE_COMPOSTED CYCLE_CANCELLED
  CREATED REWARD_DECLARED CONFIRMER_RULE_SET CLAIM_REQUESTED CLAIM_DECLINED ACCEPTED
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
  gardenId: String! # relationship: chainId-lowercaseGardenAddress
  poolType: CommitmentPoolType!
  state: CommitmentPoolState!
  charterCID: String
  pauseReasonCID: String # set by PoolPaused; cleared by PoolResumed
  openSeasonCycleId: BigInt # null when no Season is open; Campaigns may overlap
  openSeasonCycleEntityId: String # relationship: chainId-cycleId
  openCampaignIds: [BigInt!]! # event-derived raw identifiers; never enumerated on-chain
  openCampaignEntityIds: [String!]! # relationship IDs in matching order
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
  approvedUnits: BigInt!      # sum newlyApprovedUnits deltas from ApprovedWorkCounted
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
  poolEntityId: String! # relationship: chainId-poolId
  garden: String!
  gardenId: String! # relationship: chainId-lowercaseGardenAddress
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
  poolEntityId: String! # relationship: chainId-poolId
  cycleId: BigInt # null when not cycle-scoped
  cycleEntityId: String # relationship: chainId-cycleId
  garden: String!
  gardenId: String! # relationship: chainId-lowercaseGardenAddress
  creator: String!
  recordedBy: String!
  counterparty: String # null until accepted
  provider: String # immutable after acceptance: Offer creator / Request counterparty
  providerGarden: String # EAS recipient/provider role scope after acceptance
  providerGardenId: String # relationship: chainId-lowercaseProviderGarden
  counterpartyKind: CommitmentClaimType
  direction: CommitmentDirection!
  commitmentType: CommitmentKind!
  state: CommitmentOnchainState!
  claimType: CommitmentClaimType!
  claimMode: CommitmentClaimMode!
  domains: [Int!]! # optional multi-domain tags; empty is valid
  requiredActionUIDs: [BigInt!]! # positional with domains when action-bound
  unitLabel: String!
  targetUnits: BigInt!
  requiredApprovedWorkCounts: [Int!]! # positional with requiredActionUIDs (amendment 2026-07-18)
  approvedWorkCounts: [Int!]! # positional counters; totals derive in shared selectors
  approvedUnits: BigInt!
  confirmationThreshold: Int!
  confirmationCount: Int!
  confirmers: [String!]!
  requiresAssessment: Boolean!
  assessmentUID: String
  needUID: String # community Need this commitment addresses; null/zero when none (amendment 2026-07-04)
  metadataCID: String!
  workUIDs: [String!]!
  evidenceCIDs: [String!]!
  dueDate: BigInt!
  rewardSource: String
  rewardRecipient: String
  rewardToken: String
  rewardAmount: BigInt
  rewardPaid: Boolean!
  rewardPayoutRef: String
  rewardRecordedBy: String
  readyOverridden: Boolean!
  fulfilledByFallback: Boolean!
  preDisputeState: CommitmentOnchainState
  disputeReasonCID: String
  cancelReasonCID: String
  createdAt: Int!
  updatedAt: Int!
}

# Per-requirement progress read model (amendment 2026-07-18): one row per bound
# action so surfaces can render "Action × approved/required" without decoding arrays.
type CommitmentRequirement {
  id: ID! # chainId-commitmentId-requirementIndex
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String! # relationship: chainId-commitmentId
  requirementIndex: Int!
  domain: Int! # positional domains[i] from CommitmentCreated
  actionUID: BigInt! # positional requiredActionUIDs[i]
  requiredCount: Int! # positional requiredApprovedWorkCounts[i]
  approvedCount: Int! # incremented by ApprovedWorkCounted.requirementIndex
  createdAt: Int!
  updatedAt: Int!
}

type CommitmentClaimRequest {
  id: ID! # chainId-commitmentId-lowercaseClaimant
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String! # relationship: chainId-commitmentId
  claimant: String!
  requestedBy: String! # authenticated caller; differs from claimant for Garden claims
  claimType: CommitmentClaimType!
  gardenContext: String!
  gardenContextId: String! # relationship: chainId-lowercaseGardenContext
  state: CommitmentClaimRequestState!
  reasonCID: String
  resolutionCode: String # CLAIM_DECLINED / CLAIM_ACCEPTED / COMMITMENT_ACCEPTED / COMMITMENT_CANCELLED / COMMITMENT_EXPIRED
  requestedAt: Int!
  resolvedAt: Int
  updatedAt: Int!
}

# Envio handler lookup companion. The current generated entity getWhere surfaces
# are empty in this repo, so supersession uses this explicit composite-ID index
# rather than assuming a non-ID query exists at event-processing time.
type CommitmentClaimRequestIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String! # relationship: chainId-commitmentId
  requestIds: [String!]! # stable insertion order; each ID is loaded directly
  updatedAt: Int!
}

# Audit trail, one row per event (VaultEvent pattern, schema.graphql:132-144)
type CommitmentEvent {
  id: ID! # chainId-txHash-logIndex
  chainId: Int!
  poolId: BigInt!
  poolEntityId: String! # relationship: chainId-poolId
  cycleId: BigInt
  cycleEntityId: String # relationship: chainId-cycleId
  commitmentId: BigInt
  commitmentEntityId: String # relationship: chainId-commitmentId
  eventType: CommitmentEventType!
  actor: String # only an explicit event actor; never inferred from transaction.from
  units: BigInt
  data: String # reason / CID / payoutRef payload where the event carries one
  txHash: String!
  timestamp: Int!
}

# Protocol-event-only companion for Community joined reads. It indexes the
# needUID reference carried by CommitmentCreated; it does not index EAS.
type NeedCommitmentIndex {
  id: ID! # chainId-lowercaseNeedUID
  chainId: Int!
  needUID: String!
  commitmentEntityIds: [String!]!
  fulfilledCommitmentEntityIds: [String!]!
  cycleEntityIds: [String!]!
  hypercertEntityIds: [String!]!
  updatedAt: Int!
}
```

### 8.3 Handler plan

NET-NEW `packages/indexer/src/handlers/commitmentPool.ts`, registered as a side-effect import in `packages/indexer/src/EventHandlers.ts:18-25`. Patterns to copy, by name:

- **Dedup counters**: pool/cycle counters increment exactly the way `holderCount`/`grantCount` do in `packages/indexer/src/handlers/greenWill.ts:66-88` (read existing entity, branch on prior existence, never double-count).
- **Idempotency**: same-tx replay and already-exists guards as `packages/indexer/src/handlers/hypercerts.ts:38-42,71-75`.
- **Create-if-not-exists, exact defaults**: update-before-create handlers materialize placeholders instead of throwing (`createDefaultGarden` precedent, `packages/indexer/src/handlers/helpers.ts:89-110`; `.claude/rules/indexer.md`). Pool placeholders use `UNKNOWN` type/state, empty garden/gardenId/charter, empty campaign arrays, null open Season, and zero counters/timestamps except `updatedAt = event.block.timestamp`. Cycle placeholders use `UNKNOWN` type/state, zero raw IDs, composite relation IDs derived from the event when present, empty metadata, zero allocation/counters, and event timestamps. Commitment placeholders use `UNKNOWN` direction/kind/state/claim type/mode, empty strings/arrays, zero numeric counters, null optional relations/provider/reward/dispute fields, and event timestamps. A later creation event overwrites immutable placeholder facts but never resets already-applied monotonic counters or terminal state. Tests exercise each placeholder merge.
- **ID helpers**: add `getGardenId(chainId, garden)`, `getCommitmentPoolId(chainId, poolId)`, `getCommitmentCycleId(chainId, cycleId)`, `getCommitmentId(chainId, commitmentId)`, `getCommitmentClaimRequestId(chainId, commitmentId, claimant)`, `getNeedCommitmentIndexId(chainId, needUID)`, and `getCommitmentEventId(chainId, txHash, logIndex)` to `packages/indexer/src/handlers/helpers.ts`, re-exported through `packages/indexer/src/handlers/shared.ts`; composite `${chainId}-${identifier}` format throughout. Raw numeric IDs and addresses remain display/filter attributes only; every cross-entity pointer uses the corresponding `*EntityId`/`gardenId` composite field.
- **Creation payload completeness**: `CommitmentCreated` initializes `domains`, `requiredActionUIDs`, `requiredApprovedWorkCounts`, `requiresAssessment`, `metadataCID`, and `needUID` directly, and seeds one `CommitmentRequirement` row per bound action (amendment 2026-07-18). Handlers must not backfill these immutable facts from RPC reads or assume defaults that differ from the event.
- **Claim request lifecycle**: `ClaimRequested` upserts `${chainId}-${commitmentId}-${claimant}` as `PENDING` from emitted canonical claimant, `requestedBy`, kind, context, and requestedAt, then appends that ID once to `CommitmentClaimRequestIndex(${chainId}-${commitmentId}).requestIds`. `ClaimDeclined` loads the canonical claimant key and marks it `DECLINED`. `CommitmentAccepted` carries claimant/counterparty/provider/providerGarden, marks the matching claimant `ACCEPTED`, and marks other pending requests `SUPERSEDED`. Garden requests remain one row per GardenAccount even when different operators submit, while `requestedBy` preserves the actor. This intentionally avoids `getWhere` and database-wide scans.
- **Address normalization**: `normalizeAddress` for every address field (`helpers.ts:68-70`). Generic `CommitmentEvent.actor` is nullable and is populated only from an explicit actor parameter; never infer account-abstraction identity from `transaction.from`.
- **Approved-unit delta**: `ApprovedWorkCounted.approvedUnits` replaces the commitment's cumulative value; pool/cycle `approvedUnits` increment only by emitted `newlyApprovedUnits`. The handler asserts `new cumulative == prior cumulative + delta` and ignores an exact replay by event ID. It never sums cumulative event values. `requirementIndex` attributes the count to exactly one requirement: the handler writes `approvedWorkCounts[requirementIndex]` and the matching `CommitmentRequirement.approvedCount` (amendment 2026-07-18).
- **Register events** update `openExposureUnits`/`fulfilledUnits` on both `CommitmentPool` and `CommitmentCycle` plus append `CommitmentEvent` rows; `UnitsCommitted`/`UnitsReleased`/`UnitsFulfilled` carry running class totals so handlers never re-sum.
- **Need lineage**: non-zero `CommitmentCreated.needUID` appends the composite commitment/cycle IDs once to `NeedCommitmentIndex`; Fulfilled appends the commitment to `fulfilledCommitmentEntityIds`; commitment-bundled Hypercert handling appends its composite Hypercert ID. UID zero creates no index row. This is reference indexing from Green Goods events/metadata, not EAS indexing.

**Existing Garden ID migration (required, not a compatibility footnote).** Before these handlers ship, change `Garden.id` from the legacy lowercase address to `${chainId}-${lowercaseAddress}` and update every foreign key, helper, generated operation, handler lookup, shared query, fixture, and consumer. Exact relationship additions are: `GardenDomains.gardenId`; `GardenVault.gardenId`; `GardenVaultIndex.gardenId`; `VaultAddressIndex.gardenId`; `VaultDeposit.gardenId`; `VaultEvent.gardenId`; `YieldAllocation.gardenId`; `Hypercert.gardenId`; `CampaignCookieJar.sourceGardenIds`; and `Gardener.firstGardenId`/`gardenIds`, plus the new commitment/settlement fields above. Existing raw `garden`, `sourceGardens`, `firstGarden`, and `gardens` addresses remain filter/display attributes, never relationship keys. There is no mixed-ID period: deploy the schema/handlers together, perform a full Envio replay for every configured chain, run the shared query cutover against the replayed dataset, then switch consumers. Acceptance proves Arbitrum and Sepolia copies of the same address remain distinct and no raw-address Garden lookup remains.

**Generated-config preservation.** Extend both `packages/contracts/script/utils/envio-integration.ts` and `packages/indexer/scripts/check-indexing-boundary.mjs` allowlists for `CommitmentPoolingModule`, `CommitmentRegister`, and `SettlementModule`. A regression fixture must run the deployment-artifact updater twice and prove all three contract blocks and exact event signatures survive unchanged; unknown EAS or Celo token blocks must still fail the boundary check.

Run `bun codegen` in `packages/indexer` after the schema/config edits and before writing handler code (`.claude/rules/indexer.md`). Codegen acceptance includes a typed `CommitmentClaimRequestIndex` store, then the handler test must prove two pending requests become one `ACCEPTED` plus one `SUPERSEDED` without a database-wide scan.

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
- After cut-over: the bundling unit is fulfilled commitments. The mint metadata composer (shared, `corrections-log.md` §4 pointer to `packages/shared/src/modules/data/hypercerts-metadata.ts`) writes `bundleKind: "COMMITMENT"`, raw `commitmentIds`, composite `commitmentEntityIds`, and ascending unique non-zero `needUIDs`, and nests each commitment's work attestation UIDs and evidence CIDs as evidence within the IPFS metadata. Work stays visible as evidence; commitments are the impact claims.
- The legacy work-bundling path stays readable and mintable (`bundleKind: "WORK_LEGACY"`, the default when metadata carries no discriminator). Existing certificates never re-migrate.

### 9.2 Indexer entity change

```graphql
enum HypercertBundleKind { WORK_LEGACY COMMITMENT }

# Fields appended to the existing Hypercert entity (schema.graphql:190-206):
#   bundleKind: HypercertBundleKind!     (default WORK_LEGACY when absent)
#   commitmentIds: [BigInt!]             (raw chain-local identifiers; optional)
#   commitmentEntityIds: [String!]       (chainId-commitmentId relationships)
#   needUIDs: [String!]                  (ascending unique non-zero UIDs from bundled commitments)
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

Each block below is shaped as a package-level implementation surface with acceptance criteria and validation hints. Historical PRD-671..681 child issue labels roll up to the parent trackers named in `plan.todo.md`; do not create or update child Linear issues unless Afo explicitly expands the Linear footprint. Feature dependency order is contracts -> indexer/shared (coordinated after the event freeze; shared GREEN waits for generated queries) -> client/admin/docs.

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
6. First real cycle seeded and opened with an allocation preset; first commitment fulfilled with counterparty confirmation; first Arbitrum-rail `RewardPaid` recorded; first G$ reward derived from a Fulfilled commitment, executed from the registered garden Celo Safe, reported, independently verified against the Celo receipt, and visible as “support arrived” in the PWA reward row.

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
