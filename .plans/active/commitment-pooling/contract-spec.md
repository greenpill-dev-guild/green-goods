# Commitment Pooling: Contract Spec

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Companions**: `reports/corrections-log.md` (verified repo facts, exact UIDs and addresses), `uiux-spec.md` (surface flows), `plan.todo.md` (execution plan). This spec is the contract-layer source of truth for the August release build track.

> **Amendment 2026-08-02 (approved ongoing-Offer architecture; sender-safe idempotency corrected 2026-08-03; supersedes “counts-only standing has no additional Solidity” and acceptance-only Offer capacity)**: the initial module gains a pool-scoped, Offer-only `CommitmentSeries` identity, lifecycle, and event surface. `Commitment`, `CreateCommitmentParams`, and `CommitmentCreated` gain `uint256 commitmentSeriesId` (`0` = Offer once). A non-zero reference means Offer over time and must resolve to an Active series in the same pool whose `currentHolder` is the direct Offer creator; it cannot attach to a Request, Garden claim, or steward-recorded `onBehalfOf` commitment. Series creation also takes a stable, holder-scoped `bytes32 creationRequestKey`; exact request replay returns the first `seriesId` without creating or emitting a second series, while key reuse with a different creation payload reverts. This contract boundary is required because the supported wallet, embedded, and passkey senders expose a hash only after submission and cannot persist signed bytes before broadcast. Series metadata changes are prospective and never rewrite an instance. Initial lifecycle is Active, Resting, or Retired; succession relationships remain follow-on. The owning architecture, indexer, shared-state, saved-Offer, product, trust, and artifact contract is `standing-commitments-spec.md`. `Practice` is not a contract or product object.
>
> **Honest-capacity correction.** Every Offer is an accountable provider obligation before it is claimed, so `createCommitment` registers its class and immediately calls `commitUnits`; Offered and Accepted Offers occupy the same single slot with no second registry mutation at acceptance. An unaccepted Offer releases on cancel/expiry. Requests remain `Registered` until acceptance because their provider is not yet known. `acceptExchange` revalidates both already-Committed Offer classes but does not commit either class again. `providerOpenCommitmentCount` therefore means non-terminal provider obligations, not merely accepted commitments. One displayed available place is one already-created Offer instance with reserved capacity; a claim never spawns an instance. These are initial-deploy corrections, not migrations.

> **Amendment 2026-07-31 (approved vocabulary alignment; prose-only — no identifier in this spec changes)**: the acting persona noun is **gardener**; "garden member" survives only as the membership predicate (wearer of any of the six garden role hats). "Accepted provider" phrasing converges on **lead provider** / the stored provider garden, and self-confirmation prohibitions are worded contributor-wide, matching `SelfConfirmation` semantics. The §9.3 allocation class keeps identifier `operatorBps`; its prose and drawn label read "steward share". Companion identifier renames live in `settlement-spec.md` (2026-07-31 amendment).
>
> **Amendment 2026-07-04 (approved)**: the commitment record, `CreateCommitmentParams`, and `CommitmentCreated` gain an additive `bytes32 needUID` reference (0 = none) linking a commitment to the community Need that motivated it. Additive reference field beside `assessmentUID`; no state-machine change; the module stores it as-is and never reads EAS for it. Specced before the August build starts so it ships in the initial deploy, not as an upgrade. Owning spec: `.plans/active/community-interface/spec.md` (§11).
>
> **Amendment 2026-07-09 (approved architecture contract)**: commitment domains are optional multi-domain arrays. `uint8[] domains` replaces the singular domain; `uint256[] requiredActionUIDs` is positional with domains when action-bound. `DomainImpact` requires 1–4 unique valid domains and one registered, domain-matching action UID per domain. Action UID `0` is valid in the existing registry; array presence, never a numeric sentinel, expresses whether action binding exists. Other commitment kinds may use no domains and no action UIDs. `CommitmentCreated` emits all immutable creation facts needed by Envio (`domains`, `requiredActionUIDs`, `requiresAssessment`, `metadataCID`, `needUID`). Approval-gated claims gain an indexed request entity, a commitment-keyed request index, and explicit decline/supersede semantics. This is pre-build contract shape, not a storage migration.
>
> **Readiness correction 2026-07-10 (scope-locked; Garden-ID clause superseded 2026-08-02)**: confirmer defaults are direction-aware (Offer recipient; Request creator), pending claims persist their requested terms, disputes restore an explicit pre-dispute state, and only states with committed units release them. One Season may be open per pool while Campaigns may overlap. DomainImpact Work and assessments anchor to the stored provider garden. The Envio/deployment contract preserves the documented bare-address `Garden.id` compatibility exception while every new Commitment Pooling entity keeps a chain-scoped composite ID and explicit `chainId`; nullable event actors and preservation tests cover generated contract blocks. These are initial-deploy requirements, not upgrade migrations.
>
> **Amendment 2026-07-18 (approved, user visual-asset audit)**: per-action required counts. The scalar `requiredApprovedWorkCount`/`approvedWorkCount` pair becomes positional `uint32[] requiredApprovedWorkCounts` / `uint32[] approvedWorkCounts`, aligned with `requiredActionUIDs` (same length; the max-4 bound carries over from domains). A creator states "this promise needs [Action] × [count]" per bound action; the Work decision bridge credits or reverses the counter of the explicit requirement row as newer approval/rejection attestations arrive before freeze; ReadyForConfirmation auto-flips only when **every** requirement meets its non-zero count (assessment predicate unchanged); `approvedUnits = floor(targetUnits × Σ min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ requiredApprovedWorkCounts)` — the single-requirement case degenerates to the previous formula. Evidence-only kinds (SupportService/StewardCaptured/SeasonCampaign) express "no work requirement" as empty or all-zero counts, preserving the prior `== 0` semantics. `ApprovedWorkCounted` and `ApprovedWorkReversed` carry `requirementIndex`; the indexer gains a per-requirement `CommitmentRequirement` entity. Pre-build contract shape, not a storage migration. Recorded in `reports/corrections-log.md` §10.
>
> **Amendment 2026-07-22 (approved architecture correction)**: heterogeneous commitment units never mix arithmetically. `unitLabel`, `targetUnits`, per-commitment `approvedUnits`, class quota, and committed/fulfilled class balances remain unchanged. Pool/cycle progress uses state counts; `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the only cross-commitment percentage. The register's per-pool raw-unit exposure cap becomes a concurrent commitment-count cap (`providerOpenCommitmentCap` / `providerOpenCommitmentCount`). Envio stores exact-label `CommitmentUnitSummary` rows for meaningful unit totals and `CommitmentProviderExposure` rows for the current provider count. Unit identity is exact UTF-8 bytes: `hours` and `Hours` are distinct. All affected interfaces are NET-NEW and unimplemented, so this is an initial-deploy correction with no compatibility aliases or migration.
>
> **Amendment 2026-07-28 (approved group-commitment and allocation contract; supersedes the positional requirement arrays, max-four/unique-domain rule, and singular-provider portions of the 2026-07-09/18 amendments)**: DomainImpact commitments store repeatable `CommitmentRequirement { actionUID, requiredCount }` rows. Actions may share a domain; the module derives domain tags from ActionRegistry. A named `MAX_REQUIREMENTS` replaces the accidental four-domain ceiling. The provisional value is 16, but implementation must benchmark 8/16/24/32 before freezing it. Every accepted commitment stores one accountable `leadProvider` and an event-indexed contributor roster governed by an immutable Open or LeadManaged policy. Solo is a one-contributor roster. Active contributors may receive Work/evidence credit and optional requirement assignments; the roster freezes at ReadyForConfirmation; every frozen contributor is excluded from confirmation. Only `leadProvider` consumes the register count slot. Cycle-open policy snapshots the gardeners-class within-commitment rule (default 20% equal participation + 80% verified contribution). Hypercert allowlists expand to eligible contributors rather than singular providers. Payment remains a separate settlement concern in `settlement-spec.md`.
>
> **Amendment 2026-07-30 (approved PRD-759 architecture lock)**: the protocol pool is the root garden's ordinary commitment pool and does not gain a special reward state machine. After the normal claim, work/evidence, confirmation, and Fulfilled transitions, a `CeloSettlement` reward uses the same provider-garden payout-plan contract in `settlement-spec.md` as every other pool. No sixth offline settlement job and no `queueDisbursement(commitmentId)` entrypoint are introduced. The separate `queueFunding(garden, amount)` path remains a discretionary ProtocolToGarden treasury action with no commitment identity.
>
> **Amendment 2026-08-01 (approved CPP-alignment additions — Grassroots Economics review response; plan decisions #71–#73)**: two additive commitment-record fields land pre-build, both following the `needUID` additive-reference template (no state-machine change, no migration, initial deploy only).
>
> **(1) Declared valuation record — the GE "valuing" primitive as a records-only term.** `CreateCommitmentParams` and the commitment record gain `uint256 declaredUnitValue` + `string declaredValueBasis`: an optional statement of one unit's relative value against a named basis (free-text exact-label identity mirroring `unitLabel` discipline — `"G$"` and `"g$"` are distinct). Pair rule: zero value requires empty basis and vice versa (`InvalidValueDeclaration`). Steward-adjustable pre-acceptance only via new `setDeclaredValue` (mirrors the `setDeclaredReward` lock); immutable after acceptance; `ValueDeclared` mirrors `RewardDeclared`; `CommitmentCreated` carries both fields. A commitment may be valued without being rewarded (`RewardRail.None` with a declared value is valid). The 2026-07-22 count-safe lock stands in full: declared value prices a single commitment's units into one named basis; no protocol arithmetic consumes it; cross-commitment aggregation of declared value is permitted only within one exact basis, only at the read-model layer, and only as informational sums; `promiseKeptRate` remains the only cross-commitment percentage. When a reward is declared, the app pre-fills `reward.amount = declaredUnitValue × targetUnits`; the module never enforces that identity.
>
> **(2) Counter-commitment reference — the GE "exchange" step as a social record.** `uint256 counterCommitmentId` (0 = none) records that this commitment is made in exchange for an existing same-pool commitment. Creation-time validation only: referenced commitment must exist (`UnknownCounterCommitment`), live in the same pool (`CounterCommitmentPoolMismatch`), and differ from self (`SelfCounterCommitment` — self-reference is structurally impossible at creation since the id is unassigned, but the error guards the invariant explicitly). Immutable thereafter and strictly one-way: neither commitment's lifecycle ever transitions the other (`needUID` discipline); the app derives pair views and "counterpart lapsed" states from events. Cross-pool references are rejected so exchange memory stays pool-scoped; garden-to-garden exchange remains reserved with `counterpartyPoolId` (decision #13).
>
> **(3) Scope: borrow-and-repay joins the August wave.** The `CreditRegister` companion chain (records-only, no-custody, interest-free) is promoted from blocked follow-on into this build wave with **zero changes to the pooling module or register**, governed by its own spec at `../commitment-credit-follow-on/spec.md` (hub promoted backlog → active 2026-08-01). Its dispatch still requires the in-code pooling/settlement interface freeze and its own revalidation + legal/operations review gates; the G$ leg locks settlement seam **(a)** (`DisbursementKind.LoanPrincipal`) now that both modules build in the same wave (see `settlement-spec.md` 2026-08-01 amendment). Transferable vouchers, swap execution, relative-pricing enforcement, and protocol-consumed standing (reliability-adjusted caps, earned draw rights — a per-person score by another name) remain excluded exactly as before.
>
> **(4) Product identity and roadmap boundary (plan Decision Log #40 / register #74; amended 2026-08-02).** These additions are staged **Commitment Pooling**, not a separate "commitment coordination" product. Coordination names the first layer of the pool. Contract implementation in the August wave includes the value and exchange records above, the separately gated credit companion, and the module-native series amendment in `standing-commitments-spec.md`. The former “counts-only standing with no additional Solidity” conclusion is superseded. Garden-to-garden routing, transferable vouchers/exchange execution, relative-pricing enforcement, protocol-consumed standing, and succession verbs remain later-roadmap seams. Narrative surfaces must connect those seams to this architecture while never presenting them as shipped.
>
> **Amendment 2026-08-01 (approved bilateral-exchange addition — second same-day amendment; direct consent hardened 2026-08-03)**: PRD-649's architecture freeze reopens for exactly one additive module function and re-closes with this amendment set (plan Decision Log #41 / register #75). `acceptExchange(uint256 exchangeCommitmentId)` atomically accepts an Offer×Offer pair. Its argument is commitment B, created after A with `B.counterCommitmentId == A`; the immutable one-way reference means A never points back to B. The caller must be A's creator. B must have been created directly by B's creator, never by a steward through `StewardCaptured` / `onBehalfOf`, and A's creator consents by calling. These two direct creator actions are stricter than either claim gate, so this path is valid for Open and ApprovalGated commitments on both sides and never consults the ApprovalGated operator path.
>
> Preconditions are fail-closed and named: B must carry a non-zero counterpart that resolves to an existing same-pool A (`ExchangeCounterpartMismatch`); both directions must be Offer (`ExchangeDirectionInvalid`); both on-chain states must be Offered (`ExchangeStateInvalid`); creators must differ (`SelfExchange`); both stored claim types must be Individual (`ExchangeClaimTypeUnsupported`); and B must be direct-created (`ExchangeCreatorConsentRequired`). The Offer-B creation transaction already checks A's direction/state/claim type/creator/reservation before any B mutation, and `acceptExchange` repeats every mutable predicate. Every ordinary acceptance predicate then runs independently for A and B, including the conditional Open-cycle rule when `cycleId != 0`, creator-identity exclusions, and exact class quota/reservation. If either side fails, the entire transaction reverts.
>
> Effects are one atomic transaction with no exchange-specific storage field or state-machine addition: B's creator becomes A's claimant, A's creator becomes B's claimant, and each Offer keeps its own creator as its lead provider (A creator → A lead; B creator → B lead). Both commitments simply reach `Accepted`. Under the 2026-08-02 honest-capacity correction, both Offer classes are already `Committed` from creation, so acceptance performs no second `CommitmentRegistry.commitUnits` call and consumes no second provider slot. The module emits the two ordinary `CommitmentAccepted` events plus `ExchangeAccepted(A, B, poolId, B.creator, A.creator)`. After acceptance nothing couples: fulfillment, cancellation, expiry, dispute, confirmation, and count-safe exact-label accounting proceed per side. Pair status and “counterpart lapsed” remain app/indexer derivations. Multilateral and transferable exchange remain reserved for `exchange-architecture-brief.md`.
>
> **Review hardening 2026-08-03 (consent, transaction ordering, root identity, and index namespace).** A direct Individual Offer B may name A for bilateral acceptance only when B is created by its own creator: `StewardCaptured` / non-zero `onBehalfOf` creation is rejected for this path, and `acceptExchange` repeats the B-kind guard before mutation. In the same `createCommitment` transaction, before allocating/storing B or registering its class, the module revalidates A as a same-pool, Offered, Individual Offer owned by someone other than B's creator with its exact full class still Committed to A's creator; the app's preflight remains early feedback, not the safety boundary. Protocol registration is bound to the non-zero canonical `rootGarden` supplied at initialization and rejects any other garden before writing `protocolPoolId`. Each emitted `CommitmentAccepted` independently sweeps its bounded request index, so exchange acceptance cannot leave an unrelated claim request Pending. The initial indexer supports exactly one canonical UUPS `CommitmentPoolingModule` proxy per chain; its chain-scoped entity IDs rely on that stable proxy identity, and config rejects a second/replacement proxy unless a future migration defines a new namespace and full-replay plan. Saved Offer `moduleAddress` keeps client links fail-closed against the configured proxy and does not authorize concurrent multi-module indexing.
>
> **Review hardening 2026-08-03 (creation-order replay and root backfill).** A commitment lifecycle event that arrives at the indexer before `CommitmentCreated` is stored as a typed, event-keyed pending projection and consumes neither the placeholder lifecycle cursor nor any state-derived delta. Creation supplies the immutable pool/cycle/series/lead/Need facts and atomically drains that commitment's explicit pending index in block/log order through the same lifecycle helper, so reverse delivery converges for live count, series outcome, PoolMemberHistory, attribution confirmation, and Need lineage. Operationally, the root GardenAccount receives exactly one Protocol pool; the 13-garden enumeration records that normalized root as `SKIPPED_PROTOCOL_ROOT` and submits Garden-type registrations only for the 12 non-root gardens.
>
> **Review hardening 2026-08-03 (terminal capacity and late member-history facts).** Cancelling or expiring an unaccepted Offer releases the class and provider slot reserved at creation exactly once; an unaccepted Request still has no registry effect. Indexer terminal state projection no longer assumes acceptance and frozen-roster facts have already arrived: `CommitmentAccepted`, contributor mutations, and `ContributorRosterFrozen` all invoke an idempotent terminal-member-history reconciler. It applies the lead's current terminal outcome only after acceptance facts exist and applies Fulfilled contributor/receiver history only after the frozen active roster is fully materialized, so a reverse-delivered Fulfilled event cannot permanently omit history counters.
>
> **Architecture closure 2026-08-03 (replay, retry, persistence, and wind-down).** The normative
> closure inventory is `architecture-closure-matrices.md`. It assigns all 54 indexed events,
> every indexed entity/relationship, all six offline job kinds, every executable retry family,
> the saved-Offer persistence states, and all pool/cycle/series/commitment/claim/capacity/contributor
> closure rules. In particular: ordinary Commitment creation gains sender-safe request-key
> idempotency; claim, contributor, Work-link, pool-charter/cap, reward, and register projections
> converge under reverse delivery; Saved is never rendered before authenticated remote
> persistence; and `closePool` requires both zero live commitments and zero non-terminal cycles.
> The machine gate is `bun .plans/active/commitment-pooling/architecture-closure.validate.ts`.
>
> **Frozen-text conflict surfaced, not rewritten.** Canonical decision 17 says “afterwards the module never reads it” and “Atomic swap acceptance remains out of scope with the transferable-voucher layer.” This amendment preserves that historical text while making `acceptExchange` the sole additive acceptance-time read of B's reference and the sole bilateral exception. Decision 17's post-acceptance no-coupling rule remains verbatim.
>
> **Naming alignment recorded with this amendment.** `CommitmentRegister` → `CommitmentRegistry`, `ICommitmentRegister` → `ICommitmentRegistry`, `CreditRegister` → `CreditRegistry`, and `CommunityTestimonyResolver` → `TestimonyResolver` in all living and normative text, for consistency with `registries/Action.sol` and `resolvers/Assessment.sol`. Planned file targets remain `registries/Commitment.sol`, `registries/Credit.sol`, and `resolvers/Testimony.sol`; the GE “register” grammar remains prose vocabulary, and `communityTestimony` schema config and schema names do not change. Older dated amendments and decision/register history retain the names originally recorded.

> **Amendment 2026-08-02 (approved structural protocol-team confirmation fallback; pre-build)**: a commitment may explicitly set `protocolFallbackEnabled = true` at creation or through the pre-acceptance `setConfirmerRule` call. That selection permits wearers of the **protocol (root) garden's current steward or owner Hats** to call the existing `confirmFulfillmentAsFallback(commitmentId, reason)` on the commitment in **any** pool, not only the protocol pool. This is the structural escape hatch for the pilot's small, newly established gardens, where the same person frequently seeds a commitment and then works it, leaving no eligible confirmer inside that garden.
>
> The anti-farming spine is explicitly preserved. The mandatory `reason` still applies and is still emitted. **Contributor exclusion is unchanged and absolute**: a protocol steward who is a frozen contributor on the commitment is blocked by the same `SelfConfirmation` predicate as anyone else, so the protocol fallback can never be used to confirm one's own work. It is a separate *fallback* path only — it never satisfies a named-confirmer threshold and never substitutes for the direction-aware default (Offer recipient; Request creator).
>
> **The selection solves reachability instead of merely resolving incidents.** Ordinary named/default reachability is still evaluated first after excluding every contributor. When that ordinary path is unreachable, `protocolFallbackEnabled` satisfies the structural Ready predicate only if the module has registered exactly one `PoolType.Protocol` pool and stored its ID in `protocolPoolId`; caller eligibility is then checked against that registered pool's *current* garden Hats at confirmation time. An unselected commitment never silently depends on the Green Goods team. Enabling the flag while `protocolPoolId == 0` reuses `ModuleNotReady` and changes no state.
>
> **Local and protocol authority remain distinguishable.** `confirmFulfillmentAsFallback` checks the commitment pool's current steward/owner Hats first and records `PoolFallback`; only then may an opted-in protocol-pool steward/owner record `ProtocolFallback`. A dual-role caller is therefore classified by the narrower local authority. The module owner is not a fulfillment confirmer through either path. `CommitmentFulfilled` emits the confirmer and `ConfirmationPath`, and app/indexer surfaces render `ProtocolFallback` as **“confirmed by Green Goods team — fallback”** rather than as an ordinary counterparty or local-garden confirmation. Recorded as plan Decision Log #44 / register #79.

Every technical claim below carries a repo file path (relative to repo root) or a NET-NEW marker. All contract names, functions, events, and entities introduced here are NET-NEW unless a path says otherwise. Format mirrors the house implementation-spec style of `docs/docs/builders/specs/greenwill-gif-implementation-spec-2026-03.md` (Purpose, Scope, Canonical Implementation Decisions, System Components, per-contract Contract Work, Package-Level Backlog, Launch Milestones).

---

## 1. Purpose

Translate the locked commitment-pooling architecture (27 decisions from the 2026-07-03 alignment session, plus the locked state machines and count-safe aggregate semantics from the Linear lifecycle doc) into PR-openable contract, deployment, and indexer work. An implementer should be able to open the first PR from this document without asking questions.

The system lets gardens and the protocol run pools of commitments: offers and requests of concrete support, seeded into season or campaign cycles, led by one accountable lead provider and fulfilled by a solo contributor or team, evidenced through the existing Work and WorkApproval rails or lightweight evidence, confirmed by counterparties who did not perform the work, and rolled up into promises-kept aggregates and fulfilled-commitment Hypercerts. Vocabulary is mutual aid throughout: offer, request, promise kept, fulfilled, steward, season, campaign, readiness, confirmation. No leaderboard semantics anywhere, ever.

## 2. Scope

### In scope

- `CommitmentPoolingModule`: control plane for pools, cycles, commitments, confirmations, disputes, reward records (NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol`).
- `CommitmentRegistry`: non-transferable ERC-1155-style unit accounting companion, functionally controlled by the module (NET-NEW `packages/contracts/src/registries/Commitment.sol`).
- GardenToken wiring: one new module field packed after `openMinting` at slot 213 offset 2,
  setter, event, unchanged 37-slot gap, and live 42161 UUPS upgrade
  (`packages/contracts/src/tokens/Garden.sol`).
- WorkApprovalResolver bridge: optional non-blocking module hook on approval (`packages/contracts/src/resolvers/WorkApproval.sol`).
- Exactly two new EAS schema registrations: assessment v3 resolves through an in-place upgrade
  of the existing `AssessmentResolver`; community testimony uses one net-new resolver. Both
  register through the standalone badge-schemas path (register #14, register #26, register #53
  as amended by register #54).
- Deployment plumbing: `DeployHelper.sol` result fields, `DeploymentBase.sol` helpers, artifact keys, storage-layout baselines.
- Envio indexer plan: two new contract blocks, sixteen core pooling entities (including immutable `CommitmentClass`, the bilateral marker, `CommitmentSeries`, and `CommitmentSeriesCycleSummary`), one handler module; count stats and exact-label unit summaries derive from module and registry events alone. Ten auxiliary contributor/provenance/replay-coordination entities remain in the same schema but are not part of the core-phase count used by D15 and the indexer handoff.
- Hypercert cut-over: `bundleKind` discriminator, fulfilled-commitment bundling, on-chain allocation-class bps at cycle open with app-computed allowlists.

### Out of scope

- Celo/G$ execution inside the core pooling module or register. August G$ split-state settlement is in scope separately via `settlement-spec.md` / PRD-686; the core pooling contracts never custody G$, call Celo, or flip `settlementEnabled`.
- Borrow-and-repay (mutual credit) **inside this spec's contracts**. The companion `CreditRegistry` (records-only, no-custody, interest-free) ships in the same August wave as its own additive chain with zero pooling-module/register changes, specced separately in `../commitment-credit-follow-on/spec.md` (promoted backlog → active 2026-08-01, amendment (3)); its dispatch gates on the in-code pooling/settlement interface freeze plus its own revalidation and legal/operations review.
- Sarafu integration or any reading of Sarafu source code (AGPL clean-room, register #17; grounding is the Grassroots Economics paper and public docs only).
- Bridged G$, bridge custody/unbounded value authority, and GoodDollar rails inside the pooling module. Message-only CCIP settlement lives in the separate `SettlementModule` / `CeloSettlementExecutor` contract pair frozen by `settlement-spec.md`; no operator report or arbitrary bridge executor confirms value.
- Leaderboards, rankings, comparison views, countdown or streak mechanics of any kind.
- A separate aggregator contract (PRD-649 locked: aggregates come from events, not an on-chain aggregator).
- CookieJar contract changes (register #18: rewards are declared references plus operator-executed payouts on existing rails).
- Re-indexing EAS attestations (indexer boundary, `packages/indexer/schema.graphql:282-288`).

## 3. Canonical Implementation Decisions

Settled for v1 unless explicitly revised. Numbers in parentheses reference the locked decision register in the approved session plan.

1. **Commitments are NOT EAS attestations** (register #14). Commitment records are module-native storage plus events, shaped by the Grassroots Economics commitment-pooling register grammar. This supersedes Document A and the original PRD-649/650 "commitment schema + FulfillmentConfirmation resolver" language. EAS registrations shrink to exactly two: assessment v3 and community testimony.
2. **Module-event-driven lifecycle because EAS is not indexed.** Envio indexes only Green Goods core contracts; EAS attestations are queried from easscan directly (`packages/indexer/schema.graphql:282-288`, `reports/corrections-log.md` §2 Envio boundary row). Every commitment state, count stat, provider exposure row, and exact-label unit summary must be derivable from `CommitmentPoolingModule` and `CommitmentRegistry` events alone.
3. **Hybrid state weight** (register #6). Hard transitions on-chain: pool register/ready/open/pause/close/compost, cycle seed/open/close/compost/cancel, commitment create (offer/request), accept, approved-work count, ReadyForConfirmation, confirm to Fulfilled, cancel, expire, dispute raise/resolve, reward record. Draft states live in app IndexedDB; Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, and Reconciled are derived app/indexer-side from events. Full locked vocabulary is preserved across layers (section 5 table).
4. **Two-contract shape** (register #15, register #16; compatibility-amended by register #86). `CommitmentPoolingModule` is the control plane (pool registry, cycles, curation, claim modes, permissions, stat events). `CommitmentRegistry` is voucher-shaped, non-transferable, ERC-1155-style promise accounting. A later adapter may consume eligible fulfillment facts on the same `poolId` while issuing a separate `voucherClassId`; it never wraps the registry class as the same identity. Supersedes PRD-649's single-artifact V1 stance (user-approved). `poolId` semantics are unchanged.
5. **EAS bridge** (register #5). `WorkApprovalResolver.onAttest` calls `module.onWorkDecision(...)` for both approved and rejected decisions in try/catch (non-blocking, module optional), mirroring the existing GAP side effect (`packages/contracts/src/resolvers/WorkApproval.sol:179-183`). Steward-callable `syncWorkDecisions` is the catch-up fallback. Work attestations cannot carry commitment refs (schema immutable, `reports/corrections-log.md` H2), so linkage is module-side: an active contributor, accountable lead, or resolved pool steward links workUID to commitmentId before a roster freeze. The module applies the deterministic latest valid decision and freezes that effective credit at ReadyForConfirmation.
6. **v3 authorship split** (register #7). Baseline assessment: evaluator OR operator (analog capture preserved, matches today's `packages/contracts/src/resolvers/Assessment.sol:114-121`). Delta/re-assessment and technical assessment: Evaluator Hat only. Community testimony: Community Hat only (`packages/contracts/src/interfaces/IGardenAccessControl.sol:45` provides `isCommunity`).
7. **Protocol pool = root garden pool** (register #8). The root garden (`packages/contracts/deployments/42161-latest.json:40-43`: `0xf401f34378384713222d1d21f63359cc4E8a858a`, tokenId 1) anchors the protocol pool with `poolType = Protocol`. Cross-garden claiming uses one canonical identity formula: Individual claim → `claimant = requestedBy = msg.sender`; Garden claim → `claimant = gardenContext` (the GardenAccount) and `requestedBy = msg.sender` (its authenticated operator/owner). Neither identity may equal the commitment creator; ApprovalGated acceptance rechecks the stored requester. The creation-time `claimType` is immutable eligibility and must equal the runtime claim `kind`. Protocol-pool stewardship reuses root-garden Hats.
8. **Rewards are references; contributor payment is a garden-accounted plan** (register #18, superseded for group settlement by registers #63–#67). A commitment carries an explicit reward rail and amount. `ArbitrumExternal` also stores its exact source and token for the existing operator-recorded jar/treasury reference path. `CeloSettlement` stores zero source/token sentinels because pooling has no canonical-G$ configuration and a protocol-pool Request has no provider garden yet; after acceptance the SettlementModule derives and stores both its write-once `gDollarToken` and the selected provider garden Safe as payer. That rail is ineligible for `recordRewardPaid`; protocol-to-garden support first names the provider garden, then the garden Safe funds a conserved parent plan with an explicit retained amount and contributor child payouts. Zero CookieJar changes; jars remain pull-based (`packages/contracts/src/modules/CookieJar.sol:243-296`).
9. **Claim mode per commitment** (register #19). Open claim vs approval gated, set at seeding. App-level defaults: protocol pool prefills ApprovalGated, garden campaign commitments prefill Open. The module stores what is passed.
10. **Lightweight evidence** (register #20). `EvidenceAttached(commitmentId, cid, attacher)` module event, offline-queueable. For SupportService and StewardCaptured commitments, counterparty confirmation IS the review; no separate approval step. DomainImpact keeps the full Work to WorkApproval path.
11. **Schema registration is the first deployable PR chain of the August track** (register #26), via the standalone badge-schemas-style path (`packages/contracts/script/deploy/badge-schemas.ts`, `packages/contracts/script/DeployBadgeSchema.s.sol`), never via `--update-schemas` (which re-registers and overwrites all existing schema artifact keys, `packages/contracts/script/Deploy.s.sol:122-151`). The same first contracts PR may begin with non-deployable RED ABI/storage/event tests and `CommitmentPoolingBounds.t.sol`; those tests freeze the five bounded constants before any bounded module loop turns GREEN. This ordering does not authorize a deployment or make an unfrozen provisional value part of the ABI.
12. **Allocation classes on-chain as bps at cycle open**. Six-role bps snapshot (gardeners, treasury, operator, evaluator, community, funder) validated to sum exactly 10000 (precedent: `InvalidSplitRatio`, `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`. Per-address allowlist expansion stays app-computed on the existing merkle pipeline (`reports/corrections-log.md` §2 Hypercert row).
13. **Post-MVP garden-to-garden is reserved, not implemented**. `counterpartyPoolId` and `counterpartyGardenAccount` exist as reserved struct fields (always zero in MVP) so the L3 amendment is additive.
14. **Anti-farming posture from day one**: direction-aware independent confirmation (Offer recipient; Request creator), contributor self-confirmation blocked on both ordinary and steward-fallback paths (mirrors `SelfAttestation`, `packages/contracts/src/resolvers/WorkApproval.sol:153-156`), operator fallback requires a visible reason, concurrent open-commitment caps in the register, and disputes restore an explicitly stored prior state.
15. **Protocol-pool parity, not a settlement fork** (register #69). Protocol-pool commitments use the same provider-garden payout-plan lifecycle as garden-pool commitments after Fulfilled. The app may expose those existing plan writes from indexed state, but core fulfillment never synchronously moves value or creates a browser-local settlement attempt. Discretionary ProtocolToGarden funding remains an independently authorized settlement action and never changes commitment state.
16. **Valuation is a recorded term, never protocol arithmetic** (register #71, amendment 2026-08-01). `declaredUnitValue`/`declaredValueBasis` state one unit's relative value against a named basis as commitment terms — settable at creation, steward-adjustable pre-acceptance, immutable after. Valid with `RewardRail.None`. No transition, cap, quota, recognition weight, or settlement amount is derived from it on-chain; the app pre-fills `reward.amount` from it as a suggestion only. Cross-commitment value aggregation exists only per-exact-basis at the read-model layer. This realizes the GE "valuing" primitive as data while relative-pricing execution stays reserved for the transferable-voucher layer (§6.2).
17. **Exchange-of-commitments is a one-way reference, never a coupling** (register #72, amendment 2026-08-01; creation guard hardened 2026-08-03). `counterCommitmentId` records "made in exchange for" against an existing same-pool commitment at creation and is immutable. Existence, same-pool, and non-self checks run for every reference. When new B is an Offer, `createCommitment` additionally performs the bilateral eligibility check in the same transaction before allocating/storing B or registering its class: B must be Individual and direct (`onBehalfOf == 0`, therefore not `StewardCaptured`); A must still be an Offered Individual Offer with a different creator and its exact full class Committed to A's creator. Afterwards the module never reads the reference except through decision 18's `acceptExchange`; cancellation, expiry, dispute, or fulfillment of either side never transitions the other. Pair views and counterpart-lapsed states are derived app/indexer-side. Atomic swap acceptance remains out of scope with the transferable-voucher layer. (Amended by decision 18, second 2026-08-01 amendment: `acceptExchange` is the sole additive acceptance-time read of the reference and the sole bilateral exception; the post-acceptance no-coupling rule stands unchanged.)
18. **Bilateral exchange acceptance is atomic; multilateral and transferable exchange stay reserved** (Decision Log #41 / register #75, second amendment 2026-08-01; capacity effects amended 2026-08-02; consent hardened 2026-08-03). `acceptExchange(B)` requires `B.counterCommitmentId == A`, A and B in the same pool, both directions Offer, both states Offered, distinct creators, Individual claim type on both sides, direct creation of B rather than `StewardCaptured` / `onBehalfOf`, and every ordinary per-side cycle and identity predicate. It also verifies that both immutable full-quota classes remain Committed to their creators. Only A's creator calls. B's direct creator consented by creating B and A's creator consents by calling; a steward cannot consent for B's represented gardener, so neither claim mode invokes the ApprovalGated operator path. B's creator accepts A and A's creator accepts B; both ordinary acceptance events, one `ContributorAdded` lead event per side, and the `ExchangeAccepted` marker succeed or revert together. Each ordinary acceptance event independently resolves any matching request and supersedes every other still-Pending indexed request for that commitment, even when no matching request exists. Both classes and lead-provider slots are already committed from Offer creation, so acceptance performs no second registry mutation and does not reapply provider-cap headroom. A later cap reduction constrains only a new `commitUnits` reservation; it cannot strand an already-reserved Offer. Thereafter decision 17's lifecycle-independence rule applies per side; no cross-side arithmetic or transition exists. The transferable and multilateral layer remains design-only in `exchange-architecture-brief.md`.
19. **An Offer used over time has a module-native series, not an inferred grouping** (Decision Log #46 / register #81, amendment 2026-08-02). `CommitmentSeries` is the internal durable pool-scoped Offer identity with direct-holder authorship, prospective metadata, and Active/Resting/Retired lifecycle. A validated non-zero `commitmentSeriesId` links ordinary immutable instances; zero preserves Offer once. No cross-pool merge, holder transfer, or automatic obligation creation exists.
20. **Availability is reserved capacity, not a promise to try later** (Decision Log #47 / register #82, amendment 2026-08-02). Offer creation registers and commits its exact class against the creator immediately; claim and exchange acceptance do not recommit it. Requests commit only when an actual provider accepts. Cancellation or expiry releases only when the direction's class is currently committed. This makes each visible available place an independently claimable, already-reserved instance.
21. **Saved Offer metadata and Story stay outside protocol reputation** (Decision Log #48 / register #83, amendment 2026-08-02). Reusable Offer metadata may be signed offchain and private by default. The indexed Story is exact linked-instance history with absolute state counts and fulfilled-cycle IDs. Neither becomes a score, rate, rank, permission input, cross-pool identity, or transferable asset.

## 4. System Components

| Component | Responsibility | Location |
|---|---|---|
| `CommitmentPoolingModule` | pool registry, cycle lifecycle, ongoing-Offer series, commitment records and transitions, confirmations, disputes, work linkage, evidence events, reward records | NET-NEW `packages/contracts/src/modules/CommitmentPooling.sol` |
| `ICommitmentPoolingModule` | canonical interface, enums, structs, events, errors | NET-NEW `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol` |
| `CommitmentRegistry` | non-transferable unit classes, committed/fulfilled balances, class quotas, concurrent provider-commitment caps | NET-NEW `packages/contracts/src/registries/Commitment.sol` |
| `ICommitmentRegistry` | register interface | NET-NEW `packages/contracts/src/interfaces/ICommitmentRegistry.sol` |
| GardenToken wiring | module field + setter + mint callback | `packages/contracts/src/tokens/Garden.sol:27-34` (module fields), `181-227` (setter block), `421-456` (phase-2 integration callbacks) |
| WorkApprovalResolver bridge | approval hook into module | `packages/contracts/src/resolvers/WorkApproval.sol:115-185` |
| `AssessmentResolver` upgrade | existing resolver gains v3-schema authorship + baseline/delta validation while continuing to resolve v2 | EXISTING UUPS `packages/contracts/src/resolvers/Assessment.sol` |
| `TestimonyResolver` | Community-Hat-gated testimony validation | NET-NEW `packages/contracts/src/resolvers/Testimony.sol` |
| Schema structs | decode layouts for the two new schemas | `packages/contracts/src/Schemas.sol` (append) |
| Schema config | canonical field lists, new keys only | `packages/contracts/config/schemas.json` (append keys `assessmentV3`, `communityTestimony`) |
| Deploy plumbing | CREATE2 proxies, wiring, artifacts | `packages/contracts/test/helpers/DeploymentBase.sol:257-338` (`_deployCorePart2`), `341-385` (`_wireModules`), `718-759` (`_deployCookieJarModule` template); `packages/contracts/script/DeployHelper.sol:42-72,276-347` |
| AssessmentResolver upgrade workflow | existing proxy implementation upgrade, v2-state preservation, and v3 setter activation | EXISTING `packages/contracts/script/upgrade.ts assessment-resolver` UUPS path; never performed by a deploy/schema script |
| Standalone schema deploy | two resumable additive registrations + TestimonyResolver deploy + append-only artifact merge | NET-NEW `packages/contracts/script/DeployCommitmentSchemas.s.sol` + `packages/contracts/script/deploy/commitment-schemas.ts` (template: badge-schemas pair) |
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
| Open or Paused -> Closed | on-chain | `closePool(poolId)` requires `Pool.liveCommitmentCount == 0` and `Pool.nonTerminalCycleCount == 0`; otherwise it reverts `PoolHasLiveCommitments` or `PoolHasNonTerminalCycles`. A pool-level pause preserves the wind-down path: cancel/expire/resolve every live commitment, then cancel or compost every cycle. A module-wide pause preserves commitment cancel/expire/resolve only and must be lifted by its owner before cycle/pool lifecycle writes resume. Event `PoolClosed`. |
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

Pool closure is also O(1). Every successful `createCommitment` increments
`Pool.liveCommitmentCount`, including Requests and cycle-less Offers. The same reversible
commitment transition helper decrements it exactly once on Fulfilled, Cancelled, or Expired;
Expired -> Disputed re-increments it and the next terminal resolution decrements it again.
`seedCycle` increments `Pool.nonTerminalCycleCount`. A cycle decrements that count exactly once
when it first becomes Cancelled or Composted; Reconciled remains non-terminal for pool closure
until it is composted. Replays and invalid transitions never change either counter.

### 5.3 Commitment

On-chain enum: `CommitmentState { None, Offered, Requested, Accepted, ReadyForConfirmation, Fulfilled, Cancelled, Expired, Disputed }`. `Draft`, `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived.

| Transition | Layer | Mechanism |
|---|---|---|
| Draft (exists) | off-chain | Client/admin IndexedDB draft (offline-first). |
| Draft -> Offered or Requested | on-chain | `createCommitment(params)`. Event `CommitmentCreated` (direction Offer or Request sets the initial state). A non-zero `commitmentSeriesId` must resolve to an Active same-pool direct-holder Individual Offer. For Offer B with non-zero `counterCommitmentId`, the same transaction rejects `StewardCaptured` / non-zero `onBehalfOf` and revalidates A as a same-pool Offered Individual Offer with a distinct creator and exact full reservation before B ID allocation, storage, class registration, or event emission. Offer creation then commits B's full class quota and reserves the creator's provider slot; Request creation only registers its class. |
| Offered/Requested -> Accepted | on-chain | `claimCommitment` requires runtime `kind == commitment.claimType`. Individual claims use caller as claimant/requester; Garden claims use `gardenContext` as canonical claimant and caller as `requestedBy`; either identity matching the creator reverts. Open mode transitions immediately and uses that authenticated caller as a Garden Request's human lead. ApprovalGated mode emits `ClaimRequested` (state unchanged; "claim pending" is derived), then operator `acceptClaim(commitmentId, claimant)` rechecks the stored requester against the creator, consumes the canonical claimant-keyed terms, and uses its stored `requestedBy` as the Garden Request lead. Event `CommitmentAccepted`. Request acceptance records committed units and reserves its resolved provider slot; Offer acceptance validates the already-Committed class and does not mutate registry accounting again. |
| Offered + Offered -> Accepted + Accepted | on-chain | `acceptExchange(exchangeCommitmentId)` takes direct-created B, resolves A from B's immutable same-pool `counterCommitmentId`, and requires A's creator as caller. Offer×Offer, Offered×Offered, distinct-creator, Individual×Individual, B-not-`StewardCaptured`, cycle, and identity checks pass before mutation, and both full immutable-quota classes must still be Committed to their creators. B's creator accepts A; A's creator accepts B. Two `CommitmentAccepted` events, `ContributorAdded(A, A.creator)` and `ContributorAdded(B, B.creator)`, and one `ExchangeAccepted` marker commit atomically; each ordinary acceptance event independently supersedes every other still-Pending request in its bounded request index, even when the accepted counterpart had no request row. No second registry commit, slot consumption, or provider-cap headroom check occurs. Provider caps apply only when reserving a new slot. Any failure reverts both sides. Later lifecycle remains independent. |
| Accepted -> Active | derived | First `WorkLinked` or `EvidenceAttached` after acceptance. |
| Active -> EvidenceSubmitted | derived | Any `EvidenceAttached` or `WorkLinked` event. |
| EvidenceSubmitted -> PartiallyApproved | derived | `ApprovedWorkCounted` events: at least one requirement counter above zero while any requirement remains below its required count. |
| PartiallyApproved <-> EvidenceSubmitted | derived | New evidence/work after partial approvals flips forward; the counter events flip back. |
| -> ReadyForConfirmation | on-chain | Three paths, all requiring `totalVerifiedCredits > 0` as the pre-fulfillment verified-credit predicate, requiring an Open cycle when `cycleId != 0` (cycle-less commitments use the immutable protocol 20/80 policy for contributor recognition and payout defaults only), proving every active linked Work is current against `WorkApprovalResolver.latestDecisionSequence`, freezing both the contributor roster and contribution-credit accounting, and emitting `ContributorRosterFrozen` before `CommitmentReadyForConfirmation`: (a) automatic inside `onWorkDecision`, `syncWorkDecisions`, or the one-time `attachAssessment` call once every requirement reaches its non-zero count and any declared assessment is attached; (b) `submitForConfirmation(commitmentId)` only for SupportService, StewardCaptured, or SeasonCampaign commitments with `requirements.length == 0`, with >= 1 pre-freeze evidence record and any declared assessment attached; DomainImpact can never use this path; (c) `markReadyForConfirmation(commitmentId, reason)` steward override, reason emitted. The override may bypass requirement counts, never the recognition-policy, verified-credit, or linked-Work freshness prerequisites. All paths require either an ordinary named/default threshold that remains reachable after excluding every contributor, or an explicitly enabled protocol fallback backed by a registered `protocolPoolId`. |
| ReadyForConfirmation -> Fulfilled | on-chain | `confirmFulfillment(commitmentId)` by a named confirmer or the direction-aware default (Offer recipient; Request creator), where a GardenAccount default resolves to that garden's operator/owner Hat wearers as direct callers rather than an ERC-6551 `execute`; each confirmation emits `ConfirmationRecorded`; reaching threshold N emits `CommitmentFulfilled(..., confirmer, Ordinary, "")`. Every frozen contributor is excluded from every confirmation path. `confirmFulfillmentAsFallback(commitmentId, reason)` is available only while that ordinary path is unreachable after contributor exclusion; it requires a current local garden steward/owner and emits `PoolFallback`, or, only when `protocolFallbackEnabled`, a current protocol-garden steward/owner and emits `ProtocolFallback`. Both require a reason and reject contributors. Local authority is tested first for dual-role callers, and module ownership alone grants neither confirmation path. Register converts the lead provider's units (`UnitsFulfilled`). |
| Fulfilled -> Reconciled | derived | `CycleClosed` for the commitment's cycleId; cycle-less commitments (cycleId == 0) derive Reconciled from `PoolClosed`. |
| -> Cancelled | on-chain | `cancelCommitment(commitmentId, reasonCID)` from Offered/Requested (creator or steward) and Accepted (steward only; derived Active/PartiallyApproved are on-chain Accepted). Event `CommitmentCancelled`. An Offered Offer releases exactly `targetUnits` and its provider slot because creation already committed them; an unaccepted Request has no committed units and emits no register release; Accepted Offers and Requests release exactly `targetUnits`. Not allowed from ReadyForConfirmation except via dispute resolution. Envio uses the commitment request index to mark any still-Pending claim requests Superseded with terminal reason `COMMITMENT_CANCELLED`. |
| -> Expired | on-chain | `expireCommitment(commitmentId)`, permissionless, allowed once block time > dueDate (or the cycle endTime when dueDate == 0), from Offered/Requested/Accepted/ReadyForConfirmation. Event `CommitmentExpired`. An Offered Offer releases exactly `targetUnits` and its provider slot; an unaccepted Request emits no register release; Accepted/ReadyForConfirmation Offers and Requests release exactly `targetUnits`. Envio marks any still-Pending indexed claim requests Superseded with terminal reason `COMMITMENT_EXPIRED`. |
| -> Disputed | on-chain | `raiseDispute(commitmentId, reasonCID)` from Accepted/ReadyForConfirmation/Expired (the locked EvidenceSubmitted/PartiallyApproved entries map to on-chain Accepted). Before setting Disputed, the module stores the exact prior state in `preDisputeState`. Raiser: creator, counterparty, named confirmer, or steward. Event `CommitmentDisputed`. |
| Disputed -> previous state / Fulfilled / Cancelled / Expired | on-chain | `resolveDispute(commitmentId, RestorePrevious / Fulfilled / Cancelled / Expired, reasonCID)` steward-only. `RestorePrevious` restores the stored state. An Expired prior state may only restore Expired or resolve Cancelled; it can never resolve Fulfilled. A Fulfilled resolution applies the ordinary anti-farming guard first: a resolving steward who is on the current or already-frozen contributor roster reverts `SelfConfirmation`. It then requires the same opened-policy, `totalVerifiedCredits > 0`, and complete linked-Work freshness predicates as ReadyForConfirmation; when the pre-dispute state was not already ReadyForConfirmation, it freezes the roster and contribution-credit accounting and emits `ContributorRosterFrozen` before `DisputeResolved`. Unit effects depend on `preDisputeState`: Fulfilled converts still-committed units; Cancelled/Expired release still-committed units; no resolution releases units that Expired already released. Event `DisputeResolved` carries the restored/final state. |
| Cancelled/Expired -> Reconciled at cycle close | derived | `CycleClosed` event; no on-chain per-commitment write (no unbounded loops at close). |

Fulfillment posture (locked): the party receiving the delivered work confirms by default—Offer recipient/counterparty or Request creator/requester—contributor self-confirmation is blocked, and local garden fallback requires a reason and is also blocked for a steward who is a contributor. When that receiving party is a GardenAccount, the claiming garden's stewards confirm directly: the module resolves the GardenAccount to its operator/owner Hat wearers and accepts those addresses, never an ERC-6551 `execute` from the account itself. A commitment whose ordinary path would be structurally unreachable must explicitly opt into the Green Goods protocol-garden fallback before acceptance; the protocol team is never added silently.

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
- Call the `CommitmentRegistry` for every unit-count change (commit, release, fulfill).

#### Scaffold conventions (copied, not invented)

- `UUPSUpgradeable + OwnableUpgradeable + ReentrancyGuardUpgradeable`, `_disableInitializers()` constructor, initializer with owner transfer: template `packages/contracts/src/modules/CookieJar.sol:17-115`.
- `onlyGardenToken`-style authorized-caller modifier for the mint callback: `packages/contracts/src/modules/CookieJar.sol:65-68`.
- Steward gate `_requirePoolSteward(poolId)` resolves `pools[poolId].garden` and applies `hatsModule.isStewardOf || isOwnerOf`, falling back to module owner: copy of `_requireOperator` in `packages/contracts/src/modules/Hypercerts.sol:282-287`. `IHatsModule.isOperatorOf` is the deprecated alias that forwards to `isStewardOf` (`packages/contracts/src/modules/Hats.sol:294-296`); the frozen form is `isStewardOf` so this lane and the settlement lane name one predicate. For the protocol pool this resolves to root-garden Hats, so the protocol team stewards it by wearing root-garden Steward hats (register #8). Note the deliberate asymmetry with settlement: the module-owner fallback exists here for pool administration, while settlement's value-moving payout writes have no module-owner bypass.
- Graceful mint integration: GardenToken wraps `onGardenMinted` in try/catch (`packages/contracts/src/tokens/Garden.sol:421-430` pattern); the module itself is idempotent like `packages/contracts/src/modules/CookieJar.sol:138-141`.

#### Storage layout (slot accounting)

Named storage entries, in declaration order. Comment style follows `packages/contracts/src/modules/CookieJar.sol:55-59` ("declares N storage entries above and reserves M more here (50 total); inherited contracts maintain their own storage layouts independently").

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `gardenToken` | `address` |
| 3 | `commitmentRegistry` | `ICommitmentRegistry` |
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
| 15 | `nextCommitmentSeriesId` | `uint256` (starts at 1; 0 is the one-shot sentinel) |
| 16 | `gardenPool` | `mapping(address garden => uint256 poolId)` |
| 17 | `pools` | `mapping(uint256 poolId => Pool)` |
| 18 | `cycles` | `mapping(uint256 cycleId => Cycle)` |
| 19 | `commitments` | `mapping(uint256 commitmentId => Commitment)` |
| 20 | `commitmentSeries` | `mapping(uint256 seriesId => CommitmentSeries)` |
| 21 | `seriesIdByCreationRequest` | `mapping(address holder => mapping(bytes32 creationRequestKey => uint256 seriesId))` (0 = unseen; exact replay returns the existing series) |
| 22 | `commitmentConfirmers` | `mapping(uint256 commitmentId => address[])` |
| 23 | `hasConfirmed` | `mapping(uint256 commitmentId => mapping(address => bool))` |
| 24 | `workCommitment` | `mapping(bytes32 workUID => uint256 commitmentId)` |
| 25 | `approvalCounted` | `mapping(bytes32 approvalUID => bool)` |
| 26 | `pendingClaim` | `mapping(uint256 commitmentId => mapping(address claimant => PendingClaim))` |
| 27 | `contributors` | `mapping(uint256 commitmentId => mapping(address contributor => ContributorRecord))` |
| 28 | `requirementAssignments` | `mapping(uint256 commitmentId => mapping(uint16 requirementIndex => mapping(address contributor => bool)))` |
| 29 | `evidenceAttached` | `mapping(uint256 commitmentId => mapping(bytes32 cidHash => bool))` |
| 30 | `workRequirementIndexPlusOne` | `mapping(bytes32 workUID => uint16 requirementIndexPlusOne)` (0 = no DomainImpact requirement binding) |
| 31 | `workCreditActive` | `mapping(bytes32 workUID => bool)` (current effective pre-freeze Work decision contributes credit) |
| 32 | `latestWorkDecisionSequence` | `mapping(bytes32 workUID => uint64 sequence)` (resolver-assigned chronological order; 0 = no sequenced decision) |
| 33 | `latestWorkDecisionUID` | `mapping(bytes32 workUID => bytes32 approvalUID)` (identity/audit only; never an ordering key) |
| 34 | `commitmentWorkUIDs` | `mapping(uint256 commitmentId => bytes32[] activeWorkUIDs)` (bounded enumerable active-link set used by every readiness/freeze preflight) |
| 35 | `protocolPoolId` | `uint256` (set once by the first and only `PoolType.Protocol` registration; 0 = not registered) |
| 36 | `rootGarden` | `address` (non-zero canonical root GardenAccount fixed by `initialize`; the Protocol pool must use this exact garden) |
| 37 | `commitmentIdByCreationRequest` | `mapping(address creator => mapping(bytes32 creationRequestKey => uint256 commitmentId))` (0 = unseen; exact replay returns the existing commitment) |
| 38 | `workLinkPayloadHashByOperation` | `mapping(address caller => mapping(bytes32 operationKey => bytes32 payloadHash))` (exact Work-link replay is a no-op; conflicting reuse reverts) |

Gap: `uint256[12] private __gap;` (38 named + 12 reserved = 50 total). This declaration-order
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

      enum ConfirmationPath { Ordinary, PoolFallback, ProtocolFallback }

      enum DisputeResolution { RestorePrevious, Fulfilled, Cancelled, Expired }

      enum RewardRail { None, ArbitrumExternal, CeloSettlement }

      enum ModuleDependency {
          GardenToken,
          HatsModule,
          ActionRegistry,
          CommitmentRegistry,
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
        uint32 liveCommitmentCount; // every non-terminal pool commitment, including cycle-less
        uint32 nonTerminalCycleCount; // Seeded/Open/Reconciled cycles; must be zero before close
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
        address source; // ArbitrumExternal payer; zero sentinel for CeloSettlement
        address token;  // ArbitrumExternal token; zero sentinel for CeloSettlement
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

    enum CommitmentSeriesState {
        None,
        Active,
        Resting,
        Retired
    }

    struct CommitmentSeries {
        uint256 poolId;
        address createdBy;
        address currentHolder;
        CommitmentSeriesState state;
        string metadataCID;
        bytes32 creationPayloadHash; // immutable poolId + initial metadataCID hash for replay conflict detection
    }

    struct Commitment {
        uint256 poolId;
        uint256 cycleId;                 // 0 = not cycle-scoped
        uint256 commitmentSeriesId;      // 0 = one-shot; otherwise validated module-owned series
        address creator;                 // social source (StewardCaptured: the gardener, not the recorder)
        bytes32 creationRequestKey;      // sender-safe offline/restart identity
        bytes32 creationPayloadHash;     // immutable full creation payload hash for replay conflict detection
        address counterparty;            // provider (Request) or engager (Offer); zero until Accepted
        address leadProvider;            // Offer creator; Individual Request counterparty; Garden Request authenticated requester (Open caller or stored ApprovalGated requestedBy)
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
        uint64 totalVerifiedCredits;      // approved Work + at most one evidence participation credit per contributor
        uint32 evidenceCount;
        bool contributorsFrozen;
        uint32 confirmationThreshold;    // N of the named group; 1 under the counterparty default
        uint32 confirmationCount;
        bool protocolFallbackEnabled;    // explicit pre-acceptance Green Goods team fallback selection
        bool requiresAssessment;
        bytes32 assessmentUID;           // attached v2/v3 assessment; zero until attached
        bytes32 needUID;                 // community Need this commitment addresses; 0 = none (amendment 2026-07-04)
        uint256 counterCommitmentId;     // same-pool commitment this one is made in exchange for; 0 = none; one-way, immutable (amendment 2026-08-01)
        string metadataCID;              // terms/description payload (IPFS)
        DeclaredReward reward;
        uint256 declaredUnitValue;       // relative value of one unit against declaredValueBasis; 0 = undeclared (amendment 2026-08-01)
        string declaredValueBasis;       // exact-label basis ("G$", "USD"); empty = undeclared; pair-bound with declaredUnitValue
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
        bytes32 creationRequestKey;       // non-zero, creator-scoped, persisted before first send
        uint256 commitmentSeriesId;       // 0 = one-shot; non-zero is Active, same-pool, direct-holder Offer only
        CommitmentDirection direction;
        CommitmentType commitmentType;
        ClaimType claimType;
        ClaimMode claimMode;
        ContributorPolicy contributorPolicy;
        address onBehalfOf;              // StewardCaptured only: the gardener who made the promise
        uint8[] domainTags;               // non-DomainImpact optional tags; DomainImpact derives tags
        CommitmentRequirementInput[] requirements; // caller supplies only immutable requirement facts
        string unitLabel;
        uint256 targetUnits;
        bool requiresAssessment;
        uint64 dueDate;
        string metadataCID;
        bytes32 needUID;                 // 0 = none; stored as-is, module never reads EAS (amendment 2026-07-04)
        uint256 counterCommitmentId;     // 0 = none; must exist in the same pool; immutable one-way reference (amendment 2026-08-01)
        address[] confirmers;            // empty = Offer recipient / Request creator default
        uint32 confirmationThreshold;    // ignored (forced 1) when confirmers is empty
        bool protocolFallbackEnabled;    // explicit structural fallback through registered protocol-pool Hats
        DeclaredReward reward;
        uint256 declaredUnitValue;       // 0 = undeclared; pair-bound with declaredValueBasis (amendment 2026-08-01)
        string declaredValueBasis;       // empty = undeclared; exact-label identity like unitLabel
    }

    struct ContributorRecord {
        bool active;
        uint32 uncountedLinkedWorkCount;
        uint32 approvedWorkCredits;
        uint32 evidenceCredits;           // canonical 0-or-1 recognition credit; evidence provenance remains repeatable
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

    event CommitmentSeriesCreated(
        uint256 indexed seriesId,
        uint256 indexed poolId,
        address indexed holder,
        string metadataCID
    );
    event CommitmentSeriesMetadataUpdated(uint256 indexed seriesId, string metadataCID);
    event CommitmentSeriesRested(uint256 indexed seriesId);
    event CommitmentSeriesResumed(uint256 indexed seriesId);
    event CommitmentSeriesRetired(uint256 indexed seriesId);

    event CommitmentCreated(
        uint256 indexed commitmentId,
        uint256 indexed poolId,
        uint256 indexed cycleId,
        uint256 commitmentSeriesId,  // 0 = one-shot; non-indexed (3-indexed budget spent)
        bytes32 creationRequestKey,   // creator-scoped sender-safe replay identity
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
        bytes32 needUID,             // 0 = none; non-indexed (3-indexed budget spent); Envio reads params regardless (amendment 2026-07-04)
        uint256 counterCommitmentId, // 0 = none; same-pool exchange reference (amendment 2026-08-01)
        uint256 declaredUnitValue,   // 0 = undeclared (amendment 2026-08-01)
        string declaredValueBasis    // empty = undeclared; exact-label basis
    );
    event RewardDeclared(
        uint256 indexed commitmentId,
        RewardRail rail,
        address source,
        address token,
        uint256 amount
    );
    /// @notice Pre-acceptance valuation update (amendment 2026-08-01); mirrors RewardDeclared.
    event ValueDeclared(uint256 indexed commitmentId, uint256 declaredUnitValue, string declaredValueBasis);
    event ConfirmerRuleSet(
        uint256 indexed commitmentId,
        address[] confirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    );
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
    event ExchangeAccepted(
        uint256 indexed commitmentIdA,
        uint256 indexed commitmentIdB,
        uint256 poolId,
        address indexed acceptorA,
        address acceptorB
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
        address linker,
        bytes32 operationKey
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
        uint64 decisionSequence,
        uint16 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 newlyApprovedUnits
    );
    event ApprovedWorkReversed(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        bytes32 decisionUID,
        uint64 decisionSequence,
        uint16 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 removedApprovedUnits
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
    event CommitmentFulfilled(
        uint256 indexed commitmentId,
        address indexed confirmer,
        ConfirmationPath confirmationPath,
        string reason
    );
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
      error RootGardenRequired();
      error ProtocolGardenMismatch(address expectedRootGarden, address suppliedGarden);
      error SchemaUIDRequired(ModuleSchemaKind schemaKind);
      error SchemaUIDCollision(bytes32 uid);
    error PoolExists(address garden);
    error UnknownPool(uint256 poolId);
    error PoolNotInState(uint256 poolId, PoolState actual);
    error CharterRequired(uint256 poolId);
    error PoolHasLiveCommitments(uint256 poolId, uint32 liveCommitmentCount);
    error PoolHasNonTerminalCycles(uint256 poolId, uint32 nonTerminalCycleCount);
    error UnknownCycle(uint256 cycleId);
    error CycleNotInState(uint256 cycleId, CycleState actual);
    error CyclePoolMismatch(uint256 cycleId, uint256 expectedPoolId, uint256 actualPoolId);
    error CycleNotAcceptingCommitments(uint256 cycleId, CycleState actual);
    error CycleHasLiveCommitments(uint256 cycleId, uint32 liveCommitmentCount);
    error InvalidAllocation(); // bps sum != 10_000 (Yield.sol InvalidSplitRatio precedent)
    error InvalidTimeWindow(uint64 startTime, uint64 endTime);
    error SeasonAlreadyOpen(uint256 poolId, uint256 cycleId);
    error UnknownCommitmentSeries(uint256 seriesId);
    error CommitmentSeriesPoolMismatch(uint256 seriesId, uint256 expectedPoolId, uint256 actualPoolId);
    error CommitmentSeriesNotActive(uint256 seriesId);
    error CommitmentSeriesHolderOnly(uint256 seriesId, address caller);
    error CommitmentSeriesOfferOnly(uint256 seriesId);
    error CommitmentSeriesIndividualOnly(uint256 seriesId);
    error InvalidCommitmentSeriesState(uint256 seriesId, CommitmentSeriesState state);
    error InvalidSeriesCreationRequestKey();
    error SeriesCreationRequestConflict(bytes32 creationRequestKey, uint256 existingSeriesId);
    error InvalidCommitmentCreationRequestKey();
    error CommitmentCreationRequestConflict(bytes32 creationRequestKey, uint256 existingCommitmentId);
    error InvalidWorkLinkOperationKey();
    error WorkLinkOperationConflict(bytes32 operationKey);
    error UnknownCommitment(uint256 commitmentId);
    error CommitmentNotInState(uint256 commitmentId, CommitmentState actual);
    error NotEligibleClaimant(address claimant);
    error ClaimModeMismatch(uint256 commitmentId);
    error ClaimTypeMismatch(uint256 commitmentId, ClaimType expected, ClaimType actual);
    error SelfCounterparty(); // creator cannot be the canonical claimant or authenticated Garden requester
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
    error IncompleteDecisionHistory(bytes32 workUID, uint64 expectedSequence, uint64 suppliedSequence);
    error WorkNotLinkedToCommitment(bytes32 workUID, uint256 commitmentId);
    error EvidenceRequired(uint256 commitmentId);
    error EvidenceCIDRequired();
    error EvidenceAlreadyAttached(uint256 commitmentId, bytes32 cidHash);
    error EvidenceContributorsRequired();
    error TooManyEvidenceContributors(uint256 supplied, uint256 maximum);
    error TooManyContributors(uint256 supplied, uint256 maximum);
    error TooManyLinkedWorks(uint256 supplied, uint256 maximum);
    error AssessmentRequired(uint256 commitmentId);
    error WorkApprovalRequired(uint256 commitmentId);
    error OpenCommitmentCapRequired(uint256 poolId);
    error NotDue(uint256 commitmentId);
    error RewardAlreadyRecorded(uint256 commitmentId);
    error RewardNotDeclared(uint256 commitmentId);
    error RewardRailMismatch(uint256 commitmentId, RewardRail expected, RewardRail actual);
    error InvalidRewardConfiguration();
    error InvalidValueDeclaration(); // declaredUnitValue/declaredValueBasis pair rule violated (amendment 2026-08-01)
    error UnknownCounterCommitment(uint256 counterCommitmentId);
    error CounterCommitmentPoolMismatch(uint256 poolId, uint256 counterCommitmentId);
    error SelfCounterCommitment();
    error ExchangeCounterpartMismatch(uint256 exchangeCommitmentId);
    error ExchangeDirectionInvalid(
        uint256 commitmentIdA,
        uint256 commitmentIdB,
        CommitmentDirection directionA,
        CommitmentDirection directionB
    );
    error ExchangeStateInvalid(uint256 commitmentId, CommitmentState actual);
    error SelfExchange(address creator);
    error ExchangeClaimTypeUnsupported(uint256 commitmentId, ClaimType actual);
    error ExchangeCreatorConsentRequired(uint256 exchangeCommitmentId);
      error ReasonRequired();
      error UnitLabelRequired();
      error TargetUnitsRequired();
      error InvalidDomains();
    error InvalidRequirementCount(uint256 requirementIndex);
    error TooManyRequirements(uint256 supplied, uint256 maximum);
    error ContributorAlreadyActive(address contributor);
    error ContributorNotActive(address contributor);
    error NotEligibleContributor(address contributor);
    error RosterAlreadyFrozen(uint256 commitmentId); // NOT ContributorRosterFrozen: Solidity gives events and errors one declaration namespace, so the event name above cannot be reused here
    error ContributorPolicyMismatch(uint256 commitmentId);
    error LeadContributorCannotLeave(uint256 commitmentId);
    error ContributorHasCredit(address contributor);
    error NoEligibleContributors(uint256 commitmentId);
    error RecognitionPolicyUnavailable(uint256 cycleId);
    error InvalidRequirementAssignment(uint256 requirementIndex, address contributor);
    error ConfirmationThresholdUnreachable(uint256 commitmentId);
    error OrdinaryConfirmationStillReachable(uint256 commitmentId);
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
    ///         Gating: PoolType.Protocol requires module owner, requires
    ///         garden == rootGarden before any pool write, sets the write-once
    ///         protocolPoolId, and rejects a second Protocol pool with
    ///         PoolExists(existingProtocolGarden). PoolType.Garden requires
    ///         garden operator/owner or module owner.
    function registerPool(address garden, PoolType poolType) external returns (uint256 poolId);

    /// @notice Gating for the pool lifecycle functions below: pool steward (garden operator/owner
    ///         via hatsModule, module owner fallback). Protocol pool resolves
    ///         to root-garden hats.
    function setPoolCharter(uint256 poolId, string calldata charterCID) external;
    function markPoolReady(uint256 poolId) external;
    function openPool(uint256 poolId) external;
    function pausePool(uint256 poolId, string calldata reasonCID) external;
    function resumePool(uint256 poolId) external;
    /// @notice Closes only after every pool commitment is terminal and every
    ///         seeded cycle is Cancelled or Composted. A paused pool must be
    ///         safely wound down through the same zero-live boundary.
    /// @dev Reverts PoolHasLiveCommitments or PoolHasNonTerminalCycles before
    ///      changing state.
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

    // ══════════════════════ Commitment series ═════════════════════

    /// @notice Direct-holder creation. Caller must be a current member of the
    ///         pool garden; pool must be Ready or Open. Exact replay of the
    ///         same holder-scoped key and payload returns the original ID
    ///         without a second state mutation or event.
    function createCommitmentSeries(
        uint256 poolId,
        bytes32 creationRequestKey,
        string calldata metadataCID
    ) external returns (uint256 seriesId);
    function updateCommitmentSeriesMetadata(uint256 seriesId, string calldata metadataCID) external;
    function restCommitmentSeries(uint256 seriesId) external;
    function resumeCommitmentSeries(uint256 seriesId) external;
    function retireCommitmentSeries(uint256 seriesId) external;

    // ══════════════════════ Commitments ══════════════════════════════

    /// @notice Gating by commitment type (creation authority, locked):
    ///         gardeners create own offers/requests (any of the six garden role
    ///         hats in the pool garden, IHatsModule.GardenRole);
    ///         SeasonCampaign and StewardCaptured require pool steward;
    ///         protocol-pool commitments require root-garden steward or module owner.
    ///         StewardCaptured must set onBehalfOf (the gardener stays the
    ///         social source; msg.sender is recorded as recordedBy in the event).
    ///         For a non-zero counterCommitmentId on Offer B, this transaction
    ///         rejects StewardCaptured/onBehalfOf creation and, before allocating
    ///         or storing B or registering its class, revalidates A as a
    ///         same-pool Offered Individual Offer with a distinct creator and an
    ///         exact full reservation still Committed to A's creator.
    ///         creationRequestKey is non-zero and scoped to the direct creator.
    ///         First use stores the full normalized payload hash. Exact replay
    ///         returns the original commitmentId without a second event,
    ///         capacity reservation, class commit, or pool-live increment;
    ///         reuse with a different payload reverts.
    function createCommitment(CreateCommitmentParams calldata params) external returns (uint256 commitmentId);

    /// @notice Sender-safe read-through for an interrupted commitment send.
    function getCommitmentIdByCreationRequest(
        address creator,
        bytes32 creationRequestKey
    ) external view returns (uint256 commitmentId);

    /// @notice Forwards to the module-only register setter. Gating: pool
    ///         steward; cap is a non-zero concurrent commitment count and is
    ///         required before markPoolReady.
    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external;

    /// @notice Gating: pool steward, pre-acceptance only.
    function setDeclaredReward(uint256 commitmentId, DeclaredReward calldata reward) external;
    /// @notice Gating: pool steward, pre-acceptance only. Records-only valuation
    ///         term (decision 16); pair rule enforced, nothing derived on-chain.
    function setDeclaredValue(uint256 commitmentId, uint256 declaredUnitValue, string calldata declaredValueBasis) external;
    function setConfirmerRule(
        uint256 commitmentId,
        address[] calldata confirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    ) external;

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
    ///         Creator cannot be the canonical claimant or, for a Garden
    ///         claim, its authenticated requestedBy caller.
    function claimCommitment(uint256 commitmentId, ClaimType kind, address gardenContext) external;

    /// @notice Gating: pool steward. ApprovalGated acceptance path; validates
    ///         the terms persisted by claimCommitment. The accepter cannot
    ///         substitute a different kind or gardenContext.
    function acceptClaim(uint256 commitmentId, address claimant) external;

    /// @notice Atomic bilateral Offer x Offer acceptance. The argument is B,
    ///         whose immutable counterCommitmentId resolves A. Only A's creator
    ///         calls. B's creator becomes A's claimant and A's creator becomes
    ///         B's claimant. Cycle and identity predicates run per side, and
    ///         B must have been created directly, not through StewardCaptured
    ///         onBehalfOf; both full immutable-quota reservations must still
    ///         belong to their creators; the ApprovalGated operator path is not
    ///         consulted. Both Offer classes already reserve their providers'
    ///         slots, so no second registry commit or provider-cap headroom
    ///         check occurs. Both CommitmentAccepted events, one
    ///         ContributorAdded lead event per side, and the ExchangeAccepted
    ///         marker commit or revert together.
    function acceptExchange(uint256 exchangeCommitmentId) external;

    /// @notice Gating: pool steward. ApprovalGated decline path; reason is
    ///         mandatory. Clears the claimant's pending flag so a later request
    ///         is possible and emits ClaimDeclined for the audit trail.
    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external;

    /// @notice Open-policy self-join. The caller must satisfy the same
    ///         garden-membership/provider-garden gate as a Work author.
    function joinCommitment(uint256 commitmentId) external;

    /// @notice Open-policy self-exit. Only an active non-lead contributor with
    ///         zero linked Work and zero approved Work/evidence credit may leave
    ///         before freeze.
    function leaveCommitment(uint256 commitmentId) external;

    /// @notice LeadManaged-only roster mutation. The lead provider or pool steward
    ///         may add/remove contributors before the roster freezes. An added
    ///         contributor must satisfy the same resolved providerGarden
    ///         membership gate as self-join and a Work author. A contributor
    ///         with linked Work or credit cannot be removed through roster
    ///         editing.
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
    ///         operationKey is non-zero and caller-scoped. Exact payload replay
    ///         is a no-op even after a later unlink; conflicting reuse reverts.
    function linkWork(
        uint256 commitmentId,
        bytes32 workUID,
        uint16 requirementIndex,
        bytes32 operationKey
    ) external;

    /// @notice Read-through for an interrupted offline Work-link send.
    function getWorkLinkOperationPayloadHash(
        address caller,
        bytes32 operationKey
    ) external view returns (bytes32 payloadHash);

    /// @notice Gating: pool steward; on-chain state Accepted, roster/credit
    ///         ledger unfrozen, and the Work's current effective credit inactive.
    ///         Historical approvals do not block unlink after a newer rejection.
    function unlinkWork(bytes32 workUID) external;

    /// @notice Called by WorkApprovalResolver inside try/catch after every fully
    ///         validated approval or rejection decision. The module loads the
    ///         attestation and accepts a decision as effective only when the
    ///         resolver-assigned sequence is greater than the stored sequence.
    ///         An effective approval activates credit; an effective rejection
    ///         reverses it. Unlinked, duplicate, older, or frozen-ledger decisions
    ///         are observed without changing requirements, units, or recognition.
    ///         Never reverts on state it does not recognize: the Work decision
    ///         attestation must stand regardless.
    ///         Gating: workApprovalResolver only.
    function onWorkDecision(
        bytes32 workUID,
        bytes32 approvalUID,
        uint64 decisionSequence,
        address garden,
        bool approved
    ) external;

    /// @notice Steward-callable catch-up when resolver hooks were missed.
    ///         Verifies every decision UID through EAS and loads its non-zero,
    ///         resolver-owned sequence. Before any mutation, a bounded first
    ///         pass proves that the greatest supplied sequence for each Work
    ///         equals WorkApprovalResolver.latestDecisionSequence(workUID).
    ///         A second pass applies only that current decision per Work. Before
    ///         Ready can be evaluated, the module enumerates the commitment's
    ///         complete bounded active Work set and proves every stored sequence
    ///         equals the resolver's current sequence. Omitting any stale linked
    ///         Work therefore reverts the whole catch-up before freeze.
    ///         Pre-upgrade decisions with no sequence are rejected and require
    ///         the operator to attest the current decision again.
    ///         Gating: pool steward.
    function syncWorkDecisions(uint256 commitmentId, bytes32[] calldata decisionUIDs) external;

    /// @notice Canonical recognition validator shared by Hypercert composition
    ///         and SettlementModule. Recomputes the complete sorted vector from
    ///         the frozen on-chain roster, credit counters, and either the
    ///         opened cycle policy or immutable cycle-less 20/80 protocol
    ///         policy; rejects zero eligible rows, unavailable policy,
    ///         omissions, caller-selected weights, and hash mismatch.
    ///         The canonical domain-separated preimage is exactly
    ///         `recognitionSnapshotHash = keccak256(abi.encode(block.chainid,
    ///         commitmentId, recognitionEntries))`. Every off-chain caller —
    ///         SettlementModule payout-plan creation and Hypercert
    ///         composition — must reproduce that encoding byte-for-byte.
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
    ///         and every address must be active. The first evidence attribution
    ///         for a contributor sets their recognition credit from 0 to 1;
    ///         later distinct evidence remains provenance and adds no weight.
    ///         The credit becomes recognition-eligible only after Fulfilled.
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
    ///         counterparty, creator, accountable lead provider, or steward.
    ///         The lead is included so a Garden-claimed Request — whose
    ///         counterparty is an uncallable GardenAccount — is still
    ///         submittable by the human who did the work; submitting is not
    ///         confirming, and the lead stays excluded from every
    ///         confirmation path.
    function submitForConfirmation(uint256 commitmentId) external;

    /// @notice Path (c): steward override with visible reason.
    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external;

    /// @notice Gating: a named confirmer, or Offer counterparty / Request creator
    ///         under the direction-aware default. When that default resolves to
    ///         a GardenAccount (a Garden-claimed commitment), the module
    ///         resolves it to that garden's operator/owner Hat wearers and
    ///         accepts those addresses directly; confirmation is never routed
    ///         through ERC-6551 `execute`. No frozen contributor can
    ///         confirm the team's fulfillment.
    function confirmFulfillment(uint256 commitmentId) external;

    /// @notice Gating: current commitment-pool steward/owner Hat wearer, or,
    ///         only when protocolFallbackEnabled, current registered protocol-
    ///         pool steward/owner Hat wearer. Local authority is tested first,
    ///         so a dual-role caller records PoolFallback. Module ownership
    ///         alone is not confirmer authority. The current ordinary
    ///         named/default path must be unreachable after contributor
    ///         exclusion or OrdinaryConfirmationStillReachable reverts.
    ///         Reason is mandatory and SelfConfirmation excludes every
    ///         contributor on both paths.
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
    function getCommitmentSeries(uint256 seriesId) external view returns (CommitmentSeries memory);
    function getCommitmentSeriesIdByCreationRequest(
        address holder,
        bytes32 creationRequestKey
    ) external view returns (uint256 seriesId);
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
    function protocolPoolId() external view returns (uint256);
    function rootGarden() external view returns (address);
    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId);
    function getLinkedWorkUIDs(uint256 commitmentId) external view returns (bytes32[] memory);
    function isApprovalCounted(bytes32 approvalUID) external view returns (bool);
    function isEvidenceAttached(uint256 commitmentId, bytes32 cidHash) external view returns (bool);
    /// @dev The five bounds below and `cyclelessRecognitionPolicy()` must be
    ///      implemented as explicit `pure` functions returning the constants.
    ///      A `public constant` state variable generates a `view` getter, not a
    ///      `pure` one, so the natural auto-getter implementation does not
    ///      satisfy this interface and fails the ABI/interface proof.
    function MAX_CONFIRMERS() external pure returns (uint256);
    function MAX_REQUIREMENTS() external pure returns (uint256);
    function MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT() external pure returns (uint256);
    function MAX_CONTRIBUTORS_PER_COMMITMENT() external pure returns (uint256);
    function MAX_LINKED_WORKS_PER_COMMITMENT() external pure returns (uint256);
    function cyclelessRecognitionPolicy() external pure returns (RecognitionPolicy memory);
    function paused() external view returns (bool);

    // ══════════════════════ Admin (module owner) ═════════════════════

    /// @notice Initializes with paused == true and a non-zero canonical root
    ///         GardenAccount. Configuration is completed through the
    ///         paused-only setters before the first unpause.
    function initialize(address owner_, address rootGarden_) external;
    function setGardenToken(address gardenToken) external;
    function setHatsModule(address hatsModule) external;
    function setActionRegistry(address actionRegistry) external;
    function setCommitmentRegistry(address registry) external;
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
existing `AssessmentResolver`, and the net-new `TestimonyResolver`; the per-function doc
comments in the interface above remain the enforcement detail. Role legend: **steward** = pool
steward via `_requirePoolSteward` (garden operator/owner through hatsModule, module owner fallback;
the protocol pool resolves to root-garden hats). **garden member** (the membership predicate) = wearer of any of the six garden role
hats (`IHatsModule.GardenRole`) in the relevant garden; the acting persona noun in this spec and the gallery is **gardener**. Pause interplay: the initializer sets
`paused = true`. Module pause blocks operational mutations but never `setPaused`,
`cancelCommitment`, `expireCommitment`, or `resolveDispute`; owner dependency/schema setters are
callable **only while paused**. `setPaused(false)` fails closed until all six dependency addresses
and all four non-zero, pairwise-distinct schema UIDs are configured. Pool-level Paused additionally
blocks new commitments, claims, Ready submissions, and confirmations on that pool only.
`onGardenMinted` is an operational mutation and therefore reverts `ModulePaused` while the module
is paused; GardenToken's existing try/catch around that callback (6.3) swallows the revert, so
garden minting is never blocked by pooling state. Any garden minted during the paused window
simply has no pool row yet and is covered by the `registerPool` backfill that PR chain 3 already
runs after the verified unpause — there is no separate catch-up path and no queued-callback
retry.

| Group | Function | Authorized caller | State / other gates |
|---|---|---|---|
| Pool | `onGardenMinted` | GardenToken only | idempotent; creates a Garden-type pool in NotReady; reverts `ModulePaused` while the module is paused, which GardenToken's try/catch swallows so minting never blocks, and the missed garden is picked up by the post-unpause `registerPool` backfill |
| Pool | `registerPool` | Protocol type: module owner · Garden type: garden operator/owner or module owner | one pool per garden (`PoolExists`); Protocol requires `garden == rootGarden` or reverts `ProtocolGardenMismatch` before any pool/protocol ID write; first exact-root Protocol registration sets write-once `protocolPoolId`, and a second Protocol registration reuses `PoolExists(existingProtocolGarden)`. The one-shot Garden backfill compares normalized addresses and skips `rootGarden`, whose existing Protocol pool satisfies the one-pool-per-garden invariant. |
| Pool | `setPoolCharter` | steward | — |
| Pool | `markPoolReady` | steward | NotReady only; charter CID non-empty; non-zero provider open-commitment cap already set in the register. The app additionally requires one current non-revoked Baseline assessment (v2 or v3, recipient = pool garden, resolver-validated Baseline kind) before enabling this write. |
| Pool | `openPool` / `pausePool` / `resumePool` / `closePool` / `compostPool` / `reopenPool` | steward | transitions exactly per the §5.1 table; pause reason CID mandatory and indexed until resume. `closePool` additionally requires `liveCommitmentCount == 0` and `nonTerminalCycleCount == 0`; paused state does not remove the cancel/expire/resolve and cancel/compost wind-down path. |
| Cycle | `seedCycle` | steward | pool Ready or Open; valid time window; allocation is not accepted or stored |
| Cycle | `openCycle` | steward | pool Open; cycle Seeded; supplied allocation-class bps sum == 10_000; recognition-policy bps sum == 10_000 (protocol default 2_000 equal / 8_000 verified); both become immutable; Season requires `openSeasonCycleId == 0`, Campaigns may overlap |
| Cycle | `closeCycle` / `compostCycle` | steward | Open → Reconciled → Composted |
| Cycle | `cancelCycle` | steward | from Seeded or Open; reason CID; `liveCommitmentCount == 0` |
| Commitment series | `createCommitmentSeries` | current member of the pool garden, direct holder only | pool Ready or Open; non-zero holder-scoped `creationRequestKey`; non-empty metadata; caller becomes immutable `createdBy` and initial `currentHolder`. First use stores `keccak256(abi.encode(poolId, keccak256(bytes(metadataCID))))`; exact replay returns the existing `seriesId` without mutation/event, while the same holder/key with a different payload reverts `SeriesCreationRequestConflict`. |
| Commitment series | `updateCommitmentSeriesMetadata` | current holder | Active or Resting; non-empty metadata; prior and open Commitment instances remain unchanged |
| Commitment series | `restCommitmentSeries` / `resumeCommitmentSeries` / `retireCommitmentSeries` | current holder | Active → Resting, Resting → Active, Active/Resting → Retired; Retired terminal; no instance transition |
| Commitment | `createCommitment` | own Offer/Request: member of the pool garden · SeasonCampaign + StewardCaptured: steward · protocol-pool commitments: root-garden steward or module owner | pool Open; non-zero creator-scoped `creationRequestKey` persisted before send; non-empty exact `unitLabel`; non-zero `targetUnits`; `cycleId == 0` is always permitted, for gardeners as well as stewards, and carries no cycle-state requirement; a non-zero `cycleId` must exist in the same pool and must additionally be Open for gardener-created commitments, while steward-seeded SeasonCampaign/StewardCaptured commitments permit Seeded or Open; StewardCaptured must set `onBehalfOf`; DomainImpact requires 1–`MAX_REQUIREMENTS` repeatable action requirements with non-zero counts, total required count no greater than `MAX_LINKED_WORKS_PER_COMMITMENT`, and ActionRegistry-derived domain tags; non-DomainImpact kinds may use optional domain tags and no requirements; a non-zero `commitmentSeriesId` must resolve to an Active same-pool series held by the direct creator and requires Offer + Individual + zero `onBehalfOf`; every non-zero `counterCommitmentId` must reference an existing same-pool commitment (`UnknownCounterCommitment` / `CounterCommitmentPoolMismatch` / `SelfCounterCommitment`), and when B is an Offer the same transaction, before B allocation/storage/class registration, additionally requires direct Individual B plus Offered Individual A, distinct creators, and A's exact full class still Committed to A's creator; `declaredUnitValue`/`declaredValueBasis` obey the pair rule (`InvalidValueDeclaration`); `protocolFallbackEnabled` requires non-zero `protocolPoolId` or reverts `ModuleNotReady` before mutation. First use stores the full normalized payload hash and maps creator/key to the commitment; exact replay returns the first ID with no mutation or event, while conflicting reuse reverts `CommitmentCreationRequestConflict`. Offer creation commits its class and reserves one provider slot, while Request creation only registers its class; both increment the pool live count once. |
| Commitment | `setDeclaredReward` / `setDeclaredValue` / `setConfirmerRule` | steward | pre-acceptance only; zero amount requires `RewardRail.None` plus zero source/token; non-zero `ArbitrumExternal` requires non-zero source/token; non-zero `CeloSettlement` requires zero source/token sentinels because SettlementModule exclusively derives its write-once canonical G$ token and the stored provider-garden payer; `setDeclaredValue` enforces the value/basis pair rule (`InvalidValueDeclaration`) and emits `ValueDeclared`; `setConfirmerRule` writes named/default terms plus `protocolFallbackEnabled`, and enabling the flag requires non-zero `protocolPoolId` |
| Commitment | `claimCommitment` | garden pool: member of the pool garden · protocol pool ClaimType.Garden: operator/owner of the claiming garden (`gardenContext`) · protocol pool ClaimType.Individual: member of `gardenContext` | runtime kind equals stored claimType; canonical claimant is caller for Individual and `gardenContext` for Garden; `requestedBy` is caller; neither canonical claimant nor Garden `requestedBy` may equal creator; Open accepts, ApprovalGated emits `ClaimRequested` |
| Commitment | `acceptClaim` | steward | ApprovalGated path; consumes the stored kind/gardenContext, re-validates eligibility, and rejects a stored Garden `requestedBy` equal to creator |
| Commitment | `acceptExchange` | creator of referenced commitment A | B names A through immutable `counterCommitmentId`; same pool; Offer×Offer and Offered×Offered only; distinct creators; Individual×Individual only; B must be direct-created rather than `StewardCaptured`/`onBehalfOf`; both cycle/identity checks run before mutation, and both full immutable-quota classes must remain Committed to their creators. B's direct creation plus A creator's call is valid for Open and ApprovalGated claim modes, so no operator approval is consulted. Both classes/slots are already reserved from Offer creation; two `CommitmentAccepted` events, one `ContributorAdded` lead event for each creator on that creator's Offer, and one `ExchangeAccepted` marker are atomic with no second registry commit or provider-cap headroom check. Each ordinary acceptance independently sweeps every other still-Pending indexed request for its commitment. Cap headroom is checked only when `commitUnits` reserves a new slot. |
| Commitment | `declineClaim` | steward | ApprovalGated pending request; mandatory reason; claimant may request again later |
| Contributors | `joinCommitment` | eligible gardener | Accepted only; contributor policy Open; caller becomes active; roster not frozen; max-contributor guard runs before mutation |
| Contributors | `leaveCommitment` | active contributor | Accepted and Open-policy only; roster not frozen; caller is not the lead and has zero linked Work plus zero Work/evidence credit; every mutation revalidates confirmer reachability |
| Contributors | `addContributor` / `removeContributor` | lead provider or steward | Accepted only; contributor policy must be LeadManaged for both functions; Open rosters use self-join/self-leave and cannot be expelled through `removeContributor`; roster not frozen; add requires the target to pass the same resolved `providerGarden` membership predicate as self-join; max-contributor guard runs before add; lead or any contributor with linked Work or credit cannot be removed; every mutation revalidates confirmer reachability |
| Contributors | `setContributorRequirement` | lead provider or steward | Accepted only; active contributor; valid requirement index; roster not frozen; assignment is planning metadata, never contribution credit |
| Linkage | `linkWork` | active contributor, lead provider, or steward | Accepted only; non-zero caller-scoped `operationKey`; verifies schema, providerGarden recipient, explicit DomainImpact requirement index/action match, and that the Work attester is an active contributor; first use stores the exact commitment/work/requirement payload hash; exact replay is a no-op even after a later unlink and conflicting reuse reverts `WorkLinkOperationConflict`; one work maps to at most one commitment; append to the bounded enumerable active-link set and reject max-plus-one before mutation |
| Linkage | `unlinkWork` | steward | Accepted and roster/credit ledger unfrozen; only while `workCreditActive[workUID] == false`; a historical approval followed by an effective rejection may be unlinked |
| Linkage | `onWorkDecision` | WorkApprovalResolver only | never reverts; applies only the newer effective pre-freeze decision |
| Linkage | `syncWorkDecisions` | steward | bounded preflight verifies decision history on EAS and requires the greatest supplied sequence for every included Work to equal the resolver's current `latestDecisionSequence(workUID)` before mutation; applies only each Work's current decision, then enumerates the complete active-link set and requires every local sequence to equal the resolver before evaluating Ready; omission of any stale linked Work reverts the batch |
| Evidence | `attachEvidence` | active contributor, lead provider, or steward | offline-queueable; CID is non-empty and exact-CID-de-duplicated per commitment; credited list is non-empty, unique, at most `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT`, and every credited address is active; each contributor receives at most one evidence-derived recognition credit per commitment |
| Evidence | `attachAssessment` | steward or evaluator of providerGarden | Accepted and roster/credit accounting unfrozen; existing `assessmentUID` must be zero (`AssessmentAlreadyAttached` otherwise); verifies assessment attestation (v2 or v3 UID; recipient == providerGarden); if the non-zero Work threshold was already met, re-runs the automatic Ready predicate. No post-readiness replacement path exists |
| Confirmation | `submitForConfirmation` | counterparty, creator, accountable lead provider, or steward | SupportService/StewardCaptured/SeasonCampaign only; `requirements.length == 0`; at least 1 pre-freeze evidence record; declared assessment attached; DomainImpact rejected. The lead is explicitly included: for an Offer and an Individual Request the lead already is creator or counterparty, and for a Garden-claimed Request the counterparty is an uncallable GardenAccount, so omitting the lead would leave the human lead provider unable to submit their own finished work. Submitting is not confirming; the lead remains blocked from every confirmation path |
| Confirmation | `markReadyForConfirmation` | steward | override path; reason emitted and visible |
| Confirmation | `confirmFulfillment` | named confirmer, Offer counterparty, or Request creator; when that party is a GardenAccount, the operator/owner Hat wearers of that garden, resolved through hatsModule and accepted as direct callers | state ReadyForConfirmation; every frozen contributor is blocked (`SelfConfirmation`), including a garden steward who is also a contributor; once per confirmer (`AlreadyConfirmed`); confirmation is never mediated by ERC-6551 `execute`, and the GardenAccount address itself is not an accepted caller |
| Confirmation | `confirmFulfillmentAsFallback` | current commitment-pool steward/owner Hat wearer, or current registered protocol-pool steward/owner Hat wearer when `protocolFallbackEnabled` | current ordinary named/default path is unreachable after contributor exclusion (`OrdinaryConfirmationStillReachable` otherwise); mandatory reason; contributors are blocked (`SelfConfirmation`) on both paths; module ownership alone grants no confirmer authority; local authority is checked first and emits `PoolFallback`, otherwise the opted-in protocol path emits `ProtocolFallback` |
| Exit | `cancelCommitment` | creator or steward (from Offered/Requested) · steward only (from Accepted) | reason CID; never from ReadyForConfirmation except via dispute resolution; allowed while module paused |
| Exit | `expireCommitment` | anyone (permissionless) | past dueDate, or cycle endTime when dueDate == 0 |
| Dispute | `raiseDispute` | creator, counterparty, named confirmer, or steward | from Accepted / ReadyForConfirmation / Expired |
| Dispute | `resolveDispute` | steward | RestorePrevious or terminal resolution; Expired cannot become Fulfilled; a direct Fulfilled result rejects a resolving steward who is a contributor (`SelfConfirmation`); allowed while module paused |
| Recognition | `validateRecognitionSnapshot` | public view | commitment Fulfilled with frozen roster; exact sorted vector length equals `eligibleContributorCount`; every unique row is eligible; weights are recomputed from the immutable cycle policy and credit counters; supplied/canonical hashes must match |
| Reward | `recordRewardPaid` | steward | state Fulfilled; `reward.rail == ArbitrumExternal`; single record per commitment in MVP. `CeloSettlement` reverts and is owned exclusively by SettlementModule |
| Module dependency/schema admin | `setGardenToken` / `setHatsModule` / `setActionRegistry` / `setCommitmentRegistry` / `setWorkApprovalResolver` / `setEAS` / `setSchemaUIDs` | module owner | module must be paused; dependency addresses reject zero; schema UIDs reject zero and pairwise collision; every accepted change emits old/new configuration facts |
| Module pause admin | `setPaused` | module owner | initialize paused; pausing is always allowed; unpause requires all six dependencies plus all four non-zero, pairwise-distinct schema UIDs and emits old/new pause state |
| Module limiting admin | `setProviderOpenCommitmentCap` | pool steward | non-zero concurrent commitment count; module forwards to the register; required before Ready |
| Register | `registerClass` / `setProviderOpenCommitmentCap` / `commitUnits` / `releaseUnits` / `fulfillUnits` | CommitmentPoolingModule only (`NotModule`) | class quota is immutable at creation (`targetUnits`); only the accountable lead provider is the exposure/count subject (§6.2) |
| Register admin | `setModule` | register owner: protocol 3-of-5 Safe before any mainnet activation | new module rejects zero; initial zero → non-zero wiring is allowed once; every later replacement requires the current module to be paused and emits `ModuleUpdated(old,new)` |
| Assessment config | existing `setSchemaUID` / existing `setKarmaGAPModule` / new `setAssessmentV3SchemaUID` | existing AssessmentResolver owner: protocol 3-of-5 Safe before this lane's mainnet upgrade | v2 selector/event and deployment-window zero value remain compatible; KarmaGAP zero disables its optional hook; v2/v3 UID equality is rejected; v3 UID rejects zero and emits old/new |
| Community Testimony config | `setSchemaUID` / `setCommitmentModule` | TestimonyResolver owner: protocol 3-of-5 Safe before any mainnet activation | UID rejects zero, pins once, treats an exact repeat as a no-op, and rejects conflict; module rejects zero and an unpinned UID; preparation pins the deterministic UID while module is zero, finalization reconciles the exact EAS record, and verified module activation is last |
| Upgrades | `_authorizeUpgrade` on module, register, upgraded AssessmentResolver, and net-new TestimonyResolver | protocol 3-of-5 Safe | UUPS convention repo-wide; existing Assessment initializer is never re-run |

**Ownership and release gate (2026-08-02 correction; supersedes the waiver clause in the
2026-07-30 owner decision).** The live GardenToken, WorkApprovalResolver, and AssessmentResolver
proxies currently report deployer EOA `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6` as `owner()`.
That is observed state, not acceptable final authority for this lane. The
`packages/contracts/AGENTS.md § Mainnet Additional Requirements` gate applies to the pooling tier
without exception: before any mainnet upgrade, deployment, schema/module activation, or unpause,
the external audit has no unresolved critical/high finding, protocol UUPS/admin authority is
verified on the 3-of-5 Gnosis Safe, the 48-hour mainnet timelock is configured, at least two weeks
of testnet operation are evidenced, and rollback is documented and tested. Deployment tooling may
use the verified live owner only for a human-authorized, fail-closed ownership-transfer transaction
plan whose post-check proves the Safe owns every touched proxy; no later plan step may rely on the
EOA as upgrade or administrative authority. The same gate covers CommitmentPoolingModule,
CommitmentRegistry, AssessmentResolver, TestimonyResolver, and every other protocol proxy this lane
deploys or upgrades.

EAS authorship, enforced by the resolvers (§6.4.3), for completeness of the access-control picture:

| Attestation | Authorized attester |
|---|---|
| Assessment v3 — Baseline | garden evaluator OR operator (analog capture preserved, v2 parity) |
| Assessment v3 — Delta / Technical | garden evaluator only |
| Community testimony | Community Hat only (first real attestation gate for that hat) |
| Work / WorkApproval (existing) | unchanged: gardener-or-operator / operator with no self-attestation |

#### Behavior notes an implementer must not miss

- **Confirmer rule storage, structural fallback, and loop bound**: `MAX_CONFIRMERS` is an ABI-visible
  bound whose current **planning target** is 32; the first contract PR freezes its measured value
  only after the required 8/16/24/32 harness records the result table below.
  `createCommitment` and
  `setConfirmerRule` reject `confirmers.length > MAX_CONFIRMERS` with
  `TooManyConfirmers(supplied, maximum)` before class registration, commitment storage, or event
  emission. Both calls store and emit `protocolFallbackEnabled`; setting it true while
  `protocolPoolId == 0` reverts `ModuleNotReady` before mutation. Empty means Offer counterparty
  or Request creator, threshold 1; when that default
  party is a GardenAccount, the module resolves it at confirmation time to the claiming garden's
  operator/owner Hat wearers and accepts any of them as the eligible confirmer, so a Garden-claimed
  commitment is confirmed by a steward transaction rather than an ERC-6551 `execute` from the
  GardenAccount. The GardenAccount address itself never counts as a confirmer. Every frozen
  contributor is still excluded. At acceptance, the
  now-bounded named group is de-duplicated and every active contributor is excluded. Every later
  contributor mutation revalidates the group against the contributor-membership mapping. The module
  persists and emits the resolved group. Without protocol fallback, acceptance reverts
  `InvalidConfirmerRule` when the threshold exceeds remaining eligible addresses, and a roster
  mutation reverts `ConfirmationThresholdUnreachable` before state changes when too few
  non-contributor confirmers would remain. With explicit protocol fallback, that same ordinary
  reachability failure is permitted because the registered protocol garden supplies the selected
  structural path; this does not add protocol actors to the named count or lower its threshold.
  `createCommitment` and `setConfirmerRule` also reject `threshold == 0` with a
  non-empty named list, `InvalidConfirmerRule`, before any storage or event mutation; only the
  empty-list default may resolve its own threshold, and it resolves to 1. Duplicates in the
  submitted list never change the stored threshold: the stored value is exactly the
  caller-supplied number, de-duplication happens at acceptance, and it is the de-duplicated
  eligible count — after excluding every active contributor — that the ordinary
  `InvalidConfirmerRule` check compares the stored threshold against. The named group is data,
  not a hat. Fallback confirmation first proves that the current ordinary named/default path is
  unreachable after contributor exclusion, reverting `OrdinaryConfirmationStillReachable`
  otherwise. It then checks `SelfConfirmation` and a non-empty reason and classifies current
  pool-garden Hat authority as `PoolFallback` before checking the opted-in protocol-garden Hat
  authority as `ProtocolFallback`; module ownership alone satisfies neither.
- **Lead-provider identity (one formula everywhere)**: acceptance stores the Offer creator for
  every Offer; an Individual Request stores the accepted counterparty; and a Garden-claimed
  Request stores the authenticated operator/owner who requested the claim: the current
  `msg.sender` for immediate Open acceptance, or the consumed pending claim's stored
  `requestedBy` for ApprovalGated acceptance.
  `counterparty` remains the GardenAccount for that Garden claim and `providerGarden` remains the
  group scope. Before register commitment or roster mutation, acceptance revalidates the resolved
  lead against the same current `providerGarden` membership predicate used by self-join,
  managed addition, and Work authorship. A creator who lost their Hat, or an ineligible
  StewardCaptured `onBehalfOf` gardener, reverts `NotEligibleContributor` instead of becoming the
  first contributor. Only then is the lead activated.
  The lead provider alone is the `CommitmentRegistry` account and open-commitment-count subject.
  `counterparty` remains the accepted recipient for an Offer and the accepted claimant for a
  Request; only the Garden-Request exception resolves its human lead from the authenticated
  requester while keeping the GardenAccount as counterparty.
- **Contributor roster**: contributor membership is event-indexed and incrementally mutated and
  is never coupled to the four-value domain enum. `MAX_CONTRIBUTORS_PER_COMMITMENT` is
  provisionally 32 and is enforced before lead initialization, self-join, or add mutates state;
  implementation benchmarks 8/16/24/32 and freezes the largest measured-safe end-to-end
  creation/finalization vector. Open policy allows eligible self-join and pre-freeze self-leave;
  LeadManaged alone permits lead/steward add and remove, and permits adding only an eligible member of the
  resolved `providerGarden`; arbitrary external addresses cannot enter recognition or payout
- **Linked-Work enumeration**: `commitmentWorkUIDs` contains exactly the active linked Work set.
  `MAX_LINKED_WORKS_PER_COMMITMENT` is provisionally 32 and uses the same required
  8/16/24/32 gas benchmark before implementation freezes it. Link rejects max-plus-one before
  mutation; unlink swap-removes the UID. Every readiness or direct-fulfillment freeze path scans
  this complete bounded set and proves each stored decision sequence equals the resolver's
  current sequence. Callers never declare the authoritative set.
  eligibility through managed addition. Open rosters remain self-join/self-leave only and have no
  ordinary expulsion path. The lead can never leave or be removed, and any
  contributor with approved Work or evidence credit can be removed only through a separately
  specified reasoned correction that preserves attribution and confirmation exclusion, not the
  roster edit API. Membership,
  requirement assignment, Work credit, and evidence credit are distinct. Assignment expresses
  planned responsibility only. Work credit is derived from the approved Work attester; a
  contributor's first evidence attribution records one participation credit, while later
  distinct evidence remains provenance without increasing recognition weight. That 0-or-1
  evidence credit contributes to eligibility only after the commitment is fulfilled.
  The transition to ReadyForConfirmation emits `ContributorRosterFrozen` atomically before the
  ready event and freezes both roster membership and contribution-credit accounting. No
  add/remove/assignment, new evidence credit, new Work link, or late approval credit is valid
  afterward.
- **Evidence identity and bounded crediting**: `attachEvidence` rejects an empty CID, hashes the exact CID bytes, and
  rejects a repeated `(commitmentId, cidHash)` before any counter or event mutation. It requires
  1 through `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` unique active contributors, increments
  `Commitment.evidenceCount` once. For each credited contributor, the first attribution changes
  `evidenceCredits` from 0 to 1 and increments `totalVerifiedCredits`; later distinct CIDs create
  indexed provenance rows but do not increment either recognition counter. All attribution must
  land while the commitment is on-chain Accepted and `contributorsFrozen == false`; a queued
  attachment that lands after freeze reverts without writing the CID or any credit. The
  provisional bound is 32 and must be checked against 8/16/24/32 gas and event-payload
  benchmarks before implementation freezes it. The bound is transaction safety, not a product
  rule limiting team size. `isEligibleContributor` additionally requires the commitment to be
  `Fulfilled`, so attachment records attribution without treating unconfirmed work as verified.
- **Cycle terminal safety**: creating any commitment with `cycleId != 0` increments that Cycle's
  `liveCommitmentCount`. Every live-to-Fulfilled, Cancelled, or Expired transition decrements it
  exactly once; a dispute preserves whether the pre-dispute commitment was already terminal, so
  resolving an already Expired record cannot decrement twice. ReadyForConfirmation remains live.
  `raiseDispute` from a still-live state changes no count, because that record was never
  decremented. `raiseDispute` from an already-terminal Expired record **re-increments**
  `liveCommitmentCount`, and that dispute's resolution — restore Expired or resolve Cancelled,
  never Fulfilled — decrements exactly once. Increment and decrement therefore pair per dispute
  episode, which is what "resolving an already Expired record cannot decrement twice" means: the
  guard is against an unpaired second decrement, not against ever counting a reopened record.
  This is the accounting form of the §5.2 rule that every cycle-scoped commitment must be
  Fulfilled, Cancelled, or Expired before `closeCycle`: a Disputed record is none of those, so an
  open dispute must hold the cycle open. Without the re-increment the count could read zero while a
  Disputed record remained, `closeCycle` would admit it, and §5.3 would have no defined Reconciled
  derivation for a commitment whose on-chain state is `Disputed`.
  `closeCycle` and `cancelCycle` require the O(1) count to be zero, which forces stewards to
  confirm, cancel, expire, or resolve every cycle commitment before reconciliation or cycle
  cancellation and prevents a later fulfillment from changing the certified recognition set.
- **Self-checks**: `claimCommitment` reverts `SelfCounterparty` when the canonical claimant equals
  the creator or when a Garden claim's authenticated `requestedBy` caller equals the creator.
  `acceptClaim` repeats the latter check against the stored pending request before consuming it,
  so neither Open nor ApprovalGated Garden claims provide a creator-self-claim bypass.
  `confirmFulfillment` and fallback confirmation revert `SelfConfirmation` for every active
  contributor in the frozen roster, mirroring the existing WorkApproval separation-of-duties
  rule rather than checking only the lead provider.
- **Register coupling**: `createCommitment` rejects an empty exact `unitLabel` or zero
  `targetUnits`, then registers the class with immutable quota `targetUnits` and accounting state
  `Registered`. A pool steward configures the non-zero per-pool provider open-commitment cap
  through the module forwarder before `markPoolReady`; the register itself remains module-only.
  Offer creation immediately calls `commitUnits(commitmentId, creator, targetUnits)`, changes the
  class to `Committed`, and reserves the lead provider's open-commitment slot before the Offer is
  displayed as available. Offer acceptance validates the existing class/account binding and makes
  no registry call. Request creation leaves the class `Registered`; Request acceptance calls
  `commitUnits(commitmentId, commitment.leadProvider, targetUnits)` once the provider is known.
  The register accepts only the full non-zero quota from `Registered` and increments that lead
  provider's count exactly once. Cancel/expiry releases an unaccepted Offer, an
  Accepted/ReadyForConfirmation commitment, or a Disputed record whose prior state held units,
  always against `commitment.leadProvider`; an unaccepted Request has no registry effect.
  `releaseUnits` accepts only the full live committed balance from
  `Committed`, changes the class to `Released`, and decrements once. Fulfillment applies the same
  full-balance guard, changes the class to `Fulfilled`, and decrements once. `Released` and
  `Fulfilled` are terminal register states, so a module upgrade or erroneous repeat call cannot
  reacquire or release the slot. Raising or restoring a dispute makes no register call and
  preserves the pre-dispute slot state.
- **Canonical claim identity + traceability**: creation-time `claimType` is immutable eligibility; `claimCommitment` reverts `ClaimTypeMismatch` when runtime `kind` differs. Individual: `claimant = requestedBy = msg.sender`. Garden: `claimant = gardenContext`, `requestedBy = msg.sender`, after operator/owner authorization. Both identities are checked against the creator, so the creator cannot hide behind an operated GardenAccount. Open accepts immediately and derives the Garden Request lead from that authenticated caller without creating a pending row. ApprovalGated stores `{claimant, requestedBy, kind, gardenContext, requestedAt, active}` keyed by `(commitmentId, canonical claimant)`, rejects an active duplicate, and later `acceptClaim` revalidates the stored requester before it or `declineClaim` consumes that exact key. Envio marks accepted and sibling requests without an arbitrary scan.
- **Provider-garden anchor**: acceptance stores `providerGarden` (Offer: pool garden; Request:
  accepted claimant's validated gardenContext) and emits both `leadProvider` and `providerGarden`
  in `CommitmentAccepted`. DomainImpact Work must use a required action, resolve its Work attester
  as an active contributor, and keep the Work/assessment EAS recipient equal to `providerGarden`,
  including protocol-pool commitments that remain owned by the root pool.
- **Reward binding**: `RewardRail.None` is valid only with zero source/token/amount.
  `ArbitrumExternal` requires a non-zero exact source/token/amount. `CeloSettlement` requires
  zero declared source/token sentinels and a non-zero amount because pooling neither owns a
  canonical-G$ authority nor knows a protocol-pool Request's payer garden at creation. Acceptance
  resolves `providerGarden`; the SettlementModule then derives and stores its write-once
  `gDollarToken` and that garden's active Celo Safe as the plan token/source.
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
  non-zero `requiredCount`; their total may not exceed
  `MAX_LINKED_WORKS_PER_COMMITMENT`, so creation cannot encode an unfulfillable Work quota.
  Actions and derived domains may repeat. The stored `domains` list is
  the unique derived tag set for filtering, not a positional array. Non-DomainImpact kinds carry
  optional validated `domainTags` and no requirements. `MAX_REQUIREMENTS = 16` is provisional;
  before implementation freezes it, contract/indexer benchmarks must compare 8/16/24/32 for
  worst-case creation, approval credit, Ready evaluation, event payload, and replay cost. The
  benchmark is one named Foundry harness, NET-NEW at
  `packages/contracts/test/CommitmentPoolingBounds.t.sol` (alongside the existing top-level
  `test/GasBenchmarks.t.sol` and `test/StorageLayout.t.sol`, which is where this repo keeps
  cross-cutting harnesses), run as
  `bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`. It
  covers all five bounded vectors — `MAX_REQUIREMENTS`, `MAX_LINKED_WORKS_PER_COMMITMENT`,
  `MAX_CONTRIBUTORS_PER_COMMITMENT`, `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT`, and
  `MAX_CONFIRMERS` — at 8/16/24/32 each. The selected value and the recorded 8/16/24/32 result
  table land in `handoffs/codex-contracts.md`; no constant may be frozen before that table exists.
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
- **Linked-Work roster lock**: linking increments the Work attester's
  `uncountedLinkedWorkCount`; an Accepted-and-unfrozen `unlinkWork` while
  `workCreditActive == false`, or the Work's first countable approval, decrements it exactly once.
  A newer effective rejection restores the count and makes the Work unlinkable again even though
  its historical approval UID remains marked delivered. `leaveCommitment` and
  `removeContributor` require that
  count plus approved Work and evidence credits to be zero. A contributor therefore cannot exit
  while an approval could later create credit for an inactive roster address; a denied or
  abandoned Work must be unlinked by a steward before exit.
- **Effective Work decision before freeze**: `approvalCounted` makes delivery of each decision
  attestation idempotent. After full validation, WorkApprovalResolver increments the Work's
  monotonic `uint64` decision sequence in actual EVM execution order, stores that sequence by
  decision UID, and passes it to the module. The greatest non-zero sequence is canonical, so
  separate transactions in the same block remain chronological and out-of-order catch-up
  converges without treating a hash UID as order. A historical decision with sequence zero is
  not eligible for catch-up; the operator must attest the current decision again. While the
  commitment is Accepted and unfrozen, an effective `approved == true` transition from inactive
  to active sets `workCreditActive`, decrements `uncountedLinkedWorkCount`, increments the exact
  requirement and contributor credit, updates eligibility/totals/units, and emits
  `ApprovedWorkCounted`. A newer effective `approved == false` transition from active to inactive
  clears `workCreditActive`, reverses those same counters (including eligibility when that was the
  contributor's final verified credit), increments `uncountedLinkedWorkCount`, recomputes units,
  and emits `ApprovedWorkReversed` with the new cumulative values and positive removed-unit delta.
  Repeated same-state decisions update only the latest sequence/UID. Older, duplicate, unlinked,
  or post-freeze decisions are observed but cannot mutate the frozen ledger. Active links are
  stored in `commitmentWorkUIDs`; `linkWork` rejects `MAX_LINKED_WORKS_PER_COMMITMENT + 1`, and
  `unlinkWork` removes the UID from that bounded array. Catch-up first verifies all supplied
  attestations and proves the greatest submitted sequence for each included Work equals the
  resolver's current `latestDecisionSequence(workUID)`, then applies only those current
  decisions. Before any automatic, submitted, overridden, or dispute-resolution path can freeze
  credit, the module enumerates the complete active-link array and requires each stored sequence
  to equal the resolver's current sequence. In `onWorkDecision`, a failed freshness read or stale
  sibling merely suppresses the Ready transition so the resolver hook remains non-blocking; in
  `syncWorkDecisions` or an explicit readiness call it reverts `IncompleteDecisionHistory`.
  Omitting linked Work A while syncing Work B therefore cannot freeze A's stale approval.
- **Canonical recognition validation**: the module maintains `eligibleContributorCount` when a
  contributor receives their first verified credit and `totalVerifiedCredits` for each active
  approved Work credit plus each contributor's first evidence participation credit. Additional
  evidence attributed to the same contributor does not change either counter. Cycle-scoped
  commitments may enter ReadyForConfirmation or resolve a
  dispute as Fulfilled only after their cycle is Open and its two-part policy is snapshotted.
  Cycle-less commitments use the immutable protocol policy returned by
  `cyclelessRecognitionPolicy()` (2_000 equal / 8_000 verified). After fulfillment,
  `validateRecognitionSnapshot` requires a frozen roster, at least one eligible contributor,
  exactly that many sorted unique eligible rows, and an available policy, then recomputes the
  weights and deterministic remainders from on-chain records before returning the
  domain-separated hash. That hash has exactly one canonical preimage,
  `recognitionSnapshotHash = keccak256(abi.encode(block.chainid, commitmentId,
  recognitionEntries))` (`settlement-spec.md` §3.1.3), and every off-chain caller — SettlementModule
  payout-plan creation and Hypercert composition — reproduces that encoding rather than inventing
  its own domain separator.
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
- **Cycle binding**: `cycleId == 0` is the only cycle-less sentinel, and any caller class may use
  it — gardeners create cycle-less commitments exactly as stewards do. The cycle-state requirement
  is conditional on `cycleId != 0` and never applies to `cycleId == 0`. Any non-zero cycle must
  exist and belong to `params.poolId`; a gardener-created commitment additionally requires that
  cycle to be Open, while steward-seeded SeasonCampaign/StewardCaptured commitments permit Seeded
  or Open. A cycle-less commitment uses the immutable protocol 20/80 preset returned by
  `cyclelessRecognitionPolicy()` for contributor recognition and payout defaults, and stays
  ineligible for COMMITMENT-bundle Hypercert minting because it has no immutable six-role
  allocation snapshot. Cancelled, Reconciled, Composted, or cross-pool cycles always revert before class registration. A non-zero cycle increments `liveCommitmentCount` only after all creation validation succeeds.
- **onWorkDecision must never revert** for unrecognized state: the EAS approval/rejection decision succeeds regardless (the Work decision flow is a `critical` path per repo criticality matrix).

#### Acceptance criteria

- Every transition in the section 5 tables has exactly one emitting function or a documented derivation; no silent state changes.
- `bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol`
  covers pool/cycle invariants, one open Season plus concurrent Campaigns,
  allocation/recognition-policy validation and locking at `openCycle`, zero-live-commitment
  closure with exact once-only terminal decrements, paused-first configuration with non-zero
  immutable `rootGarden`, exact-root Protocol registration, wrong-root rejection before any
  pool or `protocolPoolId` write, atomic Offer-B counterparty revalidation before any B
  allocation/storage/class event, stale-A rollback, StewardCaptured/on-behalf B rejection,
  direct-B plus A-caller consent, exchange request-index supersession when neither accepted
  counterpart has a request row,
  action UID `0`, repeated domains, caller input limited to `actionUID`/`requiredCount` while
  stored `domain`/`approvedCount` remain module-derived, provisional `MAX_REQUIREMENTS` and
  max-plus-one rejection before mutation, per-requirement approval counts,
  solo/Open/LeadManaged contributor paths, lead
  initialization, add/remove/join/leave/assignment, max-plus-one contributor rejection before
  mutation, credited/lead removal rejection, linked-but-uncounted Work blocking leave/removal,
  Accepted-and-unfrozen unlink with exact pending-count decrement, active-contributor Work/evidence
  credit, empty-CID rejection, exact-CID
  evidence de-duplication, non-empty/unique/max evidence-credit lists, all three evidence-only
  kinds reaching Ready from pre-freeze evidence credit, fulfillment-gated recognition eligibility,
  newer pre-freeze rejection reversing an approval, later re-approval restoring credit exactly
  once, same-block and out-of-order decision sync converging by resolver sequence, unsequenced
  historical-decision rejection with re-attestation recovery, late evidence rejection, and
  post-freeze decision observation without credit mutation, cycle close/cancel
  rejection while any live commitment remains — including a dispute raised from an already-Expired
  record, which re-increments the live count, blocks `closeCycle` and `cancelCycle` while it is
  open, and decrements exactly once on resolution so the pair never double-counts — roster
  and credit freeze on every Ready path, every-contributor confirmation exclusion, a Garden-claimed
  default confirmer resolved to the claiming garden's operator/owner wearers with the GardenAccount
  address itself rejected and a wearer who is also a contributor reverting `SelfConfirmation`,
  protocol fallback disabled by default, `ModuleNotReady` when it is enabled before protocol-pool
  registration, `OrdinaryConfirmationStillReachable` when either fallback path is attempted while
  a named/default confirmer remains reachable, ordinary-unreachable acceptance/Ready rejection
  when disabled, the same structural case reaching Ready and being confirmed by a
  non-contributor protocol-garden steward/owner when enabled, local-vs-protocol
  `ConfirmationPath` provenance including
  local-first classification for a dual-role caller, and module-owner-only rejection,
  lead-provider `submitForConfirmation` on a Garden-claimed Request, explicit repeated-action
  requirement binding, canonical recognition-vector recomputation/hash rejection including
  independent equal/verified remainder passes, a contributor receiving one remainder from each,
  and the separate integer-unit largest-remainder pass conserving budgets smaller than row count,
  unreachable ordinary confirmer threshold rejection, lead-only register exposure, assessment gating, claim identity,
  cancel/expiry/dispute count effects, reward derivation, provider-garden Work/assessment
  validation, and decision-sync dedupe/convergence. The separate NET-NEW harness
  `packages/contracts/test/CommitmentPoolingBounds.t.sol`, run as
  `bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`,
  records worst-case 8/16/24/32 requirement and active-linked-Work
  create/credit/readiness/event gas and payload size, and its result table is written into
  `handoffs/codex-contracts.md` before either constant is frozen. App/shared
  tests cover the current non-revoked Baseline preflight and deterministic Hypercert recognition
  expansion.
- The compiler-generated baseline and concrete slot/offset assertions prove the expected
  38-feature-slot declaration order plus the 12-slot `__gap` (50 total slots); arithmetic alone
  is not proof. The Bun-wrapped
  storage gate gains the `CommitmentPoolingModule:src/modules/CommitmentPooling.sol` entry.
- Fork test proves a full Offer -> Accepted -> WorkLinked -> approval-hook count -> ReadyForConfirmation -> confirm -> Fulfilled -> RewardPaid pass against the deployed EAS on an Arbitrum fork (`bun run test:fork`, wrappers only per `.claude/rules/contracts.md`).

### 6.2 `CommitmentRegistry`

#### Objective

A non-transferable, ERC-1155-STYLE unit ledger internal to our own contract: commitment-instance
classes, committed/fulfilled balances per account, class quotas, and concurrent
provider-commitment caps. It does NOT inherit ERC-1155 and exposes no transfer or approval surface
of any kind; balances move only through module calls. This is the authoritative promise-accounting
substrate (register #15, register #16). A later transferable settlement instrument may consume its
eligible fulfillment facts, but it does not wrap the registry class as the same identity or move
promise ownership.

#### Grassroots Economics grounding (clean-room, register #17)

Design vocabulary comes from Ruddick's "Commitment Pooling: an Economic Protocol Inspired by Ancestral Wisdom" (IJCCR) and the Grassroots Economics "Intro to Commitment Pools" docs, used as named design grammar only, never as code reference (the Sarafu Solidity source is AGPL and is not read):

- **Curation**: which commitments enter the pool's register. Implemented as steward-gated `createCommitment`/`acceptClaim` on the module plus module-only `registerClass` here; nothing enters the register except through curated module paths.
- **Limiting**: hard caps per asset in the pool. Implemented as the per-class `quota` (defaults to the commitment's `targetUnits`) plus a per-pool `providerOpenCommitmentCap` on concurrent non-terminal provider obligations per lead provider. Offered Offers reserve that capacity from creation; Requests reserve it at acceptance. The first remains unit-denominated within one exact label/class; the second is count-denominated and never adds unlike units.
- **Valuing**: relative value against a reference asset. MVP records it as a commitment term — `declaredUnitValue` against an exact-label `declaredValueBasis` on the module record (decision 16, amendment 2026-08-01) — with no swaps, no cross-label conversion, and no protocol arithmetic consuming it; units remain per-commitment labels. Relative-pricing *execution* stays reserved for the transferable-voucher layer, which owns separate voucher classes and may reference the exact declared label/basis without collapsing the identities.

The GE pool step sequence (seed round, exchange in/out, redemption, cross exchange) is a
**future-capability reference**, not a list of synonyms for the initial module:

- module-only class registration is **curation and capacity accounting**, not a seed round;
- `counterCommitmentId` plus `acceptExchange` is an atomic bilateral paired start, not pooled
  inventory exchange;
- declared-reward payout is a separate support/settlement rail, not voucher redemption; and
- seed inventory, exchange in/out, redemption, and cross-pool exchange require the separately
  gated voucher/venue layer in `exchange-architecture-brief.md`.

`acceptExchange` changes no registry interface: both Offer classes already became `Committed` at
creation, so the module performs no second registry mutation during paired acceptance.

#### Transferable-voucher attachment path (spec-now, build-later)

- `classId == commitmentId` in the initial deploy. This identity is one immutable promise instance
  and its non-transferable accounting row; it remains stable.
- A non-zero `commitmentSeriesId` is a separate, pool-scoped identity for one Offer used over time.
  It groups ordinary instances but owns no transferable balance.
- A future `voucherClassId` is a third identity owned by a versioned adapter/router. It may
  reference one pool, issuer context, `commitmentSeriesId`, value basis, backing mode, supply cap,
  and redemption terms. It MUST NOT be equated with `commitmentId`, registry `classId`, or
  `commitmentSeriesId`.
- The Pool's reserved `settlementAdapter` remains one address in the initial storage shape. If a
  later scope activates it, that address resolves a versioned adapter/router rather than silently
  naming one forever-fixed token implementation.
- The first eligible backing mode is fulfilled-only: the adapter consumes exact
  `fulfilledOf` facts and prevents the same fulfillment from backing more than the authorized
  amount. `committedOf` remains an eligibility/audit read and cannot mint a voucher.
- Reserved-capacity issuance is a distinct future mode, disabled until its own consent, issuance,
  exposure, default, repair, legal, and audit scope lock. It never transfers the underlying
  promise, confirmer authority, contributor record, recognition, or Story.
- These compatibility rules require **no new initial ABI member, event, storage slot, or registry
  transfer surface**. The full design-only class, backing, issuance, seed, exchange, redemption,
  and federation architecture is canonical at `exchange-architecture-brief.md` (PRD-651). It
  authorizes no implementation or `settlementAdapter` activation.

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

Ownership note: the decision language "owned by the module" is implemented as an `onlyModule` mutation gate (same shape as `onlyGardenToken`, `packages/contracts/src/modules/CookieJar.sol:65-68`). The `OwnableUpgradeable` owner stays the protocol upgrade owner, like every other upgradeable contract in the repo (`_authorizeUpgrade onlyOwner`, `packages/contracts/src/modules/CookieJar.sol:302-304`) — the protocol 3-of-5 Safe required by §6.1 before this lane's mainnet activation. If the owner were the module, nobody could upgrade the register.

#### Interface (canonical)

```solidity
// NET-NEW: packages/contracts/src/interfaces/ICommitmentRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICommitmentRegistry
/// @notice Non-transferable ERC-1155-style unit accounting for commitment
///         pooling. No transfer, no approval, no custody: balances move only
///         through the CommitmentPoolingModule. Grounded in the Grassroots
///         Economics register grammar (curation, limiting, valuing); valuing
///         is reserved for the transferable-voucher settlement layer.
interface ICommitmentRegistry {
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

    /// @notice Provider-capacity reservation: from Registered only, records
    ///         the full non-zero class quota and consumes one provider
    ///         open-commitment slot. The module calls at Offer creation or
    ///         Request acceptance; this function does not imply claim state.
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
- `commitUnits` accepts only `Registered -> Committed` with `units == quota > 0`; the module calls
  it at Offer creation or Request acceptance. An Offered Offer is therefore already Committed,
  while an unaccepted Request remains Registered.
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
  pool/provider. Offer creation or Request acceptance consumes one slot; fulfillment,
  cancellation, and expiry release it exactly once when the class is Committed. An unaccepted
  Request cancellation or expiry has no registry effect. `Accepted`/`ReadyForConfirmation`
  disputes preserve the slot, while a dispute raised from already-released `Expired` does not
  recreate one. RestorePrevious changes no count.
- Register mutations revert `NotModule` for every caller except the wired module.
- Register-module recovery is auditable and pause-bounded: zero replacement rejects, initial
  wiring succeeds once, an unpaused replacement rejects, and a paused replacement emits the exact
  old/new module addresses without mutating any class, balance, or provider count.
- The compiler-generated layout baseline and concrete slot/offset assertions prove the planned
  six-feature-slot layout and reserved gap; `AccountingState` lives inside the mapped
  `CommitmentClass` value and adds no top-level storage slot. A `named + gap == 50` arithmetic
  assertion is not
  accepted as storage proof. Add the feature entry through the Bun-wrapped storage-layout gate.
- Exchange ladder and transferable-voucher attachment documented: a reviewer can point at the one-way reference, approved August `acceptExchange` bilateral rung, classId, reserved `settlementAdapter`, fulfilled balances, and `exchange-architecture-brief.md` and see the later 1:1 wrap path without registry changes. The bilateral rung remains specification scope until its contract lane lands; multilateral and transferable exchange remain gated.

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
root garden, enumerate the 13 live GardenToken gardens, skip the normalized root GardenAccount
because it already owns the Protocol pool, submit `registerPool(garden, Garden)` for the remaining
12 non-root gardens, and run the operational smoke. The backfill records the root as
`SKIPPED_PROTOCOL_ROOT`; it never attempts a second pool registration for that garden.

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
one `assessmentV3SchemaUID` storage field. `TestimonyResolver` is NET-NEW.

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

interface ITestimonyResolverConfig {
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

For `TestimonyResolver`, the constructor calls `_disableInitializers`; `initialize`
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

**`TestimonyResolver`** (NET-NEW `packages/contracts/src/resolvers/Testimony.sol`), validation order:

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
  post-upgrade evidence. It deploys/reconciles only the NET-NEW `TestimonyResolver`
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
  `TestimonyResolver.setCommitmentModule(nonZeroModule)` as the final activation action.
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
  `communityTestimonyDescription`, plus top-level `testimonyResolver`. There is no
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
- `bun run --filter @green-goods/contracts test:match -- test/unit/TestimonyResolver.t.sol`
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

1. New storage: `ICommitmentPoolingModule public commitmentModule;`,
   `mapping(bytes32 workUID => uint64) public latestDecisionSequence`, and
   `mapping(bytes32 decisionUID => uint64) public decisionSequenceByUID`.
   `setCommitmentModule(address)` remains owner-only with `CommitmentModuleUpdated`.
   Existing slots 1–2 remain `karmaGAPModule` and `schemaUID`; the append uses slots 3–5 and
   reduces the gap from 48 to 45 (`WorkApproval.sol:47-53`). Sequence 0 is reserved for
   pre-upgrade/unsequenced decisions.
2. In `onAttest`, after ALL existing validation passes and alongside the GAP block (`WorkApproval.sol:179-183`):

```solidity
// COMMITMENT BRIDGE: reconcile the effective decision for pre-linked Work.
// Non-blocking: the decision attestation must succeed even if the module call fails.
if (address(commitmentModule) != address(0)) {
    uint64 decisionSequence = ++latestDecisionSequence[schema.workUID];
    decisionSequenceByUID[attestation.uid] = decisionSequence;
    // solhint-disable-next-line no-empty-blocks
    try commitmentModule.onWorkDecision(
        schema.workUID,
        attestation.uid,
        decisionSequence,
        attestation.recipient,
        schema.approved
    ) {
        // Success: module reconciled the effective decision (or safely no-op'd)
    } catch {
        // Intentionally ignored; syncWorkDecisions is the recovery path
    }
}
```

Linkage mechanism, stated plainly (register #5): Work attestations carry no commitment reference and never will (the Work schema is immutable, `reports/corrections-log.md` H2). The mapping lives on the module: an active contributor, the accountable lead, or the resolved pool steward calls `linkWork(commitmentId, workUID, requirementIndex, operationKey)` before or after a decision while the commitment is Accepted and unfrozen. The non-zero caller-scoped operation key is persisted before first send; first use stores the hash of the exact commitment/work/requirement payload, exact replay is a no-op even if the Work was later unlinked, and conflicting reuse reverts. For DomainImpact the module verifies the decoded action against that exact requirement row and stores `requirementIndex + 1` beside `workCommitment`; this makes repeated action UIDs unambiguous. Every active link is also appended to the commitment's bounded enumerable Work array, and unlink removes it, so readiness never relies on a caller-declared subset. The resolver hook matches by workUID and forwards both approvals and rejections with a resolver-assigned monotonic sequence. Missed hooks or sequenced decisions that predate linkage are recovered by steward-called `syncWorkDecisions(commitmentId, decisionUIDs)`, which verifies each decision on EAS, reads its non-zero `decisionSequenceByUID`, and preflights the greatest supplied sequence per Work against the resolver's public `latestDecisionSequence(workUID)` getter before any mutation. Only current supplied decisions are applied; before Ready, the module additionally enumerates every active linked Work and proves its stored sequence equals the resolver maximum. `approvalCounted` de-duplicates one decision attestation; `latestWorkDecisionUID` preserves audit identity only, and `workCreditActive` records whether that effective decision currently contributes before the ledger freezes. A later effective rejection reverses a prior approval rather than leaving rejected Work in readiness, recognition, certificate, or payout totals, and the now-inactive Work may be unlinked even though its old approval UID remains counted for delivery idempotency. A pre-upgrade decision with no sequence fails catch-up explicitly and must be re-attested.

Trust model: linkage is roster-aware: the active Work attester may link their Work, while the accountable lead or resolved pool steward may curate links for the team. Every path verifies the Work attester is active, the provider-garden scope matches, and the commitment remains Accepted and unfrozen. The resolver hook only counts approvals for pre-linked workUIDs, the module re-verifies garden and schema on every sync, and dedupe makes double-count impossible. The bridge couples resolver to module exactly as loosely as the existing KarmaGAP coupling: optional address, try/catch, disable by setting zero (`WorkApproval.sol:69-78`).

Upgrade mechanics: WorkApprovalResolver is a live UUPS proxy at `0x166732eD81Ab200A099215cF33F6A712309B69F7` (`packages/contracts/deployments/42161-latest.json:59`); baseline entry already exists (`packages/contracts/script/check-storage-layout.sh:30`); regenerate baseline in the same PR; broadcast via `contracts:*` scripts.

Acceptance criteria: a decision with module unset behaves byte-identically to today; when the
module is configured, every fully validated decision receives one stored per-Work sequence even
if the module hook later reverts; a linked approval activates credit; a newer linked rejection
reverses it before freeze; a still-newer approval restores it once; two decisions in separate
transactions in the same block retain execution order; catch-up rejects an omitted current
resolver decision for any active linked Work, including a stale Work omitted while another Work
is supplied, and no automatic/explicit/override/dispute path freezes until the complete
enumerable set is current; sequence zero rejects with the re-attestation recovery; post-freeze
decisions cannot mutate credit; and a reverting module never blocks either decision. Exact proof:
`bun run --filter @green-goods/contracts test:match -- test/unit/WorkApprovalResolver.t.sol`,
extended with unset/unlinked/approval/rejection/re-approval/same-block/out-of-order/unsequenced/
frozen/reverting-module cases, plus
`bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol` for the
48-to-45 gap change.

## 7. Deployment

### 7.1 Deploy helpers

- NET-NEW `_deployCommitmentRegistry(...)` and `_deployCommitmentPoolingModule(...)` in `packages/contracts/test/helpers/DeploymentBase.sol`, copying `_deployCookieJarModule` byte-for-byte in shape (implementation `new`, ERC1967Proxy init bytecode, salted CREATE2 predict + deploy-if-absent + mismatch revert; `packages/contracts/test/helpers/DeploymentBase.sol:718-759`). Registry deploys first (module address zero in init), module second, wiring closes the loop.
- Call sites appended to `_deployCorePart2` after HypercertsModule (`DeploymentBase.sol:257-338` numbering continues at step 15c).
- `_wireModules` additions (`DeploymentBase.sol:341-385`):
  `commitmentRegistry.setModule(module)`; `module.setGardenToken(gardenToken)`; `module.setHatsModule(hatsModule)`; `module.setActionRegistry(actionRegistry)`; `module.setCommitmentRegistry(registry)`; `module.setWorkApprovalResolver(workApprovalResolver)`; `module.setEAS(eas)`; `module.setSchemaUIDs(work, workApproval, legacyAssessment, assessmentV3)`; `gardenToken.setCommitmentPoolingModule(module)`; `workApprovalResolver.setCommitmentModule(module)`.
  The module is initialized paused; wiring verifies every emitted old/new configuration fact and
  calls `module.setPaused(false)` only after all dependency addresses, all four non-zero/distinct
  UIDs, reverse links, register module, and deployed bytecode match the transaction plan.

### 7.2 Artifacts

- `DeploymentResult` gains `address commitmentPoolingModule;` and `address commitmentRegistry;` (`packages/contracts/script/DeployHelper.sol:42-72`) plus two `vm.serializeAddress` lines in `_saveDeployment` (`DeployHelper.sol:293-316`). Artifact keys: `commitmentPoolingModule`, `commitmentRegistry` in `deployments/{chainId}-latest.json`.
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

Every `--network arbitrum-sepolia` invocation below is currently unrunnable, and closing that is
this lane's work, not an assumption. Four concrete gaps, each verified against the tree: no
`arbitrum-sepolia` / `421614` record exists in `packages/contracts/deployments/networks.json`
(only `mainnet`, `sepolia`, `localhost`, `arbitrum`, `celo`); no
`packages/contracts/deployments/421614-latest.json` artifact exists;
`script/DeployBadgeSchema.s.sol:65-76` hard-codes a chain-id → name map that reverts
`UnsupportedChain(421614)`; and `script/utils/release-gate.ts` pins `SEPOLIA_CHAIN_ID =
"11155111"`, so `assertSepoliaGate` has no `421614` posture at all. §10 PR chain 1 carries these
as named deliverables.

1. PR chain 1 (resolver/schema preparation): first commit pre-change generated baselines for
   AssessmentResolver, WorkApprovalResolver, and GardenToken. On Arbitrum Sepolia (`421614`),
   where no canonical Green Goods Assessment proxy is currently recorded, deterministically
   deploy the current v2 resolver/proxy, register and pin its non-zero v2 UID, record the
   pre-upgrade state, then rehearse the in-place upgrade. On Arbitrum One, read the live
   `schemaUID()` first; the verified 2026-07-24 value is zero, so the owner must set the existing
   v2 artifact UID before `setAssessmentV3SchemaUID`. Then deploy only
   TestimonyResolver, register AssessmentV3 against the same Assessment proxy, set its
   v3 UID, derive and one-way pin the Community Testimony UID while its module is zero, and verify
   v2/v3 parity. Community Testimony remains inactive at this step; its deterministic registry
   record is either absent or already exact because permissionless pre-registration is accepted
   only under exact reconciliation.
2. PR chain 2 (module + register + schema finalization): deploy `CommitmentRegistry` +
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
   (`deployments/42161-latest.json:40-43`), enumerate all 13 live gardens, skip that normalized
   root address, and backfill `registerPool(garden, Garden)` for the 12 non-root gardens.
4. Update `packages/indexer/config.yaml` addresses from zero-address placeholders and bump
   `start_block` (8.1).

### 7.4 Storage-layout and UUPS proof gate

The storage gate covers every contract introduced or upgraded by Commitment Pooling:
`CommitmentPoolingModule`, `CommitmentRegistry`, `SettlementModule`,
`CeloSettlementExecutor`, `TestimonyResolver`, `AssessmentResolver`, `GardenToken`,
and `WorkApprovalResolver`.

- The gate this lane relies on already behaves correctly, and that behavior is a precondition
  rather than work: `script/check-storage-layout.sh` check mode already exits non-zero on an
  absent or differing baseline and never writes (`script/check-storage-layout.sh:222-236`),
  baseline regeneration is already available only through the explicit `--update` action, and the
  contract list already carries the correct `Deployment:src/registries/Deployment.sol` entry
  rather than a stale `DeploymentRegistry:src/DeploymentRegistry.sol` one
  (`script/check-storage-layout.sh:24-33`). This lane appends its own entries to that list and
  must not weaken any of it.
- `packages/contracts/package.json` already exposes
  `bun run --filter @green-goods/contracts check:storage-layout` (`package.json:25`); that Bun
  target is the only supported entry point and encapsulates every Forge inspection. Raw `forge`
  remains forbidden.
- Generated compiler layout is compared by fully qualified contract name, slot, offset, type,
  and label. `StorageLayout.t.sol` adds concrete `vm.load`/getter upgrade-preservation
  assertions for every appended field; arithmetic such as “named + gap == 50” is not accepted
  as slot proof.
- Each live UUPS upgrade test initializes representative pre-upgrade state, upgrades through
  the real proxy authorization path, asserts all old fields/owner/immutable dependencies are
  unchanged, and exercises rollback to the prior implementation in simulation.
- Assessment is specifically 2+48 → 3+47; GardenToken appends at slot 213 offset 2 and retains
  its 37-slot gap; WorkApprovalResolver is 2+48 → 5+45 because §6.5 appends exactly three
  entries — `commitmentModule`, `latestDecisionSequence`, and `decisionSequenceByUID` — at slots
  3–5, leaving 5 named plus `__gap[45]`. New contracts commit their
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
# artifact, prints one Protocol call for the root plus 12 Garden calls for the non-root
# members of the verified 13-garden set, records the root as SKIPPED_PROTOCOL_ROOT, and
# writes no chain state in dry-run mode.
bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

# Post-broadcast targets below are also created by this lane. They run only after separately
# authorized broadcasts and config address replacement.
bun run verify:post-deploy:arbitrum-sepolia
bun run verify:post-deploy:indexer:arbitrum-sepolia
bun run verify:post-deploy:arbitrum
bun run verify:post-deploy:indexer:arbitrum
```

`upgrade.ts assessment-resolver` is the only Assessment proxy-upgrade path. That target and the
`--dry-run`, `--pure-simulation`, `--tx-plan`, and `--sender` flags already exist
(`packages/contracts/script/upgrade.ts:27,44,80-89,333-341`). The sender contract stated next is
NET-NEW work this lane builds, not current behavior: today `--sender` is optional, silently falls
back to `process.env.SENDER_ADDRESS`, persists `sender: null` when neither is supplied
(`script/upgrade.ts:425`), and never reads the proxy `owner()` anywhere in the script.
This lane makes the `--sender` value mandatory on every transaction plan and validates it against
the live proxy `owner()`; the `421614` value is read from and checked against that chain's v2
bootstrap artifact, while the verified `42161` owner is pinned above. A mismatch or missing sender
must fail before plan persistence rather than defaulting.
Both angle-bracketed `421614` senders are mandatory future artifact inputs, not optional
placeholders or inferred defaults. The grouped `commitment-pooling` upgrade target is likewise
NET-NEW — it is not a current `upgrade.ts` contract name — and ships with its own owner check: it
verifies that GardenToken and WorkApprovalResolver report the same live owner before persisting
one transaction plan; differing owners require separately named targets and plans rather than an
inferred sender.
Each chain-connected command above is illegal until the preceding stage's separately authorized
receipt, post-action verification, and persisted artifact pass. No dry-run relies on state from a
separate pure-simulation process. The complete sequence is rehearsed first on deterministic local
chains and Arbitrum Sepolia. `--finalize-community-testimony` requires the verified
module/register artifact, never accepts an address override, and proves the pinned UID plus exact
registry record before activating the verified module last. `upgrade.ts commitment-pooling`
upgrades exactly GardenToken and
WorkApprovalResolver, verifies implementation slots and storage baselines, wires both module
setters, and merges no schema keys. `backfill-pools.ts` persists a resumable result artifact at
`.plans/active/commitment-pooling/artifacts/{chainId}-pool-backfill.json` keyed by garden. It
normalizes every enumerated address, records the exact root as `SKIPPED_PROTOCOL_ROOT`, and emits
no Garden-type call for it; the remaining 12 entries record their Garden registration plan or
receipt. Dry-run produces a simulation artifact under `.generated/runtime` only, while an
explicitly authorized broadcast records tx hash, receipt block, and resulting poolId per submitted
garden. Deploy dry-runs write simulation output only; broadcasts merge only the named append-only
keys. All invocations use bun wrappers; never raw forge (`.claude/rules/contracts.md`).

## 8. Indexer plan

Boundary restated: Envio indexes Green Goods core state only; EAS attestations are read from easscan (`packages/indexer/schema.graphql:282-288`). Every entity and stat below derives exclusively from `CommitmentPoolingModule` and `CommitmentRegistry` events. This initial schema indexes exactly one canonical UUPS Commitment Pooling proxy pair per chain, so proxy identity is stable while implementations upgrade in place. A second `CommitmentPoolingModule`/`CommitmentRegistry` block on the same chain, or replacement of either proxy address, fails the indexing-boundary check unless a separately approved migration first defines a new entity namespace and full-replay plan. The saved-Offer `moduleAddress` is a client-side fail-closed link key, not authorization for concurrent multi-module indexing. Under that explicit boundary, rules that bind every net-new entity here are: `chainId: Int!`, composite IDs `${chainId}-${identifier}`, create-if-not-exists in update handlers, and `bun codegen` after any `schema.graphql`/`config.yaml` change (`.claude/rules/indexer.md`). The one documented package exception remains the existing `Garden.id` bare-address primary key; Garden rows still carry `chainId`, and relationship helpers point to that unchanged ID.

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
      - event: CommitmentSeriesCreated(uint256 indexed seriesId, uint256 indexed poolId, address indexed holder, string metadataCID)
      - event: CommitmentSeriesMetadataUpdated(uint256 indexed seriesId, string metadataCID)
      - event: CommitmentSeriesRested(uint256 indexed seriesId)
      - event: CommitmentSeriesResumed(uint256 indexed seriesId)
      - event: CommitmentSeriesRetired(uint256 indexed seriesId)
      - event: CommitmentCreated(uint256 indexed commitmentId, uint256 indexed poolId, uint256 indexed cycleId, uint256 commitmentSeriesId, bytes32 creationRequestKey, address creator, address recordedBy, uint8 direction, uint8 commitmentType, uint8 claimType, uint8 claimMode, uint8 contributorPolicy, uint8[] domains, uint256[] requirementActionUIDs, uint8[] requirementDomains, uint32[] requirementRequiredCounts, string unitLabel, uint256 targetUnits, bool requiresAssessment, uint64 dueDate, string metadataCID, bytes32 needUID, uint256 counterCommitmentId, uint256 declaredUnitValue, string declaredValueBasis)
      - event: RewardDeclared(uint256 indexed commitmentId, uint8 rail, address source, address token, uint256 amount)
      - event: ValueDeclared(uint256 indexed commitmentId, uint256 declaredUnitValue, string declaredValueBasis)
      - event: ConfirmerRuleSet(uint256 indexed commitmentId, address[] confirmers, uint32 threshold, bool protocolFallbackEnabled)
      - event: ClaimRequested(uint256 indexed commitmentId, address indexed claimant, address indexed requestedBy, uint8 kind, address gardenContext, uint64 requestedAt)
      - event: ClaimDeclined(uint256 indexed commitmentId, address indexed claimant, string reasonCID)
      - event: CommitmentAccepted(uint256 indexed commitmentId, address indexed claimant, address indexed counterparty, uint8 kind, address gardenContext, address leadProvider, address providerGarden)
      - event: ExchangeAccepted(uint256 indexed commitmentIdA, uint256 indexed commitmentIdB, uint256 poolId, address indexed acceptorA, address acceptorB)
      - event: ContributorAdded(uint256 indexed commitmentId, address indexed contributor, address indexed addedBy)
      - event: ContributorRemoved(uint256 indexed commitmentId, address indexed contributor, address indexed removedBy)
      - event: ContributorRequirementAssigned(uint256 indexed commitmentId, address indexed contributor, uint16 indexed requirementIndex, bool assigned)
      - event: ContributorRosterFrozen(uint256 indexed commitmentId, uint32 contributorCount)
      - event: WorkLinked(uint256 indexed commitmentId, bytes32 indexed workUID, address indexed contributor, uint16 requirementIndex, address linker, bytes32 operationKey)
      - event: WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker)
      - event: ApprovedWorkCounted(uint256 indexed commitmentId, bytes32 indexed workUID, address indexed contributor, bytes32 approvalUID, uint64 decisionSequence, uint16 requirementIndex, uint32 approvedWorkCount, uint256 approvedUnits, uint256 newlyApprovedUnits)
      - event: ApprovedWorkReversed(uint256 indexed commitmentId, bytes32 indexed workUID, address indexed contributor, bytes32 decisionUID, uint64 decisionSequence, uint16 requirementIndex, uint32 approvedWorkCount, uint256 approvedUnits, uint256 removedApprovedUnits)
      - event: EvidenceAttached(uint256 indexed commitmentId, string cid, address indexed attacher, address[] creditedContributors)
      - event: AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher)
      - event: CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason)
      - event: ConfirmationRecorded(uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold)
      - event: CommitmentFulfilled(uint256 indexed commitmentId, address indexed confirmer, uint8 confirmationPath, string reason)
      - event: CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID)
      - event: CommitmentExpired(uint256 indexed commitmentId, address indexed caller)
      - event: CommitmentDisputed(uint256 indexed commitmentId, address indexed raiser, uint8 previousState, string reasonCID)
      - event: DisputeResolved(uint256 indexed commitmentId, uint8 resolution, uint8 finalState, string reasonCID)
      - event: RewardPaid(uint256 indexed commitmentId, address indexed source, address indexed recipient, address token, uint256 amount, bytes32 payoutRef, address recordedBy)
      - event: ModuleDependencyUpdated(uint8 indexed dependency, address indexed previousAddress, address indexed newAddress)
      - event: ModuleSchemaUIDUpdated(uint8 indexed schemaKind, bytes32 previousUID, bytes32 newUID)
      - event: ModulePauseStatusChanged(bool previousPaused, bool paused)
  - name: CommitmentRegistry
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
enum CommitmentKind { UNKNOWN DOMAIN_IMPACT SUPPORT_SERVICE SEASON_CAMPAIGN STEWARD_CAPTURED }
# On-chain vocabulary only. DRAFT / ACTIVE / EVIDENCE_SUBMITTED /
# PARTIALLY_APPROVED / RECONCILED are derived in shared selectors.
enum CommitmentOnchainState { UNKNOWN OFFERED REQUESTED ACCEPTED READY_FOR_CONFIRMATION FULFILLED CANCELLED EXPIRED DISPUTED }
enum CommitmentClaimType { UNKNOWN GARDEN INDIVIDUAL }
enum CommitmentClaimMode { UNKNOWN OPEN APPROVAL_GATED }
enum CommitmentContributorPolicy { UNKNOWN OPEN LEAD_MANAGED }
enum CommitmentSeriesState { UNKNOWN ACTIVE RESTING RETIRED }
enum CommitmentRewardRail { UNKNOWN NONE ARBITRUM_EXTERNAL CELO_SETTLEMENT }
enum CommitmentConfirmationPath { UNKNOWN ORDINARY POOL_FALLBACK PROTOCOL_FALLBACK }
enum CommitmentClaimRequestState { PENDING ACCEPTED DECLINED SUPERSEDED }
enum CommitmentUnitScope { POOL CYCLE }
  enum CommitmentEventType {
    MODULE_UPDATED
    MODULE_DEPENDENCY_UPDATED MODULE_SCHEMA_UID_UPDATED MODULE_PAUSE_STATUS_CHANGED
  POOL_REGISTERED POOL_CHARTER_UPDATED POOL_READY POOL_OPENED POOL_PAUSED
  POOL_RESUMED POOL_CLOSED POOL_COMPOSTED POOL_REOPENED
  CLASS_REGISTERED PROVIDER_OPEN_COMMITMENT_CAP_UPDATED
  CYCLE_SEEDED CYCLE_OPENED CYCLE_CLOSED CYCLE_COMPOSTED CYCLE_CANCELLED
  COMMITMENT_SERIES_CREATED COMMITMENT_SERIES_METADATA_UPDATED
  COMMITMENT_SERIES_RESTED COMMITMENT_SERIES_RESUMED COMMITMENT_SERIES_RETIRED
  CREATED REWARD_DECLARED VALUE_DECLARED CONFIRMER_RULE_SET CLAIM_REQUESTED CLAIM_DECLINED ACCEPTED
  EXCHANGE_ACCEPTED
  CONTRIBUTOR_ADDED CONTRIBUTOR_REMOVED CONTRIBUTOR_REQUIREMENT_ASSIGNED CONTRIBUTOR_ROSTER_FROZEN
  WORK_LINKED WORK_UNLINKED APPROVED_WORK_COUNTED APPROVED_WORK_REVERSED EVIDENCE_ATTACHED
  ASSESSMENT_ATTACHED READY_FOR_CONFIRMATION CONFIRMATION_RECORDED FULFILLED
  CANCELLED EXPIRED DISPUTED DISPUTE_RESOLVED REWARD_PAID
  UNITS_COMMITTED UNITS_RELEASED UNITS_FULFILLED
}

type CommitmentPool {
  id: ID! # chainId-poolId
  chainId: Int!
  poolId: BigInt!
  registrationSeen: Boolean! # false only for an update-before-PoolRegistered placeholder
  garden: String # garden account address, lowercase; null until registrationSeen
  gardenId: String # relationship to documented bare-address Garden.id
  poolType: CommitmentPoolType
  state: CommitmentPoolState # null only when a charter/cap update created the placeholder first
  charterCID: String
  pauseReasonCID: String # set by PoolPaused; cleared by PoolResumed
  openSeasonCycleId: BigInt # null when no Season is open; Campaigns may overlap
  openSeasonCycleEntityId: String # relationship: chainId-cycleId
  openCampaignIds: [BigInt!]! # event-derived raw identifiers; never enumerated on-chain
  openCampaignEntityIds: [String!]! # relationship IDs in matching order
  providerOpenCommitmentCap: BigInt!
  liveCommitmentCount: BigInt! # every non-terminal pool commitment, including cycle-less
  nonTerminalCycleCount: BigInt! # Seeded/Open/Reconciled cycles; zero before pool close
  lifecycleBlockNumber: BigInt # nullable latest PoolReady/Open/Pause/Resume/Close/Compost/Reopen cursor
  lifecycleLogIndex: Int # nullable cursor partner; older pool state events never regress state/reason
  charterUpdateBlockNumber: BigInt # nullable latest PoolCharterUpdated cursor
  charterUpdateLogIndex: Int
  providerCapUpdateBlockNumber: BigInt # nullable latest ProviderOpenCommitmentCapUpdated cursor
  providerCapUpdateLogIndex: Int
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
  openCommitmentCount: BigInt! # committed Offers plus accepted Requests not released or fulfilled
  commitmentsDue: BigInt!     # accepted minus cancelled (mutually released promises are not broken promises)
  createdAt: Int # PoolRegistered timestamp; null until registrationSeen
  updatedAt: Int!
}

type CommitmentCycle {
  id: ID! # chainId-cycleId
  chainId: Int!
  cycleId: BigInt!
  seedSeen: Boolean! # false only for a lifecycle-before-CycleSeeded placeholder
  poolId: BigInt!
  poolEntityId: String! # relationship: chainId-poolId
  garden: String # copied only from a registrationSeen pool
  gardenId: String # relationship to documented bare-address Garden.id
  cycleType: CommitmentCycleType # null until seedSeen
  state: CommitmentCycleState # null only when no seed/lifecycle event has supplied it
  startTime: BigInt # null until seedSeen
  endTime: BigInt # null until seedSeen
  metadataCID: String # null until seedSeen
  # Allocation-class snapshot from CycleOpened (Hypercert cut-over input)
  gardenersBps: Int!
  treasuryBps: Int!
  operatorBps: Int!
  evaluatorBps: Int!
  communityBps: Int!
  funderBps: Int!
  equalParticipationBps: Int!
  verifiedContributionBps: Int!
  liveCommitmentCount: BigInt! # every non-terminal cycle commitment, including Offered/Requested
  lifecycleBlockNumber: BigInt # nullable latest CycleOpened/Closed/Composted/Cancelled cursor
  lifecycleLogIndex: Int # nullable cursor partner; older cycle events never regress state/relations
  # Per-cycle count stats. Unit totals live in exact-label summary rows.
  commitmentsAccepted: BigInt!
  commitmentsReadyForConfirmation: BigInt!
  commitmentsFulfilled: BigInt!
  commitmentsCancelled: BigInt!
  commitmentsExpired: BigInt!
  commitmentsDisputed: BigInt!
  commitmentsDue: BigInt!
  openCommitmentCount: BigInt!
  createdAt: Int # CycleSeeded timestamp; null until seedSeen
  updatedAt: Int!
}

# Immutable class declaration emitted before provider identity is known.
type CommitmentClass {
  id: ID! # chainId-classId
  chainId: Int!
  classId: BigInt!
  poolId: BigInt!
  poolEntityId: String!
  cycleId: BigInt
  cycleEntityId: String
  unitLabel: String!
  unitLabelHash: String!
  quota: BigInt!
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

type CommitmentSeries {
  id: ID! # chainId-seriesId
  chainId: Int!
  seriesId: BigInt!
  creationSeen: Boolean! # false only for an event-before-CommitmentSeriesCreated placeholder
  poolId: BigInt # null until creationSeen
  poolEntityId: String # null until creationSeen
  createdBy: String # null until creationSeen
  currentHolder: String # null until creationSeen
  state: CommitmentSeriesState # null only when no creation/lifecycle event has supplied it
  metadataCID: String # null only when no creation/metadata event has supplied it
  instanceCount: BigInt!
  offeredCount: BigInt!
  acceptedCount: BigInt!
  readyCount: BigInt!
  fulfilledCount: BigInt!
  cancelledCount: BigInt!
  expiredCount: BigInt!
  disputedCount: BigInt!
  fulfilledCycleIds: [String!]!
  latestLifecycleBlock: BigInt # independent nullable lifecycle cursor
  latestLifecycleLogIndex: Int
  latestMetadataBlock: BigInt # independent nullable metadata cursor
  latestMetadataLogIndex: Int
  createdAt: Int # CommitmentSeriesCreated timestamp; null until creationSeen
  updatedAt: Int!
}

type CommitmentSeriesCycleSummary {
  id: ID! # chainId-seriesId-cycleId
  chainId: Int!
  seriesId: BigInt!
  seriesEntityId: String!
  cycleId: BigInt!
  cycleEntityId: String!
  poolId: BigInt!
  poolEntityId: String!
  instanceCount: BigInt!
  offeredCount: BigInt!
  acceptedCount: BigInt!
  readyCount: BigInt!
  fulfilledCount: BigInt!
  cancelledCount: BigInt!
  expiredCount: BigInt!
  disputedCount: BigInt!
  updatedAt: Int!
}

type Commitment {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  creationSeen: Boolean! # false only for an update-before-create placeholder
  acceptanceSeen: Boolean! # true once the unique CommitmentAccepted payload is stored, even if its lifecycle cursor is older
  creationRequestKey: String # creator-scoped sender-safe key emitted by CommitmentCreated
  creationPayloadHash: String # full normalized immutable creation payload
  poolId: BigInt # null until creationSeen
  poolEntityId: String # relationship: chainId-poolId; null until creationSeen
  cycleId: BigInt # null when not cycle-scoped
  cycleEntityId: String # relationship: chainId-cycleId
  commitmentSeriesId: BigInt # null when one-shot
  commitmentSeriesEntityId: String # relationship: chainId-seriesId
  garden: String # null until creationSeen and the registered pool relation exists
  gardenId: String # relationship to documented bare-address Garden.id
  creator: String # null until creationSeen
  recordedBy: String # null until creationSeen
  counterparty: String # null until accepted
  leadProvider: String # Offer creator; Individual Request counterparty; Garden Request authenticated requester (Open caller or stored ApprovalGated requestedBy)
  providerGarden: String # EAS recipient/provider role scope after acceptance
  providerGardenId: String # relationship to documented bare-address Garden.id
  counterpartyKind: CommitmentClaimType
  direction: CommitmentDirection # null until creationSeen
  commitmentType: CommitmentKind # null until creationSeen
  state: CommitmentOnchainState # null only when a non-lifecycle update created the placeholder first
  claimType: CommitmentClaimType # null until creationSeen
  claimMode: CommitmentClaimMode # null until creationSeen
  contributorPolicy: CommitmentContributorPolicy # null until creationSeen
  domains: [Int!]! # unique derived tags; not positional and not a cardinality bound
  requirementCount: Int!
  contributorCount: Int!
  contributorsFrozen: Boolean!
  frozenContributorCount: Int # exact ContributorRosterFrozen count; null until that event arrives
  memberHistoryOutcome: CommitmentOnchainState # nullable lead terminal bucket currently applied
  fulfilledParticipantHistoryApplied: Boolean! # contributorFulfilled + receivedFulfilled idempotency guard
  contributorEntityIds: [String!]!
  unitLabel: String # null until creationSeen
  targetUnits: BigInt # null until creationSeen
  approvedUnits: BigInt!
  confirmationThreshold: Int!
  confirmationCount: Int!
  confirmers: [String!]!
  protocolFallbackEnabled: Boolean!
  confirmerRuleUpdateBlockNumber: BigInt # nullable replay cursor; non-null means at least one ConfirmerRuleSet update was observed
  confirmerRuleUpdateLogIndex: Int # nullable partner to confirmerRuleUpdateBlockNumber; compare the pair lexicographically
  requiresAssessment: Boolean # null until creationSeen
  assessmentUID: String
  needUID: String # community Need this commitment addresses; null/zero when none (amendment 2026-07-04)
  counterCommitmentId: BigInt # same-pool exchange reference; null/zero when none (amendment 2026-08-01)
  counterCommitmentEntityId: String # relationship: chainId-counterCommitmentId; null when none
  declaredUnitValue: BigInt # 0/null = undeclared (amendment 2026-08-01)
  declaredValueBasis: String # exact-label basis; null when undeclared; value aggregation only per exact basis, read-model informational sums only
  declaredValueUpdateBlockNumber: BigInt # nullable replay cursor; non-null means at least one ValueDeclared update was observed
  declaredValueUpdateLogIndex: Int # nullable partner to declaredValueUpdateBlockNumber; compare the pair lexicographically
  metadataCID: String # null until creationSeen
  workUIDs: [String!]!
  evidenceCIDs: [String!]!
  evidenceCount: Int!
  dueDate: BigInt # null until creationSeen
  rewardRail: CommitmentRewardRail # null until creation or RewardDeclared supplies it
  rewardSource: String
  rewardRecipient: String # ArbitrumExternal RewardPaid recipient only; Celo beneficiary is on Disbursement
  rewardToken: String
  rewardAmount: BigInt
  rewardPaid: Boolean!
  rewardPayoutRef: String
  rewardRecordedBy: String
  rewardUpdateBlockNumber: BigInt # nullable latest DeclaredRewardUpdated/RewardPaid cursor
  rewardUpdateLogIndex: Int
  readyOverridden: Boolean!
  fulfilledBy: String # explicit CommitmentFulfilled.confirmer; null for non-confirmation terminal resolution
  confirmationPath: CommitmentConfirmationPath # null until confirmed or when fulfillment came from dispute resolution
  fallbackReason: String # non-empty only for POOL_FALLBACK / PROTOCOL_FALLBACK
  fulfilledByFallback: Boolean! # convenience derivation: confirmationPath is a fallback value
  preDisputeState: CommitmentOnchainState
  acceptanceBlockNumber: BigInt # immutable CommitmentAccepted event position
  acceptanceLogIndex: Int
  lifecycleBlockNumber: BigInt # latest state-derived projection cursor
  lifecycleLogIndex: Int # nullable partner; compare the pair lexicographically
  disputeReasonCID: String
  cancelReasonCID: String
  createdAt: Int # CommitmentCreated timestamp; null until creationSeen
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
  additionSeen: Boolean! # false only for remove/decision-before-ContributorAdded
  active: Boolean!
  isLead: Boolean!
  approvedWorkCredits: Int!
  evidenceCredits: Int!
  uncountedLinkedWorkCount: Int!
  requirementIndexes: [Int!]!
  recognitionWeightBps: Int
  membershipBlockNumber: BigInt # nullable latest ContributorAdded/ContributorRemoved cursor
  membershipLogIndex: Int
  addedBy: String # null until additionSeen
  addedAt: Int # null until additionSeen
  removedBy: String
  removedAt: Int
  updatedAt: Int!
}

type CommitmentContributorRequirementAssignment {
  id: ID! # chainId-commitmentId-lowercaseContributor-requirementIndex
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributor: String!
  contributorEntityId: String!
  requirementIndex: Int!
  assigned: Boolean!
  lifecycleBlockNumber: BigInt!
  lifecycleLogIndex: Int!
  updatedAt: Int!
}

type HypercertCommitmentContributorAllocation {
  id: ID! # chainId-hypercertId-commitmentId-lowercaseContributor
  chainId: Int!
  hypercertId: BigInt!
  hypercertEntityId: String!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributor: String!
  contributorEntityId: String!
  recognitionWeightBps: Int!
  commitmentGardenersClassUnits: BigInt!
  recognitionUnits: BigInt!
  createdAt: Int!
  updatedAt: Int!
}

type CommitmentWorkAttribution {
  id: ID! # chainId-lowercaseWorkUID
  chainId: Int!
  workUID: String!
  commitmentId: BigInt!
  commitmentEntityId: String!
  linkSeen: Boolean! # false only for unlink/decision-before-WorkLinked
  contributor: String # null until linkSeen or a decision event supplies it
  contributorEntityId: String
  requirementIndex: Int
  operationKey: String # null until linkSeen
  linked: Boolean!
  creditActive: Boolean!
  linkLifecycleBlockNumber: BigInt # nullable until a Link/Unlink event is observed
  linkLifecycleLogIndex: Int
  latestDecisionSequence: BigInt
  latestDecisionUID: String
  linkedBy: String # null until linkSeen
  linkedAt: Int # null until linkSeen
  unlinkedBy: String
  unlinkedAt: Int
  updatedAt: Int!
}

type CommitmentContributorIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributorEntityIds: [String!]! # unique IDs sorted by normalized contributor address
  updatedAt: Int!
}

type CommitmentContributorRequirementIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  assignmentEntityIds: [String!]! # unique IDs sorted by contributor then requirement index
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
  requestSeen: Boolean! # false only for ClaimDeclined-before-ClaimRequested
  requestedBy: String # authenticated caller; null until requestSeen
  claimType: CommitmentClaimType # null until requestSeen
  gardenContext: String # null until requestSeen
  gardenContextId: String # relationship to documented bare-address Garden.id
  state: CommitmentClaimRequestState!
  reasonCID: String
  resolutionCode: String # CLAIM_DECLINED / CLAIM_ACCEPTED / COMMITMENT_ACCEPTED / COMMITMENT_CANCELLED / COMMITMENT_EXPIRED
  lifecycleBlockNumber: BigInt # nullable until a request/decline resolution event is observed
  lifecycleLogIndex: Int
  requestedAt: Int # null until requestSeen
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
  requestIds: [String!]! # unique claimant-key IDs sorted lexicographically
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

# Durable replay buffer for commitment events whose state-derived projection requires immutable
# facts from CommitmentCreated. ID is the event audit ID, so duplicate delivery cannot enqueue
# twice. The typed optional fields preserve the exact emitted payload needed by the handler named
# by eventType; no RPC read or transaction.from inference is permitted during the later drain.
type CommitmentPendingLifecycleProjection {
  id: ID! # chainId-txHash-logIndex; same identity as the CommitmentEvent audit row
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  eventType: CommitmentEventType!
  blockNumber: BigInt!
  logIndex: Int!
  nextState: CommitmentOnchainState
  actor: String
  claimType: CommitmentClaimType
  gardenContext: String
  claimant: String
  counterparty: String
  leadProvider: String
  providerGarden: String
  confirmationCount: Int
  confirmationThreshold: Int
  overridden: Boolean
  confirmationPath: CommitmentConfirmationPath
  previousState: CommitmentOnchainState
  disputeResolution: Int
  data: String
  applied: Boolean!
  createdAt: Int!
  updatedAt: Int!
}

# Explicit lookup companion; creation drains these IDs without a database-wide scan.
type CommitmentPendingLifecycleProjectionIndex {
  id: ID! # chainId-commitmentId
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  projectionIds: [String!]! # stable insertion; drained in blockNumber/logIndex order
  updatedAt: Int!
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

# Reverse lookup for the one-way counterCommitmentId reference (amendment
# 2026-08-01): which commitments name this one as their exchange counterpart.
# Same explicit composite-ID discipline as NeedCommitmentIndex because the
# generated getWhere surfaces are empty in this repo.
type CommitmentCounterIndex {
  id: ID! # chainId-counterCommitmentId (the referenced commitment)
  chainId: Int!
  commitmentId: BigInt! # the referenced commitment's raw id
  commitmentEntityId: String! # relationship: chainId-commitmentId
  referencingCommitmentEntityIds: [String!]!
  updatedAt: Int!
}

# One row per successful atomic bilateral acceptance. Pair identity is ordered
# by the event's A/B semantics, not numerically sorted: B is the later
# commitment whose counterCommitmentId names A.
type CommitmentExchange {
  id: ID! # chainId-EXCHANGE-poolId-idA-idB
  chainId: Int!
  poolId: BigInt!
  poolEntityId: String! # relationship: chainId-poolId
  commitmentIdA: BigInt!
  commitmentEntityIdA: String! # relationship: chainId-commitmentIdA
  commitmentIdB: BigInt!
  commitmentEntityIdB: String! # relationship: chainId-commitmentIdB
  acceptorA: String! # B creator, claimant of A; never A's lead/provider
  acceptorB: String! # A creator, claimant of B; never B's lead/provider
  txHash: String!
  acceptedAt: Int!
}

# Per-member relational memory in one pool (amendment 2026-08-01): counts only,
# derived from public events already indexed — no floats, no units (label-exact
# rule), no score, no ranking, and never a public leaderboard. Decision #21 is a
# product-disclosure rule, not a confidentiality claim: raw Envio rows can be
# queried because their inputs are public onchain facts. Shared selectors require
# the viewer account plus current steward capability and return a participant row
# only to that pool's steward or the member themself; client/admin code consumes
# those selectors, and editorial surfaces consume pool-level aggregates only.
# "Received" counts the fulfilled commitments whose delivery this account was
# eligible to confirm (Request creator / Offer counterparty side).
type PoolMemberHistory {
  id: ID! # chainId-poolId-lowercaseAccount
  chainId: Int!
  poolId: BigInt!
  poolEntityId: String! # relationship: chainId-poolId
  account: String!
  leadAccepted: Int!
  leadFulfilled: Int!
  leadCancelled: Int!
  leadExpired: Int!
  contributorFulfilled: Int! # frozen-roster memberships on Fulfilled commitments, excluding lead rows
  receivedFulfilled: Int!
  confirmationsGiven: Int!
  disputesRaised: Int!
  updatedAt: Int!
}
```

### 8.3 Handler plan

NET-NEW `packages/indexer/src/handlers/commitmentPool.ts`, registered as a side-effect import in `packages/indexer/src/EventHandlers.ts:18-25`. Patterns to copy, by name:

- **Dedup counters**: pool/cycle counters increment exactly the way `holderCount`/`grantCount` do in `packages/indexer/src/handlers/greenWill.ts:66-88` (read existing entity, branch on prior existence, never double-count).
- **Idempotency**: same-tx replay and already-exists guards as `packages/indexer/src/handlers/hypercerts.ts:38-42,71-75`.
- **Create-if-not-exists, representable placeholders**: update-before-base handlers materialize
  placeholders instead of throwing (`createDefaultGarden` precedent,
  `packages/indexer/src/handlers/helpers.ts:89-110`; `.claude/rules/indexer.md`). Absence is
  represented only by nullable fields plus an explicit seen flag—never by an invented enum,
  zero address, zero raw identity, or empty-string identity that a reader could mistake for
  emitted data. `CommitmentPool.registrationSeen`, `CommitmentCycle.seedSeen`,
  `CommitmentSeries.creationSeen`, `Commitment.creationSeen`,
  `CommitmentClaimRequest.requestSeen`, `CommitmentContributor.additionSeen`, and
  `CommitmentWorkAttribution.linkSeen` are false until their base event arrives. Only counters,
  booleans, and relationship arrays with an unambiguous empty identity default to zero/false/`[]`;
  missing immutable payload fields and unrelated cursor pairs remain null. App/shared queries
  exclude unseen placeholders from ordinary lists while handlers may load them by ID.
  A later base event fills nullable immutable facts, sets its seen flag, and never resets a
  winning mutable cursor, terminal state, credit, counter, or sorted relationship. State-derived
  commitment events that require creation facts remain in the typed pending-projection index
  rather than consuming a placeholder lifecycle cursor. Tests cover every sparse event named in
  Matrix A3 before and after its base event.
- **ID helpers**: retain `getGardenId(garden)` as normalized bare-address compatibility, and add `getCommitmentPoolId(chainId, poolId)`,
  `getCommitmentCycleId(chainId, cycleId)`, `getCommitmentId(chainId, commitmentId)`,
  `getCommitmentSeriesId(chainId, seriesId)`,
  `getCommitmentSeriesCycleSummaryId(chainId, seriesId, cycleId)`,
  `getCommitmentContributorId(chainId, commitmentId, contributor)`,
  `getCommitmentWorkAttributionId(chainId, workUID)`,
  `getCommitmentEvidenceAttributionId(chainId, commitmentId, cid, contributor)`,
  `getCommitmentEvidenceAttributionIndexId(chainId, commitmentId)`,
  `getCommitmentClaimRequestId(chainId, commitmentId, claimant)`,
  `getCommitmentPendingLifecycleProjectionId(chainId, txHash, logIndex)`,
  `getCommitmentPendingLifecycleProjectionIndexId(chainId, commitmentId)`,
  `getCommitmentUnitSummaryId(chainId, scope, scopeId, unitLabelHash)`,
  `getCommitmentProviderExposureId(chainId, poolId, leadProvider)`,
  `getNeedCommitmentIndexId(chainId, needUID)`,
  `getCommitmentCounterIndexId(chainId, counterCommitmentId)`,
  `getCommitmentExchangeId(chainId, poolId, commitmentIdA, commitmentIdB)`,
  `getPoolMemberHistoryId(chainId, poolId, account)`, and
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
- **Independent pool-field projection**: `PoolCharterUpdated` compares its event position with
  `(charterUpdateBlockNumber, charterUpdateLogIndex)` before changing `charterCID`.
  `ProviderOpenCommitmentCapUpdated` independently compares
  `(providerCapUpdateBlockNumber, providerCapUpdateLogIndex)` before changing the cap. Neither
  event is blocked by, nor advances, the pool lifecycle cursor; an older event delivered last
  cannot overwrite the newer value. Fixtures reverse two charter updates, two cap updates, and
  each update against a newer pool lifecycle event.
- **Pool and cycle lifecycle projection**: `CommitmentPool` and `CommitmentCycle` each own an
  independent nullable `(lifecycleBlockNumber, lifecycleLogIndex)` cursor. Every pool state event
  (`PoolReady`, `PoolOpened`, `PoolPaused`, `PoolResumed`, `PoolClosed`, `PoolComposted`,
  `PoolReopened`) and cycle state event (`CycleOpened`, `CycleClosed`, `CycleComposted`,
  `CycleCancelled`) compares its event position lexicographically before changing state,
  `pauseReasonCID`, or the pool's open Season/Campaign relationships. Older and duplicate events
  may retain their immutable audit row but do not mutate those projections or `updatedAt`.
  `PoolRegistered` and `CycleSeeded` fill nullable immutable placeholder facts, set
  `registrationSeen` / `seedSeen`, and initialize state only when no later lifecycle cursor
  exists. A reverse-delivered `CycleOpened` still fills its
  immutable allocation/recognition snapshots once, but cannot reopen a cycle whose newer
  close/compost/cancel cursor already won. Fixtures deliver opposing pool Open/Pause/Resume and
  cycle Open/Close/Compost/Cancel sequences in both orders, including lifecycle-before-creation
  and duplicates, and assert identical state, pause reason, open-cycle relationships, snapshots,
  and `updatedAt`.
- **Pool closure counters**: `CommitmentCreated` increments
  `CommitmentPool.liveCommitmentCount` exactly once after immutable creation facts exist.
  The reversible lifecycle-delta helper decrements that pool count on the first live-to-terminal
  Fulfilled, Cancelled, or Expired transition, re-increments Expired -> Disputed, and decrements
  the next terminal resolution. `CycleSeeded` increments
  `CommitmentPool.nonTerminalCycleCount`; `CycleCancelled` and `CycleComposted` decrement it
  exactly once, while `CycleClosed` leaves it unchanged because Reconciled is still awaiting
  compost. Event replay and older lifecycle positions cannot move either count. Reverse-delivery
  fixtures prove a pool cannot project Closed while either counter is non-zero and that every
  supported wind-down order converges to zero.
- **Series and Story projection**: series state and series metadata are independently mutable and
  therefore use separate nullable lexicographic cursor pairs. A metadata-first placeholder has
  only the metadata cursor; a lifecycle-first placeholder has only the lifecycle cursor.
  `CommitmentSeriesRested`,
  `CommitmentSeriesResumed`, and `CommitmentSeriesRetired` compare only
  `(latestLifecycleBlock, latestLifecycleLogIndex)` before updating `state`;
  `CommitmentSeriesMetadataUpdated` compares only
  `(latestMetadataBlock, latestMetadataLogIndex)` before updating `metadataCID`.
  `CommitmentSeriesCreated` fills nullable immutable placeholder facts, sets
  `creationSeen = true`, and initializes each mutable field only when that field has no later
  same-type cursor. Cross-type delivery order never blocks the
  other field: a later metadata event followed by an earlier Rest still applies the Rest, while a
  later Resume followed by an earlier metadata event still applies the metadata. Cross-type
  reverse-delivery and same-type stale/duplicate fixtures prove convergence.
  `CommitmentCreated` with a non-zero series ID links the Commitment and increments
  instance/current-state counts once. When lifecycle events were buffered before creation, the
  creation handler initializes the creation state and then drains those events in cursor order in
  the same database transaction, so the one committed series/current-state result reflects the
  final replay state rather than an Offered row stranded behind a newer cursor. The existing
  reversible lifecycle-delta helper updates both series and non-zero-cycle summary rows through
  Offered/Accepted/Ready/Fulfilled/Cancelled/Expired/Disputed and dispute restoration. The first
  Fulfilled instance in a cycle appends its composite cycle ID once. No handler computes a rate,
  score, rank, participant count, cross-pool grouping, or unit total across labels.
- **Creation payload completeness**: `CommitmentCreated` initializes `commitmentSeriesId`,
  its nullable composite relationship, emitted `creationRequestKey`, stored
  `creationPayloadHash`, contributor policy, derived
  domain tags, requirement action/domain/count arrays, `requiresAssessment`, `metadataCID`, and
  `needUID` directly, and seeds one `CommitmentRequirement` row per requirement. Handlers must
  not backfill these immutable facts from RPC reads or assume defaults that differ from the event.
  The contract mapping is creator-scoped: a non-zero first-use key stores the hash of the complete
  normalized `CreateCommitmentParams` payload and resulting commitment ID. Exact replay returns
  that ID without a second event or state delta. Different payload reuse reverts
  `CommitmentCreationRequestConflict`; the UI read-through getter must compare every immutable
  field before binding the local record.
- **CPP-alignment term and reverse-index handlers**: `CommitmentCreated` assigns
  `counterCommitmentId`, its nullable composite `counterCommitmentEntityId`,
  `declaredUnitValue`, and `declaredValueBasis` directly from the event only when the row has no
  `ValueDeclared` replay cursor. A prior out-of-order `ValueDeclared` creates/updates the
  placeholder and sets the nullable `(declaredValueUpdateBlockNumber,
  declaredValueUpdateLogIndex)` cursor, so creation can populate immutable facts without
  restoring the older creation-time value/basis pair. The value pair itself is never used as an
  unset sentinel because zero/empty is valid. When the counter ID is
  non-zero, the same handler create-if-not-exists loads
  `CommitmentCounterIndex(chainId, counterCommitmentId)` and appends the new commitment entity ID
  once; a replay of the same transaction/log cannot append again. `ValueDeclared` compares its
  `(blockNumber, logIndex)` lexicographically with the nullable stored cursor, ignores an older or
  duplicate position, and otherwise assigns the emitted value/basis pair plus the new cursor.
  It changes no lifecycle, unit, reward, settlement, or counter-index field. Replay fixtures cover
  creation→update, update→creation, duplicate delivery, and two updates delivered in either order.
  No later event reads `counterCommitmentId` to transition either side.
- **Reward projection**: `RewardDeclared` and `RewardPaid` compare their event position with the
  independent nullable `(rewardUpdateBlockNumber, rewardUpdateLogIndex)` pair before assigning
  reward terms or receipt fields. Creation fills its declared reward snapshot only when no newer
  reward cursor exists. An older declaration or receipt delivered last cannot regress the current
  reward view; reverse declaration/receipt and duplicate fixtures assert convergence without
  changing the commitment lifecycle cursor.
- **Atomic exchange marker**: the two ordinary `CommitmentAccepted` events remain the canonical
  per-commitment lifecycle inputs. `ExchangeAccepted` additionally creates exactly one
  `CommitmentExchange` row with ID
  `chainId-EXCHANGE-poolId-idA-idB`, ordered as emitted A then B, using the event's non-indexed
  `poolId` rather than an RPC read or a prerequisite commitment row. The handler stores both composite
  commitment relationships, both acceptors, the transaction hash, and timestamp. Entity
  existence is the atomic-acceptance marker, so no redundant boolean is stored; the handler does
  not increment pool, member-history, unit, provider, or
  lifecycle counters a third time. If the marker is processed before either ordinary acceptance,
  create-if-not-exists commitment placeholders preserve the relationships until those events
  populate lifecycle fields. Replay never duplicates the pair. Pair status after acceptance is
  derived by joining the two commitments; cancellation, expiry, dispute, or fulfillment on one
  side never mutates the other or the immutable exchange row.
- **Confirmation authority, provenance, and replay cursor**: `CommitmentCreated` initializes the
  emitted named/default rule and `protocolFallbackEnabled` only when the nullable
  `(confirmerRuleUpdateBlockNumber, confirmerRuleUpdateLogIndex)` cursor is absent.
  `ConfirmerRuleSet` compares its `(blockNumber, logIndex)` lexicographically with that cursor;
  an older or duplicate event may retain its immutable audit row but cannot mutate the rule,
  threshold, confirmers, fallback flag, cursor, or `updatedAt`. A newer event atomically assigns
  the complete emitted rule, threshold, confirmer list, `protocolFallbackEnabled`, and cursor, so
  reverse delivery never combines fields from different rule versions or invents Green Goods team
  authority from pool type or caller identity. A `ConfirmerRuleSet` delivered before
  `CommitmentCreated` may populate those rule fields on the placeholder; creation then fills its
  immutable facts without restoring the older creation-time rule. Replay fixtures cover
  creation→update, update→creation, duplicate delivery, and two opposing opt-in/opt-out updates
  delivered in either order. `CommitmentFulfilled` assigns its explicit `confirmer`,
  `confirmationPath`, and reason to `fulfilledBy`, `confirmationPath`, and `fallbackReason`;
  `fulfilledByFallback` is derived only for `PoolFallback` or `ProtocolFallback`. `Ordinary`
  requires an empty reason. `PoolFallback` renders as local-garden fallback and
  `ProtocolFallback` renders as “confirmed by Green Goods team — fallback”; handlers never infer
  either authority from `transaction.from`. A `DisputeResolved` transition to Fulfilled leaves
  these confirmation-only fields null. Each unique `ConfirmationRecorded` still increments the
  emitted confirmer's history once, while the commitment projection assigns
  `confirmationCount = max(currentCount, emittedCount)` and retains the emitted threshold. A
  lower cumulative count delivered later can never regress readiness or hide an already recorded
  confirmation.
- **Lifecycle and terminal projection helper**: after the unique
  `CommitmentEvent(chainId, txHash, logIndex)` guard proves an event is new, every commitment event
  whose state/member/series/cycle/Need projection requires immutable creation facts first checks
  `creationSeen`. When false, the handler writes one typed
  `CommitmentPendingLifecycleProjection` with the same event ID, appends that ID once to
  `CommitmentPendingLifecycleProjectionIndex`, and returns without mutating state, the lifecycle
  cursor, actor/member counters, series outcomes, `liveCommitmentCount`, attribution confirmation,
  or Need lineage. `CommitmentCreated` then populates the immutable facts, applies its Offered or
  Requested base projection exactly once, sorts the explicit pending IDs by
  `(blockNumber, logIndex)`, and invokes the same internal projection functions directly from the
  stored payloads; the existing audit rows do not cause the drain to skip them. Each drained row is
  marked applied and the pending ID list is cleared only after all projections succeed. The Envio
  handler transaction exposes neither a transient live increment nor a partially drained result.
  When `creationSeen` is true, the event calls `applyLifecycleTransition` directly with its
  explicit next state and cursor. The helper compares that cursor lexicographically with the
  commitment's stored lifecycle cursor; an older delivery may still create its immutable audit row
  and actor counter, but it cannot regress state or reapply state-derived deltas. The same path is
  used by `CommitmentAccepted`, `CommitmentReadyForConfirmation`, `ConfirmationRecorded`,
  `CommitmentDisputed`, `CommitmentFulfilled`, `CommitmentCancelled`, `CommitmentExpired`, and
  terminal `DisputeResolved.finalState`; `RestorePrevious` passes the emitted restored state.
  Transitioning from Expired to Disputed reverses the current Expired pool/cycle/member-history
  bucket and re-increments a non-zero cycle's `liveCommitmentCount`. Resolving that dispute to
  Expired restores the Expired bucket, while resolving it to Cancelled applies only the Cancelled
  bucket. A live Accepted/Ready dispute changes no live count until its terminal resolution.
  Therefore `Expired -> Disputed -> Cancelled` leaves exactly one current terminal outcome and one
  paired live-count decrement, never both Expired and Cancelled history for the same commitment.
- **Pool-member-history deltas and late-fact reconciliation**: every touched row is
  create-if-not-exists with zero counters. `CommitmentAccepted` stores its immutable acceptance
  payload, `(acceptanceBlockNumber, acceptanceLogIndex)`, and `acceptanceSeen = true` even when its
  lifecycle cursor is older than an already applied terminal event; its unique audit event increments `leadAccepted` once for the emitted
  non-zero `leadProvider`. `ConfirmationRecorded` increments `confirmationsGiven` for its emitted
  `confirmer`; `CommitmentDisputed` increments `disputesRaised` for its emitted `raiser` even when
  its lifecycle projection is older than the stored cursor. `ContributorRosterFrozen` stores its
  emitted exact count in `frozenContributorCount`; contributor add/remove handlers continue to
  materialize their event-owned rows independently of terminal state.

  `reconcileTerminalMemberHistory(commitment)` is called after every terminal lifecycle
  projection and after `CommitmentAccepted`, `ContributorAdded`, `ContributorRemoved`, and
  `ContributorRosterFrozen`. When the current state is Fulfilled, Cancelled, or Expired and
  `acceptanceSeen` supplies a non-zero lead, it reverses any different non-null
  `memberHistoryOutcome`, applies exactly one `leadFulfilled`, `leadCancelled`, or `leadExpired`
  bucket for the current terminal state, and stores that outcome. Expired-to-Disputed reverses and
  clears the stored outcome before a restored or replacement terminal result can apply. Therefore
  a terminal event delivered before acceptance cannot lose or duplicate the lead outcome.

  The Fulfilled participant portion waits until `acceptanceSeen`, `contributorsFrozen`, a non-null
  `frozenContributorCount`, and exactly that many active rows from the bounded contributor index
  are materialized. If `fulfilledParticipantHistoryApplied == false`, it then increments
  `contributorFulfilled` once for each frozen active contributor other than the lead and
  `receivedFulfilled` for exactly one stored receiving identity (Offer uses `counterparty`; Request
  uses `creator`), then flips the guard atomically. A GardenAccount receiver is counted as that
  GardenAccount, never fanned out to its current stewards or named confirmers. Late acceptance,
  contributor, or freeze delivery re-enters this helper; duplicate delivery or later calls observe
  the guards and apply no second delta. Request, readiness, confirmation-threshold, reward,
  value-declaration, and counter-commitment events change no other history counter.
- **Terminal side projections**: every transition into Fulfilled, including
  `DisputeResolved(finalState = Fulfilled)`, loads the bounded attribution index and marks each
  referenced attribution confirmed, appends the commitment to
  `NeedCommitmentIndex.fulfilledCommitmentEntityIds` once when `needUID != 0`, and applies the same
  pool/cycle/current-outcome counters as ordinary fulfillment. Cancelled and Expired resolutions
  apply their ordinary current-outcome counters. Exact-label units and provider exposure remain
  event-owned by `UnitsFulfilled`/`UnitsReleased`, so the lifecycle helper never duplicates those
  accounting deltas. If an `EvidenceAttached` row is itself delivered after the Fulfilled
  projection, its handler creates the attribution as `confirmed = true`; if evidence arrives while
  a terminal projection is buffered, the creation-time drain sees it through the explicit index.
  Both delivery orders therefore converge without a database scan.
- **Cycle live-count read model**: `CommitmentCreated` with non-zero `cycleId` increments
  `CommitmentCycle.liveCommitmentCount`, including Requested records that do not yet affect
  `openCommitmentCount`; Offered records affect both counts because creation reserves provider
  capacity. A creation-time pending-projection drain occurs in that same atomic handler
  transaction, so a reverse-delivered terminal commitment commits the correct zero live count and
  final series/member/Need outcome without exposing or stranding an intermediate live increment.
  `applyLifecycleTransition` decrements on every live-to-terminal
  Fulfilled/Cancelled/Expired transition, including terminal `DisputeResolved`; Expired-to-Disputed
  re-increments, and its later terminal resolution decrements once. Ready and disputes raised from
  live states do not change the count. Replay fixtures deliver Accepted, Ready, Fulfilled,
  Cancelled, Expired, Disputed, and resolved-dispute events both before and after creation, plus
  Fulfilled/Cancelled/Expired before acceptance and Fulfilled before contributor/freeze rows. Every
  order preserves the exact on-chain count and the same series outcome, PoolMemberHistory rows,
  attribution confirmation, and Need lineage. W26 reads this field rather than provider-capacity
  exposure when deciding whether close can run.
  - **Pool-less authority/configuration audit**: `ModuleUpdated`,
    `ModuleDependencyUpdated`, `ModuleSchemaUIDUpdated`, and `ModulePauseStatusChanged` each create
    exactly one replay-idempotent `CommitmentEvent` with the matching event type, nullable
    `configurationKey`, normalized `previousValue`/`newValue`, and null
    pool/cycle/commitment relationships. Address and bytes32 values use lowercase canonical hex;
    booleans use `false`/`true`. These events mutate no pool, cycle, commitment, unit-summary, or
    provider-exposure row, and never use a synthetic pool `0` or `transaction.from`.
- **Claim request and contributor lifecycle**: every `CommitmentClaimRequest` owns a nullable
  `(lifecycleBlockNumber, lifecycleLogIndex)` cursor and an explicit `requestSeen` marker.
  `ClaimRequested` upserts
  `${chainId}-${commitmentId}-${claimant}` from the emitted canonical claimant, `requestedBy`,
  kind, context, and requestedAt, then appends that ID once to the lexicographically sorted
  request index. A **late `ClaimRequested`** first compares its position with the commitment's
  stored acceptance and terminal positions: when a newer acceptance already won, the matching
  accepted claimant materializes directly as `ACCEPTED` and every other claimant as
  `SUPERSEDED`; when a newer Cancelled or Expired marker already won, it materializes directly as
  `SUPERSEDED`. It can become `PENDING` only when no newer commitment result or same-row decline
  exists. `ClaimDeclined` always upserts the claimant-keyed row and request index. When the
  request payload has not arrived, it creates a terminal placeholder with `requestSeen = false`,
  nullable request fields, `DECLINED`, the reason/resolution, and the decline position. A later
  older `ClaimRequested` fills the nullable payload and sets `requestSeen = true` without
  regressing `DECLINED`; a genuinely newer post-decline request fills/replaces the payload,
  clears the old resolution, advances the row cursor, and becomes `PENDING` unless a still-newer
  commitment acceptance/cancel/expiry marker wins. `CommitmentAccepted` carries
  claimant/counterparty/leadProvider/providerGarden, stores its immutable acceptance position,
  marks the matching request `ACCEPTED` when that row exists, then independently loads
  `CommitmentClaimRequestIndex` and marks every other still-`PENDING` row `SUPERSEDED` with
  `COMMITMENT_ACCEPTED`. The bounded sweep never depends on finding a matching row: the two
  ordinary events emitted by `acceptExchange` therefore clear stale requests for both A and B
  even when neither counterpart creator requested first. Cancellation and expiry use the same
  index and terminal-position comparison. Reverse-delivery fixtures run Request/Decline/Accept/
  Cancel/Expire in every relevant order, including decline-before-request and a later fresh
  request after decline, and assert the same cursor-winning result.

  Open acceptance normally has no request row and stores the emitted authenticated caller as the
  Garden Request lead. It relies on the same-transaction `ContributorAdded` event to create the
  lead's roster row. Each `CommitmentContributor` owns an independent
  `(membershipBlockNumber, membershipLogIndex)` cursor; an older Add delivered after a newer
  Remove cannot reactivate the row, and an older Remove cannot deactivate a newer Add.
  A remove-before-add row sets `additionSeen = false` and leaves `addedBy`/`addedAt` null until
  the older Add fills those immutable audit facts without reactivating the newer removal.
  `CommitmentContributorIndex.contributorEntityIds` is unique and sorted by normalized address,
  never insertion order. Each `ContributorRequirementAssigned` writes one
  `CommitmentContributorRequirementAssignment` row with its own lifecycle cursor and appends its
  ID once to `CommitmentContributorRequirementIndex`, sorted by contributor and numeric
  requirement index. Assignment delivery never rewrites the contributor membership cursor.

  `WorkLinked` creates or activates the workUID-keyed `CommitmentWorkAttribution`, sets
  `linkSeen = true`, stores its
  caller-scoped `operationKey`, and compares `(linkLifecycleBlockNumber,
  linkLifecycleLogIndex)` independently from the Work decision sequence. A later Unlink followed
  by an earlier Link stays unlinked; an older Unlink cannot hide a newer Link. Unlink/decision
  before Link may create a `linkSeen = false` placeholder whose link-only payload remains null;
  the later Link fills those immutable facts without overriding the winning link/decision state.
  `uncountedLinkedWorkCount` changes only on the winning linked-state transition. Exact replay of
  the same contract operation key produces no second event; conflicting key reuse is rejected.
  `ContributorRosterFrozen` locks the read model. Every
  `EvidenceAttached` increments the commitment's `evidenceCount` exactly once, then walks
  `creditedContributors` in emitted order. For each address it upserts the
  `(commitmentId, cid, contributor)` attribution row, appends that row ID exactly once to
  `CommitmentEvidenceAttributionIndex.attributionEntityIds`, and mirrors the emitted ledger
  semantics: only the contributor's first evidence attribution changes `evidenceCredits` from
  0 to 1; later distinct CIDs remain separately queryable provenance without adding recognition
  weight. Work events separately increment the named contributor's `approvedWorkCredits`.
  The shared terminal projection helper's Fulfilled branch loads the bounded attribution index and
  marks each referenced attribution confirmed, whether fulfillment arrived through
  `CommitmentFulfilled` or `DisputeResolved`, never using a database-wide scan. The indexer never
  increments on-chain-style contributor credits again at fulfillment.
- **Relationship-array convergence**: every set-like relationship array is de-duplicated and
  deterministically sorted before write: normalized addresses for contributor rows, lexical
  composite IDs for claims/evidence/Need/counter references, and contributor plus numeric
  requirement index for assignments. Semantically ordered pending lifecycle projections are the
  sole exception and are sorted by `(blockNumber, logIndex, eventId)` before drain. No final
  relationship order depends on event delivery order.
- **Address normalization**: `normalizeAddress` for every address field (`helpers.ts:68-70`). Generic `CommitmentEvent.actor` is nullable and is populated only from an explicit actor parameter; never infer account-abstraction identity from `transaction.from`.
- **Effective Work-credit delta**: `ApprovedWorkCounted` loads the durable Work attribution,
  transitions `creditActive` false → true, stores the emitted non-zero sequence and decision UID,
  decrements
  `uncountedLinkedWorkCount`, writes the emitted cumulative requirement/commitment values,
  increments the contributor credit, and adds only `newlyApprovedUnits` to the exact-label
  pool/cycle summaries. `ApprovedWorkReversed` transitions true → false, stores the newer
  decision key, restores `uncountedLinkedWorkCount`, decrements the contributor credit, writes the
  emitted cumulative requirement/commitment values, and subtracts only
  `removedApprovedUnits` from those summaries. A row with a sequence below the stored sequence,
  or the same sequence with a different UID, is rejected as inconsistent input; UID never orders
  two decisions. Same-state, stale, and exact-event replays do not
  mutate counters; cumulative values are assigned, never summed. Replay coverage includes
  approval → reversal, reversal before surrounding lifecycle events, unlink after a non-counted
  link, and duplicate delivery of every Work event.
- **Register events and count safety**: the three unit events carry `poolId`, `cycleId`, and the
  exact stored `unitLabel`; handlers never need a Commitment lookup or RPC call to choose their
  keys. `ClassRegistered` carries `poolId`, `cycleId`, `unitLabel`, and `quota` but **no account**,
  so it create-if-not-exists writes only the class row plus the placeholder pool and exact-label
  rows those keys imply, records `quota`, and changes no expected, open, or fulfilled unit total
  and no open-commitment count. It never writes a `CommitmentProviderExposure` row: that entity is
  keyed `chainId-poolId-lowercaseProvider`, and no provider address exists in the event or in the
  commitment at registration time, because the lead is only resolved at acceptance. Provider rows
  are created by the first `UnitsCommitted` for that account, which carries
  `address indexed account`. Expected/open units move only on `UnitsCommitted`. A class that is
  registered at creation and never accepted therefore reads as a known label with zero units
  rather than as phantom expected supply, and a `ClassRegistered` that arrives before
  `CommitmentCreated` needs no reconciliation when the commitment row later appears.
  After the immutable audit-event guard, handlers apply **signed commutative deltas** keyed by the
  event itself rather than assigning aggregates from delivery order. `UnitsCommitted` contributes
  `+1` to pool/provider/cycle open counts, `+units` expected, and `+units` open.
  `UnitsReleased` contributes `-1` open slot and `-units` open; `UnitsFulfilled` contributes
  `-1` open slot, `-units` open, and `+units` fulfilled. When `cycleId != 0`, the same slot delta
  applies to that cycle; `cycleId == 0` creates no cycle-scoped row. The current total is the sum
  of the unique event deltas, so Commit/Release/Fulfill delivered in any order has the same final
  result; `updatedAt` is the maximum event timestamp/position, never “last delivered.” Synthetic
  reverse replay may expose an internal negative intermediate, but a completed checkpoint is
  published only after its transaction/batch converges. The events update only the matching
  exact-label `CommitmentUnitSummary`; `hours` and `Hours` never share an ID. Tests permute every
  unit event order, include event-before-creation, case-distinct labels, duplicate delivery,
  cancellation/expiry, and fulfillment.
- **Need lineage**: non-zero `CommitmentCreated.needUID` appends the composite commitment/cycle IDs once to `NeedCommitmentIndex`; the terminal projection helper's Fulfilled branch appends the commitment to `fulfilledCommitmentEntityIds` once for both ordinary and dispute-resolved fulfillment, including when that terminal event was buffered until creation supplied the UID; commitment-bundled Hypercert handling appends its composite Hypercert ID. UID zero creates no index row. This is reference indexing from Green Goods events/metadata, not EAS indexing.

**Existing Garden identity compatibility (required).** `Garden.id` remains the normalized bare
GardenAccount address and every Garden row continues to carry its explicit `chainId`, matching
`packages/indexer/AGENTS.md`; no Commitment Pooling lane may convert it to a composite ID.
`gardenId`, `providerGardenId`, and `gardenContextId` relationship fields therefore store the same
normalized bare Garden ID. Every new Commitment Pooling, settlement, request, index, event, and
summary entity keeps its own chain-scoped composite `id` plus `chainId`, so their cross-chain
identity never depends on changing `Garden.id`. Handler/query fixtures prove existing raw-address
Garden lookups remain compatible, relationship helpers resolve to those Garden rows, and otherwise
identical Arbitrum/Sepolia commitment entities remain distinct through their own IDs and chain
fields. A full replay is required for the new schema and handlers, not for a Garden primary-key
cutover, and there is no mixed Garden-ID mode to support.

**Generated-config preservation.** Extend both `packages/contracts/script/utils/envio-integration.ts` and `packages/indexer/scripts/check-indexing-boundary.mjs` allowlists for `CommitmentPoolingModule`, `CommitmentRegistry`, `SettlementModule`, and `CeloSettlementExecutor`. A regression fixture must run the deployment-artifact updater twice and prove all four contract blocks and exact event signatures survive unchanged; unknown EAS or Celo token blocks must still fail the boundary check. The same boundary fixture rejects duplicate Commitment Pooling module/register blocks on one chain and rejects an address replacement without an explicit versioned namespace/migration manifest, preserving the single-canonical-proxy assumption behind every `chainId-*` pooling ID.

Run `bun codegen` in `packages/indexer` after the schema/config edits and before writing handler
code (`.claude/rules/indexer.md`). Codegen acceptance includes typed
`CommitmentClaimRequestIndex` and `CommitmentEvidenceAttributionIndex` stores. Handler tests prove
two pending requests become one `ACCEPTED` plus one `SUPERSEDED`; exchange acceptance with
pending rows but no matching counterpart request supersedes every pending row for both A and B;
and multiple evidence rows
become confirmed on fulfillment, using only their bounded event-owned indexes and no
database-wide scan.

### 8.4 Stat derivation contract

Cross-commitment arithmetic is count-based. `promiseKeptRate` is the only cross-commitment percentage and is computed in shared selectors, never stored as a float:

| Aggregate | Numerator | Denominator | Notes |
|---|---|---|---|
| promiseKeptRate | `commitmentsFulfilled` | `commitmentsDue` (accepted minus cancelled) | per pool/cycle; expiries count against; mutual releases do not |
| openCommitmentCount | event-driven current count | none | committed Offers plus accepted Requests not released or fulfilled; count-safe across unit labels |

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

`recognitionWeightBps` remains on `CommitmentContributor` because it is fixed by that commitment's
frozen credits and immutable cycle policy. Integer `recognitionUnits` is certificate-specific
because each Hypercert supplies a different gardeners-class unit budget, so it lives only on
`HypercertCommitmentContributorAllocation`, keyed by
`chainId-hypercertId-commitmentId-lowercaseContributor`. The row stores the Hypercert and
commitment relationship IDs, contributor relationship, stable bps weight, that commitment's
gardeners-class unit budget, and the resulting integer units.

The ClaimStored metadata handler extends `parseHypercertMetadata`
(`packages/indexer/src/handlers/hypercerts.ts:131-177`) to populate the bundle fields; absent or
unrecognized metadata resolves to `WORK_LEGACY`. For a `COMMITMENT` bundle, the same
replay-idempotent handler runs the canonical §9.3 expansion and upserts one
`HypercertCommitmentContributorAllocation` row per commitment/contributor result. A later
certificate containing the same commitment creates rows under its own Hypercert key and never
overwrites commitment-level weights or a prior certificate's units.

### 9.3 Allocation classes

- On-chain: only the six-role bps snapshot, set at cycle open, validated `sum == 10_000` (`InvalidAllocation`, mirroring `InvalidSplitRatio` at `packages/contracts/src/resolvers/Yield.sol:107,373`), emitted in `CycleOpened`, stored on the cycle and indexed on `CommitmentCycle` (8.2).
- App-computed: per-address allowlist expansion. Treasury, operator (label reads "steward share"), evaluator, community, and
  funder classes resolve as before. The gardeners class resolves through fulfilled commitments
  and their frozen eligible contributors, never through singular providers:
  1. sort fulfilled commitment IDs ascending, assign each
     `floor(gardenersClassUnits / fulfilledCommitmentCount)`, then give the first
     `gardenersClassUnits % fulfilledCommitmentCount` commitments one additional unit in that
     order;
  2. within each commitment, eligible contributors are frozen contributors with at least one
     approved linked Work credit or evidence credit on the now-Fulfilled commitment;
  3. run the equal-participation component as its own exact integer pass: give every eligible
     contributor `floor(equalParticipationBps / eligibleContributorCount)`, then give one
     additional bps to the first `equalParticipationBps % eligibleContributorCount` addresses in
     ascending lowercase-address order;
  4. run the verified-contribution component independently: for contributor `i`, compute
     `floor(verifiedContributionBps * verifiedCredits[i] / totalVerifiedCredits)`, retain the
     fractional numerator remainder, then give one additional bps to the first
     `verifiedContributionBps - sum(floors)` contributors ordered by descending fractional
     remainder and ascending lowercase address;
  5. add each contributor's equal and verified component results. The passes are never pooled or
     interleaved: equal remainder units are assigned first, verified remainder units second, and
     the same contributor may receive one unit from both passes. Within either pass the remainder
     is smaller than the eligible row count, so no row receives more than one remainder unit from
     that pass. The final vector sums to exactly 10_000 bps.
  6. expand that final bps vector into the commitment's integer gardener-unit budget in a separate
     exact-conservation pass: assign contributor `i`
     `floor(commitmentGardenersClassUnits * recognitionWeightBps[i] / 10_000)`, retain each
     numerator remainder, then award the remaining
     `commitmentGardenersClassUnits - sum(floors)` units by descending numerator remainder and
     ascending lowercase address. This unit-level pass never changes or re-hashes the canonical
     10,000-bps recognition vector; it only produces allowlist units, whose sum must equal the
     commitment budget even when that budget is smaller than the eligible contributor count.
  The protocol preset is 2_000 equal / 8_000 verified. The steward selects the policy at cycle
  open, where it snapshots immutably and must sum to 10_000; cycle-less commitments use the same
  immutable protocol preset for contributor recognition and payout defaults only. They are
  ineligible for COMMITMENT-bundle Hypercert minting because no `CycleOpened` six-role allocation
  snapshot exists. The shared composer rejects any selected `cycleId == 0` commitment and any
  cycle whose current on-chain state is not exactly `Reconciled` before allowlist or metadata
  construction, regardless of whether entry came from W26 or `/hub/certify/create`; the admin UI
  labels those commitments “Cycle must be closed · not certificate eligible.” There is no
  automatic lead fallback and no metadata-only recognition
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

- A COMMITMENT-bundle mint accepts only fulfilled commitments from one non-zero cycle whose
  on-chain state is already `Reconciled`, produces an indexed Hypercert with
  `bundleKind: COMMITMENT` and populated `commitmentIds`, and rejects `cycleId == 0`, Open,
  Seeded, Composted, or Cancelled selections before metadata or allowlist construction. This gate
  lives in the shared composer used by both W26 and the independently reachable
  `/hub/certify/create` route. A legacy mint still resolves `WORK_LEGACY`.
- Every COMMITMENT-bundle mint persists certificate-scoped
  `HypercertCommitmentContributorAllocation` rows. Minting a second certificate containing the
  same fulfilled commitment creates distinct rows and may produce different `recognitionUnits`
  without overwriting the stable commitment-level `recognitionWeightBps` or the first
  certificate's allocations.
- Cycle-open bps snapshot drives the allowlist; each commitment's integer unit expansion uses the
  specified floor plus descending fractional-remainder/ascending-address pass and conserves its
  assigned budget exactly, including a one-unit budget shared across multiple contributors.
- The gardeners-class expansion covers solo and team commitments, equal cross-commitment budgets,
  the 20/80 preset, deterministic tie/rounding behavior, zero-eligible blocking with no lead
  fallback, and rejection of any inconsistent legacy/indexed zero-eligible state. There is no
  metadata-only attribution repair; a governed migration or source-data correction must restore
  canonical on-chain credit before expansion. Once every fulfilled commitment has an eligible
  contributor, the result sums exactly to the gardeners-class units.
- No change to `HypercertsModule` bytecode; `createAllowlistAndRegister` call shape is identical.
- Contract tests cover Garden claims where the creator is the authenticated operator for both
  Open and ApprovalGated modes, including the acceptance-time requester recheck. Evidence tests
  attach multiple distinct CIDs to one contributor and prove their evidence-derived recognition
  credit remains 1, while the first attribution to a second contributor adds exactly one credit.

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
`src/resolvers/Testimony.sol`; `config/schemas.json` keys `assessmentV3` +
`communityTestimony`; the existing `script/upgrade.ts assessment-resolver` UUPS target;
`script/DeployCommitmentSchemas.s.sol` +
`script/deploy/commitment-schemas.ts` registration/deploy wiring; validate-script extensions;
dual-schema Assessment upgrade tests, Community Testimony tests, and storage-layout baselines.

Additional NET-NEW deliverables this chain must build before any `--network arbitrum-sepolia`
command in §7.3/§7.4 can run at all. None of these exist today:

- An `arbitrum-sepolia` / `421614` entry in `packages/contracts/deployments/networks.json` with
  chain id, name, `${ARBITRUM_SEPOLIA_RPC_URL}`, explorer/verify config, deploy config, and the
  chain-local-verified `eas` / `easSchemaRegistry` addresses, plus the matching NetworkManager /
  RPC env wiring and `.env.schema` key.
- The `packages/contracts/deployments/421614-latest.json` artifact path, created by the chain's
  first authorized broadcast and read by every later `--network arbitrum-sepolia` invocation and
  by the §7.4 owner check.
- Extension of `script/DeployBadgeSchema.s.sol` `_getNetworkName` (`:65-76`), whose current
  chain-id → name map reverts `UnsupportedChain(421614)`.
- An explicit `421614` posture in `script/utils/release-gate.ts`, which today pins only
  `SEPOLIA_CHAIN_ID = "11155111"`; `assertSepoliaGate` must state whether `421614` is gated,
  exempt, or gated under its own constant, rather than inheriting `11155111` by accident.
- The §7.4 sender contract: make `--sender` mandatory on every `upgrade.ts` transaction plan and
  validate it against the live proxy `owner()` before plan persistence. Today `--sender` is
  optional, falls back to `process.env.SENDER_ADDRESS`, persists `sender: null`
  (`script/upgrade.ts:425`), and `owner()` is never read. Add the NET-NEW grouped
  `commitment-pooling` upgrade target with its own check that GardenToken and
  WorkApprovalResolver report the same live owner before one plan persists.

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

Deliverables: GardenToken change set (6.3), WorkApprovalResolver bridge (6.5), 42161 broadcast runbook (one-shot ops doc in `.plans/active/commitment-pooling/`, not `scripts/`), protocol pool registration, and a verified 13-garden enumeration that records the root skip and submits 12 non-root Garden registrations.

Acceptance: storage-layout gates green pre-broadcast; GardenToken and WorkApprovalResolver are
upgraded and both reverse links are verified while pooling remains paused; unpause succeeds only
after every chain-2 and chain-3 readiness fact passes; the root receives exactly one Protocol pool,
the backfill proves `SKIPPED_PROTOCOL_ROOT` for that address, and the 12 remaining live gardens
receive Garden pools without a `PoolExists` abort; a scripted offer -> fulfilled smoke passes; the
post-broadcast artifact shows both new addresses and non-zero pool count; and a live approval on an
existing garden emits `ApprovedWorkCounted` for a linked work.

### `packages/indexer`

Deliverables: `config.yaml` blocks (8.1, zero-address placeholders until broadcast), `schema.graphql` entities + enums (8.2, 9.2), `src/handlers/commitmentPool.ts`, hypercerts handler `bundleKind` extension, helper ID functions, `EventHandlers.ts` import, handler tests, `bun codegen` artifacts.

Acceptance: local Docker stack replays a scripted Sepolia fixture and produces correct pool/cycle counts, provider exposure rows, and exact-label unit summaries; `promiseKeptRate` derives with integer math only; no EAS reads anywhere in handlers.

### `packages/shared`

Deliverables: domain types (`CommitmentPool`, `CommitmentCycle`, `Commitment`, allocation preset constants; `Address` type per repo rules); ABI + address exports from the deployment artifact (import pattern per root CLAUDE.md Contract Integration); query hooks + `queryKeys.*` entries; derived-state selectors implementing the section 5 overlays (Active, EvidenceSubmitted, PartiallyApproved, InProgress, Reviewing, Reconciled) and the 8.4 rate math; **six August offline job kinds**: `commitmentSeries` (create one pool-scoped ongoing Offer identity), `commitment` (create offer/request), `claim` (claim/accept), `evidence` (attach evidence CID), `workLink` (link approved work), and `confirmation` (confirm fulfillment), plus the separate online-only wallet action `transfer` (settlement-chain G$ send), extending the exactly-two-kinds baseline where applicable (`packages/shared/src/types/job-queue.ts` + `packages/shared/src/modules/job-queue/`, `reports/corrections-log.md` §6); mutation hooks with `createMutationErrorHandler`.

Acceptance: hooks exported from the barrel only; the six offline pool job kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`, `confirmation`) run through the existing IndexedDB + XState machine with MAX_RETRIES parity, including explicit `clientSeriesId` dependency waiting that consumes no retry and sender-compatible contract-idempotent series recovery from `standing-commitments-spec.md` §6; `transfer` is an online-only settlement wallet action with no offline queue entry and no MAX_RETRIES replay (per `uiux-spec.md` §5.11 and `settlement-spec.md` §5); locale keys mirrored es/pt (repo i18n gate); `bun run --filter @green-goods/shared test` green.

### `packages/admin`

Deliverables (full flows in `uiux-spec.md`; contract touchpoints listed here): steward seeding console (createCommitment with confirmer rule + declared reward + claim mode), cycle management across 5.2, claims queue (`acceptClaim`), analog capture (StewardCaptured via `onBehalfOf`, extending the `SubmitWork` on-behalf precedent), per-cycle assessment creation against the v3 schema, allocation preset picker at cycle open, dispute handling, `RewardPaid` recording. Garden workspace + new Pools workspace per register #10.

Acceptance: every module write goes through shared mutation hooks; no direct contract calls in views; admin remains restrained (no hero moments).

### `packages/client`

Deliverables (full flows in `uiux-spec.md`): offer/request creation, browse/claim, work linkage through the existing MDR flow, evidence capture, counterparty confirmation, commitment + cycle views in the Garden tab; personal commitments + pending-confirmations panel on the Profile wallet surface; settlement reward status + G$ send affordance per `settlement-spec.md`; Fulfilled and cycle-close hero moments (register #27, client only). The six August offline job kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`, `confirmation`) cover field actions where applicable; G$ send remains an explicit online-only wallet action on Celo.

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
5. Shared substrate (types, signed saved-Offer persistence, hooks, six offline queue job kinds including `commitmentSeries` plus online wallet `transfer`, settlement selectors) consumed by admin + client + editorial surfaces.
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
12. **Register upgrade authority.** The register is UUPS-owned by the protocol upgrade owner — the protocol 3-of-5 Safe required by §6.1 before mainnet activation — while mutations are module-gated (6.2). Anyone proposing owner==module must answer who upgrades the register.

---

Build order restated for the July Build and August 12 Release: contracts (schemas -> module/register -> upgrades) -> indexer -> shared -> admin + client PWA + editorial in parallel -> September community interface. The July dry run needs none of it.
