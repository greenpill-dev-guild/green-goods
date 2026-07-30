# Commitment Pooling: Contract Spec

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Companions**: `reports/corrections-log.md` (verified repo facts, exact UIDs and addresses), `uiux-spec.md` (surface flows), `plan.todo.md` (execution plan). This spec is the contract-layer source of truth for the August release build track.

> **Amendment 2026-07-04 (approved)**: the commitment record, `CreateCommitmentParams`, and `CommitmentCreated` gain an additive `bytes32 needUID` reference (0 = none) linking a commitment to the community Need that motivated it. Additive reference field beside `assessmentUID`; no state-machine change; the module stores it as-is and never reads EAS for it. Specced before the August build starts so it ships in the initial deploy, not as an upgrade. Owning spec: `.plans/active/community-interface/spec.md` (§11).
>
> **Amendment 2026-07-09 (approved architecture contract)**: commitment domains are optional multi-domain arrays. `uint8[] domains` replaces the singular domain; `uint256[] requiredActionUIDs` is positional with domains when action-bound. `DomainImpact` requires 1–4 unique valid domains and one registered, domain-matching action UID per domain. Action UID `0` is valid in the existing registry; array presence, never a numeric sentinel, expresses whether action binding exists. Other commitment kinds may use no domains and no action UIDs. `CommitmentCreated` emits all immutable creation facts needed by Envio (`domains`, `requiredActionUIDs`, `requiresAssessment`, `metadataCID`, `needUID`). Approval-gated claims gain an indexed request entity, a commitment-keyed request index, and explicit decline/supersede semantics. This is pre-build contract shape, not a storage migration.
>
> **Readiness correction 2026-07-10 (scope-locked)**: confirmer defaults are direction-aware (Offer recipient; Request creator), pending claims persist their requested terms, disputes restore an explicit pre-dispute state, and only states with committed units release them. One Season may be open per pool while Campaigns may overlap. DomainImpact Work and assessments anchor to the accepted provider garden. The Envio/deployment contract includes a full Garden composite-ID replay, nullable event actors, and preservation tests for generated contract blocks. These are initial-deploy requirements, not upgrade migrations.
>
> **Amendment 2026-07-18 (approved, user visual-asset audit)**: per-action required counts. The scalar `requiredApprovedWorkCount`/`approvedWorkCount` pair becomes positional `uint32[] requiredApprovedWorkCounts` / `uint32[] approvedWorkCounts`, aligned with `requiredActionUIDs` (same length; the max-4 bound carries over from domains). A creator states "this promise needs [Action] × [count]" per bound action; `onWorkApproved`/`syncApprovedWork` credit the counter of the requirement whose action UID matches the approved Work; ReadyForConfirmation auto-flips only when **every** requirement meets its non-zero count (assessment predicate unchanged); `approvedUnits = floor(targetUnits × Σ min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ requiredApprovedWorkCounts)` — the single-requirement case degenerates to the previous formula. Evidence-only kinds (SupportService/StewardCaptured/SeasonCampaign) express "no work requirement" as empty or all-zero counts, preserving the prior `== 0` semantics. `ApprovedWorkCounted` gains `requirementIndex`; the indexer gains a per-requirement `CommitmentRequirement` entity. Pre-build contract shape, not a storage migration. Recorded in `reports/corrections-log.md` §10.
>
> **Amendment 2026-07-22 (approved architecture correction)**: heterogeneous commitment units never mix arithmetically. `unitLabel`, `targetUnits`, per-commitment `approvedUnits`, class quota, and committed/fulfilled class balances remain unchanged. Pool/cycle progress uses state counts; `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the only cross-commitment percentage. The register's per-pool raw-unit exposure cap becomes a concurrent commitment-count cap (`providerOpenCommitmentCap` / `providerOpenCommitmentCount`). Envio stores exact-label `CommitmentUnitSummary` rows for meaningful unit totals and `CommitmentProviderExposure` rows for the current provider count. Unit identity is exact UTF-8 bytes: `hours` and `Hours` are distinct. All affected interfaces are NET-NEW and unimplemented, so this is an initial-deploy correction with no compatibility aliases or migration.
>
> **Amendment 2026-07-28 (approved group-commitment and allocation contract; supersedes the positional requirement arrays, max-four/unique-domain rule, and singular-provider portions of the 2026-07-09/18 amendments)**: DomainImpact commitments store repeatable `CommitmentRequirement { actionUID, requiredCount }` rows. Actions may share a domain; the module derives domain tags from ActionRegistry. A named `MAX_REQUIREMENTS` replaces the accidental four-domain ceiling. The provisional value is 16, but implementation must benchmark 8/16/24/32 before freezing it. Every accepted commitment stores one accountable `leadProvider` and an event-indexed contributor roster governed by an immutable Open or LeadManaged policy. Solo is a one-contributor roster. Active contributors may receive Work/evidence credit and optional requirement assignments; the roster freezes at ReadyForConfirmation; every frozen contributor is excluded from confirmation. Only `leadProvider` consumes the register count slot. Cycle-open policy snapshots the gardeners-class within-commitment rule (default 20% equal participation + 80% verified contribution). Hypercert allowlists expand to eligible contributors rather than singular providers. Payment remains a separate settlement concern in `settlement-spec.md`.

Every technical claim below carries a repo file path (relative to repo root) or a NET-NEW marker. All contract names, functions, events, and entities introduced here are NET-NEW unless a path says otherwise. Format mirrors the house implementation-spec style of `docs/docs/builders/specs/greenwill-gif-implementation-spec-2026-03.md` (Purpose, Scope, Canonical Implementation Decisions, System Components, per-contract Contract Work, Package-Level Backlog, Launch Milestones).

---

## 1. Purpose

Translate the locked commitment-pooling architecture (27 decisions from the 2026-07-03 alignment session, plus the locked state machines and count-safe aggregate semantics from the Linear lifecycle doc) into PR-openable contract, deployment, and indexer work. An implementer should be able to open the first PR from this document without asking questions.

The system lets gardens and the protocol run pools of commitments: offers and requests of concrete support, seeded into season or campaign cycles, led by one accountable provider and fulfilled by a solo contributor or team, evidenced through the existing Work and WorkApproval rails or lightweight evidence, confirmed by counterparties who did not perform the work, and rolled up into promises-kept aggregates and fulfilled-commitment Hypercerts. Vocabulary is mutual aid throughout: offer, request, promise kept, fulfilled, steward, season, campaign, readiness, confirmation. No leaderboard semantics anywhere, ever.

## 2. Scope

### In scope

- `CommitmentPoolingModule`: control plane for pools, cycles, commitments, confirmations, disputes, reward records (NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol`).
- `CommitmentRegister`: non-transferable ERC-1155-style unit accounting companion, functionally controlled by the module (NET-NEW `packages/contracts/src/registries/Commitment.sol`).
- GardenToken wiring: one new module field packed after `openMinting` at slot 213 offset 2,
  setter, event, unchanged 37-slot gap, and live 42161 UUPS upgrade
  (`packages/contracts/src/tokens/Garden.sol`).
- WorkApprovalResolver bridge: optional non-blocking module hook on approval (`packages/contracts/src/resolvers/WorkApproval.sol`).
- Exactly two new EAS schema registrations: assessment v3 resolves through an in-place upgrade
  of the existing `AssessmentResolver`; community testimony uses one net-new resolver. Both
  register through the standalone badge-schemas path (register #14, register #26, register #53
  as amended by register #54).
- Deployment plumbing: `DeployHelper.sol` result fields, `DeploymentBase.sol` helpers, artifact keys, storage-layout baselines.
- Envio indexer plan: two new contract blocks, ten new pooling entities, one handler module; count stats and exact-label unit summaries derive from module and register events alone.
- Hypercert cut-over: `bundleKind` discriminator, fulfilled-commitment bundling, on-chain allocation-class bps at cycle open with app-computed allowlists.

### Out of scope

- Celo/G$ execution inside the core pooling module or register. August G$ split-state settlement is in scope separately via `settlement-spec.md` / PRD-686; the core pooling contracts never custody G$, call Celo, or flip `settlementEnabled`.
- Borrow-and-repay (mutual credit). A blocked follow-on companion `CreditRegister` (records-only, no-custody, interest-free) is specced separately in `../../backlog/commitment-credit-follow-on/spec.md` — additive, zero pooling-module/register changes; out of scope for this spec and not dispatchable without a new scope lock.
- Sarafu integration or any reading of Sarafu source code (AGPL clean-room, register #17; grounding is the Grassroots Economics paper and public docs only).
- Bridged G$, bridge custody/unbounded value authority, and GoodDollar rails inside the pooling module. Message-only CCIP settlement lives in the separate `SettlementModule` / `CeloSettlementExecutor` contract pair frozen by `settlement-spec.md`; no operator report or arbitrary bridge executor confirms value.
- Leaderboards, rankings, comparison views, countdown or streak mechanics of any kind.
- A separate aggregator contract (PRD-649 locked: aggregates come from events, not an on-chain aggregator).
- CookieJar contract changes (register #18: rewards are declared references plus operator-executed payouts on existing rails).
- Re-indexing EAS attestations (indexer boundary, `packages/indexer/schema.graphql:282-288`).

## 3. Canonical Implementation Decisions

Settled for v1 unless explicitly revised. Numbers in parentheses reference the locked decision register in the approved session plan.

1. **Commitments are NOT EAS attestations** (register #14). Commitment records are module-native storage plus events, shaped by the Grassroots Economics commitment-pooling register grammar. This supersedes Document A and the original PRD-649/650 "commitment schema + FulfillmentConfirmation resolver" language. EAS registrations shrink to exactly two: assessment v3 and community testimony.
2. **Module-event-driven lifecycle because EAS is not indexed.** Envio indexes only Green Goods core contracts; EAS attestations are queried from easscan directly (`packages/indexer/schema.graphql:282-288`, `reports/corrections-log.md` §2 Envio boundary row). Every commitment state, count stat, provider exposure row, and exact-label unit summary must be derivable from `CommitmentPoolingModule` and `CommitmentRegister` events alone.
3. **Hybrid state weight** (register #6). Hard transitions on-chain: pool register/ready/open/pause/close/compost, cycle seed/open/close/compost/cancel, commitment create (offer/request), accept, approved-work count, ReadyForConfirmation, confirm to Fulfilled, cancel, expire, dispute raise/resolve, reward record. Draft states live in app IndexedDB; Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, and Reconciled are derived app/indexer-side from events. Full locked vocabulary is preserved across layers (section 5 table).
4. **Two-contract shape** (register #15, register #16). `CommitmentPoolingModule` is the control plane (pool registry, cycles, curation, claim modes, permissions, stat events). `CommitmentRegister` is voucher-shaped, non-transferable, ERC-1155-style unit accounting so transferable settlement vouchers can wrap classes 1:1 on the same poolId later. Supersedes PRD-649's single-artifact V1 stance (user-approved). poolId semantics unchanged.
5. **EAS bridge** (register #5). `WorkApprovalResolver.onAttest` calls `module.onWorkApproved(...)` in try/catch (non-blocking, module optional), mirroring the existing GAP side effect (`packages/contracts/src/resolvers/WorkApproval.sol:179-183`). Operator-callable `syncApprovedWork` is the catch-up fallback. Work attestations cannot carry commitment refs (schema immutable, `reports/corrections-log.md` H2), so linkage is module-side: claimant or operator links workUID to commitmentId before or after approval; the resolver hook only counts approvals for pre-linked workUIDs. Trust model: operator-curated linkage.
6. **v3 authorship split** (register #7). Baseline assessment: evaluator OR operator (analog capture preserved, matches today's `packages/contracts/src/resolvers/Assessment.sol:114-121`). Delta/re-assessment and technical assessment: Evaluator Hat only. Community testimony: Community Hat only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:45` provides `isCommunity`).
7. **Protocol pool = root garden pool** (register #8). The root garden (`packages/contracts/deployments/42161-latest.json:40-43`: `0xf401f34378384713222d1d21f63359cc4E8a858a`, tokenId 1) anchors the protocol pool with `poolType = Protocol`. Cross-garden claiming uses one canonical identity formula: Individual claim → `claimant = requestedBy = msg.sender`; Garden claim → `claimant = gardenContext` (the GardenAccount) and `requestedBy = msg.sender` (its authenticated operator/owner). The creation-time `claimType` is immutable eligibility and must equal the runtime claim `kind`. Protocol-pool stewardship reuses root-garden Hats.
8. **Rewards are references; contributor payment is a garden-accounted plan** (register #18, superseded for group settlement by registers #63–#67). A commitment carries an explicit reward rail, token, and amount. `ArbitrumExternal` also stores its exact source for the existing operator-recorded jar/treasury reference path. `CeloSettlement` stores a zero source at creation because a protocol-pool Request has no provider garden yet; after acceptance the SettlementModule derives and stores the selected provider garden Safe as payer. That rail is ineligible for `recordRewardPaid`; protocol-to-garden support first names the provider garden, then the garden Safe funds a conserved parent plan with an explicit retained amount and contributor child payouts. Zero CookieJar changes; jars remain pull-based (`packages/contracts/src/modules/CookieJar.sol:243-296`).
9. **Claim mode per commitment** (register #19). Open claim vs approval gated, set at seeding. App-level defaults: protocol pool prefills ApprovalGated, garden campaign commitments prefill Open. The module stores what is passed.
10. **Lightweight evidence** (register #20). `EvidenceAttached(commitmentId, cid, attacher)` module event, offline-queueable. For SupportService and StewardCaptured commitments, counterparty confirmation IS the review; no separate approval step. DomainImpact keeps the full Work to WorkApproval path.
11. **Schema registration is the first PR chain of the August track** (register #26), via the standalone badge-schemas-style path (`packages/contracts/script/deploy/badge-schemas.ts`, `packages/contracts/script/DeployBadgeSchema.s.sol`), never via `--update-schemas` (which re-registers and overwrites all existing schema artifact keys, `packages/contracts/script/Deploy.s.sol:122-151`).
12. **Allocation classes on-chain as bps at cycle open**. Six-role bps snapshot (gardeners, treasury, operator, evaluator, community, funder) validated to sum exactly 10000 (precedent: `InvalidSplitRatio`, `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`. Per-address allowlist expansion stays app-computed on the existing merkle pipeline (`reports/corrections-log.md` §2 Hypercert row).
13. **Post-MVP garden-to-garden is reserved, not implemented**. `counterpartyPoolId` and `counterpartyGardenAccount` exist as reserved struct fields (always zero in MVP) so the L3 amendment is additive.
14. **Anti-farming posture from day one**: direction-aware independent confirmation (Offer recipient; Request creator), provider self-confirmation blocked on both ordinary and steward-fallback paths (mirrors `SelfAttestation`, `packages/contracts/src/resolvers/WorkApproval.sol:153-156`), operator fallback requires a visible reason, concurrent open-commitment caps in the register, and disputes restore an explicitly stored prior state.

## 4. System Components

| Component | Responsibility | Location |
|---|---|---|
| `CommitmentPoolingModule` | pool registry, cycle lifecycle, commitment records and transitions, confirmations, disputes, work linkage, evidence events, reward records | NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol` |
| `ICommitmentPoolingModule` | canonical interface, enums, structs, events, errors | NET-NEW `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol` |
| `CommitmentRegister` | non-transferable unit classes, committed/fulfilled balances, class quotas, concurrent provider-commitment caps | NET-NEW `packages/contracts/src/registries/Commitment.sol` |
| `ICommitmentRegister` | register interface | NET-NEW `packages/contracts/src/interfaces/ICommitmentRegister.sol` |
| GardenToken wiring | module field + setter + mint callback | `packages/contracts/src/tokens/Garden.sol:27-34` (module fields), `181-227` (setter block), `421-456` (phase-2 integration callbacks) |
| WorkApprovalResolver bridge | approval hook into module | `packages/contracts/src/resolvers/WorkApproval.sol:115-185` |
| `AssessmentResolver` upgrade | existing resolver gains v3-schema authorship + baseline/delta validation while continuing to resolve v2 | EXISTING UUPS `packages/contracts/src/resolvers/Assessment.sol` |
| `CommunityTestimonyResolver` | Community-Hat-gated testimony validation | NET-NEW `packages/contracts/src/resolvers/CommunityTestimony.sol` |
| Schema structs | decode layouts for the two new schemas | `packages/contracts/src/Schemas.sol` (append) |
| Schema config | canonical field lists, new keys only | `packages/contracts/config/schemas.json` (append keys `assessmentV3`, `communityTestimony`) |
| Deploy plumbing | CREATE2 proxies, wiring, artifacts | `packages/contracts/test/helpers/DeploymentBase.sol:257-338` (`_deployCorePart2`), `341-385` (`_wireModules`), `718-759` (`_deployCookieJarModule` template); `packages/contracts/script/DeployHelper.sol:42-72,276-347` |
| AssessmentResolver upgrade workflow | existing proxy implementation upgrade, v2-state preservation, and v3 setter activation | EXISTING `packages/contracts/script/upgrade.ts assessment-resolver` UUPS path; never performed by a deploy/schema script |
| Standalone schema deploy | two resumable additive registrations + CommunityTestimonyResolver deploy + append-only artifact merge | NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` + `packages/contracts/script/deploy/commitment-schemas.ts` (template: badge-schemas pair) |
| Indexer | entities + handlers for pools, cycles, commitments, units | `packages/indexer/config.yaml`, `packages/indexer/schema.graphql`, NET-NEW `packages/indexer/src/handlers/commitmentPool.ts` |
| Shared substrate | types, ABIs, hooks, job kinds (consumed by the UI/UX spec) | `packages/shared/src/types/job-queue.ts` (today exactly two kinds, `reports/corrections-log.md` §6) |

Module wiring follows the hub-and-spoke pattern: GardenToken holds the module address and calls it during mint inside try/catch so garden mint never reverts on module failure (`packages/contracts/src/tokens/Garden.sol:421-430` CookieJar precedent).

## 5. State Machines: On-Chain Functions vs Derived States

Locked vocabulary from the lifecycle doc is preserved in full. "On-chain" means a named module function performs the transition and emits the listed event. "Derived" means app/indexer computes the state from the listed events; the chain never stores it. Draft states exist only as IndexedDB drafts in the app (register #6).

### 5.1 Pool

On-chain enum: `PoolState { None, NotReady, Ready, Open, Paused, Closed, Composted }`. Every pool state is on-chain (transitions are rare, operator console actions).

| Transition | Layer | Mechanism |
|---|---|---|
| (create) -> NotReady | on-chain | `onGardenMinted(garden)` (GardenToken-only, idempotent) or `registerPool(garden, poolType)` (backfill + protocol pool). Event `PoolRegistered`. |
| NotReady -> Ready | on-chain | `markPoolReady(poolId)`, requires non-empty charter CID and a non-zero register provider-open-commitment cap. Event `PoolReady`. App additionally requires one current non-revoked Baseline assessment for the pool garden before offering the action. |
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
| Draft -> Seeded | on-chain | `seedCycle(poolId, cycleType, startTime, endTime, metadataCID)`. Event `CycleSeeded`. No allocation is stored yet. |
| Seeded -> Open | on-chain | `openCycle(cycleId, allocation, recognitionPolicy)`. The six allocation-class bps and two recognition-policy bps each sum to 10000; the call stores both immutable snapshots and emits them in `CycleOpened`. |
| Open -> InProgress | derived | Indexer/app: cycle is Open on-chain AND (first `CommitmentAccepted` with this cycleId OR block time >= startTime). |
| InProgress -> Reviewing | derived | Indexer/app: cycle Open on-chain AND block time > endTime, OR all cycle commitments in terminal or ReadyForConfirmation states. |
| Reviewing <-> InProgress | derived | New `EvidenceAttached` / `WorkLinked` / `ApprovedWorkCounted` on a cycle commitment while still Open on-chain flips back. |
| Reviewing -> Reconciled | on-chain | `closeCycle(cycleId)` (the reconcile act) requires `liveCommitmentCount == 0`; every cycle-scoped commitment must already be Fulfilled, Cancelled, or Expired. Event `CycleClosed`. Commitment-level `Reconciled` derivation hangs off this event (5.3). |
| Reconciled -> Composted | on-chain | `compostCycle(cycleId)`. Event `CycleComposted`. |
| Draft -> Cancelled | off-chain | Discard the Admin IndexedDB draft; no chain state or event exists. |
| Seeded/Open/InProgress -> Cancelled | on-chain | `cancelCycle(cycleId, reasonCID)` only when `liveCommitmentCount == 0`; event `CycleCancelled`. InProgress is derived from on-chain Open, so the same function covers it. |
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
| -> ReadyForConfirmation | on-chain | Three paths, all requiring `totalVerifiedCredits > 0` as the pre-fulfillment verified-credit predicate, requiring an Open cycle when `cycleId != 0` (cycle-less commitments use the immutable protocol 20/80 policy for contributor recognition and payout defaults only), freezing both the contributor roster and contribution-credit accounting, and emitting `ContributorRosterFrozen` before `CommitmentReadyForConfirmation`: (a) automatic inside `onWorkApproved`, `syncApprovedWork`, or the one-time `attachAssessment` call once every requirement reaches its non-zero count and any declared assessment is attached; (b) `submitForConfirmation(commitmentId)` only for SupportService, StewardCaptured, or SeasonCampaign commitments with `requirements.length == 0`, with >= 1 pre-freeze evidence record and any declared assessment attached; DomainImpact can never use this path; (c) `markReadyForConfirmation(commitmentId, reason)` steward override, reason emitted. The override may bypass requirement counts, never the recognition-policy or verified-credit prerequisites. All paths revalidate that the confirmer threshold remains reachable after excluding every contributor. |
| ReadyForConfirmation -> Fulfilled | on-chain | `confirmFulfillment(commitmentId)` by a named confirmer or the direction-aware default (Offer recipient; Request creator); each confirmation emits `ConfirmationRecorded`; reaching threshold N emits `CommitmentFulfilled`. Every frozen contributor is excluded from every confirmation path. Fallback: `confirmFulfillmentAsFallback(commitmentId, reason)` operator/owner with mandatory reason, also forbidden when the caller is a contributor. Register converts the lead provider's units (`UnitsFulfilled`). |
| Fulfilled -> Reconciled | derived | `CycleClosed` for the commitment's cycleId; cycle-less commitments (cycleId == 0) derive Reconciled from `PoolClosed`. |
| -> Cancelled | on-chain | `cancelCommitment(commitmentId, reasonCID)` from Offered/Requested (creator or steward) and Accepted (steward only; derived Active/PartiallyApproved are on-chain Accepted). Event `CommitmentCancelled`. Offered/Requested have no committed units and emit no register release; Accepted releases exactly `targetUnits`. Not allowed from ReadyForConfirmation except via dispute resolution. Envio uses the commitment request index to mark any still-Pending claim requests Superseded with terminal reason `COMMITMENT_CANCELLED`. |
| -> Expired | on-chain | `expireCommitment(commitmentId)`, permissionless, allowed once block time > dueDate (or the cycle endTime when dueDate == 0), from Offered/Requested/Accepted/ReadyForConfirmation. Event `CommitmentExpired`. Offered/Requested emit no register release; Accepted/ReadyForConfirmation release exactly `targetUnits`. Envio marks any still-Pending indexed claim requests Superseded with terminal reason `COMMITMENT_EXPIRED`. |
| -> Disputed | on-chain | `raiseDispute(commitmentId, reasonCID)` from Accepted/ReadyForConfirmation/Expired (the locked EvidenceSubmitted/PartiallyApproved entries map to on-chain Accepted). Before setting Disputed, the module stores the exact prior state in `preDisputeState`. Raiser: creator, counterparty, named confirmer, or steward. Event `CommitmentDisputed`. |
| Disputed -> previous state / Fulfilled / Cancelled / Expired | on-chain | `resolveDispute(commitmentId, RestorePrevious / Fulfilled / Cancelled / Expired, reasonCID)` steward-only. `RestorePrevious` restores the stored state. An Expired prior state may only restore Expired or resolve Cancelled; it can never resolve Fulfilled. A Fulfilled resolution applies the ordinary anti-farming guard first: a resolving steward who is on the current or already-frozen contributor roster reverts `SelfConfirmation`. It then requires the same opened-policy and `totalVerifiedCredits > 0` predicates as ReadyForConfirmation; when the pre-dispute state was not already ReadyForConfirmation, it freezes the roster and contribution-credit accounting and emits `ContributorRosterFrozen` before `DisputeResolved`. Unit effects depend on `preDisputeState`: Fulfilled converts still-committed units; Cancelled/Expired release still-committed units; no resolution releases units that Expired already released. Event `DisputeResolved` carries the restored/final state. |
| Cancelled/Expired -> Reconciled at cycle close | derived | `CycleClosed` event; no on-chain per-commitment write (no unbounded loops at close). |

Fulfillment posture (locked): the party receiving the provider's work confirms by default—Offer recipient/counterparty or Request creator/requester—provider self-confirmation is blocked, and operator/owner fallback requires a reason and is also blocked for a provider who is an operator.

## 6. Contract Work

### 6.1 `CommitmentPoolingModule`

#### Objective

One UUPS module that owns the whole commitment-pooling control plane: durable poolId per garden, cycle lifecycle, module-native commitment records, confirmations, disputes, EAS work-approval bridging, evidence and reward events.

#### Responsibilities

- Register exactly one pool per garden account (idempotent), including the protocol pool anchored to the root garden.
- Drive the three state machines exactly as tabled in section 5, emitting one event per hard transition.
- Hold commitment records: repeatable requirement rows, accountable lead, contributor policy/roster/freeze state, confirmer rule (address[] + threshold N), assessment UID ref, declared reward, claim mode, due date, unit label + target quantity, and reserved counterparty-pool fields.
- Enforce Hats-based permissions per function (gating table below) via the garden-scoped operator check copied from `packages/contracts/src/modules/Hypercerts.sol:282-287`.
- Verify EAS attestations (work, approval, assessment) via `_eas.getAttestation` when linking or
  syncing. Operational pooling never inherits the legacy resolver zero-bypass: all four module
  schema UIDs are non-zero and pairwise distinct before unpause, and every linked attestation must
  match its exact configured UID.
- Import and type the existing concrete `ActionRegistry` from `packages/contracts/src/registries/Action.sol` (the repo has no `IActionRegistry`). Validate every requirement action with its deployed ABI: `actionToOwner(actionUID) != address(0)` proves registration and `getAction(actionUID).domain` supplies the derived domain tag. Actions may share a domain. UID `0` remains valid because `ActionRegistry.registerAction` allocates from `_nextActionUID++` (`packages/contracts/src/registries/Action.sol:185-188`).
- Call the `CommitmentRegister` for every unit-count change (commit, release, fulfill).

#### Scaffold conventions (copied, not invented)

- `UUPSUpgradeable + OwnableUpgradeable + ReentrancyGuardUpgradeable`, `_disableInitializers()` constructor, initializer with owner transfer: template `packages/contracts/src/modules/CookieJar.sol:17-115`.
- `onlyGardenToken`-style authorized-caller modifier for the mint callback: `packages/contracts/src/modules/CookieJar.sol:65-68`.
- Steward gate `_requirePoolSteward(poolId)` resolves `pools[poolId].garden` and applies `hatsModule.isOperatorOf || isOwnerOf`, falling back to module owner: copy of `_requireOperator` in `packages/contracts/src/modules/Hypercerts.sol:282-287`. For the protocol pool this resolves to root-garden Hats, so the protocol team stewards it by wearing root-garden Operator hats (register #7).
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
| 24 | `contributors` | `mapping(uint256 commitmentId => mapping(address contributor => ContributorRecord))` |
| 25 | `requirementAssignments` | `mapping(uint256 commitmentId => mapping(uint16 requirementIndex => mapping(address contributor => bool)))` |
| 26 | `evidenceAttached` | `mapping(uint256 commitmentId => mapping(bytes32 cidHash => bool))` |
| 27 | `workRequirementIndexPlusOne` | `mapping(bytes32 workUID => uint16 requirementIndexPlusOne)` (0 = no DomainImpact requirement binding) |
| 28 | `workCreditCounted` | `mapping(bytes32 workUID => bool)` (one countable contributor/requirement credit per Work, regardless of how many approval attestations exist) |

Gap: `uint256[22] private __gap;` (28 named + 22 reserved = 50 total). This declaration-order
table is the implementation target; the compiler-generated storage baseline and concrete
slot/offset assertions remain authoritative at implementation time.

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

    enum CommitmentType { DomainImpact, SupportService, SeasonCampaign, StewardCaptured }

    /// @notice On-chain subset. Draft is app-side; Active, EvidenceSubmitted,
    ///         PartiallyApproved, Reconciled are derived (spec section 5.3).
    enum CommitmentState { None, Offered, Requested, Accepted, ReadyForConfirmation, Fulfilled, Cancelled, Expired, Disputed }

    /// @notice Claimant class. Garden = a GardenAccount claims (protocol pool
    ///         cross-garden reach); Individual = a hat-wearing person claims.
    enum ClaimType { Garden, Individual }

    enum ClaimMode { Open, ApprovalGated }

      enum ContributorPolicy { Open, LeadManaged }

      enum DisputeResolution { RestorePrevious, Fulfilled, Cancelled, Expired }

      enum RewardRail { None, ArbitrumExternal, CeloSettlement }

      enum ModuleDependency {
          GardenToken,
          HatsModule,
          ActionRegistry,
          CommitmentRegister,
          WorkApprovalResolver,
          EAS
      }

      enum ModuleSchemaKind { Work, WorkApproval, LegacyAssessment, AssessmentV3 }

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

    /// @notice Within the gardeners allocation class. The protocol preset is
    ///         2_000 / 8_000; values snapshot at cycle open and sum to 10_000.
    struct RecognitionPolicy {
        uint16 equalParticipationBps;
        uint16 verifiedContributionBps;
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
        RecognitionPolicy recognitionPolicy;
        uint32 liveCommitmentCount; // non-terminal cycle commitments; must be zero before close
    }

    /// @notice Declared reward is a reference, never custody (register #18).
    struct DeclaredReward {
        RewardRail rail;
        address source; // ArbitrumExternal payer; must be zero for CeloSettlement until provider selection
        address token;
        uint256 amount; // 0 = no declared reward
    }

    struct CommitmentRequirement {
        uint256 actionUID;
        uint8 domain;          // derived from ActionRegistry, never caller-authored
        uint32 requiredCount;
        uint32 approvedCount;
    }

    struct CommitmentRequirementInput {
        uint256 actionUID;
        uint32 requiredCount;
    }

    struct Commitment {
        uint256 poolId;
        uint256 cycleId;                 // 0 = not cycle-scoped
        address creator;                 // social source (StewardCaptured: the member, not the recorder)
        address counterparty;            // provider (Request) or engager (Offer); zero until Accepted
        address leadProvider;            // Offer creator; Individual Request counterparty; Garden Request requestedBy
        ClaimType counterpartyKind;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        CommitmentState state;
        ClaimType claimType;             // eligibility class set at seeding
        ClaimMode claimMode;
        ContributorPolicy contributorPolicy;
        uint8[] domains;                 // derived unique tags; not a requirement-count bound
        CommitmentRequirement[] requirements; // DomainImpact: 1..MAX_REQUIREMENTS
        uint64 dueDate;                  // 0 = cycle endTime governs
        string unitLabel;                // hours, tasks, meals, rides, plants...
        uint256 targetUnits;
        uint32 contributorCount;
        uint32 eligibleContributorCount; // contributors with pre-freeze credit; recognition additionally requires Fulfilled
        uint64 totalVerifiedCredits;      // approved Work + evidence credits, for canonical recognition validation
        uint32 evidenceCount;
        bool contributorsFrozen;
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
        address counterpartyGardenAccount;
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
        ContributorPolicy contributorPolicy;
        address onBehalfOf;              // StewardCaptured only: the member who made the promise
        uint8[] domainTags;               // non-DomainImpact optional tags; DomainImpact derives tags
        CommitmentRequirementInput[] requirements; // caller supplies only immutable requirement facts
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

    struct ContributorRecord {
        bool active;
        uint32 approvedWorkCredits;
        uint32 evidenceCredits;
    }

    struct RecognitionEntry {
        address contributor;
        uint16 recognitionWeightBps;
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
    /// @notice Allocation-class bps ride in the open event (register #12).
    event CycleOpened(
        uint256 indexed cycleId,
        uint256 indexed poolId,
        uint16 gardenersBps,
        uint16 treasuryBps,
        uint16 operatorBps,
        uint16 evaluatorBps,
        uint16 communityBps,
        uint16 funderBps,
        uint16 equalParticipationBps,
        uint16 verifiedContributionBps
    );
    event CycleClosed(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleComposted(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID);

    event CommitmentCreated(
        uint256 indexed commitmentId,
        uint256 indexed poolId,
        uint256 indexed cycleId,
        address creator,
        address recordedBy,          // msg.sender; differs from creator for StewardCaptured
        CommitmentDirection direction,
        CommitmentType commitmentType,
        ClaimType claimType,
        ClaimMode claimMode,
        ContributorPolicy contributorPolicy,
        uint8[] domains,
        uint256[] requirementActionUIDs,
        uint8[] requirementDomains,
        uint32[] requirementRequiredCounts,
        string unitLabel,
        uint256 targetUnits,
        bool requiresAssessment,
        uint64 dueDate,
        string metadataCID,
        bytes32 needUID              // 0 = none; non-indexed (3-indexed budget spent); Envio reads params regardless (amendment 2026-07-04)
    );
    event RewardDeclared(
        uint256 indexed commitmentId,
        RewardRail rail,
        address source,
        address token,
        uint256 amount
    );
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
        address leadProvider,
        address providerGarden
    );
    event ContributorAdded(
        uint256 indexed commitmentId,
        address indexed contributor,
        address indexed addedBy
    );
    event ContributorRemoved(
        uint256 indexed commitmentId,
        address indexed contributor,
        address indexed removedBy
    );
    event ContributorRequirementAssigned(
        uint256 indexed commitmentId,
        address indexed contributor,
        uint16 indexed requirementIndex,
        bool assigned
    );
    event ContributorRosterFrozen(uint256 indexed commitmentId, uint32 contributorCount);
    event WorkLinked(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        uint16 requirementIndex,
        address linker
    );
    event WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker);
    /// @notice Unit-count change event. requirementIndex is the matched
    ///         requirement and contributor is the active Work attester.
    ///         approvedUnits is the new cumulative integer floor over the
    ///         requirement rows; newlyApprovedUnits is its delta.
    event ApprovedWorkCounted(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        bytes32 approvalUID,
        uint16 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 newlyApprovedUnits
    );
    /// @notice Lightweight evidence (register #20); offline-queueable write.
    event EvidenceAttached(
        uint256 indexed commitmentId,
        string cid,
        address indexed attacher,
        address[] creditedContributors
    );
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
    /// @notice Payout executed on existing rails and recorded here (register #18).
      event RewardPaid(
          uint256 indexed commitmentId,
        address indexed source,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 payoutRef,
          address recordedBy
      );
      event ModuleDependencyUpdated(
          ModuleDependency indexed dependency,
          address indexed previousAddress,
          address indexed newAddress
      );
      event ModuleSchemaUIDUpdated(
          ModuleSchemaKind indexed schemaKind,
          bytes32 previousUID,
          bytes32 newUID
      );
      event ModulePauseStatusChanged(bool previousPaused, bool paused);

    // ═════════════════════════════ Errors ════════════════════════════

    error UnauthorizedCaller(address caller);
    error NotPoolSteward(address caller, uint256 poolId);
      error ModulePaused();
      error ModuleMustBePaused();
      error ModuleNotReady();
      error ZeroAddress();
      error SchemaUIDRequired(ModuleSchemaKind schemaKind);
      error SchemaUIDCollision(bytes32 uid);
    error PoolExists(address garden);
    error UnknownPool(uint256 poolId);
    error PoolNotInState(uint256 poolId, PoolState actual);
    error CharterRequired(uint256 poolId);
    error UnknownCycle(uint256 cycleId);
    error CycleNotInState(uint256 cycleId, CycleState actual);
    error CyclePoolMismatch(uint256 cycleId, uint256 expectedPoolId, uint256 actualPoolId);
    error CycleNotAcceptingCommitments(uint256 cycleId, CycleState actual);
    error CycleHasLiveCommitments(uint256 cycleId, uint32 liveCommitmentCount);
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
      error TooManyConfirmers(uint256 supplied, uint256 maximum);
    error InvalidWorkAttestation(bytes32 workUID);
    error InvalidApprovalAttestation(bytes32 approvalUID);
    error InvalidAssessmentAttestation(bytes32 assessmentUID);
    error AssessmentAlreadyAttached(uint256 commitmentId, bytes32 assessmentUID);
    error WorkAlreadyLinked(bytes32 workUID);
    error ApprovalAlreadyCounted(bytes32 approvalUID);
    error WorkNotLinkedToCommitment(bytes32 workUID, uint256 commitmentId);
    error EvidenceRequired(uint256 commitmentId);
    error EvidenceCIDRequired();
    error EvidenceAlreadyAttached(uint256 commitmentId, bytes32 cidHash);
    error EvidenceContributorsRequired();
    error TooManyEvidenceContributors(uint256 supplied, uint256 maximum);
    error TooManyContributors(uint256 supplied, uint256 maximum);
    error AssessmentRequired(uint256 commitmentId);
    error WorkApprovalRequired(uint256 commitmentId);
    error OpenCommitmentCapRequired(uint256 poolId);
    error NotDue(uint256 commitmentId);
    error RewardAlreadyRecorded(uint256 commitmentId);
    error RewardNotDeclared(uint256 commitmentId);
    error RewardRailMismatch(uint256 commitmentId, RewardRail expected, RewardRail actual);
    error InvalidRewardConfiguration();
      error ReasonRequired();
      error UnitLabelRequired();
      error TargetUnitsRequired();
      error InvalidDomains();
    error InvalidRequirementCount(uint256 requirementIndex);
    error TooManyRequirements(uint256 supplied, uint256 maximum);
    error ContributorAlreadyActive(address contributor);
    error ContributorNotActive(address contributor);
    error ContributorRosterFrozen(uint256 commitmentId);
    error ContributorPolicyMismatch(uint256 commitmentId);
    error LeadContributorCannotLeave(uint256 commitmentId);
    error ContributorHasCredit(address contributor);
    error NoEligibleContributors(uint256 commitmentId);
    error RecognitionPolicyUnavailable(uint256 cycleId);
    error InvalidRequirementAssignment(uint256 requirementIndex, address contributor);
    error ConfirmationThresholdUnreachable(uint256 commitmentId);
    error UnknownAction(uint256 actionUID);
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
    ///         Open to open a cycle. The allocation is supplied atomically at
    ///         open and must sum to 10_000.
    function seedCycle(
        uint256 poolId,
        CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataCID
    ) external returns (uint256 cycleId);
    function openCycle(
        uint256 cycleId,
        AllocationBps calldata allocation,
        RecognitionPolicy calldata recognitionPolicy
    ) external;
    /// @notice Reconciliation is O(1): the cycle must be Open and its
    ///         liveCommitmentCount must be zero. Creation increments the count
    ///         for a non-zero cycle; Fulfilled, Cancelled, or Expired decrements
    ///         it exactly once. ReadyForConfirmation and Disputed remain live.
    function closeCycle(uint256 cycleId) external;
    function compostCycle(uint256 cycleId) external;
    /// @dev Requires liveCommitmentCount == 0 so cancellation cannot strand commitments.
    function cancelCycle(uint256 cycleId, string calldata reasonCID) external;

    // ══════════════════════ Commitments ══════════════════════════════

    /// @notice Gating by commitment type (creation authority, locked):
    ///         members create own offers/requests (any of the six garden role
    ///         hats in the pool garden, IHatsModule.GardenRole);
    ///         SeasonCampaign and StewardCaptured require pool steward;
    ///         protocol-pool commitments require root-garden steward or module owner.
    ///         StewardCaptured must set onBehalfOf (the member stays the
    ///         social source; msg.sender is recorded as recordedBy in the event).
    function createCommitment(CreateCommitmentParams calldata params) external returns (uint256 commitmentId);

    /// @notice Forwards to the module-only register setter. Gating: pool
    ///         steward; cap is a non-zero concurrent commitment count and is
    ///         required before markPoolReady.
    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external;

    /// @notice Gating: pool steward, pre-acceptance only.
    function setDeclaredReward(uint256 commitmentId, DeclaredReward calldata reward) external;
    function setConfirmerRule(uint256 commitmentId, address[] calldata confirmers, uint32 threshold) external;

    /// @notice Claim eligibility (register #7, register #8):
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

    /// @notice Open-policy self-join. The caller must satisfy the same
    ///         garden-membership/provider-garden gate as a Work author.
    function joinCommitment(uint256 commitmentId) external;

    /// @notice Open-policy self-exit. Only an active non-lead contributor with
    ///         zero approved Work and evidence credit may leave before freeze.
    function leaveCommitment(uint256 commitmentId) external;

    /// @notice LeadManaged roster mutation. The lead provider or pool steward
    ///         may add/remove contributors before the roster freezes. A credited
    ///         contributor cannot be removed through roster editing.
    function addContributor(uint256 commitmentId, address contributor) external;
    function removeContributor(uint256 commitmentId, address contributor) external;

    /// @notice Optional planning signal; assignment is not recognition credit.
    function setContributorRequirement(
        uint256 commitmentId,
        address contributor,
        uint16 requirementIndex,
        bool assigned
    ) external;

    // ─────────────── Work linkage + EAS bridge (register #5) ─────────

    /// @notice Link a Work attestation to a commitment before or after its
    ///         approval. Verifies via eas.getAttestation: schema == workSchemaUID,
    ///         recipient == providerGarden. DomainImpact additionally requires
    ///         decoded Work.actionUID in the explicitly selected stored requirement. The Work
    ///         attester must be an active contributor and satisfy the
    ///         providerGarden role scope. One work maps to at most one
    ///         commitment; one commitment maps to many works.
    ///         Gating: active contributor, lead provider, or pool steward;
    ///         on-chain state Accepted and contributorsFrozen == false.
    function linkWork(uint256 commitmentId, bytes32 workUID, uint16 requirementIndex) external;

    /// @notice Gating: pool steward; only while the approval is not yet counted.
    function unlinkWork(bytes32 workUID) external;

    /// @notice Called by WorkApprovalResolver inside try/catch after full
    ///         approval validation (WorkApproval.sol:179-183 GAP precedent).
    ///         No-op (returns without revert) when the workUID is unlinked, the
    ///         approvalUID was already observed, this Work already produced
    ///         its one countable credit, or the commitment's contribution
    ///         ledger is frozen. A first approval after freeze is recorded as
    ///         observed through approvalCounted but never changes Work credit,
    ///         requirement progress, units, or recognition. Never reverts on
    ///         state it does not recognize: the approval must stand regardless.
    ///         Gating: workApprovalResolver only.
    function onWorkApproved(bytes32 workUID, bytes32 approvalUID, address garden) external;

    /// @notice Operator-callable catch-up when the resolver hook was missed
    ///         (module wired after approvals, or work linked after approval).
    ///         Verifies each approvalUID via eas.getAttestation: schema ==
    ///         workApprovalSchemaUID, decoded approved == true, decoded workUID
    ///         linked to this commitmentId, recipient == providerGarden; records
    ///         each approvalUID for idempotency but credits each workUID at most
    ///         once through workCreditCounted and only while the commitment is
    ///         Accepted and unfrozen. Gating: pool steward.
    function syncApprovedWork(uint256 commitmentId, bytes32[] calldata approvalUIDs) external;

    /// @notice Canonical recognition validator shared by Hypercert composition
    ///         and SettlementModule. Recomputes the complete sorted vector from
    ///         the frozen on-chain roster, credit counters, and either the
    ///         opened cycle policy or immutable cycle-less 20/80 protocol
    ///         policy; rejects zero eligible rows, unavailable policy,
    ///         omissions, caller-selected weights, and hash mismatch.
    function validateRecognitionSnapshot(
        uint256 commitmentId,
        RecognitionEntry[] calldata entries,
        bytes32 suppliedHash
    ) external view returns (bytes32 canonicalHash);

    // ─────────────── Evidence, assessment, confirmation ──────────────

    /// @notice Gating: active contributor, lead provider, or pool steward; the
    ///         commitment must still be Accepted and its roster/credit ledger
    ///         unfrozen. The non-empty exact CID may be attached only once per
    ///         commitment. The credited list is non-empty, unique, bounded,
    ///         and every address must be active. Credits are recorded now and
    ///         become recognition-eligible only after Fulfilled.
    ///         Offline-queueable; a job that lands after freeze fails visibly
    ///         and never changes credit.
    function attachEvidence(
        uint256 commitmentId,
        string calldata cid,
        address[] calldata creditedContributors
    ) external;

    /// @notice Verifies via eas.getAttestation: schema is legacyAssessmentSchemaUID
    ///         or assessmentV3SchemaUID, recipient == providerGarden.
    ///         Gating: Accepted, contributor roster and credit accounting
    ///         unfrozen, no assessment previously attached, and caller is the
    ///         pool steward or garden evaluator. The UID is write-once.
    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external;

    /// @notice Path (b) to ReadyForConfirmation: SupportService,
    ///         StewardCaptured, or SeasonCampaign commitments with no work
    ///         requirement (requirements is empty);
    ///         requires >= 1 pre-freeze evidence record,
    ///         totalVerifiedCredits > 0, and any declared assessment.
    ///         DomainImpact always reverts WorkApprovalRequired. Gating:
    ///         counterparty, creator, or steward.
    function submitForConfirmation(uint256 commitmentId) external;

    /// @notice Path (c): steward override with visible reason.
    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external;

    /// @notice Gating: a named confirmer, or Offer counterparty / Request creator
    ///         under the direction-aware default. No frozen contributor can
    ///         confirm the team's fulfillment.
    function confirmFulfillment(uint256 commitmentId) external;

    /// @notice Gating: pool steward; reason mandatory (fallback stays visible).
    ///         Reverts SelfConfirmation when the steward is a contributor.
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
    function getRequirement(
        uint256 commitmentId,
        uint16 requirementIndex
    ) external view returns (CommitmentRequirement memory);
    function getContributor(
        uint256 commitmentId,
        address contributor
    ) external view returns (ContributorRecord memory);
    function isContributor(uint256 commitmentId, address contributor) external view returns (bool);
    function isEligibleContributor(
        uint256 commitmentId,
        address contributor
    ) external view returns (bool); // Fulfilled + frozen active roster + Work/evidence credit
    function getPendingClaim(uint256 commitmentId, address claimant) external view returns (PendingClaim memory);
    function getConfirmers(uint256 commitmentId) external view returns (address[] memory);
    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId);
    function isApprovalCounted(bytes32 approvalUID) external view returns (bool);
    function isEvidenceAttached(uint256 commitmentId, bytes32 cidHash) external view returns (bool);
    function MAX_CONFIRMERS() external pure returns (uint256);
    function MAX_REQUIREMENTS() external pure returns (uint256);
    function MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT() external pure returns (uint256);
    function MAX_CONTRIBUTORS_PER_COMMITMENT() external pure returns (uint256);
    function cyclelessRecognitionPolicy() external pure returns (RecognitionPolicy memory);
    function paused() external view returns (bool);

    // ══════════════════════ Admin (module owner) ═════════════════════

    /// @notice Initializes with paused == true. Configuration is completed
    ///         through the paused-only setters before the first unpause.
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
    /// @notice Pausing is always available to the owner. Unpause requires all
    ///         six dependencies plus four non-zero, pairwise-distinct schema
    ///         UIDs and otherwise reverts ModuleNotReady.
    function setPaused(bool paused) external;
}
```

#### Permission matrix (the gating table)

Consolidated view of every mutating entry point across both pooling contracts, the upgraded
existing `AssessmentResolver`, and the net-new `CommunityTestimonyResolver`; the per-function doc
comments in the interface above remain the enforcement detail. Role legend: **steward** = pool
steward via `_requirePoolSteward` (garden operator/owner through hatsModule, module owner fallback;
the protocol pool resolves to root-garden hats). **member** = wearer of any of the six garden role
hats (`IHatsModule.GardenRole`) in the relevant garden. Pause interplay: the initializer sets
`paused = true`. Module pause blocks operational mutations but never `setPaused`,
`cancelCommitment`, `expireCommitment`, or `resolveDispute`; owner dependency/schema setters are
callable **only while paused**. `setPaused(false)` fails closed until all six dependency addresses
and all four non-zero, pairwise-distinct schema UIDs are configured. Pool-level Paused additionally
blocks new commitments, claims, Ready submissions, and confirmations on that pool only.

| Group | Function | Authorized caller | State / other gates |
|---|---|---|---|
| Pool | `onGardenMinted` | GardenToken only | idempotent; creates a Garden-type pool in NotReady |
| Pool | `registerPool` | Protocol type: module owner · Garden type: garden operator/owner or module owner | one pool per garden (`PoolExists`) |
| Pool | `setPoolCharter` | steward | — |
| Pool | `markPoolReady` | steward | NotReady only; charter CID non-empty; non-zero provider open-commitment cap already set in the register. The app additionally requires one current non-revoked Baseline assessment (v2 or v3, recipient = pool garden, resolver-validated Baseline kind) before enabling this write. |
| Pool | `openPool` / `pausePool` / `resumePool` / `closePool` / `compostPool` / `reopenPool` | steward | transitions exactly per the §5.1 table; pause reason CID mandatory and indexed until resume |
| Cycle | `seedCycle` | steward | pool Ready or Open; valid time window; allocation is not accepted or stored |
| Cycle | `openCycle` | steward | pool Open; cycle Seeded; supplied allocation-class bps sum == 10_000; recognition-policy bps sum == 10_000 (protocol default 2_000 equal / 8_000 verified); both become immutable; Season requires `openSeasonCycleId == 0`, Campaigns may overlap |
| Cycle | `closeCycle` / `compostCycle` | steward | Open → Reconciled → Composted |
| Cycle | `cancelCycle` | steward | from Seeded or Open; reason CID; `liveCommitmentCount == 0` |
| Commitment | `createCommitment` | own Offer/Request: member of the pool garden · SeasonCampaign + StewardCaptured: steward · protocol-pool commitments: root-garden steward or module owner | pool Open; non-empty exact `unitLabel`; non-zero `targetUnits`; `cycleId == 0` or cycle exists in the same pool; member-created commitments require an Open cycle, while steward seeding permits Seeded or Open; StewardCaptured must set `onBehalfOf`; DomainImpact requires 1–`MAX_REQUIREMENTS` repeatable action requirements with non-zero counts and ActionRegistry-derived domain tags; non-DomainImpact kinds may use optional domain tags and no requirements |
| Commitment | `setDeclaredReward` / `setConfirmerRule` | steward | pre-acceptance only; zero amount requires `RewardRail.None` plus zero source/token; non-zero `ArbitrumExternal` requires non-zero source/token; non-zero `CeloSettlement` requires zero source plus canonical G$ token because its payer is derived from the accepted provider garden |
| Commitment | `claimCommitment` | garden pool: member of the pool garden · protocol pool ClaimType.Garden: operator/owner of the claiming garden (`gardenContext`) · protocol pool ClaimType.Individual: member of `gardenContext` | runtime kind equals stored claimType; canonical claimant is caller for Individual and `gardenContext` for Garden; `requestedBy` is caller; claimant != creator; Open accepts, ApprovalGated emits `ClaimRequested` |
| Commitment | `acceptClaim` | steward | ApprovalGated path; consumes the stored kind/gardenContext and re-validates eligibility |
| Commitment | `declineClaim` | steward | ApprovalGated pending request; mandatory reason; claimant may request again later |
| Contributors | `joinCommitment` | eligible member | Accepted only; contributor policy Open; caller becomes active; roster not frozen; max-contributor guard runs before mutation |
| Contributors | `leaveCommitment` | active contributor | Accepted and Open-policy only; roster not frozen; caller is not the lead and has zero Work/evidence credit; every mutation revalidates confirmer reachability |
| Contributors | `addContributor` / `removeContributor` | lead provider or steward | Accepted only; contributor policy LeadManaged for add unless steward correction; roster not frozen; max-contributor guard runs before add; lead or any credited contributor cannot be removed; every mutation revalidates confirmer reachability |
| Contributors | `setContributorRequirement` | lead provider or steward | Accepted only; active contributor; valid requirement index; roster not frozen; assignment is planning metadata, never contribution credit |
| Linkage | `linkWork` | active contributor, lead provider, or steward | Accepted only; verifies schema, providerGarden recipient, explicit DomainImpact requirement index/action match, and that the Work attester is an active contributor; one work maps to at most one commitment |
| Linkage | `unlinkWork` | steward | only while the approval is not yet counted |
| Linkage | `onWorkApproved` | WorkApprovalResolver only | never reverts; no-op when unlinked or already counted |
| Linkage | `syncApprovedWork` | steward | verifies each approval on EAS; dedupes via `approvalCounted` |
| Evidence | `attachEvidence` | active contributor, lead provider, or steward | offline-queueable; CID is non-empty and exact-CID-de-duplicated per commitment; credited list is non-empty, unique, at most `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT`, and every credited address is active |
| Evidence | `attachAssessment` | steward or evaluator of providerGarden | Accepted and roster/credit accounting unfrozen; existing `assessmentUID` must be zero (`AssessmentAlreadyAttached` otherwise); verifies assessment attestation (v2 or v3 UID; recipient == providerGarden); if the non-zero Work threshold was already met, re-runs the automatic Ready predicate. No post-readiness replacement path exists |
| Confirmation | `submitForConfirmation` | counterparty, creator, or steward | SupportService/StewardCaptured/SeasonCampaign only; `requirements.length == 0`; at least 1 pre-freeze evidence record; declared assessment attached; DomainImpact rejected |
| Confirmation | `markReadyForConfirmation` | steward | override path; reason emitted and visible |
| Confirmation | `confirmFulfillment` | named confirmer, Offer counterparty, or Request creator | state ReadyForConfirmation; every frozen contributor is blocked (`SelfConfirmation`); once per confirmer (`AlreadyConfirmed`) |
| Confirmation | `confirmFulfillmentAsFallback` | steward | mandatory reason; contributor-steward is blocked (`SelfConfirmation`) |
| Exit | `cancelCommitment` | creator or steward (from Offered/Requested) · steward only (from Accepted) | reason CID; never from ReadyForConfirmation except via dispute resolution; allowed while module paused |
| Exit | `expireCommitment` | anyone (permissionless) | past dueDate, or cycle endTime when dueDate == 0 |
| Dispute | `raiseDispute` | creator, counterparty, named confirmer, or steward | from Accepted / ReadyForConfirmation / Expired |
| Dispute | `resolveDispute` | steward | RestorePrevious or terminal resolution; Expired cannot become Fulfilled; a direct Fulfilled result rejects a resolving steward who is a contributor (`SelfConfirmation`); allowed while module paused |
| Recognition | `validateRecognitionSnapshot` | public view | commitment Fulfilled with frozen roster; exact sorted vector length equals `eligibleContributorCount`; every unique row is eligible; weights are recomputed from the immutable cycle policy and credit counters; supplied/canonical hashes must match |
| Reward | `recordRewardPaid` | steward | state Fulfilled; `reward.rail == ArbitrumExternal`; single record per commitment in MVP. `CeloSettlement` reverts and is owned exclusively by SettlementModule |
| Module dependency/schema admin | `setGardenToken` / `setHatsModule` / `setActionRegistry` / `setCommitmentRegister` / `setWorkApprovalResolver` / `setEAS` / `setSchemaUIDs` | module owner | module must be paused; dependency addresses reject zero; schema UIDs reject zero and pairwise collision; every accepted change emits old/new configuration facts |
| Module pause admin | `setPaused` | module owner | initialize paused; pausing is always allowed; unpause requires all six dependencies plus all four non-zero, pairwise-distinct schema UIDs and emits old/new pause state |
| Module limiting admin | `setProviderOpenCommitmentCap` | pool steward | non-zero concurrent commitment count; module forwards to the register; required before Ready |
| Register | `registerClass` / `setProviderOpenCommitmentCap` / `commitUnits` / `releaseUnits` / `fulfillUnits` | CommitmentPoolingModule only (`NotModule`) | class quota is immutable at creation (`targetUnits`); only the accountable lead provider is the exposure/count subject (§6.2) |
| Register admin | `setModule` | register owner (protocol multisig) | new module rejects zero; initial zero → non-zero wiring is allowed once; every later replacement requires the current module to be paused and emits `ModuleUpdated(old,new)` |
| Assessment config | existing `setSchemaUID` / existing `setKarmaGAPModule` / new `setAssessmentV3SchemaUID` | existing AssessmentResolver owner (protocol multisig) | v2 selector/event and deployment-window zero value remain compatible; KarmaGAP zero disables its optional hook; v2/v3 UID equality is rejected; v3 UID rejects zero and emits old/new |
| Community Testimony config | `setSchemaUID` / `setCommitmentModule` | CommunityTestimonyResolver owner (protocol multisig) | UID rejects zero, pins once, treats an exact repeat as a no-op, and rejects conflict; module rejects zero and an unpinned UID; preparation pins the deterministic UID while module is zero, finalization reconciles the exact EAS record, and verified module activation is last |
| Upgrades | `_authorizeUpgrade` on module, register, upgraded AssessmentResolver, and net-new CommunityTestimonyResolver | respective owner (protocol multisig) | UUPS convention repo-wide; existing Assessment initializer is never re-run |

EAS authorship, enforced by the resolvers (§6.4.3), for completeness of the access-control picture:

| Attestation | Authorized attester |
|---|---|
| Assessment v3 — Baseline | garden evaluator OR operator (analog capture preserved, v2 parity) |
| Assessment v3 — Delta / Technical | garden evaluator only |
| Community testimony | Community Hat only (first real attestation gate for that hat) |
| Work / WorkApproval (existing) | unchanged: gardener-or-operator / operator with no self-attestation |

#### Behavior notes an implementer must not miss

- **Confirmer rule storage and loop bound**: `MAX_CONFIRMERS = 32`. `createCommitment` and
  `setConfirmerRule` reject `confirmers.length > MAX_CONFIRMERS` with
  `TooManyConfirmers(supplied, maximum)` before class registration, commitment storage, or event
  emission. Empty means Offer counterparty or Request creator, threshold 1. At acceptance, the
  now-bounded named group is de-duplicated and every active contributor is excluded. Every later
  contributor mutation revalidates the group against the contributor-membership mapping. The module
  persists and emits the resolved group; acceptance reverts `InvalidConfirmerRule` when the
  threshold exceeds remaining eligible addresses. A roster mutation reverts
  `ConfirmationThresholdUnreachable` before state changes when too few non-contributor confirmers
  would remain. The named group is data, not a hat.
- **Lead-provider identity (one formula everywhere)**: acceptance stores the Offer creator for
  every Offer; an Individual Request stores the accepted counterparty; and a Garden-claimed
  Request stores the accepted pending claim's authenticated `requestedBy` operator/owner.
  `counterparty` remains the GardenAccount for that Garden claim and `providerGarden` remains the
  group scope. The resolved lead is immediately activated as the first contributor.
  The lead provider alone is the `CommitmentRegister` account and open-commitment-count subject.
  `counterparty` remains the accepted recipient for an Offer and the accepted claimant for a
  Request; only the Garden-Request exception resolves its human lead from stored `requestedBy`.
- **Contributor roster**: contributor membership is event-indexed and incrementally mutated and
  is never coupled to the four-value domain enum. `MAX_CONTRIBUTORS_PER_COMMITMENT` is
  provisionally 32 and is enforced before lead initialization, self-join, or add mutates state;
  implementation benchmarks 8/16/24/32 and freezes the largest measured-safe end-to-end
  creation/finalization vector. Open policy allows eligible self-join and pre-freeze self-leave;
  LeadManaged requires the lead or steward. The lead can never leave or be removed, and any
  contributor with approved Work or evidence credit can be removed only through a separately
  specified reasoned correction that preserves attribution and confirmation exclusion, not the
  roster edit API. Membership,
  requirement assignment, Work credit, and evidence credit are distinct. Assignment expresses
  planned responsibility only. Work credit is derived from the approved Work attester; evidence
  credit is recorded once when the exact CID is attached and contributes to eligibility only
  after the commitment is fulfilled.
  The transition to ReadyForConfirmation emits `ContributorRosterFrozen` atomically before the
  ready event and freezes both roster membership and contribution-credit accounting. No
  add/remove/assignment, new evidence credit, new Work link, or late approval credit is valid
  afterward.
- **Evidence identity and bounded crediting**: `attachEvidence` rejects an empty CID, hashes the exact CID bytes, and
  rejects a repeated `(commitmentId, cidHash)` before any counter or event mutation. It requires
  1 through `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` unique active contributors, increments
  `Commitment.evidenceCount` once, and increments each credited contributor's `evidenceCredits`
  once only while the commitment is on-chain Accepted and `contributorsFrozen == false`; a queued
  attachment that lands after freeze reverts without writing the CID or any credit. The
  provisional bound is 32 and must be checked against 8/16/24/32 gas and event-payload
  benchmarks before implementation freezes it. The bound is transaction safety, not a product
  rule limiting team size. `isEligibleContributor` additionally requires the commitment to be
  `Fulfilled`, so attachment records attribution without treating unconfirmed work as verified.
- **Cycle terminal safety**: creating any commitment with `cycleId != 0` increments that Cycle's
  `liveCommitmentCount`. The first transition to Fulfilled, Cancelled, or Expired decrements it
  exactly once; a dispute preserves whether the pre-dispute commitment was already terminal, so
  resolving an already Expired record cannot decrement twice. ReadyForConfirmation remains live.
  `closeCycle` and `cancelCycle` require the O(1) count to be zero, which forces stewards to
  confirm, cancel, or expire every cycle commitment before reconciliation or cycle cancellation
  and prevents a later fulfillment from changing the certified recognition set.
- **Self-checks**: `claimCommitment` reverts `SelfCounterparty` when claimant == creator.
  `confirmFulfillment` and fallback confirmation revert `SelfConfirmation` for every active
  contributor in the frozen roster, mirroring the existing WorkApproval separation-of-duties
  rule rather than checking only one provider.
- **Register coupling**: `createCommitment` rejects an empty exact `unitLabel` or zero
  `targetUnits`, then registers the class with immutable quota `targetUnits` and accounting state
  `Registered`. A pool steward configures the non-zero per-pool provider open-commitment cap
  through the module forwarder before `markPoolReady`; the register itself remains module-only.
  Acceptance calls `commitUnits(commitmentId, commitment.leadProvider, targetUnits)`. The register
  accepts only the full non-zero quota from `Registered`, changes the class to `Committed`, and
  increments that provider's open commitment count exactly once. Cancel/expiry release only from
  Accepted/ReadyForConfirmation (or a Disputed record whose prior state held units), always
  against `commitment.leadProvider`; `releaseUnits` accepts only the full live committed balance from
  `Committed`, changes the class to `Released`, and decrements once. Fulfillment applies the same
  full-balance guard, changes the class to `Fulfilled`, and decrements once. `Released` and
  `Fulfilled` are terminal register states, so a module upgrade or erroneous repeat call cannot
  reacquire or release the slot. Offered/Requested never release. Raising or restoring a dispute
  makes no register call and preserves the pre-dispute slot state.
- **Canonical claim identity + traceability**: creation-time `claimType` is immutable eligibility; `claimCommitment` reverts `ClaimTypeMismatch` when runtime `kind` differs. Individual: `claimant = requestedBy = msg.sender`. Garden: `claimant = gardenContext`, `requestedBy = msg.sender`, after operator/owner authorization. The module stores `{claimant, requestedBy, kind, gardenContext, requestedAt, active}` keyed by `(commitmentId, canonical claimant)` and rejects an active duplicate. `acceptClaim`/`declineClaim` consume that key. Envio marks accepted and sibling requests without an arbitrary scan.
- **Provider-garden anchor**: acceptance stores `providerGarden` (Offer: pool garden; Request:
  accepted claimant's validated gardenContext) and emits both `leadProvider` and `providerGarden`
  in `CommitmentAccepted`. DomainImpact Work must use a required action, resolve its Work attester
  as an active contributor, and keep the Work/assessment EAS recipient equal to `providerGarden`,
  including protocol-pool commitments that remain owned by the root pool.
- **Reward binding**: `RewardRail.None` is valid only with zero source/token/amount.
  `ArbitrumExternal` requires a non-zero exact source/token/amount. `CeloSettlement` requires
  zero declared source, canonical G$, and a non-zero amount because a protocol-pool Request
  cannot know its payer garden at creation. Acceptance resolves `providerGarden`; the
  SettlementModule then derives and stores that garden's active Celo Safe as the plan source.
  `recordRewardPaid` remains the Arbitrum-rail total-payment record: it emits the stored source,
  lead provider, token/amount, payout ref, and recorder without moving value or claiming an
  on-chain contributor split. `CeloSettlement` rejects that function and instead requires the
  fulfilled commitment's frozen contributor roster and recognition output to seed the
  garden-managed payout plan in `settlement-spec.md`. The provider garden Celo Safe is the payer;
  contributor accounts and amounts derive from the locked plan. The explicit rail makes recording
  both paths for one commitment impossible.
- **Mandatory reasons**: `declineClaim`, steward cancellation, `markReadyForConfirmation`, fallback confirmation, `raiseDispute`, and every `resolveDispute` call reject an empty reason/CID with `ReasonRequired`. This error is the only empty-reason error; handlers preserve the emitted reason exactly.
- **Domain/action scope and measured bound**: `Domain` remains the closed four-value ActionRegistry
  taxonomy, but it no longer limits requirement count. DomainImpact accepts 1 through
  `MAX_REQUIREMENTS` rows; each row has a registered action UID (including valid UID `0`) and
  non-zero `requiredCount`. Actions and derived domains may repeat. The stored `domains` list is
  the unique derived tag set for filtering, not a positional array. Non-DomainImpact kinds carry
  optional validated `domainTags` and no requirements. `MAX_REQUIREMENTS = 16` is provisional;
  before implementation freezes it, contract/indexer benchmarks must compare 8/16/24/32 for
  worst-case creation, approval credit, Ready evaluation, event payload, and replay cost. The
  selected value and evidence are recorded in the contracts handoff.
- **approvedUnits math**: computed on-chain as
  `targetUnits * Σ min(requirements[i].approvedCount, requirements[i].requiredCount) /
  Σ requirements[i].requiredCount` (integer floor; approvals beyond one requirement's quota never
  add units) and emitted in `ApprovedWorkCounted` so the indexer never re-derives fractional
  units. A single requirement degenerates to the previous scalar formula.
- **Repeated-action Work binding**: `linkWork` receives and validates an explicit
  `requirementIndex`; for DomainImpact, the selected row must exist and its `actionUID` must equal
  the decoded Work action, including valid UID `0`. The module stores `requirementIndex + 1`
  beside `workCommitment`, emits the index in `WorkLinked`, and every approval/sync increments
  only that exact row. Repeated action UIDs therefore remain legal without first-match,
  first-unmet, or all-match ambiguity. Non-DomainImpact Work links use index `0` as a
  non-counting compatibility value and never write the plus-one mapping.
- **One countable approval per Work**: `approvalCounted` makes delivery of one approval attestation
  idempotent, while `workCreditCounted` is the recognition/accounting guard. The first valid
  approved attestation for a linked `workUID` while its commitment is Accepted and unfrozen marks
  both keys and increments exactly one requirement and contributor credit. A first approval that
  arrives after freeze marks only `approvalCounted`; it is observed but does not set
  `workCreditCounted`, increment requirements/units/credits, or emit `ApprovedWorkCounted`. Any
  later approval attestation for that same Work is likewise recorded as observed and returns
  without changing counts, units, eligibility, or events. This remains true when
  `WorkApprovalResolver` issues a new non-revocable decision attestation.
- **Canonical recognition validation**: the module maintains `eligibleContributorCount` when a
  contributor receives their first verified credit and `totalVerifiedCredits` on every
  de-duplicated credit. Cycle-scoped commitments may enter ReadyForConfirmation or resolve a
  dispute as Fulfilled only after their cycle is Open and its two-part policy is snapshotted.
  Cycle-less commitments use the immutable protocol policy returned by
  `cyclelessRecognitionPolicy()` (2_000 equal / 8_000 verified). After fulfillment,
  `validateRecognitionSnapshot` requires a frozen roster, at least one eligible contributor,
  exactly that many sorted unique eligible rows, and an available policy, then recomputes the
  weights and deterministic remainders from on-chain records before returning the
  domain-separated hash.
  SettlementModule must call this view for every payout plan. The Hypercert allowlist composer
  calls it only after rejecting `cycleId == 0`, because a cycle-less commitment has no immutable
  six-role allocation snapshot and is not COMMITMENT-bundle eligible. A self-consistent
  caller-supplied vector/hash is never authority.
- **ReadyForConfirmation gates**: DomainImpact requires every requirement to meet its non-zero
  count; evidence-only kinds use no requirements. Work-gated auto-flip is evaluated after any
  requirement counter changes and after `attachAssessment`, and happens only when every
  requirement is met and `requiresAssessment == false || assessmentUID != 0`. Every path also
  requires the pre-fulfillment predicate `totalVerifiedCredits > 0` and an Open cycle when
  `cycleId != 0`; the steward
  override cannot bypass either predicate. Immediately before the Ready transition, the module
  freezes the contributor roster and contribution ledger and revalidates that every confirmer
  remains outside it and the threshold is reachable. Evidence-only
  `submitForConfirmation` enforces the same assessment/roster predicates and rejects
  DomainImpact, and reads both `evidenceCount >= 1` and `totalVerifiedCredits > 0`. Steward
  override may bypass work counts, never contributor/confirmation
  separation, and always emits its reason.
- **Pause/configuration semantics**: initialization is paused-first. Dependency and schema setters
  reject unpaused calls with `ModuleMustBePaused`, reject zero/colliding values before storage
  mutation, and emit `ModuleDependencyUpdated` or one `ModuleSchemaUIDUpdated` per changed UID.
  The initializer emits `ModulePauseStatusChanged(false, true)` so replay starts from an explicit
  fail-closed state. Exact repeats are no-ops. `setPaused(false)` revalidates the complete non-zero/distinct
  dependency/schema set and otherwise reverts `ModuleNotReady`; every real pause transition emits
  `ModulePauseStatusChanged`. While paused, operational entry points stay blocked, but cancel,
  expire, and dispute resolution remain available for safe wind-down. Pool-level Paused blocks
  new commitments, claims, Ready submissions, and confirmations only; browse, evidence/linkage,
  cancellation/expiry, and dispute recovery remain available. `PoolPaused` carries the mandatory
  reason CID and `PoolResumed` clears the indexed reason.
- **Cycle binding**: `cycleId == 0` is the only cycle-less sentinel. Any non-zero cycle must exist and belong to `params.poolId`. Member-created commitments require an Open cycle; steward-seeded SeasonCampaign/StewardCaptured commitments permit Seeded or Open. Cancelled, Reconciled, Composted, or cross-pool cycles always revert before class registration. A non-zero cycle increments `liveCommitmentCount` only after all creation validation succeeds.
- **onWorkApproved must never revert** for unrecognized state: the EAS approval succeeds regardless (approval flow is `critical` path per repo criticality matrix).

#### Acceptance criteria

- Every transition in the section 5 tables has exactly one emitting function or a documented derivation; no silent state changes.
- `bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol`
  covers pool/cycle invariants, one open Season plus concurrent Campaigns,
  allocation/recognition-policy validation and locking at `openCycle`, zero-live-commitment
  closure with exact once-only terminal decrements, paused-first configuration,
  action UID `0`, repeated domains, caller input limited to `actionUID`/`requiredCount` while
  stored `domain`/`approvedCount` remain module-derived, provisional `MAX_REQUIREMENTS` and
  max-plus-one rejection before mutation, per-requirement approval counts,
  solo/Open/LeadManaged contributor paths, lead
  initialization, add/remove/join/leave/assignment, max-plus-one contributor rejection before
  mutation, credited/lead removal rejection, active-contributor Work/evidence credit, empty-CID rejection, exact-CID
  evidence de-duplication, non-empty/unique/max evidence-credit lists, all three evidence-only
  kinds reaching Ready from pre-freeze evidence credit, fulfillment-gated recognition eligibility,
  late evidence rejection and late approval observation without credit, cycle close/cancel
  rejection while any live commitment remains, roster
  and credit freeze on every Ready path, every-contributor confirmation exclusion, explicit repeated-action
  requirement binding, canonical recognition-vector recomputation/hash rejection, unreachable confirmer
  threshold rejection, lead-only register exposure, assessment gating, claim identity,
  cancel/expiry/dispute count effects, reward derivation, provider-garden Work/assessment
  validation, and sync dedupe. A separate benchmark records worst-case 8/16/24/32 requirement
  create/credit/readiness/event gas and payload size before the constant is frozen. App/shared
  tests cover the current non-revoked Baseline preflight and deterministic Hypercert recognition
  expansion.
- The compiler-generated baseline and concrete slot/offset assertions prove the expected
  28-feature-slot layout and reserved gap; arithmetic alone is not proof. The Bun-wrapped
  storage gate gains the `CommitmentPoolingModule:src/modules/CommitmentPooling.sol` entry.
- Fork test proves a full Offer -> Accepted -> WorkLinked -> approval-hook count -> ReadyForConfirmation -> confirm -> Fulfilled -> RewardPaid pass against the deployed EAS on an Arbitrum fork (`bun run test:fork`, wrappers only per `.claude/rules/contracts.md`).

### 6.2 `CommitmentRegister`

#### Objective

A non-transferable, ERC-1155-STYLE unit ledger internal to our own contract: commitment classes, committed/fulfilled balances per account, class quotas, and concurrent provider-commitment caps. It does NOT inherit ERC-1155 and exposes no transfer or approval surface of any kind; balances move only through module calls. This is the voucher-shaped substrate (register #15, register #16) that transferable settlement vouchers later wrap 1:1 on the same poolId.

#### Grassroots Economics grounding (clean-room, register #17)

Design vocabulary comes from Ruddick's "Commitment Pooling: an Economic Protocol Inspired by Ancestral Wisdom" (IJCCR) and the Grassroots Economics "Intro to Commitment Pools" docs, used as named design grammar only, never as code reference (the Sarafu Solidity source is AGPL and is not read):

- **Curation**: which commitments enter the pool's register. Implemented as steward-gated `createCommitment`/`acceptClaim` on the module plus module-only `registerClass` here; nothing enters the register except through curated module paths.
- **Limiting**: hard caps per asset in the pool. Implemented as the per-class `quota` (defaults to the commitment's `targetUnits`) plus a per-pool `providerOpenCommitmentCap` on concurrent accepted commitments per provider. The first remains unit-denominated within one exact label/class; the second is count-denominated and never adds unlike units.
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
| 5 | `providerOpenCommitmentCap` | `mapping(uint256 poolId => uint256)` (0 = not configured; a non-zero cap is required for Ready) |
| 6 | `providerOpenCommitmentCount` | `mapping(uint256 poolId => mapping(address account => uint256))` |

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

    enum AccountingState {
        Registered,
        Committed,
        Released,
        Fulfilled
    }

    struct CommitmentClass {
        uint256 poolId;
        uint256 cycleId;         // 0 = cycle-less; emitted so indexers never infer it
        string unitLabel;
        uint256 quota;           // LIMITING: hard cap on committed units for this class
        uint256 totalCommitted;  // live open exposure for this class
        uint256 totalFulfilled;
        AccountingState accountingState; // exact single-shot slot lifecycle
        bool exists;
    }

    // ═════════════════════════════ Events ════════════════════════════

    event ModuleUpdated(address indexed oldModule, address indexed newModule);
    event ClassRegistered(uint256 indexed classId, uint256 indexed poolId, uint256 cycleId, string unitLabel, uint256 quota);
    event ProviderOpenCommitmentCapUpdated(uint256 indexed poolId, uint256 cap);
    event UnitsCommitted(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalCommitted);
    event UnitsReleased(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalCommitted);
    event UnitsFulfilled(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalFulfilled);

    // ═════════════════════════════ Errors ════════════════════════════

      error NotModule(address caller);
      error ModuleMustBePaused(address currentModule);
      error ZeroAddress();
    error UnitLabelRequired();
    error QuotaRequired();
    error OpenCommitmentCapRequired(uint256 poolId);
    error ClassAlreadyRegistered(uint256 classId);
    error UnknownClass(uint256 classId);
    error ClassAccountingStateMismatch(uint256 classId, AccountingState expected, AccountingState actual);
    error InvalidUnitAmount(uint256 classId, uint256 requested, uint256 expected);
    error QuotaExceeded(uint256 classId, uint256 requested, uint256 available);
    error OpenCommitmentCapExceeded(uint256 poolId, address account, uint256 requestedCount, uint256 availableCount);
    error InsufficientCommitted(uint256 classId, address account, uint256 requested, uint256 available);

    // ══════════════════════ Mutations (onlyModule) ═══════════════════

    function registerClass(uint256 classId, uint256 poolId, uint256 cycleId, string calldata unitLabel, uint256 quota) external;
    /// @notice Sets the non-zero concurrent commitment-count cap for a pool.
    ///         An authorized zero value reverts OpenCommitmentCapRequired(poolId)
    ///         before event emission or storage mutation.
    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external;

    /// @notice Acceptance: from Registered only, records the full non-zero
    ///         class quota and consumes one provider open-commitment slot.
    function commitUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Cancel/expire: from Committed only, releases the full non-zero
    ///         committed balance and one open slot, then becomes terminal.
    function releaseUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Fulfillment: from Committed only, converts the full non-zero
    ///         committed balance and releases one open slot, then becomes terminal.
    function fulfillUnits(uint256 classId, address account, uint256 units) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getClass(uint256 classId) external view returns (CommitmentClass memory);
    function committedOf(address account, uint256 classId) external view returns (uint256);
    function fulfilledOf(address account, uint256 classId) external view returns (uint256);
    function openCommitmentCountOf(uint256 poolId, address account) external view returns (uint256);
    function providerOpenCommitmentCapOf(uint256 poolId) external view returns (uint256);

    // ══════════════════════ Admin (owner) ════════════════════════════

    function setModule(address module) external;

    // Deliberately absent: transferFrom, safeTransferFrom, setApprovalForAll,
    // balanceOfBatch, any ERC-1155 receiver hooks. Non-transferable by
    // construction; adding a transfer surface is a spec violation.
}
```

Scaffold: `UUPSUpgradeable + OwnableUpgradeable`, `_disableInitializers()`, initializer takes
`(owner, module)` where module may be zero and set later during wiring (template
`packages/contracts/src/modules/CookieJar.sol:74-115`). `setModule` rejects a zero replacement.
The initial zero → non-zero wiring is the only pre-pause exception; after wiring, replacement
requires `ICommitmentPoolingModule(currentModule).paused() == true` and emits
`ModuleUpdated(oldModule, newModule)`.

#### Acceptance criteria

- No function in the compiled ABI moves balance between two non-module accounts; a dedicated test asserts the ABI contains no `transfer`/`approve` selector.
- `createCommitment` and `registerClass` both reject empty unit labels and zero targets/quotas.
  `registerClass` fixes quota to the commitment's `targetUnits` and starts in `Registered`; there is
  no post-creation quota mutation.
- `commitUnits` accepts only `Registered -> Committed` with `units == quota > 0`.
  `releaseUnits` and `fulfillUnits` accept only `Committed -> Released|Fulfilled` with
  `units == committedOf(account, classId) == quota > 0`. Direct repeat, partial, zero, wrong-account,
  reactivation-after-release, and release-after-fulfillment calls all revert before changing
  balances or `providerOpenCommitmentCount`.
- After pool/steward resolution, the module forwarder rejects `cap == 0` with
  `OpenCommitmentCapRequired(poolId)` before calling the register. For an authorized module
  caller, the register independently rejects zero with the same error before event emission or
  storage mutation; an unauthorized caller still fails `NotModule` first. Unit tests cover both
  boundaries. `providerOpenCommitmentCapOf` exposes readiness configuration and
  `openCommitmentCountOf` matches the number of classes still in `Committed` for that
  pool/provider. Acceptance consumes one slot; fulfillment, cancellation, and expiry release it
  exactly once. `Accepted`/`ReadyForConfirmation` disputes preserve the slot, while a dispute
  raised from already-released `Expired` does not recreate one. RestorePrevious changes no count.
- Register mutations revert `NotModule` for every caller except the wired module.
- Register-module recovery is auditable and pause-bounded: zero replacement rejects, initial
  wiring succeeds once, an unpaused replacement rejects, and a paused replacement emits the exact
  old/new module addresses without mutating any class, balance, or provider count.
- The compiler-generated layout baseline and concrete slot/offset assertions prove the planned
  six-feature-slot layout and reserved gap; `AccountingState` lives inside the mapped
  `CommitmentClass` value and adds no top-level storage slot. A `named + gap == 50` arithmetic
  assertion is not
  accepted as storage proof. Add the feature entry through the Bun-wrapped storage-layout gate.
- Transferable-voucher attachment documented: a reviewer can point at the classId, the reserved settlementAdapter field, and the fulfilled balances and see the 1:1 wrap path without register changes.

### 6.3 GardenToken wiring (live UUPS upgrade)

#### Changes to `packages/contracts/src/tokens/Garden.sol`

1. Append `ICommitmentPoolingModule public commitmentPoolingModule;` immediately after
   `openMinting` and immediately before `__gap`. It must compile at slot 213 offset 2; inserting
   it in the earlier module-fields block would shift live fields and is forbidden.
2. New setter + event in the setter block (lines 181-227 pattern):
   `setCommitmentPoolingModule(address)` onlyOwner, emitting `CommitmentPoolingModuleUpdated(oldModule, newModule)`.
3. Mint callback in `_initializeIntegrationsAndAccount` (lines 421-456), after the CookieJar block, same graceful shape as lines 423-430: `if (address(commitmentPoolingModule) != address(0)) { try commitmentPoolingModule.onGardenMinted(gardenAccount) returns (uint256) { } catch { } }`. Garden mint MUST NOT revert on module failure.
4. **Gap remains 37.** `transferRestriction` occupies slot 213 offset 0 and `openMinting`
   occupies offset 1; the address fits in the remaining bytes at offset 2. The generated layout,
   not named-field arithmetic, is authoritative, and `uint256[37] private __gap;` is unchanged.

#### Live-chain implication

GardenToken on 42161 is a live UUPS proxy at `0xe1Da335110b1ed48e7df63209f5D424d02276593` (`packages/contracts/deployments/42161-latest.json:14`) holding real garden state for 13 live gardens. The upgrade appends one packed variable after all existing fields without consuming a gap slot. Required proof chain before broadcast:

- `bun run --filter @green-goods/contracts check:storage-layout` passes against the reviewed
  pre-change GardenToken baseline; only an explicit `--update` action may refresh it.
- `packages/contracts/test/StorageLayout.t.sol` asserts slot 213 offset 2, preservation of every
  old slot/offset, and the unchanged 37-slot gap. Named-field arithmetic is not accepted.
- Upgrade preserves state test extended (`testGardenTokenUpgradePreservesState`, `packages/contracts/test/StorageLayout.t.sol:270-289`) to set and survive `commitmentPoolingModule`.
- Broadcast via the named root `contracts:*` scripts only (keystore + sender encoding per root CLAUDE.md; never raw forge, `.claude/rules/contracts.md`).

Post-upgrade ops sequence (one-shot, lives in `.plans/`, not `scripts/`): after both the
`GardenToken` and `WorkApprovalResolver` upgrades, call
`gardenToken.setCommitmentPoolingModule(module)` and
`workApprovalResolver.setCommitmentModule(module)`; verify both reverse links, updater
preservation, storage, ownership, and every chain-2/chain-3 readiness fact while the pooling
module remains paused; then call `module.setPaused(false)`, register the protocol pool on the
root garden, backfill `registerPool(garden, Garden)` for the 13 live gardens, and run the
operational smoke.

### 6.4 EAS schema work: exactly two registrations (register #14)

No commitment schema exists or will exist. The two registrations are assessment v3 and community testimony. Both non-revocable, matching every existing Green Goods schema (`packages/contracts/config/schemas.json` `"revocable": false`; resolvers return false from `onRevoke`, e.g. `packages/contracts/src/resolvers/Assessment.sol:173-176`). Note the GreenWill badge schema is revocable (`packages/contracts/script/DeployBadgeSchema.s.sol:23`); ours deliberately are not.

#### 6.4.1 Assessment v3 schema

The registered v2 schema stays immutable and readable in EAS: UID
`0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93`, string
`string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location`
(`packages/contracts/deployments/42161-latest.json:47-48`). The live Arbitrum resolver currently
reports a zero v2 UID; the upgrade sequence must first pin this verified artifact UID and prove
the registered schema record, resolver address, owner, and old state before adding v3. Schemas
are immutable (`reports/corrections-log.md` H2), so v3 is a fresh UID following the same
thin-schema + config-CID pattern, appending only what resolvers and indexed consumers need
(`reports/corrections-log.md` §3).

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
- Recipient = garden account, matching every existing schema's recipient convention (`reports/corrections-log.md` §2).
- No numeric score field, on purpose. Testimony gates nothing by itself: when a commitment is explicitly aimed at the community, its confirmation power flows through the module's named-confirmer group (Community-Hat wearers placed in `confirmers` at seeding), never through this schema. Everywhere else testimony is narrative only. "Never averaged" is enforced off-chain (indexer and app never aggregate testimony into scores); flagged in section 12.

Struct appended to `packages/contracts/src/Schemas.sol` as `CommunityTestimonySchema`.

#### 6.4.3 Resolvers

`AssessmentV3` is the **schema name only**. The live `AssessmentResolver` UUPS proxy at the
existing `assessmentResolver` deployment address is upgraded in place; there is no
`AssessmentV3Resolver`, second Assessment proxy, compatibility alias, or resolver migration.
The upgraded implementation continues to recognize the existing `schemaUID` as v2 and appends
one `assessmentV3SchemaUID` storage field. `CommunityTestimonyResolver` is NET-NEW.

Both implementations follow the resolver conventions in
`packages/contracts/src/resolvers/{Work,WorkApproval,Assessment}.sol`: validation-order doc
comments, flat-tuple decode, `onRevoke` returning false, UUPS + Ownable, and
implementation-constructor `_disableInitializers()`. `onAttest` and `onRevoke` remain the
inherited internal `SchemaResolver` overrides; EAS is their only caller. Constructors hold EAS
as an immutable exactly like the existing resolvers, while mutable configuration is
owner-gated and observable.

```solidity
interface IAssessmentResolverConfig {
    // Existing SchemaUIDUpdated(bytes32 schemaUID) and setSchemaUID(bytes32)
    // remain the v2 configuration surface unchanged.
    event AssessmentV3SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);
    event KarmaGAPModuleDisabled(address indexed oldModule);

    // Existing v2 errors keep their selectors unchanged.
    error NotAuthorizedAttester();
    error TitleRequired();
    error ConfigCIDRequired();
    error InvalidDomain(uint8 domain);
    error AssessmentV2SchemaUIDRequired();
    error AssessmentV3SchemaUIDRequired();
    error SchemaUIDCollision(bytes32 uid);
    error InvalidAssessmentKind(uint8 kind);
    error BaselineRequired();
    error BaselineForbidden();
    error InvalidBaseline(bytes32 baselineUID);
    error BaselineGardenMismatch(bytes32 baselineUID, address expectedGarden, address actualGarden);

    function initialize(address owner_) external; // existing initializer; never re-run on upgrade
    function setSchemaUID(bytes32 uid) external; // existing v2 setter/signature
    function setAssessmentV3SchemaUID(bytes32 uid) external;
    function setKarmaGAPModule(address module) external; // zero disables the optional hook
    function schemaUID() external view returns (bytes32); // existing v2 UID
    function assessmentV3SchemaUID() external view returns (bytes32);
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
    error InvalidSchema(); // existing CommonErrors.sol selector
    error SchemaUIDRequired();
    error SchemaUIDConflict(bytes32 currentUID, bytes32 requestedUID);
    error CommitmentModuleRequired();

    // implementation constructor: constructor(address eas)
    function initialize(address owner_) external;
    function setSchemaUID(bytes32 uid) external; // non-zero; zero -> pin, exact -> no-op, conflict -> revert
    function setCommitmentModule(address module) external; // non-zero and schema UID already pinned
    function schemaUID() external view returns (bytes32);
    function commitmentModule() external view returns (address);
    function isPayable() external pure returns (bool);
}
```

For `CommunityTestimonyResolver`, the constructor calls `_disableInitializers`; `initialize`
rejects zero owner, calls `__Ownable_init`, and transfers ownership; `_authorizeUpgrade` is
`onlyOwner`. Its NET-NEW schema path has no compatibility wildcard: validation requires the
attestation schema to equal the stored non-zero UID. `setSchemaUID` rejects zero, pins the first
non-zero UID, treats the exact value as a no-op without another event, and reverts
`SchemaUIDConflict(currentUID, requestedUID)` for any different non-zero value. The upgraded
Assessment implementation has no new initializer: it preserves owner, EAS immutable,
`karmaGAPModule`, and v2 `schemaUID`, and uses
an owner-only `setAssessmentV3SchemaUID` after the additive registration. That setter rejects
zero, a zero v2 UID, or equality with the v2 UID and emits the exact old/new event above. The existing
`setSchemaUID` selector/event remain unchanged and retain the v2 deployment-window zero value,
but after a non-zero v3 UID is configured it rejects both zero and equality with v3. Thus the
legacy zero-bypass exists only before v3 activation, never while either live v3 schema can call
the resolver. Post-deploy verification rejects either UID being zero and proves the two UIDs
are distinct.

**Upgraded `AssessmentResolver`** (`packages/contracts/src/resolvers/Assessment.sol`), validation order:

1. Schema dispatch: a non-zero `assessmentV3SchemaUID` match decodes v3; otherwise
   `schemaUID == 0 || attestation.schema == schemaUID` decodes and validates the existing v2
   tuple exactly as today; every other schema reverts. This preserves the existing v2
   deployment-window zero-bypass without creating a v3 bypass. The v3 setter cannot activate
   while v2 is zero, and the v2 setter cannot return to zero after v3 activation. Post-deploy
   both UIDs are non-zero and distinct.
2. Decode the selected v2 or v3 tuple.
3. IDENTITY by kind (register #7): Baseline requires `accessControl.isEvaluator || accessControl.isOperator` (exact parity with today's `packages/contracts/src/resolvers/Assessment.sol:114-121`, preserving operator analog capture); Delta and Technical require `accessControl.isEvaluator` only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:25`).
4. REQUIRED FIELDS: title, assessmentConfigCID non-empty; domain <= 3 (`Assessment.sol:124-136` parity).
5. KIND VALIDATION for v3 only: assessmentKind <= 2; Delta requires baselineUID != 0 and `_eas.getAttestation(baselineUID)` returning an attestation whose schema is `schemaUID` (v2) or `assessmentV3SchemaUID` and whose recipient equals `attestation.recipient`; Baseline/Technical require baselineUID == 0. Existing v2 attestations retain their current evaluator-or-operator rule and seven-field validation without fabricating v3 fields.
6. GAP INTEGRATION: same optional KarmaGAP milestone try/catch as v2 (`Assessment.sol:138-141,150-167`), reusing `createMilestone`.

Storage append: existing slots 1–2 remain `karmaGAPModule`, `schemaUID`; slot 3 becomes
`assessmentV3SchemaUID`; `uint256[48] __gap` becomes `uint256[47] __gap` (50 total). The
upgrade proof must assert the live proxy owner, v2 UID, and KarmaGAP address are byte-identical
before/after and that both v2 and v3 attestations resolve through the same proxy.

**`CommunityTestimonyResolver`** (NET-NEW `packages/contracts/src/resolvers/CommunityTestimony.sol`), validation order:

1. ACTIVATION CHECK: require `commitmentModule != address(0)` or revert
   `CommitmentModuleRequired`. The setter cannot make the module non-zero until the schema UID is
   pinned, so every pre-activation call fails closed.
2. SCHEMA UID CHECK: require non-zero `schemaUID` and exact equality with
   `attestation.schema`; there is no zero-UID wildcard.
3. Decode tuple.
4. IDENTITY: `accessControl.isCommunity(attestation.attester)` only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:42-45`). Community Hat becomes a real attestation gate for the first time (today it only gates GreenWill genesis eligibility, `reports/corrections-log.md` H6).
5. REQUIRED FIELDS: testimonyCID non-empty.
6. COMMITMENT CHECK: when `commitmentId != 0`, verify
   `module.getCommitment(commitmentId)` exists and its pool's garden equals
   `attestation.recipient`.

Storage: `schemaUID`, `commitmentModule` = 2 used slots, `uint256[48] __gap` (matches `Assessment.sol:39-44` accounting style).

`setCommitmentModule` rejects zero and rejects configuration while `schemaUID == bytes32(0)`;
successful changes emit old/new. A non-zero replacement remains available only for catastrophic
module-proxy recovery and is owner/timelock-controlled; post-deploy verification proves the target
has expected `ICommitmentPoolingModule` bytecode/interface and that its EAS/schema wiring points
back to this resolver. The normal UUPS upgrade path preserves the module proxy address and never
uses this recovery setter.

#### 6.4.4 Registration path (standalone, register #26; first PR chain of the August track)

Never use `--update-schemas`: that mode reloads the three legacy resolvers and re-registers ALL legacy schemas, overwriting every schema artifact key (`packages/contracts/script/Deploy.s.sol:122-151`, `_registerSchemas` at `packages/contracts/test/helpers/DeploymentBase.sol:955-990`). Additive registration goes through the badge-schemas standalone precedent instead:

- The existing Assessment proxy upgrade is a separate, earlier phase through
  `packages/contracts/script/upgrade.ts assessment-resolver`. It follows the repository UUPS
  sequence: layout/rollback proof -> pure simulation -> persisted transaction plan -> separately
  authorized broadcast -> post-upgrade implementation-slot, owner, v2 UID, KarmaGAP, and
  initializer-lock verification. A deploy or schema-registration target never upgrades that
  proxy.
- NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` (template
  `packages/contracts/script/DeployBadgeSchema.s.sol:15-73`) has two explicit modes. The default
  preparation mode verifies that the existing `assessmentResolver` proxy is already on the
  approved v3-capable implementation and that its owner, v2 UID, and KarmaGAP state match the
  post-upgrade evidence. It deploys/reconciles only the NET-NEW `CommunityTestimonyResolver`
  implementation + proxy and the AssessmentV3 registration against the existing Assessment
  proxy. From the exact schema bytes, predicted resolver proxy, and `revocable == false`, it derives
  and one-way pins the deterministic Community Testimony UID while `commitmentModule` remains zero.
  Preparation does not call `SchemaRegistry.register`; because registration is permissionless, it
  accepts only an empty record or the already-exact deterministic record and rejects anything else.
  Either state remains inactive while the module is zero. The named
  `--finalize-community-testimony` mode runs only after module/register deployment. It reads the
  module proxy from the verified chain deployment artifact (there is no caller-supplied module
  override), verifies its bytecode/interface and owner boundary, proves the resolver's pinned UID
  equals the deterministic expected UID, registers/reconciles the exact Community Testimony record,
  and only then reconciles
  `CommunityTestimonyResolver.setCommitmentModule(nonZeroModule)` as the final activation action.
  An exact registered record may therefore exist briefly while the resolver is intentionally
  inactive; no attestation succeeds until the verified module is activated last.
- Resolver deployment is transaction/artifact-recovery safe, not only schema registration. The
  preparation mode derives versioned CREATE2 salts and predicts both implementation and proxy from
  exact creation/init code before sending. Absent code permits one deployment. Existing code is reused
  only when implementation bytecode hash, proxy ERC-1967 implementation, initializer lock, owner,
  EAS, and schema/module state match exactly. Preparation reconciles schema UID zero to the exact
  expected UID only while module is zero; exact UID/module-zero is the prepared state. A fully
  finalized retry may reuse exact UID + exact registry record + the exact artifact-sourced module.
  Module-nonzero with a zero UID, or module-nonzero with an absent/mismatched registry record, fails
  closed as an out-of-order state. Finalization accepts only three ordered recovery states:
  expected UID + empty record + zero module; expected UID + exact record + zero module; or expected
  UID + exact record + exact verified module. Any other state fails closed. If deployment succeeds
  but result persistence or append-only merge fails, a retry reads the same predicted addresses and
  reconstructs the missing result artifact without another deployment transaction.
- Both registrations are transaction/artifact-recovery safe. Before sending, the script computes
  `expectedUID = keccak256(abi.encodePacked(schemaString, resolver, false))` and reads
  `SchemaRegistry.getSchema(expectedUID)`. An empty record permits one `register` call whose
  returned UID must equal `expectedUID`. An existing record is reused only when its UID, schema
  bytes, resolver, and `revocable == false` match exactly; any mismatch fails closed. Schema UID
  setters use read-before-set reconciliation: zero sets `expectedUID`, the exact existing value
  skips the transaction, and any other non-zero value fails closed. Community Testimony's UID is
  pinned during preparation; its registry record is reconciled during finalization before module
  activation. The preparation result may persist the predicted UID as recovery metadata, but the
  canonical latest/schema artifact exposes the Community Testimony schema keys only after exact
  record reconciliation and final activation. The append-only artifact merge uses `expectedUID` in
  every path. A retry after an on-chain success but local persistence failure therefore reconstructs
  the same artifact without a duplicate deployment/registration/setter transaction or an
  `AlreadyExists` revert.
- NET-NEW `packages/contracts/script/deploy/commitment-schemas.ts` (template `packages/contracts/script/deploy/badge-schemas.ts:76-168`): wraps the forge script with keystore handling and merges the result into `deployments/{chainId}-latest.json` under NEW keys only, exactly like `mergeIntoDeployment` (`badge-schemas.ts:128-168`).
- Artifact keys added (v2 keys and existing top-level `assessmentResolver` untouched):
  `assessmentV3SchemaUID`, `assessmentV3Schema`, `assessmentV3Name`,
  `assessmentV3Description`, `communityTestimonySchemaUID`,
  `communityTestimonySchema`, `communityTestimonyName`,
  `communityTestimonyDescription`, plus top-level `communityTestimonyResolver`. There is no
  `assessmentV3Resolver` artifact key.
- `packages/contracts/config/schemas.json` gains sibling keys `assessmentV3` and `communityTestimony` (name, description, revocable false, fields array) so `_generateSchemaString` and its bun utility keep producing canonical strings (`packages/contracts/script/DeployHelper.sol:416-462`). The deployed `assessment` key is never edited.
- `packages/contracts/script/validate-resolver-eas.mjs` and
  `validate-eas-immutables.mjs` are extended to prove both assessment schema UIDs point to the
  same existing Assessment proxy and Community Testimony points to its new resolver.
- Invocations, wired into the existing deploy CLI dispatch next to `badge-schemas`:

  ```sh
  bun script/deploy.ts commitment-schemas --network <chain> --broadcast
  bun script/deploy.ts commitment-schemas --network <chain> --finalize-community-testimony --broadcast
  ```

  The first command is preparation; the second runs only after the verified module/register
  deployment. Both broadcasts remain
  separately authorized release operations; implementation/review lanes run their corresponding
  dry-run modes only.

#### Acceptance criteria

- Both schema strings byte-match between `config/schemas.json`-generated output and the registered on-chain schema record.
- v2 assessment attestations keep resolving and the v2 artifact keys are byte-identical before and after the merge.
- Deployment-script tests cover absent/exact/mismatched implementation and proxy code; recovery
  when resolver deployment succeeded but its result/deployment artifact is absent; first
  registration; exact-existing reconciliation; zero/exact/conflicting schema setter state; exact
  finalization-module reconciliation; the ordered Community Testimony states UID pin -> exact
  registry reconciliation -> module activation; rejection of module-before-UID,
  module-before-record, and mismatched records; and recovery when registration, UID pinning, module
  activation, or artifact persistence succeeds independently for AssessmentV3 and Community
  Testimony.
- `bun run --filter @green-goods/contracts test:match -- test/unit/AssessmentResolver.t.sol`
  covers the upgrade and dual-schema dispatch: pre-upgrade v2 state preservation; v2
  attestation parity after upgrade; v3 baseline by operator (passes); v3 delta by operator
  (reverts); invalid kind/domain; forbidden/missing/foreign baselineUID; setter event;
  v3 activation while v2 is zero; attempts to zero/collide either UID after v3 activation;
  implementation initializer lock; owner-only upgrade/configuration; and rejection of an
  unrelated schema.
- `bun run --filter @green-goods/contracts test:match -- test/unit/CommunityTestimonyResolver.t.sol`
  covers testimony by non-community, empty testimony, commitmentId pointing at another
  garden's pool, fail-closed zero module for both `commitmentId == 0` and `commitmentId != 0`,
  exact-schema enforcement with no zero-UID wildcard, zero UID rejection, first UID pin and event,
  exact UID no-op without an event, conflicting UID rejection, zero-module setter rejection,
  module-before-UID rejection, registered-exact-schema inactivity while module is zero, verified
  non-zero activation/recovery replacement, initializer lock, and owner-only
  upgrade/configuration.
- Arbitrum Sepolia registration/rehearsal precedes Arbitrum One (release-age gate posture of
  `assertSepoliaGate`, `packages/contracts/script/deploy/badge-schemas.ts:77-81`, extended for
  the distinct `421614` target rather than reusing `11155111`).
- Registered before cycle 1 opens so baselines exist for seeding (register #26).

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

Linkage mechanism, stated plainly (register #5): Work attestations carry no commitment reference and never will (the Work schema is immutable, `reports/corrections-log.md` H2). The mapping lives on the module: claimant or steward calls `linkWork(commitmentId, workUID, requirementIndex)` before or after the approval. For DomainImpact the module verifies the decoded action against that exact requirement row and stores `requirementIndex + 1` beside `workCommitment`; this makes repeated action UIDs unambiguous. The resolver hook matches by workUID: the module looks up both bindings; if unlinked it returns without effect. Approvals landing before linkage are recovered by steward-called `syncApprovedWork(commitmentId, approvalUIDs)`, which verifies each approval on EAS. `approvalCounted` de-duplicates delivery of one approval attestation; `workCreditCounted` independently guarantees that distinct approval attestations for the same Work can never increment the requirement, contributor credit, or units twice.

Trust model: linkage is operator-curated (steward and claimant are the only linkers), the resolver hook only counts approvals for pre-linked workUIDs, the module re-verifies garden and schema on every sync, and dedupe makes double-count impossible. The bridge couples resolver to module exactly as loosely as the existing KarmaGAP coupling: optional address, try/catch, disable by setting zero (`WorkApproval.sol:69-78`).

Upgrade mechanics: WorkApprovalResolver is a live UUPS proxy at `0x166732eD81Ab200A099215cF33F6A712309B69F7` (`packages/contracts/deployments/42161-latest.json:59`); baseline entry already exists (`packages/contracts/script/check-storage-layout.sh:30`); regenerate baseline in the same PR; broadcast via `contracts:*` scripts.

Acceptance criteria: approval with module unset behaves byte-identically to today; approval with module set and work unlinked emits nothing from the module and still validates; approval with linked work increments the counter once; a reverting module never blocks an approval. Exact proof: `bun run --filter @green-goods/contracts test:match -- test/unit/WorkApprovalResolver.t.sol`, extended with unset/unlinked/linked/reverting-module cases, plus `bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol` for the 48-to-47 gap change.

## 7. Deployment

### 7.1 Deploy helpers

- NET-NEW `_deployCommitmentRegister(...)` and `_deployCommitmentPoolingModule(...)` in `packages/contracts/test/helpers/DeploymentBase.sol`, copying `_deployCookieJarModule` byte-for-byte in shape (implementation `new`, ERC1967Proxy init bytecode, salted CREATE2 predict + deploy-if-absent + mismatch revert; `packages/contracts/test/helpers/DeploymentBase.sol:718-759`). Register deploys first (module address zero in init), module second, wiring closes the loop.
- Call sites appended to `_deployCorePart2` after HypercertsModule (`DeploymentBase.sol:257-338` numbering continues at step 15c).
- `_wireModules` additions (`DeploymentBase.sol:341-385`):
  `commitmentRegister.setModule(module)`; `module.setGardenToken(gardenToken)`; `module.setHatsModule(hatsModule)`; `module.setActionRegistry(actionRegistry)`; `module.setCommitmentRegister(register)`; `module.setWorkApprovalResolver(workApprovalResolver)`; `module.setEAS(eas)`; `module.setSchemaUIDs(work, workApproval, legacyAssessment, assessmentV3)`; `gardenToken.setCommitmentPoolingModule(module)`; `workApprovalResolver.setCommitmentModule(module)`.
  The module is initialized paused; wiring verifies every emitted old/new configuration fact and
  calls `module.setPaused(false)` only after all dependency addresses, all four non-zero/distinct
  UIDs, reverse links, register module, and deployed bytecode match the transaction plan.

### 7.2 Artifacts

- `DeploymentResult` gains `address commitmentPoolingModule;` and `address commitmentRegister;` (`packages/contracts/script/DeployHelper.sol:42-72`) plus two `vm.serializeAddress` lines in `_saveDeployment` (`DeployHelper.sol:293-316`). Artifact keys: `commitmentPoolingModule`, `commitmentRegister` in `deployments/{chainId}-latest.json`.
- Do NOT extend the fixed `NetworkConfig` struct (`DeployHelper.sol:24-40`); the module has no external network dependency beyond what wiring provides (HypercertsModule precedent: deployed and wired without a NetworkConfig field).
- Schema artifact keys land via the standalone merge path (6.4.4), not `_saveDeployment`.

### 7.3 Order of operations for 42161 (August)

Deployment artifacts are the source of truth for addresses; pre-broadcast zero/missing addresses mean pending broadcast, post-broadcast they are blockers (root CLAUDE.md contract deployment rules).

Arbitrum Sepolia is not interchangeable with Ethereum Sepolia for protocol dependencies. The
official EAS repository publishes `421614` EAS
`0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE` and SchemaRegistry
`0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475`; the rehearsal consumes those addresses only after
chain-local bytecode/code-hash verification. Hats still has no official `421614` deployment in
the reviewed primary source, so the implementation lane adds a Bun-wrapped, version-pinned
test Hats bootstrap/dry-run path with constructor/configuration inputs and persisted code hashes.
It must never copy any `11155111` address into `421614` without proving the same contract exists
there. Unit/local/fork tests may use existing mocks, but a live rehearsal is blocked until every
chain-local dependency fact passes.

1. PR chain 1 (resolver/schema preparation): first commit pre-change generated baselines for
   AssessmentResolver, WorkApprovalResolver, and GardenToken. On Arbitrum Sepolia (`421614`),
   where no canonical Green Goods Assessment proxy is currently recorded, deterministically
   deploy the current v2 resolver/proxy, register and pin its non-zero v2 UID, record the
   pre-upgrade state, then rehearse the in-place upgrade. On Arbitrum One, read the live
   `schemaUID()` first; the verified 2026-07-24 value is zero, so the owner must set the existing
   v2 artifact UID before `setAssessmentV3SchemaUID`. Then deploy only
   CommunityTestimonyResolver, register AssessmentV3 against the same Assessment proxy, set its
   v3 UID, derive and one-way pin the Community Testimony UID while its module is zero, and verify
   v2/v3 parity. Community Testimony remains inactive at this step; its deterministic registry
   record is either absent or already exact because permissionless pre-registration is accepted
   only under exact reconciliation.
2. PR chain 2 (module + register + schema finalization): deploy `CommitmentRegister` +
   `CommitmentPoolingModule` proxies, wire module-side references, verify the Community Testimony
   resolver's pinned UID, register/reconcile the exact Community Testimony record while its module
   is still zero, activate the verified non-zero module proxy last, and run `setSchemaUIDs` with the
   chain's final non-zero, pairwise-distinct artifact values while the pooling module is paused.
   Verify dependency/schema events and module-side wiring, and keep the pooling module paused
   through PR chain 3. Repeat the exact sequence on Arbitrum One only after Arbitrum Sepolia
   evidence passes. Ethereum
   Sepolia (`11155111`) remains a legacy regression lane and does not substitute for the
   protocol's target-chain rehearsal.
3. PR chain 3 (upgrades): upgrade GardenToken implementation (6.3) and
   WorkApprovalResolver implementation (6.5); `setCommitmentPoolingModule` /
   `setCommitmentModule`; verify updater preservation, post-upgrade storage/ownership, and
   both-direction wiring; unpause the pooling module only after those reverse links and every
   chain-2 readiness fact pass; then register the protocol pool on the root garden
   (`deployments/42161-latest.json:40-43`) and backfill `registerPool` for the 13 live gardens.
4. Update `packages/indexer/config.yaml` addresses from zero-address placeholders and bump
   `start_block` (8.1).

### 7.4 Storage-layout and UUPS proof gate

The storage gate covers every contract introduced or upgraded by Commitment Pooling:
`CommitmentPoolingModule`, `CommitmentRegister`, `SettlementModule`,
`CeloSettlementExecutor`, `CommunityTestimonyResolver`, `AssessmentResolver`, `GardenToken`,
and `WorkApprovalResolver`.

- The implementation first fixes `script/check-storage-layout.sh`: check mode exits non-zero
  when a baseline is absent or differs, never writes, and corrects/removes the stale
  `DeploymentRegistry:src/DeploymentRegistry.sol` entry. Baseline regeneration is available
  only through an explicit `--update` action.
- `packages/contracts/package.json` gains
  `bun run --filter @green-goods/contracts check:storage-layout`; that Bun target is the only
  supported entry point and encapsulates every Forge inspection. Raw `forge` remains forbidden.
- Generated compiler layout is compared by fully qualified contract name, slot, offset, type,
  and label. `StorageLayout.t.sol` adds concrete `vm.load`/getter upgrade-preservation
  assertions for every appended field; arithmetic such as “named + gap == 50” is not accepted
  as slot proof.
- Each live UUPS upgrade test initializes representative pre-upgrade state, upgrades through
  the real proxy authorization path, asserts all old fields/owner/immutable dependencies are
  unchanged, and exercises rollback to the prior implementation in simulation.
- Assessment is specifically 2+48 → 3+47; GardenToken appends at slot 213 offset 2 and retains
  its 37-slot gap; WorkApprovalResolver is 2+48 → 3+47. New contracts commit their
  compiler-generated baseline before any deploy dry-run. Any prose feature-slot/gap count for a
  new contract is an expected design value only until the generated baseline confirms it.
- The deployment wrapper runs the read-only layout check before prediction or broadcast, and
  post-deploy verification confirms ERC-1967 implementation, proxy owner/admin boundary,
  initializer lock, bytecode hash, and persisted artifact address. A missing address before
  broadcast remains pending; a missing proof path or a post-broadcast zero/mismatch is a
  blocker.

The runnable command contract is exact:

```sh
# From packages/contracts. Phase A: the existing Assessment proxy is the only action that can run
# before its upgrade is authorized. Pure simulation and the sender-bound transaction plan do not
# claim that a later invocation can observe their ephemeral state.
bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --dry-run --pure-simulation
bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --tx-plan --sender <verified-421614-assessment-owner>

# Phase B: only after the separately authorized Assessment upgrade receipt and post-upgrade
# verifier pass. This chain-connected preparation dry-run observes the upgraded live proxy.
bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --dry-run

# Phase C: only after the separately authorized schema-preparation broadcast and artifact verifier
# pass. The module/register deploy dry-run observes the prepared resolver artifact.
bun script/deploy.ts commitment-pooling --network arbitrum-sepolia --dry-run

# Phase D: only after the separately authorized module/register broadcast and post-deploy verifier
# pass. Finalization reads that verified artifact; the grouped upgrade is separately simulated and
# planned with a sender equal to the live owner of both existing proxies.
bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --finalize-community-testimony --dry-run
bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --dry-run --pure-simulation
bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --tx-plan --sender <verified-421614-pooling-upgrade-owner>

# Arbitrum One repeats the same four phases only after every Arbitrum Sepolia phase and
# post-deploy verifier passes.
bun script/upgrade.ts assessment-resolver --network arbitrum --dry-run --pure-simulation
bun script/upgrade.ts assessment-resolver --network arbitrum --tx-plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6
bun script/deploy.ts commitment-schemas --network arbitrum --dry-run
bun script/deploy.ts commitment-pooling --network arbitrum --dry-run
bun script/deploy.ts commitment-schemas --network arbitrum --finalize-community-testimony --dry-run
bun script/upgrade.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
bun script/upgrade.ts commitment-pooling --network arbitrum --tx-plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6

# One-shot backfill stays in the plan hub, not scripts/. It reads the deployment
# artifact, prints the root + 13 garden calls, and writes no state in dry-run mode.
bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

# Post-broadcast targets below are also created by this lane. They run only after separately
# authorized broadcasts and config address replacement.
bun run verify:post-deploy:arbitrum-sepolia
bun run verify:post-deploy:indexer:arbitrum-sepolia
bun run verify:post-deploy:arbitrum
bun run verify:post-deploy:indexer:arbitrum
```

`upgrade.ts assessment-resolver` is the only Assessment proxy-upgrade path. The
`--sender` value on every transaction plan is mandatory and must equal the live proxy `owner()`;
the `421614` value is read from and checked against that chain's v2 bootstrap artifact, while the
verified `42161` owner is pinned above. A mismatch or missing sender fails before plan persistence.
Both angle-bracketed `421614` senders are mandatory future artifact inputs, not optional
placeholders or inferred defaults. The grouped pooling upgrade additionally verifies that
GardenToken and WorkApprovalResolver have the same live owner before persisting one transaction
plan; differing owners require separately named targets and plans rather than an inferred sender.
Each chain-connected command above is illegal until the preceding stage's separately authorized
receipt, post-action verification, and persisted artifact pass. No dry-run relies on state from a
separate pure-simulation process. The complete sequence is rehearsed first on deterministic local
chains and Arbitrum Sepolia. `--finalize-community-testimony` requires the verified
module/register artifact, never accepts an address override, and proves the pinned UID plus exact
registry record before activating the verified module last. `upgrade.ts commitment-pooling`
upgrades exactly GardenToken and
WorkApprovalResolver, verifies implementation slots and storage baselines, wires both module
setters, and merges no schema keys. `backfill-pools.ts` persists a resumable result artifact at
`.plans/active/commitment-pooling/artifacts/{chainId}-pool-backfill.json` keyed by garden; dry-run
produces a simulation artifact under `.generated/runtime` only, while an explicitly authorized
broadcast records tx hash, receipt block, and resulting poolId per garden. Deploy dry-runs write
simulation output only; broadcasts merge only the named append-only keys. All invocations use bun
wrappers; never raw forge (`.claude/rules/contracts.md`).

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
      - event: CycleOpened(uint256 indexed cycleId, uint256 indexed poolId, uint16 gardenersBps, uint16 treasuryBps, uint16 operatorBps, uint16 evaluatorBps, uint16 communityBps, uint16 funderBps, uint16 equalParticipationBps, uint16 verifiedContributionBps)
      - event: CycleClosed(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleComposted(uint256 indexed cycleId, uint256 indexed poolId)
      - event: CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID)
      - event: CommitmentCreated(uint256 indexed commitmentId, uint256 indexed poolId, uint256 indexed cycleId, address creator, address recordedBy, uint8 direction, uint8 commitmentType, uint8 claimType, uint8 claimMode, uint8 contributorPolicy, uint8[] domains, uint256[] requirementActionUIDs, uint8[] requirementDomains, uint32[] requirementRequiredCounts, string unitLabel, uint256 targetUnits, bool requiresAssessment, uint64 dueDate, string metadataCID, bytes32 needUID)
      - event: RewardDeclared(uint256 indexed commitmentId, uint8 rail, address source, address token, uint256 amount)
      - event: ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold)
      - event: ClaimRequested(uint256 indexed commitmentId, address indexed claimant, address indexed requestedBy, uint8 kind, address gardenContext, uint64 requestedAt)
      - event: ClaimDeclined(uint256 indexed commitmentId, address indexed claimant, string reasonCID)
      - event: CommitmentAccepted(uint256 indexed commitmentId, address indexed claimant, address indexed counterparty, uint8 kind, address gardenContext, address leadProvider, address providerGarden)
      - event: ContributorAdded(uint256 indexed commitmentId, address indexed contributor, address indexed addedBy)
      - event: ContributorRemoved(uint256 indexed commitmentId, address indexed contributor, address indexed removedBy)
      - event: ContributorRequirementAssigned(uint256 indexed commitmentId, address indexed contributor, uint16 indexed requirementIndex, bool assigned)
      - event: ContributorRosterFrozen(uint256 indexed commitmentId, uint32 contributorCount)
      - event: WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address indexed contributor, uint16 requirementIndex, address linker)
      - event: WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker)
      - event: ApprovedWorkCounted(uint256 indexed commitmentId, bytes32 indexed workUID, address indexed contributor, bytes32 approvalUID, uint16 requirementIndex, uint32 approvedWorkCount, uint256 approvedUnits, uint256 newlyApprovedUnits)
      - event: EvidenceAttached(uint256 indexed commitmentId, string cid, address indexed attacher, address[] creditedContributors)
      - event: AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher)
      - event: CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason)
      - event: ConfirmationRecorded(uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold)
      - event: CommitmentFulfilled(uint256 indexed commitmentId, bool fallbackConfirmation, string reason)
      - event: CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID)
      - event: CommitmentExpired(uint256 indexed commitmentId, address indexed caller)
      - event: CommitmentDisputed(uint256 indexed commitmentId, address indexed raiser, uint8 previousState, string reasonCID)
      - event: DisputeResolved(uint256 indexed commitmentId, uint8 resolution, uint8 finalState, string reasonCID)
      - event: RewardPaid(uint256 indexed commitmentId, address indexed source, address indexed recipient, address token, uint256 amount, bytes32 payoutRef, address recordedBy)
      - event: ModuleDependencyUpdated(uint8 indexed dependency, address indexed previousAddress, address indexed newAddress)
      - event: ModuleSchemaUIDUpdated(uint8 indexed schemaKind, bytes32 previousUID, bytes32 newUID)
      - event: ModulePauseStatusChanged(bool previousPaused, bool paused)
  - name: CommitmentRegister
    handler: src/EventHandlers.ts
    events:
      - event: ModuleUpdated(address indexed oldModule, address indexed newModule)
      - event: ProviderOpenCommitmentCapUpdated(uint256 indexed poolId, uint256 cap)
      - event: ClassRegistered(uint256 indexed classId, uint256 indexed poolId, uint256 cycleId, string unitLabel, uint256 quota)
      - event: UnitsCommitted(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalCommitted)
      - event: UnitsReleased(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalCommitted)
      - event: UnitsFulfilled(uint256 indexed classId, uint256 indexed poolId, address indexed account, uint256 cycleId, string unitLabel, uint256 units, uint256 totalFulfilled)
```

Pooling network entries are `42161` and `421614`; both start with zero-address placeholders until
broadcast and then swap to verified artifact addresses. Existing `11155111` blocks remain
untouched as a legacy regression lane and receive no pooling block unless Green Goods separately
decides to deploy the pooling contracts there.

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
enum CommitmentContributorPolicy { UNKNOWN OPEN LEAD_MANAGED }
enum CommitmentRewardRail { UNKNOWN NONE ARBITRUM_EXTERNAL CELO_SETTLEMENT }
enum CommitmentClaimRequestState { PENDING ACCEPTED DECLINED SUPERSEDED }
enum CommitmentUnitScope { POOL CYCLE }
  enum CommitmentEventType {
    MODULE_UPDATED
    MODULE_DEPENDENCY_UPDATED MODULE_SCHEMA_UID_UPDATED MODULE_PAUSE_STATUS_CHANGED
  POOL_REGISTERED POOL_CHARTER_UPDATED POOL_READY POOL_OPENED POOL_PAUSED
  POOL_RESUMED POOL_CLOSED POOL_COMPOSTED POOL_REOPENED
  CLASS_REGISTERED PROVIDER_OPEN_COMMITMENT_CAP_UPDATED
  CYCLE_SEEDED CYCLE_OPENED CYCLE_CLOSED CYCLE_COMPOSTED CYCLE_CANCELLED
  CREATED REWARD_DECLARED CONFIRMER_RULE_SET CLAIM_REQUESTED CLAIM_DECLINED ACCEPTED
  CONTRIBUTOR_ADDED CONTRIBUTOR_REMOVED CONTRIBUTOR_REQUIREMENT_ASSIGNED CONTRIBUTOR_ROSTER_FROZEN
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
  providerOpenCommitmentCap: BigInt!
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
  # Count-safe cross-commitment stats. Unit totals live only in exact-label
  # CommitmentUnitSummary rows.
  openCommitmentCount: BigInt! # accepted commitments not released or fulfilled
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
  equalParticipationBps: Int!
  verifiedContributionBps: Int!
  # Per-cycle count stats. Unit totals live in exact-label summary rows.
  commitmentsAccepted: BigInt!
  commitmentsReadyForConfirmation: BigInt!
  commitmentsFulfilled: BigInt!
  commitmentsCancelled: BigInt!
  commitmentsExpired: BigInt!
  commitmentsDisputed: BigInt!
  commitmentsDue: BigInt!
  openCommitmentCount: BigInt!
  createdAt: Int!
  updatedAt: Int!
}

# Exact-label aggregate. Identity uses keccak256 of the exact stored UTF-8
# unitLabel bytes: "hours" and "Hours" intentionally produce separate rows.
# Pool summary id: chainId-POOL-poolId-unitLabelHash
# Cycle summary id: chainId-CYCLE-cycleId-unitLabelHash
type CommitmentUnitSummary {
  id: ID!
  chainId: Int!
  scope: CommitmentUnitScope!
  scopeId: BigInt!
  poolId: BigInt!
  poolEntityId: String!
  cycleId: BigInt
  cycleEntityId: String
  unitLabel: String!
  unitLabelHash: String!
  expectedUnits: BigInt!
  approvedUnits: BigInt!
  fulfilledUnits: BigInt!
  openUnits: BigInt!
  updatedAt: Int!
}

# Current concurrent commitment count for one accountable lead provider in one pool.
type CommitmentProviderExposure {
  id: ID! # chainId-poolId-lowercaseProvider
  chainId: Int!
  poolId: BigInt!
  poolEntityId: String!
  provider: String! # lead provider; field name retained only for this generic exposure entity
  openCommitmentCount: BigInt!
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
  leadProvider: String # Offer creator; Individual Request counterparty; Garden Request requestedBy
  providerGarden: String # EAS recipient/provider role scope after acceptance
  providerGardenId: String # relationship: chainId-lowercaseProviderGarden
  counterpartyKind: CommitmentClaimType
  direction: CommitmentDirection!
  commitmentType: CommitmentKind!
  state: CommitmentOnchainState!
  claimType: CommitmentClaimType!
  claimMode: CommitmentClaimMode!
  contributorPolicy: CommitmentContributorPolicy!
  domains: [Int!]! # unique derived tags; not positional and not a cardinality bound
  requirementCount: Int!
  contributorCount: Int!
  contributorsFrozen: Boolean!
  contributorEntityIds: [String!]!
  unitLabel: String!
  targetUnits: BigInt!
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
  evidenceCount: Int!
  dueDate: BigInt!
  rewardRail: CommitmentRewardRail!
  rewardSource: String
  rewardRecipient: String # ArbitrumExternal RewardPaid recipient only; Celo beneficiary is on Disbursement
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

# Per-requirement progress read model: one row per bound
# action so surfaces can render "Action × approved/required" without decoding arrays.
type CommitmentRequirement {
  id: ID! # chainId-commitmentId-requirementIndex
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String! # relationship: chainId-commitmentId
  requirementIndex: Int!
  domain: Int! # ActionRegistry-derived tag; repeated domains are valid
  actionUID: BigInt!
  requiredCount: Int!
  approvedCount: Int! # incremented by ApprovedWorkCounted.requirementIndex
  createdAt: Int!
  updatedAt: Int!
}

type CommitmentContributor {
  id: ID! # chainId-commitmentId-lowercaseContributor
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributor: String!
  active: Boolean!
  isLead: Boolean!
  approvedWorkCredits: Int!
  evidenceCredits: Int!
  requirementIndexes: [Int!]!
  recognitionWeightBps: Int
  recognitionUnits: BigInt
  addedBy: String!
  addedAt: Int!
  removedBy: String
  removedAt: Int
  updatedAt: Int!
}

type CommitmentContributorIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributorEntityIds: [String!]! # stable event order
  updatedAt: Int!
}

type CommitmentEvidenceAttribution {
  id: ID! # chainId-commitmentId-keccak256(cid)-lowercaseContributor
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  cid: String!
  contributor: String!
  contributorEntityId: String!
  attacher: String!
  confirmed: Boolean! # flips when the commitment is fulfilled
  createdAt: Int!
  updatedAt: Int!
}

# Event-owned lookup companion used when fulfillment confirms every evidence
# attribution without relying on a database-wide scan.
type CommitmentEvidenceAttributionIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  attributionEntityIds: [String!]! # stable event order; each ID is loaded directly
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
  poolId: BigInt # null for pool-less module/register configuration events
  poolEntityId: String # relationship: chainId-poolId; null with poolId
  cycleId: BigInt
  cycleEntityId: String # relationship: chainId-cycleId
  commitmentId: BigInt
  commitmentEntityId: String # relationship: chainId-commitmentId
  eventType: CommitmentEventType!
  actor: String # only an explicit event actor; never inferred from transaction.from
  configurationKey: Int # dependency/schema enum ordinal; null for ModuleUpdated/pause
  previousValue: String # normalized address/bytes32/bool configuration value
  newValue: String # normalized address/bytes32/bool configuration value
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
- **Create-if-not-exists, exact defaults**: update-before-create handlers materialize placeholders instead of throwing (`createDefaultGarden` precedent, `packages/indexer/src/handlers/helpers.ts:89-110`; `.claude/rules/indexer.md`). Pool placeholders use `UNKNOWN` type/state, empty garden/gardenId/charter, empty campaign arrays, null open Season, and zero counters/timestamps except `updatedAt = event.block.timestamp`. Cycle placeholders use `UNKNOWN` type/state, zero raw IDs, composite relation IDs derived from the event when present, empty metadata, zero allocation/counters, and event timestamps. Commitment placeholders use `UNKNOWN` direction/kind/state/claim type/mode, empty strings/arrays, zero numeric counters, null optional relations/provider/reward/dispute fields, and event timestamps. Unit-summary placeholders preserve their exact scope/label identity and start every unit counter at zero; provider-exposure placeholders preserve pool/provider identity and start at zero. A later creation event overwrites immutable placeholder facts but never resets already-applied monotonic counters or terminal state. Tests exercise each placeholder merge.
- **ID helpers**: add `getGardenId(chainId, garden)`, `getCommitmentPoolId(chainId, poolId)`,
  `getCommitmentCycleId(chainId, cycleId)`, `getCommitmentId(chainId, commitmentId)`,
  `getCommitmentContributorId(chainId, commitmentId, contributor)`,
  `getCommitmentEvidenceAttributionId(chainId, commitmentId, cid, contributor)`,
  `getCommitmentEvidenceAttributionIndexId(chainId, commitmentId)`,
  `getCommitmentClaimRequestId(chainId, commitmentId, claimant)`,
  `getCommitmentUnitSummaryId(chainId, scope, scopeId, unitLabelHash)`,
  `getCommitmentProviderExposureId(chainId, poolId, leadProvider)`,
  `getNeedCommitmentIndexId(chainId, needUID)`, and
  `getCommitmentEventId(chainId, txHash, logIndex)` to
  `packages/indexer/src/handlers/helpers.ts`, re-exported through
  `packages/indexer/src/handlers/shared.ts`. The one canonical label hash is
  `viem.keccak256(viem.stringToBytes(unitLabel))`; implementation adds direct
  `viem: "2.55.0"` to `packages/indexer/package.json`, matching the root pin, rather than relying
  on any Envio-internal viem version. Corrected and merged PR #649 (`envio@3.2.1`) is a hard
  prerequisite for this lane. Adding the direct dependency or installing the migration
  dependencies still requires explicit repository-owner approval at implementation time; this
  plan does not authorize an install. Exact strings use no trim, case fold, Unicode normalization,
  locale transform, or ABI encoding. Raw numeric IDs and addresses remain display/filter
  attributes only; every cross-entity pointer uses its composite relationship field.
- **Creation payload completeness**: `CommitmentCreated` initializes contributor policy, derived
  domain tags, requirement action/domain/count arrays, `requiresAssessment`, `metadataCID`, and
  `needUID` directly, and seeds one `CommitmentRequirement` row per requirement. Handlers must
  not backfill these immutable facts from RPC reads or assume defaults that differ from the event.
  - **Pool-less authority/configuration audit**: `ModuleUpdated`,
    `ModuleDependencyUpdated`, `ModuleSchemaUIDUpdated`, and `ModulePauseStatusChanged` each create
    exactly one replay-idempotent `CommitmentEvent` with the matching event type, nullable
    `configurationKey`, normalized `previousValue`/`newValue`, and null
    pool/cycle/commitment relationships. Address and bytes32 values use lowercase canonical hex;
    booleans use `false`/`true`. These events mutate no pool, cycle, commitment, unit-summary, or
    provider-exposure row, and never use a synthetic pool `0` or `transaction.from`.
- **Claim request and contributor lifecycle**: `ClaimRequested` upserts
  `${chainId}-${commitmentId}-${claimant}` as `PENDING` from emitted canonical claimant,
  `requestedBy`, kind, context, and requestedAt, then appends that ID once to the request index.
  `ClaimDeclined` marks that key `DECLINED`. `CommitmentAccepted` carries
  claimant/counterparty/leadProvider/providerGarden, marks the matching request `ACCEPTED`, marks
  siblings `SUPERSEDED`, and relies on the same-transaction `ContributorAdded` event to create the
  lead's roster row. Contributor add/remove/assignment events update the composite contributor
  row and stable contributor index. `ContributorRosterFrozen` locks the read model. Every
  `EvidenceAttached` event increments the commitment's `evidenceCount` exactly once, then walks
  `creditedContributors` in emitted order. For each address it upserts the
  `(commitmentId, cid, contributor)` attribution row, appends that row ID exactly once to
  `CommitmentEvidenceAttributionIndex.attributionEntityIds`, and increments that contributor's
  `evidenceCredits` exactly once. Work events separately increment the named contributor's
  `approvedWorkCredits`. Fulfillment loads the bounded attribution index and marks each referenced
  attribution confirmed, never using a database-wide scan. The indexer never increments
  on-chain-style contributor credits again at fulfillment.
- **Address normalization**: `normalizeAddress` for every address field (`helpers.ts:68-70`). Generic `CommitmentEvent.actor` is nullable and is populated only from an explicit actor parameter; never infer account-abstraction identity from `transaction.from`.
- **Approved-unit delta**: `ApprovedWorkCounted.approvedUnits` replaces the commitment's cumulative
  value. The handler asserts `new cumulative == prior cumulative + delta`, writes the matching
  `CommitmentRequirement.approvedCount`, increments the emitted contributor's
  `approvedWorkCredits`, and increments only the exact-label pool/cycle
  `CommitmentUnitSummary.approvedUnits` by emitted `newlyApprovedUnits`. An exact event replay
  changes nothing; cumulative event values are never summed.
- **Register events and count safety**: the three unit events carry `poolId`, `cycleId`, and the
  exact stored `unitLabel`; handlers never need a Commitment lookup or RPC call to choose their
  keys. `UnitsCommitted` increments `CommitmentPool.openCommitmentCount` and
  `CommitmentProviderExposure.openCommitmentCount` by exactly one regardless of `units`;
  `UnitsReleased` and `UnitsFulfilled` decrement them once. When `cycleId != 0`, the same delta
  applies to that cycle; `cycleId == 0` creates no cycle-scoped row. The events update only the
  matching exact-label `CommitmentUnitSummary`: commit increments expected/open units, release
  decrements open units, and fulfill decrements open plus increments fulfilled. `hours` and
  `Hours` never share an ID. Tests process each unit event before `CommitmentCreated` and prove
  the self-describing keys still converge, alongside same-label, case-distinct, replay,
  cancellation/expiry, fulfillment, and dispute fixtures.
- **Need lineage**: non-zero `CommitmentCreated.needUID` appends the composite commitment/cycle IDs once to `NeedCommitmentIndex`; Fulfilled appends the commitment to `fulfilledCommitmentEntityIds`; commitment-bundled Hypercert handling appends its composite Hypercert ID. UID zero creates no index row. This is reference indexing from Green Goods events/metadata, not EAS indexing.

**Existing Garden ID migration (required, not a compatibility footnote).** Before these handlers ship, change `Garden.id` from the legacy lowercase address to `${chainId}-${lowercaseAddress}` and update every foreign key, helper, generated operation, handler lookup, shared query, fixture, and consumer. Exact relationship additions are: `GardenDomains.gardenId`; `GardenVault.gardenId`; `GardenVaultIndex.gardenId`; `VaultAddressIndex.gardenId`; `VaultDeposit.gardenId`; `VaultEvent.gardenId`; `YieldAllocation.gardenId`; `Hypercert.gardenId`; `CampaignCookieJar.sourceGardenIds`; and `Gardener.firstGardenId`/`gardenIds`, plus the new commitment/settlement fields above. Existing raw `garden`, `sourceGardens`, `firstGarden`, and `gardens` addresses remain filter/display attributes, never relationship keys. There is no mixed-ID period: deploy the schema/handlers together, perform a full Envio replay for every configured chain, run the shared query cutover against the replayed dataset, then switch consumers. Acceptance proves Arbitrum and Sepolia copies of the same address remain distinct and no raw-address Garden lookup remains.

**Generated-config preservation.** Extend both `packages/contracts/script/utils/envio-integration.ts` and `packages/indexer/scripts/check-indexing-boundary.mjs` allowlists for `CommitmentPoolingModule`, `CommitmentRegister`, `SettlementModule`, and `CeloSettlementExecutor`. A regression fixture must run the deployment-artifact updater twice and prove all four contract blocks and exact event signatures survive unchanged; unknown EAS or Celo token blocks must still fail the boundary check.

Run `bun codegen` in `packages/indexer` after the schema/config edits and before writing handler
code (`.claude/rules/indexer.md`). Codegen acceptance includes typed
`CommitmentClaimRequestIndex` and `CommitmentEvidenceAttributionIndex` stores. Handler tests prove
two pending requests become one `ACCEPTED` plus one `SUPERSEDED`, and multiple evidence rows
become confirmed on fulfillment, using only their bounded event-owned indexes and no
database-wide scan.

### 8.4 Stat derivation contract

Cross-commitment arithmetic is count-based. `promiseKeptRate` is the only cross-commitment percentage and is computed in shared selectors, never stored as a float:

| Aggregate | Numerator | Denominator | Notes |
|---|---|---|---|
| promiseKeptRate | `commitmentsFulfilled` | `commitmentsDue` (accepted minus cancelled) | per pool/cycle; expiries count against; mutual releases do not |
| openCommitmentCount | event-driven current count | none | accepted commitments not released or fulfilled; count-safe across unit labels |

Active-cycle surfaces show state counts and exact-label `CommitmentUnitSummary` groups instead of a synthetic overall progress percentage. Per-commitment `approvedUnits / targetUnits` remains meaningful within that commitment only. No selector may sum unit totals across different `unitLabelHash` values.

## 9. Hypercert cut-over

Zero HypercertsModule contract changes. The cut-over swaps the bundling unit and the allocation source; the mint pipeline is untouched.

### 9.1 Bundling unit

- Today: operator curates approved Work attestations at mint time; UIDs land in `Hypercert.attestationUIDs` via IPFS metadata parse (`reports/corrections-log.md` §2 Hypercert row; `packages/indexer/src/handlers/hypercerts.ts:150-165`).
- After cut-over: the bundling unit is fulfilled commitments. The mint metadata composer (shared, `reports/corrections-log.md` §4 pointer to `packages/shared/src/modules/data/hypercerts-metadata.ts`) writes `bundleKind: "COMMITMENT"`, raw `commitmentIds`, composite `commitmentEntityIds`, and ascending unique non-zero `needUIDs`, and nests each commitment's work attestation UIDs and evidence CIDs as evidence within the IPFS metadata. Work stays visible as evidence; commitments are the impact claims.
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
- App-computed: per-address allowlist expansion. Treasury, steward, evaluator, community, and
  funder classes resolve as before. The gardeners class resolves through fulfilled commitments
  and their frozen eligible contributors, never through singular providers:
  1. sort fulfilled commitment IDs ascending, assign each
     `floor(gardenersClassUnits / fulfilledCommitmentCount)`, then give the first
     `gardenersClassUnits % fulfilledCommitmentCount` commitments one additional unit in that
     order;
  2. within each commitment, eligible contributors are frozen contributors with at least one
     approved linked Work credit or evidence credit on the now-Fulfilled commitment;
  3. allocate `recognitionPolicy.equalParticipationBps` equally across eligible contributors;
  4. allocate `recognitionPolicy.verifiedContributionBps` in proportion to each contributor's
     verified credit count (`approvedWorkCredits + evidenceCredits`);
  5. assign integer remainders by descending verified weight, then ascending lowercase address.
  The protocol preset is 2_000 equal / 8_000 verified. The steward selects the policy at cycle
  open, where it snapshots immutably and must sum to 10_000; cycle-less commitments use the same
  immutable protocol preset for contributor recognition and payout defaults only. They are
  ineligible for COMMITMENT-bundle Hypercert minting because no `CycleOpened` six-role allocation
  snapshot exists; the composer rejects any selected `cycleId == 0` commitment before allowlist or
  metadata construction, and the admin UI labels those commitments “No cycle allocation · not
  certificate eligible.” There is no automatic lead fallback and no metadata-only recognition
  override: every Ready transition and direct Fulfilled dispute resolution rejects zero eligible
  contributors before freezing/finalizing the roster. W26 treats a zero-eligible Fulfilled record
  as an inconsistent legacy or indexed state, blocks certificate expansion, and requires a
  governed migration or source-data correction rather than pretending mint metadata changed the
  on-chain counters. The final canonical addresses and units continue through the existing
  validation, IPFS upload, and merkle-root pipeline unchanged
  (`reports/corrections-log.md` §2).
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

- A COMMITMENT-bundle mint accepts only fulfilled commitments from one non-zero cycle, produces an
  indexed Hypercert with `bundleKind: COMMITMENT` and populated `commitmentIds`, and rejects any
  `cycleId == 0` selection before metadata or allowlist construction. A legacy mint still resolves
  `WORK_LEGACY`.
- Cycle-open bps snapshot equals the allocation encoded in the minted allowlist within rounding (app test).
- The gardeners-class expansion covers solo and team commitments, equal cross-commitment budgets,
  the 20/80 preset, deterministic tie/rounding behavior, zero-eligible blocking with no lead
  fallback, and rejection of any inconsistent legacy/indexed zero-eligible state. There is no
  metadata-only attribution repair; a governed migration or source-data correction must restore
  canonical on-chain credit before expansion. Once every fulfilled commitment has an eligible
  contributor, the result sums exactly to the gardeners-class units.
- No change to `HypercertsModule` bytecode; `createAllowlistAndRegister` call shape is identical.

## 10. Package-Level Backlog

Each block below is shaped as a package-level implementation surface with acceptance criteria and
validation hints. Current thin lane mirrors are PRD-721 contracts, PRD-722 indexer, PRD-723
state/API, PRD-724 client, PRD-725 admin, PRD-726 editorial, PRD-727 docs, and PRD-728
walkthrough videos. PRD-671..681 remain historical labels only. Current feature order is Envio
foundation -> existing contract cleanup -> architecture freeze -> contracts/indexer/shared ->
authorized non-value broadcast and live indexer read-back -> existing admin/UI foundation ->
client/admin/editorial -> staging QA Pass 1 -> documentation polish -> QA Pass 2 -> walkthrough
videos.

### `packages/contracts` PR chain 1: schemas and resolvers (FIRST, register #26)

Deliverables: `AssessmentV3Schema` + `CommunityTestimonySchema` structs in `src/Schemas.sol`;
an in-place `src/resolvers/Assessment.sol` UUPS upgrade plus NET-NEW
`src/resolvers/CommunityTestimony.sol`; `config/schemas.json` keys `assessmentV3` +
`communityTestimony`; the existing `script/upgrade.ts assessment-resolver` UUPS target;
`script/DeployCommitmentSchemas.s.sol` +
`script/deploy/commitment-schemas.ts` registration/deploy wiring; validate-script extensions;
dual-schema Assessment upgrade tests, Community Testimony tests, and storage-layout baselines.

Acceptance: 6.4 acceptance criteria pass; Arbitrum Sepolia upgrade/registration rehearsal,
including AssessmentV3 registration and Community resolver deployment; Community Testimony
UID is pinned while its module remains zero, an empty or already-exact permissionless registry
record is proven, and activation remains pending until PR chain 2 supplies and verifies the
module. The existing
Assessment proxy address, owner, v2 UID, and v2 artifact keys remain byte-identical; no
`assessmentV3Resolver` is emitted; `bun run test` green in `packages/contracts`.

### `packages/contracts` PR chain 2: module + register

Deliverables: `src/modules/CommitmentPooling.sol`, `src/registries/Commitment.sol`, both interfaces, unit + fork tests, `DeploymentBase.sol` deploy helpers + wiring, `DeployHelper.sol` result fields + serialization, storage-layout entries + baselines + `StorageLayout.t.sol` additions.

Acceptance: 6.1 and 6.2 acceptance criteria pass; Arbitrum Sepolia full-stack dry-run deploys
the module/register, verifies the Community resolver's one-way pinned UID, reconciles the exact
Community Testimony record while the resolver is inactive, activates the verified non-zero module
last, sets final module schema UIDs, verifies module-side configuration, and leaves the pooling
module paused. Operational smoke remains blocked until PR chain 3 installs and verifies both
reverse links. Arbitrum One broadcast remains gated on chain-3 readiness and separate human
authorization.

### `packages/contracts` PR chain 3: live upgrades + backfill

Deliverables: GardenToken change set (6.3), WorkApprovalResolver bridge (6.5), 42161 broadcast runbook (one-shot ops doc in `.plans/active/commitment-pooling/`, not `scripts/`), protocol pool registration, 13-garden pool backfill.

Acceptance: storage-layout gates green pre-broadcast; GardenToken and WorkApprovalResolver are
upgraded and both reverse links are verified while pooling remains paused; unpause succeeds only
after every chain-2 and chain-3 readiness fact passes; protocol/root and live-garden pools are then
registered; a scripted offer -> fulfilled smoke passes; the post-broadcast artifact shows both new
addresses and non-zero pool count; and a live approval on an existing garden emits
`ApprovedWorkCounted` for a linked work.

### `packages/indexer`

Deliverables: `config.yaml` blocks (8.1, zero-address placeholders until broadcast), `schema.graphql` entities + enums (8.2, 9.2), `src/handlers/commitmentPool.ts`, hypercerts handler `bundleKind` extension, helper ID functions, `EventHandlers.ts` import, handler tests, `bun codegen` artifacts.

Acceptance: local Docker stack replays a scripted Sepolia fixture and produces correct pool/cycle counts, provider exposure rows, and exact-label unit summaries; `promiseKeptRate` derives with integer math only; no EAS reads anywhere in handlers.

### `packages/shared`

Deliverables: domain types (`CommitmentPool`, `CommitmentCycle`, `Commitment`, allocation preset constants; `Address` type per repo rules); ABI + address exports from the deployment artifact (import pattern per root CLAUDE.md Contract Integration); query hooks + `queryKeys.*` entries; derived-state selectors implementing the section 5 overlays (Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, Reconciled) and the 8.4 rate math; **six August action/job kinds**: offline queue kinds `commitment` (create offer/request), `claim` (claim/accept), `evidence` (attach evidence CID), `workLink` (link approved work), and `confirmation` (confirm fulfillment), plus online-only wallet action `transfer` (settlement-chain G$ send), extending the exactly-two-kinds baseline where applicable (`packages/shared/src/types/job-queue.ts` + `packages/shared/src/modules/job-queue/`, `reports/corrections-log.md` §6); mutation hooks with `createMutationErrorHandler`.

Acceptance: hooks exported from the barrel only; the five offline pool job kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) run through the existing IndexedDB + XState machine with MAX_RETRIES parity; `transfer` is an online-only settlement wallet action with no offline queue entry and no MAX_RETRIES replay (per `uiux-spec.md` §4.2 and `settlement-spec.md` §5); locale keys mirrored es/pt (repo i18n gate); `bun run --filter @green-goods/shared test` green.

### `packages/admin`

Deliverables (full flows in `uiux-spec.md`; contract touchpoints listed here): steward seeding console (createCommitment with confirmer rule + declared reward + claim mode), cycle management across 5.2, claims queue (`acceptClaim`), analog capture (StewardCaptured via `onBehalfOf`, extending the `SubmitWork` on-behalf precedent), per-cycle assessment creation against the v3 schema, allocation preset picker at cycle open, dispute handling, `RewardPaid` recording. Garden workspace + new Pools workspace per register #10.

Acceptance: every module write goes through shared mutation hooks; no direct contract calls in views; admin remains restrained (no hero moments).

### `packages/client`

Deliverables (full flows in `uiux-spec.md`): offer/request creation, browse/claim, work linkage through the existing MDR flow, evidence capture, counterparty confirmation, commitment + cycle views in the Garden tab; personal commitments + pending-confirmations panel on the Profile wallet surface; settlement reward status + G$ send affordance per `settlement-spec.md`; Fulfilled and cycle-close hero moments (register #27, client only). The five August offline job kinds cover field actions where applicable; G$ send is an explicit online wallet action on Celo.

Acceptance: offline queue proof for each field action; mutual-aid copy only (banned-vocab lint passes).

### Editorial website (client public routes)

Deliverables: `/gardens/:id` GardenDialog pool view, cycle state counts plus exact-label summaries, promises-kept stats; `/impact` protocol-wide pool aggregates. Read-only, aggregate-only, no new routes (register #21).

Acceptance: renders exclusively from indexer aggregates; no per-person listings; small-community sensitivity respected (readiness copy before live numbers).

## 11. Native Phases and Operational Checkpoints

### Native phase 1: Scope and Design — closes 2026-07-22

Goal: finish the audit reconciliation with one authoritative interface, lifecycle, dispatch, release, and evidence model.
Exit criteria: specs, handoffs, acceptance sources, machine state, and generated planning artifacts agree or name an explicit external blocker.

### Native phase 2: Build — closes 2026-07-31

Goal: implement and verify the scoped product lanes during the remaining July build window, then
broadcast and activate the non-value pooling/register/schema tier by July 31 only after its complete
three-PR-chain dependency sequence, narrower evidence gate, and explicit human authorization pass.
Build completion alone is not authorization or a public-live claim.
Exit criteria, in dependency order:

1. Schemas registered on Sepolia + Arbitrum with resolvers live (PR chain 1); baselines attestable before cycle 1 opens.
2. Module + register deployed with module-side wiring verified, storage baselines committed, and
   pooling still paused (PR chain 2).
3. GardenToken + WorkApprovalResolver upgraded on 42161; reverse links verified; pooling unpaused;
   protocol pool + 13 garden pools registered; operational smoke passed (PR chain 3).
4. Indexer serving the four core aggregates plus settlement/disbursement status from Green Goods core events alone.
5. Shared substrate (types, hooks, five offline queue job kinds plus online wallet `transfer`, settlement selectors) consumed by admin + client + editorial surfaces.
6. First cycle is ready to seed and open with an allocation preset; the non-value deployments have persisted post-deploy and rollback proof; and the commitment, confirmation, reward, and settlement paths have deployment-grade proof without treating the July broadcast as a user-facing release or value-tier authorization.

### Native phase 3: Release — 2026-08-12

Goal: release the user-facing pooling flow, preserve the July non-value deployment proof, and complete one bounded production proof. The fixed date does not waive the value-tier gates or human authorization in `handoffs/human-release-ops.md`.
Exit criteria: user-facing release authorization; persisted July deployment and post-deploy evidence; first real cycle opened; first team commitment fulfilled with eligible counterparty confirmation; first Arbitrum-rail `RewardPaid` recorded; and, only if every value-tier gate passes, one contributor child payout executed from the provider garden's registered Celo Safe under a conserved parent plan, acknowledged through authenticated Celo → Arbitrum CCIP, indexed as `Confirmed`, and visible as “support arrived.” A dispatch, Celo execution, timeout, or operator report without that acknowledgment is not confirmation. A blocked settlement leg remains blocked rather than weakening Release evidence.

### Native phase 4: Follow On / Hardening — 2026-09-30

Goal: use pilot evidence to harden accepted paths and make explicit promote/defer decisions in parallel with the separately labeled September Community and settlement-evidence checkpoint.
Exit criteria: evidence-backed decisions only. This date authorizes no follow-on implementation, transferable voucher, credit, arbitrary bridge executor, or custody expansion.

### Operational checkpoint: July dry run — 2026-07-31

Goal: run the commitment loop socially on existing rails while the Build phase completes.
Exit criteria: methodology + scoping surveys complete (mandate artifact per garden); activations recorded; rewards flowing through existing Cookie Jar/treasury paths; zero contract dependencies.

### Operational checkpoint: Community and settlement evidence — 2026-09-30

Goal: deliver the independent `packages/community` PWA evidence package and the separately governed settlement-evidence packet.
Exit criteria: Community view/signal/confirm paths work without contract changes; testimony is available only on the September Community surface; settlement data sources, privacy boundary, thresholds, and reporting proof meet the human-owned evidence definition.

## 12. Risks and Open Questions

Carried verbatim from the session-plan skeleton (1-6), plus findings from this pass (7-12). Items marked DO-NOT-SILENTLY-FIX must be logged or decided, never patched in passing.

1. **On-chain vs derived state weight.** The module carries more transition logic than the repo's thin-module convention (modules today mostly wire external protocols). Decision register #6 accepts this deliberately; reviewers should challenge any FURTHER on-chain state before it lands, not the tabled set.
2. **EAS -> module bridge coupling.** The resolver -> module hook has GAP precedent (`packages/contracts/src/resolvers/WorkApproval.sol:179-183`) but couples the approval path (criticality: critical) to a new module. Mitigations specced: optional address, try/catch, never-revert no-op semantics, sync fallback, mock-revert test. The bridge and trust model are named in 6.5; any change to linkage authority is a spec change.
3. **Schema key versioning.** `assessmentV3*` keys sit beside untouched `assessment*` (v2)
keys, while both UIDs resolve through the existing `assessmentResolver` proxy. Consumers must
select by schema key/UID, never by "latest" or by a fictitious resolver address. A future v4
repeats the schema-key pattern; nothing may ever rewrite an existing key (the
`--update-schemas` overwrite hazard, `packages/contracts/script/Deploy.s.sol:122-151`).
4. **Storage-layout script drift** (DO-NOT-SILENTLY-FIX). `script/check-storage-layout.sh:23-33` never gained CookieJarModule, HypercertsModule, GardensModule, OctantModule, YieldResolver, or UnifiedPowerRegistry. This feature adds entries only for its new contracts and the existing AssessmentResolver, GardenToken, and WorkApprovalResolver upgrades named in §7.4; the unrelated missing-module backfill is separate debt (log to the docs-freshness/debt Linear issue).
5. **"Campaign" naming collision** (DO-NOT-SILENTLY-FIX). `CycleType.Campaign` collides conceptually with the existing `CampaignCookieJar` indexer entity (`packages/indexer/schema.graphql:259-280`) and the admin Cookies workspace. They are different things (a cycle type vs a funding jar). Copy, docs, and glossary entries must always say "campaign cycle" vs "campaign cookie jar"; do not rename either side in code.
6. **Testimony "never averaged" is off-chain law only.** The schema deliberately has no score field, but nothing on-chain stops a future consumer from scoring testimony. Enforcement lives in indexer/app review (no aggregation of testimony into numbers) and the banned-vocab/design gates. Flag any PR that counts testimony.
7. **StorageLayout.t.sol GardenToken drift** (DO-NOT-SILENTLY-FIX beyond the touched contract). Comments and gap tests describe a 7-named/43-gap layout (`packages/contracts/test/StorageLayout.t.sol:31-35,59-69`) while the source is 13 used + 37 gap (`packages/contracts/src/tokens/Garden.sol:56-62`); the gap tests are arithmetic tautologies (`expectedNamed + expectedGap == 50`). PR chain 3 corrects the GardenToken numbers it touches and must add real slot assertions for the new field; the tautology pattern across other contracts is logged debt.
8. **Expiry timing with cycle fallback.** `expireCommitment` with `dueDate == 0` reads the cycle's endTime; commitments that are cycle-less AND dueDate-less can never expire (only cancel). Accepted for MVP; seeding UX should require one of the two.
9. **Protocol-pool individual claims.** ClaimType.Individual accepts any role hat in any registered garden via a caller-supplied `gardenContext`. This is broad by design (protocol commitments are curated + default ApprovalGated per register #19); if farming appears, tighten eligibility in the module without schema impact. Sarafu-precedent reclamation posture applies (suspend via pool pause, dispute, cancel).
10. **GraphQL `PoolType` collision.** Existing enum at `packages/indexer/schema.graphql:29-32` is kept for signal pools; all new enums are `Commitment*`-namespaced. Do not "clean up" the old enum in this workstream.
11. **Partial fulfillment is out of MVP.** Units convert all-or-nothing at Fulfilled. The MVP
    register deliberately requires the full committed balance and then enters terminal
    `Fulfilled`; its units argument does not imply partial-fulfillment readiness. A module v1.1
    must separately specify remaining-slot semantics, register transitions, events, and indexer
    deltas before permitting partial conversion.
12. **Register upgrade authority.** The register is UUPS-owned by the multisig while mutations are module-gated (6.2). Anyone proposing owner==module must answer who upgrades the register.

---

Build order restated for the July Build and August 12 Release: contracts (schemas -> module/register -> upgrades) -> indexer -> shared -> admin + client PWA + editorial in parallel -> September community interface. The July dry run needs none of it.
