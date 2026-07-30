# Commitment Pooling - Codex Contracts Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: contracts
- Owner: Codex
- Branch signal: codex/contracts/commitment-pooling
- Current state: blocked; this handoff does not self-dispatch
- Linear context: PRD-721 (contracts lane) under parent PRD-650; PRD-671/672 are historical labels

## Inputs

- Corrected and merged GitHub PR #649 with Envio `3.2.1` generation/build/test/migration proof.
- Completed PRD-747/748 Steward contract/live-hat work. PRD-575 GreenWill is explicitly deferred
  for separate Council Safe coordination and is not an input to this lane.
- Afo's completed PRD-649 architecture fine-comb with every resulting correction reconciled into
  the contract/event/indexer/state/API boundaries.
- contract-spec.md, especially sections 5-8
- acceptance-matrix.md for canonical identity, permissions, payout, and final state proof
- packages/contracts/AGENTS.md and the approved append-only schema policy
- Existing ActionRegistry, GardenToken, WorkApprovalResolver, UUPS, deploy.ts, and storage-layout patterns
- Current deployment artifacts for Ethereum Sepolia and Arbitrum One, plus the additive
  Arbitrum Sepolia dependency/artifact path required by the spec

## Outputs

- An in-place upgrade of the existing AssessmentResolver for the AssessmentV3 schema, plus the
  NET-NEW CommunityTestimonyResolver and approved additive schema-registration targets.
- CommitmentPoolingModule and non-transferable CommitmentRegister with exact structs, enums, errors, events, indexes, storage gaps, pause rules, and bounded loops.
- GardenToken and WorkApprovalResolver wiring, isolated deploy targets, append-only artifact persistence, and post-deploy/indexer update hooks.
- Contract tests and deployment-script tests that become the frozen ABI/event source for indexer and shared lanes.

## Acceptance

- Empty confirmer rules resolve to Offer recipient or Request creator; named inputs are bounded by
  `MAX_CONFIRMERS = 32` before mutation; every active contributor is excluded from ordinary,
  named-group, and fallback confirmation. RED covers 32, 33, duplicate-heavy,
  contributor-filtered, and threshold-after-filtering cases.
- Pending claims store canonical claimant, authenticated requestedBy, immutable claim type, provider garden context, requested time, and active state. Runtime kind must equal the creation-time claim type. Acceptance consumes the canonical claimant-keyed terms; decline clears only that request; terminal pre-acceptance cancel/expiry are emitted for deterministic indexed supersession.
- Disputes store pre-dispute state and RestorePrevious restores it. An expired commitment can
  never resolve Fulfilled, and a contributor-steward cannot select the direct Fulfilled result
  because the same `SelfConfirmation` invariant applies.
- A pool permits one open Season and concurrent Campaigns through bounded O(1) checks.
  `Cycle.liveCommitmentCount` increments after successful cycle-scoped creation, decrements once
  on the first Fulfilled/Cancelled/Expired transition, and must be zero before `closeCycle` or
  `cancelCycle`.
- Creating a commitment with a cycle requires that cycle to belong to the same pool and still accept commitments. Cycle-less commitments remain explicit.
- DomainImpact requires 1–`MAX_REQUIREMENTS` repeatable registered action/count requirements. Actions
  may share a domain, every non-zero quota must be met by contributor/provider-garden-valid Work
  links, and any declared assessment must exist before non-override Ready. Approval-first and
  assessment-first ordering both reach Ready because the one-time `attachAssessment` call
  re-evaluates all completed requirements. It is Accepted-and-unfrozen only and rejects any
  replacement UID. SupportService, StewardCaptured, and SeasonCampaign require pre-freeze
  `evidenceCount >= 1`, `totalVerifiedCredits > 0`, plus any declared assessment; every
  non-override Ready path has its assessment gate.
- The onchain Ready predicate requires a charter and non-zero register provider open-commitment cap. A current, non-revoked Baseline assessment is an app/shared/admin preflight and is never added to the contract predicate. `pausePool` requires a reason CID and blocks only the operational mutations enumerated in contract-spec §6.1.
- `CommitmentPoolingModule` initializes paused. All six dependency setters and `setSchemaUIDs`
  require pause, reject zero/collision before mutation, and emit exact old/new facts; unpause
  requires the complete six-address/four-UID configuration. `CommitmentRegister.setModule`
  permits the initial zero → non-zero wiring only; later replacement requires the current module
  paused and emits exact old/new without touching accounting state. The frozen
  `ICommitmentPoolingModule` interface includes `paused() external view returns (bool)` because
  the register's replacement guard calls that selector; interface/implementation ABI proof must
  fail before deployment if it is absent.
- `seedCycle` stores no allocation or recognition policy.
  `openCycle(cycleId, AllocationBps allocation, RecognitionPolicy recognitionPolicy)` validates
  the six allocation fields sum to 10,000 and the equal/verified recognition fields separately
  sum to 10,000, stores both immutable snapshots, and emits all eight fields in `CycleOpened`.
  Update every downstream call site and ABI fixture; tests prove invalid sums reject before
  storage/event mutation and a valid policy cannot change after opening.
- DomainImpact creation stores repeatable `CommitmentRequirement { actionUID, requiredCount }` rows
  (1–`MAX_REQUIREMENTS`, every required count non-zero). Every Work approval carries a
  `requirementIndex`, validates the matching registered action and contributor attribution, and
  increments only that requirement's approved count while the commitment is Accepted and
  unfrozen; Ready requires every row to meet its quota. A late approval remains observable but
  cannot change progress, units, credit, or recognition. Domain tags are derived from
  ActionRegistry and may repeat across rows.
- The accountable lead is stored once at acceptance (`Offer -> creator`; non-Garden `Request ->
  counterparty`; Garden-claimed `Request -> authenticated pending claim.requestedBy`, while the
  GardenAccount remains counterparty and provider scope)
  and is the only unit account and open-commitment-count subject. The active contributor roster
  begins with that lead, preserves Work/evidence attribution, freezes roster and credit
  accounting before confirmation, and is wholly excluded from confirmation. Garden claims use
  gardeners/operators of `providerGarden`; `addContributor` applies the same resolved
  provider-garden membership predicate as self-join and Work attribution, so a lead/steward
  cannot add an arbitrary external address. Tests prove an eligible member succeeds and a
  non-member reverts before roster, confirmer, credit, or event mutation.
  UID 0 remains valid through the concrete ActionRegistry ABI. Celo G$ payout derivation belongs
  exclusively to `SettlementModule`: the provider garden Safe is payer, the plan names an explicit
  retained amount, and each non-zero eligible contributor allocation becomes a child disbursement.
- `DeclaredReward` carries `RewardRail { None, ArbitrumExternal, CeloSettlement }`. Zero reward
  requires `None` plus zero source/token/amount; `recordRewardPaid` accepts only
  `ArbitrumExternal`, so a Celo settlement declaration cannot also be recorded on the external
  rail.
- Commitment creation rejects an empty exact unit label and zero target. The register's per-class
  accounting state enforces only `Registered -> Committed -> Released|Fulfilled`; commit accepts
  exactly the full non-zero quota, and release/fulfillment accept exactly the full live committed
  balance. Acceptance therefore increments `providerOpenCommitmentCount` exactly once, while
  fulfillment, accepted cancellation, and accepted expiry release exactly one slot once.
  Partial, zero, repeated, wrong-account, and terminal-state register calls revert before any
  balance or count mutation. Pre-acceptance cancel/expiry changes no balance or slot; dispute
  entry/restoration makes no register call and preserves the slot.
- Pre-acceptance cancellation is available to the creator or steward; after acceptance only the steward may cancel. Work links are added by the accepted provider/counterparty or steward, never by an unrelated creator. Register class quota is immutable and `setProviderOpenCommitmentCap` changes go through the module's steward-gated forwarder.
- The count-cap API is the initial interface: `ProviderOpenCommitmentCapUpdated`,
  `OpenCommitmentCapRequired`, `OpenCommitmentCapExceeded`,
  `providerOpenCommitmentCapOf`, and `openCommitmentCountOf`. After pool/steward resolution the
  module forwarder rejects zero before calling the register; for an authorized module caller the
  register independently rejects zero before event or storage mutation. No exposure-unit
  compatibility alias or migration machinery is permitted.
- Existing schema definitions and artifact keys remain byte-identical; approved additions use unique keys and standalone registration.
- Exact creation, transition, pause, dependency, and schema-configuration events support
  deterministic Envio handlers without RPC backfill.
- `ClassRegistered` and every unit mutation carry `poolId`, `cycleId`, and the exact stored
  `unitLabel`; a unit handler can update pool/provider/exact-label rows even when it arrives
  before `CommitmentCreated`. `cycleId == 0` means no cycle-scoped row.
- `recordRewardPaid(commitmentId, payoutRef)` derives and emits stored source/provider recipient/token/amount; callers cannot override earned-reward facts.
- AssessmentResolver dual-schema config ABI, setter, event, errors, no-new-initializer UUPS
  upgrade, v2 state-preservation proof, and 3+47 storage layout match contract-spec §6.4.3
  exactly. `AssessmentV3` is a schema/artifact-key name only: no `AssessmentV3Resolver`
  contract, proxy, deployment address, or compatibility alias is created.
- AssessmentResolver is upgraded only through the existing
  `bun script/upgrade.ts assessment-resolver` UUPS path. The schema deploy target verifies the
  already-upgraded implementation and never performs a proxy upgrade.
- Before either schema registration, the standalone script derives the EAS UID from the exact
  schema bytes, resolver, and `revocable == false`, then reads `getSchema(uid)`. It registers an
  empty UID once, or reuses an exact existing record after a transaction/artifact partial
  failure; a mismatched existing record fails closed. UID setters reconcile zero → set,
  exact → skip, conflicting non-zero → fail. The append-only artifact merge uses that same UID in
  every path.
- CommunityTestimonyResolver implementation/proxy deployment uses deterministic versioned CREATE2
  predictions and is resumable after an on-chain-success/local-artifact-failure split. Existing
  addresses are reused only after exact implementation bytecode, ERC-1967 implementation,
  initializer lock, owner, EAS, and module/schema-state verification; mismatch fails closed and an
  absent result artifact is reconstructed without redeployment.
- The Assessment v3 setter cannot activate while the v2 UID is zero, and the legacy v2 setter
  cannot return to zero or collide after v3 activation. Community Testimony's NET-NEW resolver has
  no zero-UID wildcard. Preparation one-way pins its deterministic expected UID while module is
  zero; UID zero/conflict rejects and an exact repeat is a no-op. The exact second phase is
  `--finalize-community-testimony`: it reads the module from the verified deployment artifact,
  accepts no caller-provided module override, verifies the pinned UID, reconciles the exact EAS
  record while the resolver is inactive, and activates the module last. The module setter rejects
  zero and an unpinned UID; zero module fails closed for bound and unbound testimony. Because EAS
  registration is permissionless, preparation accepts an already-present record only when every
  deterministic field is exact; that record still cannot activate testimony while module is zero.
- The live Arbitrum Assessment proxy currently reports `schemaUID() == 0`; before v3 activation,
  the owner pins the existing v2 UID from the verified `42161` artifact. Arbitrum Sepolia has no
  recorded Assessment proxy, so the rehearsal deploys current v2, pins it, records state, and
  then proves the in-place upgrade.
- Arbitrum Sepolia consumes the official EAS
  `0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE` and SchemaRegistry
  `0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475` only after chain-local bytecode proof. Hats uses a
  version-pinned test deployment; no Ethereum Sepolia address is inherited by assumption.
- Pre-change AssessmentResolver, WorkApprovalResolver, and GardenToken baselines are committed
  before source edits. The Bun-wrapped storage gate fails closed on missing/different baselines,
  and generated compiler layouts plus concrete slot/offset assertions—not `named + gap`
  arithmetic—are the proof. GardenToken appends at slot 213 offset 2 and keeps `__gap[37]`.

## RED / GREEN

- RED: add focused tests in test/unit/CommitmentPooling.t.sol and
  test/unit/CommitmentRegister.t.sol; include write-once Accepted-and-unfrozen assessment
  attachment (replacement and post-freeze rejection), contributor-steward direct-dispute
  Fulfilled rejection, Garden-Request `requestedBy` lead accounting, evidence-only
  `requirements.length == 0`, and cycle-less Hypercert-composer rejection while recognition
  validation remains available for payout defaults. Run them before implementation and record
  the expected behavioral failures.
- GREEN: run the same files after the minimum implementation, then storage, script, and full contract checks.

## Exact Bun commands

`CommitmentPooling.t.sol`, `CommitmentRegister.t.sol`, and
`CommunityTestimonyResolver.t.sol` do not exist yet; each is an intentional to-be-created
RED-first deliverable. The existing `AssessmentResolver.t.sol` is extended with the in-place
upgrade and dual-schema cases. `WorkApprovalResolver.t.sol` and `StorageLayout.t.sol` are
existing regression surfaces.

- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentRegister.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/AssessmentResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/CommunityTestimonyResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/WorkApprovalResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol
- bun run --filter @green-goods/contracts check:storage-layout
- bun run --filter @green-goods/contracts test:script
- bun run --filter @green-goods/contracts build:full
- bun run --filter @green-goods/contracts lint:check
- bun run --filter @green-goods/contracts test

Run these deployment commands from packages/contracts; they remain simulation/transaction-plan
only until separately authorized. Commands are stage-gated: no invocation may assume that a
separate pure-simulation process changed chain state. The AssessmentResolver target already exists.
`commitment-schemas`, `commitment-pooling`, the grouped pooling upgrade target, and
`backfill-pools.ts` are deliverables of this lane (contract-spec §6.4.4, §7):

`commitment-pooling` deploys and finalizes the module/register while leaving the module paused.
The grouped `commitment-pooling` upgrade target upgrades GardenToken and WorkApprovalResolver,
wires and verifies both reverse links, and unpauses only after the complete chain-2/chain-3
readiness plan passes. `backfill-pools.ts` runs only after that verified unpause.

- bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --dry-run --pure-simulation
- bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --tx-plan --sender <verified-421614-assessment-owner>
- bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --dry-run
- bun script/deploy.ts commitment-pooling --network arbitrum-sepolia --dry-run
- bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --finalize-community-testimony --dry-run
- bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --tx-plan --sender <verified-421614-pooling-upgrade-owner>
- bun script/upgrade.ts assessment-resolver --network arbitrum --dry-run --pure-simulation
- bun script/upgrade.ts assessment-resolver --network arbitrum --tx-plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6
- bun script/deploy.ts commitment-schemas --network arbitrum --dry-run
- bun script/deploy.ts commitment-pooling --network arbitrum --dry-run
- bun script/deploy.ts commitment-schemas --network arbitrum --finalize-community-testimony --dry-run
- bun script/upgrade.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network arbitrum --tx-plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6
- bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

For a live chain, the commands execute in the listed dependency order, with a separately
authorized receipt, post-action verifier, and persisted artifact between stages:
AssessmentResolver upgrade → schema preparation → module/register deployment → Community
Testimony finalization with pooling still paused → grouped GardenToken/WorkApprovalResolver
upgrade and reverse wiring while paused → complete readiness verification → pooling unpause →
pool backfill and operational smoke. The full sequence is rehearsed on local and Arbitrum Sepolia
first. Every tx-plan sender
must equal the relevant live proxy `owner()` before plan persistence; the grouped upgrade fails
unless both proxies share that verified owner. After verified module/register deployment, run
`commitment-schemas --finalize-community-testimony --dry-run`; it must source the module from the
deployment artifact and prove UID pin -> exact registry reconciliation -> module activation,
including the allowed empty-record/zero-module, exact-record/zero-module, and
exact-record/exact-module retry states. It rejects module-before-UID, module-before-record, and
every conflicting state. Broadcast remains outside this handoff.

## Out of scope

- SettlementModule implementation, Celo execution, bridged G$, transferable vouchers, CreditRegister, raw Celo indexing, Sarafu integration, UI, and any broadcast.
- Editing existing production schema definitions or using bulk --update-schemas.

## Unblock evidence

- GitHub PR #649 is corrected, merged, and proven on Envio `3.2.1`.
- PRD-747 and PRD-748 have complete live upgrade/broadcast verification; PRD-575 remains deferred
  and non-blocking.
- Afo explicitly closes the PRD-649 final architecture fine-comb.
- status.json then marks the contracts lane ready and the user explicitly dispatches it.
- Corrected handoff and exact count-cap contract interface/event tables are present.
- Standalone schema-registration and isolated deployment targets have dry-run acceptance defined.
- The two Arbitrum Sepolia post-deploy verifier targets are created by this lane before any
  broadcast, alongside the `421614` network record.
- RED proof is recorded before implementation; GREEN cannot be claimed without the same test passing plus storage/deploy evidence.

## Binding architecture amendment — 2026-07-28

- Replace the single-provider fulfillment model with one accountable `leadProvider` plus a contributor roster. Only the lead consumes the non-transferable register slot; every roster member is excluded from confirmation.
- Accept repeatable `CommitmentRequirementInput` rows containing only `actionUID` and `requiredCount`; derive stored `domain` and `approvedCount` inside the module. There is no four-requirement product rule; set `MAX_REQUIREMENTS` only from the named gas/indexer benchmark.
- Freeze the roster and contribution-credit accounting atomically on the transition to
  `ReadyForConfirmation`. Emit contributor, work/evidence attribution, and recognition inputs
  needed by the indexer.
- The gardener Hypercert class uses equal fulfilled-commitment budgets, then the immutable
  cycle-open `RecognitionPolicy` (protocol default 20% equal participation / 80% verified
  contribution). Equal and verified components each run their own floor-plus-remainder pass before
  their row results are added; equal ties use ascending lowercase address, while verified
  remainders use descending fractional remainder then ascending lowercase address. Expand each
  commitment's final 10,000-bps vector into its integer gardener-unit budget with a final
  floor-plus-largest-fractional-remainder pass and ascending-address tie break, conserving the
  commitment budget exactly without changing the recognition hash. The cycle-less
  preset remains 20/80. Zero eligible contributors block certificate expansion; there is no lead
  fallback. Recognition is not a payment transfer.

## Binding review closure — 2026-07-29

- Implement the 30-feature-slot Commitment Pooling declaration order and `__gap[20]`, including
  `workRequirementIndexPlusOne`, `workCreditActive`, and the latest Work decision `(time, UID)`
  key, but treat the generated compiler baseline plus concrete
  slot/offset assertions as authoritative.
- `attachEvidence` rejects an empty or repeated exact CID, requires a non-empty unique
  measured-bounded credited list, and may increment `evidenceCount`/`evidenceCredits` only while
  the commitment is Accepted and unfrozen. A queued job that lands after freeze fails without a
  partial write. `isEligibleContributor` additionally requires `Fulfilled`.
- The provisional evidence-recipient bound is 32 only until the required 8/16/24/32 benchmark selects the transaction-safe value. It is not a semantic team-size cap.
- `MAX_CONTRIBUTORS_PER_COMMITMENT` is the measured end-to-end vector bound (provisional 32);
  add/join reject max-plus-one before mutation. Open contributors may self-leave only before
  freeze with zero linked Work and zero credit; neither the lead, a credited contributor, nor a
  contributor with uncounted linked Work may leave/be removed. `ContributorRecord` carries the
  O(1) `uncountedLinkedWorkCount`: link increments, Accepted-and-unfrozen unlink decrements, and
  the first countable approval decrements exactly once.
- `linkWork(commitmentId, workUID, requirementIndex)` binds a repeated action to one exact row and
  stores index-plus-one. `WorkApprovalResolver` forwards both approved and rejected decisions.
  `approvalCounted` makes each decision-attestation delivery idempotent; the greatest
  `(attestation.time, approvalUID)` pair is the deterministic effective decision. Before freeze,
  approval activates the exact requirement/contributor credit and a newer rejection reverses it;
  repeated same-state or older decisions do not double-mutate. After freeze, decisions are
  observed but cannot mutate credit, requirements, units, or recognition.
  The active contributor, accountable lead, or resolved pool steward may link after all shared
  validation; only the steward may unlink, and unlink is also Accepted-and-unfrozen.
- Every Ready transition and a direct `Disputed -> Fulfilled` resolution require at least one
  pre-freeze verified credit (`totalVerifiedCredits > 0`) plus either the cycle's opened
  recognition policy or the
  immutable cycle-less 20/80 default. The direct dispute path freezes and validates the roster
  before emitting the Fulfilled resolution, and rejects the resolving steward when that address
  is a current or frozen contributor.
- Each non-zero-cycle commitment increments `Cycle.liveCommitmentCount` after successful
  creation; the first Fulfilled/Cancelled/Expired transition decrements exactly once. Ready and
  Disputed remain live, and `closeCycle` plus `cancelCycle` require the O(1) count to be zero.
- Garden-claimed Requests use stored `requestedBy` as the accountable lead while retaining the
  GardenAccount as counterparty/provider scope. CeloSettlement declarations require source zero;
  the accepted provider-garden Safe becomes authoritative only in SettlementModule.
- Maintain eligible-contributor/verified-credit totals and expose
  `validateRecognitionSnapshot`; Settlement must always use its on-chain recomputation rather
  than trust a caller-selected vector/hash. Hypercert composition uses it only for non-zero-cycle
  commitments and rejects `cycleId == 0` before allowlist/metadata construction because no
  six-role allocation snapshot exists.
- For the gardeners-class cross-commitment split, sort fulfilled commitment IDs ascending, assign
  the floor share to each, and give one remainder unit to the lowest IDs before applying the
  within-commitment contributor policy. Within a commitment, allocate the equal-policy bps and
  verified-policy bps in two independent passes. Finish the equal remainder pass first by
  ascending lowercase address; then finish the verified remainder pass by descending fractional
  remainder and ascending lowercase address. Add the two row results only after both passes;
  remainders are never pooled, and one contributor may receive one remainder unit from each pass.
