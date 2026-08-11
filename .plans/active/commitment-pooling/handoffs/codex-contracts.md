# Commitment Pooling - Codex Contracts Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: contracts
- Owner: Codex
- Implementation branch: `feature/build-commitment-pooling-contracts`
- Merge: PR #694 at `c60b38dea`, verified as an ancestor of Phase A base `7a9c7ee`
- Current state: passed and merged; deployment/release engineering is a separate Phase A lane
- Linear context: PRD-721 (contracts lane) under parent PRD-650; PRD-671/672 are historical labels

Concurrent agents share this repository. Stay inside this lane's named paths, preserve unrelated
working-tree changes, and do not switch branches from another session's primary tree.

## Validation receipt

- Tested implementation/settlement integration tree: PR #694 merge `c60b38dea` plus the accepted
  post-merge Credit integration in PR #695 `bff3b274d`.
- Receipt refreshed: 2026-08-11 on Phase A base `7a9c7ee`.
- Merge proof: `git merge-base --is-ancestor c60b38dea origin/develop` returned success after a
  fresh fetch; live PRD-721 was re-read as Done.
- Accepted behavior proof from the merged range: the full contracts target passed 1,975 Solidity
  tests and 104 script tests; build, size, storage-layout, lint, audit, source-structure, ontology,
  format, and read-only settlement-lane gates passed as recorded in the merged handoffs.
- Proof limit: this receipt closes the implementation lane. It is not fresh Phase A deployment,
  dry-run, artifact-recovery, or broadcast evidence.

## Inputs

`status.json` is authoritative for lane readiness. PRD-557, PRD-747/748, PRD-757/759, PRD-762,
and the PRD-649 architecture fine-comb are recorded there as cleared; they are historical inputs,
not current blockers. The remaining dispatch gates are the corrected-source merge to `develop`,
the authorized live Linear convergence write plus re-read, and explicit user dispatch. Before
those process gates clear, this handoff may be reviewed but must not self-dispatch.

- Corrected-and-merged PR #649 with Envio `3.2.1` generation/build/test/migration proof remains a
  prerequisite for the **indexer** lane. It does not block the first contracts PR's isolated
  bounds harness and RED interface tests once this contracts lane is explicitly dispatched.
- Decision #44's selected protocol fallback is part of the initial ABI: one write-once
  `protocolPoolId`, per-commitment `protocolFallbackEnabled`, local-first
  `ConfirmationPath`, and explicit `CommitmentFulfilled` confirmer/path/reason provenance.
- contract-spec.md, especially sections 5-8 — including the 2026-08-01 CPP-alignment amendment
  (decisions 16-17): the `declaredUnitValue`/`declaredValueBasis` pair with `setDeclaredValue` +
  `ValueDeclared`, and the `counterCommitmentId` creation-time reference with its
  existence/same-pool/non-self errors. Both are additive creation-fact fields with no
  state-machine change; `CommitmentCreated` carries all three new params.
- The second 2026-08-01 amendment and canonical decision 18: implement only
  `acceptExchange(uint256 exchangeCommitmentId)` plus `ExchangeAccepted` and the named exchange
  errors. Section 6.1 is the exact semantics source: B references A, only A's creator calls,
  and B must have been created directly rather than by a steward through
  `StewardCaptured` / `onBehalfOf`. `createCommitment` atomically validates A's Offered,
  Individual, distinct-creator, and exact-reservation predicates before allocating/storing B or
  registering B's class; the UI preflight is not the safety boundary. Those two direct creator
  actions bypass both claim-mode operator paths. Offer×Offer and Individual×Individual are
  mandatory, cycle and identity predicates run, and both full immutable-quota classes must remain
  Committed to their creators. Claimant identities cross while provider identities do not:
  A's creator remains A's lead/registry account and B's creator remains B's. Acceptance does not
  recommit either class or reapply provider-cap headroom; cap checks run only when `commitUnits`
  reserves a new slot. Emit one `ContributorAdded` lead event for A's creator on A and one for B's
  creator on B in the same atomic transaction. `ExchangeAccepted` carries non-indexed
  `poolId` so its marker is self-describing without an RPC read, and the ordinary lifecycles never
  couple after acceptance. The architecture brief does not authorize the
  transferable/multilateral layer.
- [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796), Decision Log
  #51–#53/register #86–#88, and `exchange-architecture-brief.md` freeze the later
  compatibility boundary without expanding this lane. Keep initial registry
  `classId == commitmentId`; keep `commitmentSeriesId` as the pool-scoped Offer-over-time
  identity; add no `voucherClassId`, voucher event, adapter router, backing receipt, issuance,
  redemption, venue, custody, capacity-backed, or federation surface. The existing reserved
  Pool fields remain disabled. G$ support remains separate from voucher redemption.
- settlement-spec.md, which holds the canonical `validateRecognitionSnapshot` hash preimage this
  lane must implement: `recognitionSnapshotHash = keccak256(abi.encode(block.chainid,
  commitmentId, recognitionEntries))` (`settlement-spec.md` §3.1.3, mirrored into contract-spec
  §6.1). Every off-chain caller — SettlementModule payout-plan creation and Hypercert
  composition — reproduces that exact encoding, so the on-chain view may not invent a different
  domain separator.
- acceptance-matrix.md for canonical identity, permissions, payout, and final state proof
- packages/contracts/AGENTS.md and the approved append-only schema policy
- Existing ActionRegistry, GardenToken, WorkApprovalResolver, UUPS, deploy.ts, and storage-layout patterns
- Current deployment artifacts for Ethereum Sepolia and Arbitrum One, plus the additive
  Arbitrum Sepolia dependency/artifact path required by the spec

## Outputs

- An in-place upgrade of the existing AssessmentResolver for the AssessmentV3 schema, plus the
  NET-NEW TestimonyResolver and approved additive schema-registration targets.
- CommitmentPoolingModule and non-transferable CommitmentRegistry with exact structs, enums, errors, events, indexes, storage gaps, pause rules, and bounded loops.
- The module's 35th named storage entry is write-once `protocolPoolId`; the 36th is the non-zero
  initializer-fixed `rootGarden`; slot 37 is the creator-scoped commitment creation-key mapping
  and slot 38 is the caller-scoped Work-link operation mapping (`__gap[12]`).
  `registerPool(..., Protocol)` requires the exact
  root before any pool/protocol ID write. The series
  amendment adds `nextCommitmentSeriesId`, `commitmentSeries`, and the holder-scoped
  `seriesIdByCreationRequest` idempotency mapping before it. The first
  module-owner exact-root `PoolType.Protocol` registration sets `protocolPoolId`; a wrong root
  reverts `ProtocolGardenMismatch`, and a second Protocol registration reuses
  `PoolExists(existingProtocolGarden)`. The deployment wrapper supplies the artifact-verified
  root GardenAccount to `initialize(owner, rootGarden)`; no chain address is hardcoded in the
  implementation.
- GardenToken and WorkApprovalResolver wiring, isolated deploy targets, append-only artifact persistence, and post-deploy/indexer update hooks.
- Contract tests and deployment-script tests that become the frozen ABI/event source for indexer and shared lanes.
- The `421614` toolchain that every `--network arbitrum-sepolia` command below depends on and
  that does not exist today: an `arbitrum-sepolia` / `421614` record in
  `packages/contracts/deployments/networks.json` (which currently holds only mainnet, sepolia,
  localhost, arbitrum, celo) plus its RPC/NetworkManager and `.env.schema` wiring; the
  `packages/contracts/deployments/421614-latest.json` artifact path; an extended
  `script/DeployBadgeSchema.s.sol` `_getNetworkName` chain map, which today reverts
  `UnsupportedChain(421614)` (`:65-76`); and an explicit `421614` posture in
  `script/utils/release-gate.ts`, which today pins only `SEPOLIA_CHAIN_ID = "11155111"`.
- The `upgrade.ts` sender contract, also NET-NEW: `--sender` becomes mandatory on every
  transaction plan and is validated against the live proxy `owner()` before plan persistence.
  Today the flag is optional, falls back to `process.env.SENDER_ADDRESS`, persists
  `sender: null` (`script/upgrade.ts:425`), and `owner()` is never read anywhere in the script.
  The grouped `commitment-pooling` upgrade target is likewise NET-NEW and ships with its own
  check that GardenToken and WorkApprovalResolver report the same live owner before one plan
  persists.
- Mainnet transaction planning fails closed unless the verified target owner is the protocol
  3-of-5 Safe. A human-authorized ownership-transfer plan may start from the observed deployer EOA,
  but it must be isolated, name every touched proxy, and verify Safe ownership before any upgrade,
  schema/module activation, or unpause plan can persist. Release evidence additionally binds the
  repository's external-audit, 48-hour timelock, two-week testnet-operation, and tested-rollback
  gates; this lane adds no tier waiver.
- `packages/contracts/test/CommitmentPoolingBounds.t.sol`, the NET-NEW Foundry gas/payload
  benchmark harness that selects every `MAX_*` constant.

## Acceptance

- Empty confirmer rules resolve to Offer recipient or Request creator; when that party is a
  GardenAccount the module resolves it to the claiming garden's operator/owner Hat wearers and
  accepts those addresses as direct callers, never an ERC-6551 `execute` and never the
  GardenAccount address itself. Named inputs are bounded by the measured `MAX_CONFIRMERS`
  (planning target 32) before mutation; `threshold == 0` with a non-empty named list rejects
  `InvalidConfirmerRule` before any mutation; duplicates never change the stored threshold, which
  stays the caller-supplied value and is validated at acceptance against the de-duplicated
  eligible count. `protocolFallbackEnabled` is false unless explicitly selected at creation or
  through the pre-acceptance `setConfirmerRule`; enabling before `protocolPoolId` exists reverts
  `ModuleNotReady`. An unreachable ordinary rule rejects when the flag is false and satisfies the
  structural Ready predicate when it is true. Every active contributor is excluded from ordinary,
  named-group, local fallback, and protocol fallback confirmation. Local current-pool Hats are
  checked before current protocol-pool Hats, so a dual-role caller records `PoolFallback`; an
  opted-in protocol-only caller records `ProtocolFallback`; module ownership alone records
  neither. `ConfirmerRuleSet` emits the opt-in and `CommitmentFulfilled` emits the confirmer,
  `ConfirmationPath`, and reason.
  RED covers 8/16/24/32 benchmark sizes plus max-plus-one at the selected bound, zero-threshold,
  duplicate-heavy, contributor-filtered, threshold-after-filtering, Garden-claimed wearer
  confirmation, GardenAccount-caller rejection, missing protocol-pool registration, flag-off
  structural rejection, flag-on structural success, local/protocol/dual-role provenance, mandatory
  fallback reason, contributor exclusion on both fallback paths, and module-owner-only rejection.
- `submitForConfirmation` accepts the counterparty, creator, accountable lead provider, or
  steward. The lead is explicitly included so a Garden-claimed Request — whose counterparty is an
  uncallable GardenAccount — is still submittable by the human who did the work; submitting is
  not confirming and the lead stays excluded from every confirmation path.
- Pending claims store canonical claimant, authenticated requestedBy, immutable claim type, provider garden context, requested time, and active state. Runtime kind must equal the creation-time claim type. Acceptance consumes the canonical claimant-keyed terms; decline clears only that request; terminal pre-acceptance cancel/expiry are emitted for deterministic indexed supersession.
- Disputes store pre-dispute state and RestorePrevious restores it. An expired commitment can
  never resolve Fulfilled, and a contributor-steward cannot select the direct Fulfilled result
  because the same `SelfConfirmation` invariant applies.
- A pool permits one open Season and concurrent Campaigns through bounded O(1) checks.
  `Cycle.liveCommitmentCount` increments after successful cycle-scoped creation, decrements once
  on every live-to-Fulfilled/Cancelled/Expired transition, and must be zero before `closeCycle` or
  `cancelCycle`. Raising a dispute from Expired re-increments the count because Disputed is live;
  restoring Expired or resolving Cancelled decrements it exactly once, and Expired can never
  resolve Fulfilled. Tests include Offered/Requested commitments, which count as live before
  acceptance; Requested rows can keep `liveCommitmentCount` above provider-capacity
  `openCommitmentCount` before any provider is resolved, plus
  `Expired -> Disputed -> RestorePrevious/Cancelled`.
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
  requires the complete six-address/four-UID configuration. `CommitmentRegistry.setModule`
  permits the initial zero → non-zero wiring only; later replacement requires the current module
  paused and emits exact old/new without touching accounting state. The frozen
  mainnet release plan additionally proves the external audit has no unresolved critical/high
  finding, every touched UUPS/admin owner is the protocol 3-of-5 Safe, the 48-hour timelock and
  two-week testnet-operation requirements passed, and rollback was tested before any broadcast or
  activation step is authorized.
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
  counterparty`; Garden-claimed `Request -> authenticated Open caller or consumed ApprovalGated
  pending claim.requestedBy`, while the GardenAccount remains counterparty and provider scope)
  and is the only unit account and open-commitment-count subject. The active contributor roster
  begins with that lead, preserves Work/evidence attribution, freezes roster and credit
  accounting before confirmation, and is wholly excluded from confirmation. Garden claims use
  gardeners/operators of `providerGarden`; `addContributor` applies the same resolved
  provider-garden membership predicate as self-join and Work attribution, so a lead/steward
  cannot add an arbitrary external address. Tests prove an eligible member succeeds and a
  non-member reverts before roster, confirmer, credit, or event mutation. A creator who operates
  a GardenAccount cannot request their own commitment through that garden: `claimCommitment`
  checks both canonical claimant and authenticated requester, and `acceptClaim` rechecks the
  stored ApprovalGated requester before mutation. Before register or roster mutation, every
  resolved lead must also pass the current `providerGarden` membership predicate; tests cover an
  Offer creator who lost their Hat and an ineligible StewardCaptured `onBehalfOf`.
  UID 0 remains valid through the concrete ActionRegistry ABI. Celo G$ payout derivation belongs
  exclusively to `SettlementModule`: the **payer** garden Safe is payer — the pool garden for a
  Request, the claiming garden for an Offer, equal to the provider garden only for garden-internal
  commitments (register #90) — the plan names an explicit
  retained amount, and each non-zero eligible contributor allocation becomes a child disbursement.
- `DeclaredConsideration` carries `ConsiderationRail { None, ArbitrumExternal, CeloSettlement }`. Zero consideration
  requires `None` plus zero source/token/amount; `recordConsiderationPaid` accepts only
  `ArbitrumExternal`, so a Celo settlement declaration cannot also be recorded on the external
  rail. `CeloSettlement` accepts a non-zero amount with zero source/token sentinels; pooling has
  no canonical-token dependency, and SettlementModule exclusively derives its write-once
  `gDollarToken`.
- Commitment creation rejects an empty exact unit label and zero target. The register's per-class
  accounting state enforces only `Registered -> Committed -> Released|Fulfilled`; commit accepts
  exactly the full non-zero quota, and release/fulfillment accept exactly the full live committed
  balance. Offer creation commits the creator's class and increments
  `providerOpenCommitmentCount` exactly once; Offer acceptance performs no second register
  mutation. Request creation remains Registered, and Request acceptance commits the resolved
  provider class and increments the count exactly once. Fulfillment, accepted cancellation, and
  accepted expiry release exactly one slot once.
  Partial, zero, repeated, wrong-account, and terminal-state register calls revert before any
  balance or count mutation. Pre-acceptance Offer cancel/expiry releases its committed class and
  slot; pre-acceptance Request cancel/expiry changes no balance or slot. Dispute entry/restoration
  makes no register call and preserves any committed slot.
- Pre-acceptance cancellation is available to the creator or steward; after acceptance only the steward may cancel. Work links are added by an active contributor, the lead provider, or the steward, never by an unrelated counterparty or inactive creator. Register class quota is immutable and `setProviderOpenCommitmentCap` changes go through the module's steward-gated forwarder.
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
  before `CommitmentCreated`, because the three unit events also carry `address indexed account`.
  `ClassRegistered` carries no account, so it writes only the class row and the placeholder pool
  and exact-label rows its keys imply plus the recorded `quota`. It never writes a
  `CommitmentProviderExposure` row — that entity is keyed `chainId-poolId-lowercaseProvider`, and
  `ClassRegistered` itself carries no provider. For an Offer the immediately following
  `UnitsCommitted` names the creator and creates the exposure row; for a Request the first
  `UnitsCommitted` arrives only when acceptance resolves the provider. `ClassRegistered`
  mutates no `expectedUnits`, open, or fulfilled total and no open-commitment count, so a class
  registered for an unaccepted Request reads as a known label with zero units. Expected/open units
  move only on `UnitsCommitted`. `cycleId == 0` means no cycle-scoped row.
- `recordConsiderationPaid(commitmentId, payoutRef)` derives and emits stored source/provider recipient/token/amount; callers cannot override earned-consideration facts.
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
- TestimonyResolver implementation/proxy deployment uses deterministic versioned CREATE2
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
  test/unit/CommitmentRegistry.t.sol; include write-once Accepted-and-unfrozen assessment
  attachment (replacement and post-freeze rejection), contributor-steward direct-dispute
  Fulfilled rejection, Garden-Request `requestedBy` lead accounting, creator-operated Garden
  rejection in both Open and ApprovalGated modes (including acceptance-time revalidation),
  non-zero initializer root, wrong-root Protocol registration reverting before pool/protocol ID
  mutation, direct Offer-B exchange creation, steward-captured/on-behalf B rejection, stale A
  changing before B mining with zero B/class/event residue, acceptance-time direct-B
  defense-in-depth, and two exchange acceptances sweeping pending request indexes even when
  neither counterpart creator has a matching request row,
  evidence-only `requirements.length == 0`, one evidence-derived recognition credit per
  contributor across multiple distinct CIDs, stale catch-up omission before mutation, unlink
  after effective rejection, current provider-garden eligibility for Offer/StewardCaptured
  leads, live count including Offered/Requested, and non-Reconciled/cycle-less
  Hypercert-composer rejection while recognition validation remains available for payout
  defaults. Run them before implementation
  and record the expected behavioral failures.
- GREEN: run the same files after the minimum implementation, then storage, script, and full contract checks.

## Exact Bun commands

`CommitmentPooling.t.sol`, `CommitmentRegistry.t.sol`,
`TestimonyResolver.t.sol`, and `CommitmentPoolingBounds.t.sol` do not exist yet; each is
an intentional to-be-created
RED-first deliverable. The existing `AssessmentResolver.t.sol` is extended with the in-place
upgrade and dual-schema cases. `WorkApprovalResolver.t.sol` and `StorageLayout.t.sol` are
existing regression surfaces.

- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentRegistry.t.sol
- bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/AssessmentResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/TestimonyResolver.t.sol
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
readiness plan passes. `backfill-pools.ts` runs only after that verified unpause. It registers the
root as Protocol exactly once, enumerates the verified 13-garden set, records the normalized root
as `SKIPPED_PROTOCOL_ROOT`, and submits Garden registrations only for the 12 non-root addresses.

Every `--network arbitrum-sepolia` line below is unrunnable against the current tree and stays
unrunnable until this lane ships the `421614` toolchain named in Outputs: the networks.json
`arbitrum-sepolia` record, the `421614-latest.json` artifact path, the `DeployBadgeSchema.s.sol`
chain-map extension, and the `release-gate.ts` `421614` posture. Do not treat any of them as
existing infrastructure.

- bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --dry-run --pure-simulation
- bun script/upgrade.ts assessment-resolver --network arbitrum-sepolia --tx-plan --sender <verified-421614-assessment-owner>
- bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --dry-run
- bun script/deploy.ts commitment-pooling --network arbitrum-sepolia --dry-run
- bun script/deploy.ts commitment-schemas --network arbitrum-sepolia --finalize-community-testimony --dry-run
- bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network arbitrum-sepolia --tx-plan --sender <verified-421614-pooling-upgrade-owner>
- bun script/upgrade.ts assessment-resolver --network arbitrum --dry-run --pure-simulation
- bun script/upgrade.ts assessment-resolver --network arbitrum --tx-plan --sender <verified-arbitrum-assessment-owner>
- bun script/deploy.ts commitment-schemas --network arbitrum --dry-run
- bun script/deploy.ts commitment-pooling --network arbitrum --dry-run
- bun script/deploy.ts commitment-schemas --network arbitrum --finalize-community-testimony --dry-run
- bun script/upgrade.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network arbitrum --tx-plan --sender <verified-arbitrum-pooling-upgrade-owner>
- bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

**The two Arbitrum One `--tx-plan` lines are future-only and must not be run yet.** Two independent
reasons:

1. `contract-spec.md` §6.1's ownership gate. The live proxies currently report deployer EOA
   `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6` as `owner()`, but that address is valid **only** for
   the isolated, human-authorized ownership-transfer plan. Every other mainnet plan resolves its
   sender from the verified protocol 3-of-5 Safe.
2. `upgrade.ts` cannot yet enforce that. Today it accepts `--sender` optionally, silently falls back
   to `process.env.SENDER_ADDRESS`, persists `sender: … ?? null` (`script/upgrade.ts:424`), and
   never reads `owner()`. An unsubstituted placeholder therefore does not fail closed — it persists
   whatever the environment happens to hold, which is exactly the EOA this gate excludes.

Both lines unblock only after this lane ships the sender preflight named in Outputs: `--sender`
mandatory, validated against the live proxy `owner()`, and rejecting missing, placeholder, and
mismatched values **before** plan persistence.

For a live chain, the commands execute in the listed dependency order, with a separately
authorized receipt, post-action verifier, and persisted artifact between stages:
AssessmentResolver upgrade → schema preparation → module/register deployment → Community
Testimony finalization with pooling still paused → grouped GardenToken/WorkApprovalResolver
upgrade and reverse wiring while paused → complete readiness verification → pooling unpause →
root Protocol registration → 13-garden enumeration with root skipped → 12 non-root Garden
registrations → operational smoke. The full sequence is rehearsed on local and Arbitrum Sepolia
first. Every tx-plan sender
must equal the relevant live proxy `owner()` before plan persistence; the grouped upgrade fails
unless both proxies share that verified owner. That is the contract this lane builds, not current
behavior: `upgrade.ts` today accepts `--sender` optionally, falls back to
`process.env.SENDER_ADDRESS`, persists `sender: null`, and never reads `owner()`.
After verified module/register deployment, run
`commitment-schemas --finalize-community-testimony --dry-run`; it must source the module from the
deployment artifact and prove UID pin -> exact registry reconciliation -> module activation,
including the allowed empty-record/zero-module, exact-record/zero-module, and
exact-record/exact-module retry states. It rejects module-before-UID, module-before-record, and
every conflicting state. Broadcast remains outside this handoff.

## Bounded-constant benchmark results

> **PRODUCTION BOUNDS FROZEN — 2026-08-05:** Afo authorized the specification-frozen production
> paths before the final bounds freeze. The exact paths and canonical events were measured at
> 8/16/24/32/40, and all five explicit `pure` getters now reconcile to the selected value 40.
> The superseded synthetic values remain only in git history and must not be consumed. This work
> performed no broadcast or live chain-state mutation. See
> `reports/contracts-impl-2026-08-05.md`; the separate branch-mirror blocker is recorded in
> `reports/contracts-blocker-2026-08-05.md`.

The table below records the largest transaction gas and largest canonical event-data payload in
each named real-module path from
`bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`.

The 2026-08-05 authorization supersedes the ordering below only for the production benchmark:

1. Add the RED ABI/storage/event tests plus `CommitmentPoolingBounds.t.sol`.
2. Implement the specification-frozen bounded module paths without treating the provisional value
   as a final ABI bound.
3. Run and record the 8/16/24/32/40 production-path matrix with canonical events.
4. Freeze all five measured values in this table and in the explicit `pure` ABI getters. No
   downstream lane may copy the provisional planning targets.

| Bound | 8 | 16 | 24 | 32 | 40 | Selected | Rejection reason for the next size |
|---|---|---|---|---|---|---|---|
| `MAX_REQUIREMENTS` (create / approval credit / Ready eval / event payload / replay) | 1,242,130 gas / 1,920 B | 1,873,097 gas / 2,688 B | 2,504,598 gas / 3,456 B | 3,136,637 gas / 4,224 B | 3,769,213 gas / 4,992 B | **40** | 48 is outside the authorized measured matrix, so it has no cold-transaction vector proof. |
| `MAX_LINKED_WORKS_PER_COMMITMENT` (link / freeze-time full-set scan) | 168,032 gas / 128 B | 170,870 gas / 128 B | 230,239 gas / 128 B | 289,608 gas / 128 B | 348,978 gas / 128 B | **40** | 48 is outside the authorized measured matrix, so it has no cold-transaction vector proof. |
| `MAX_CONTRIBUTORS_PER_COMMITMENT` (end-to-end create → finalize vector) | 166,137 gas / 448 B | 194,515 gas / 704 B | 288,197 gas / 960 B | 396,023 gas / 1,216 B | 517,992 gas / 1,472 B | **40** | 48 is outside the authorized measured matrix, so it has no cold-transaction vector proof. |
| `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` (attach / event payload) | 114,980 gas / 448 B | 194,515 gas / 704 B | 288,197 gas / 960 B | 396,023 gas / 1,216 B | 517,992 gas / 1,472 B | **40** | 48 is outside the authorized measured matrix, so it has no cold-transaction vector proof. |
| `MAX_CONFIRMERS` (creation / acceptance dedupe / roster-mutation revalidation) | 767,941 gas / 1,024 B | 960,070 gas / 1,024 B | 1,152,133 gas / 1,024 B | 1,344,270 gas / 1,152 B | 1,536,424 gas / 1,408 B | **40** | 48 is outside the authorized measured matrix, so it has no cold-transaction vector proof. |

Re-measured 2026-08-05 on commit `4256623d0` with Solc 0.8.28 through the exact Bun-wrapped
`test/CommitmentPoolingBounds.t.sol` command. The harness has 60 operation-specific cases. Each
case prepares a fresh proxy/module dependency graph and specification-valid production state in
Foundry `setUp`, then measures exactly one top-level test transaction with a fresh access list.
Gas is the largest cold transaction among the named operations; payload bytes come from the actual
canonical module logs emitted by those calls, not a synthetic `abi.encode` estimate. All measured
cells remain below 10,000,000 gas and 16,384 event-data bytes, so the largest authorized measured
size remains selected and all five `pure` ABI getters remain 40; unmeasured size 48 remains
rejected.

The payload column is deliberately limited to the exact canonical fixture strings used by the
harness. `unitLabel`, metadata/evidence/reason CIDs, and declared-value basis are frozen dynamic
`string` ABI fields for which the specification defines non-empty validation but no maximum byte
length. Therefore this table proves the bounded-vector contribution to canonical event payloads;
it does **not** claim a finite global worst-case payload ceiling for arbitrary caller strings. No
new string cap or ABI error was invented during this correction.

## Out of scope

- SettlementModule implementation, Celo execution, bridged G$, transferable-voucher implementation
  or adapter activation, backing receipts, issuance, seed inventory, redemption, venue custody,
  capacity-backed issuance, federation, CreditRegistry, raw Celo indexing, Sarafu integration, UI,
  and any broadcast.
- Editing existing production schema definitions or using bulk --update-schemas.

## Unblock evidence

Current initial-deploy architecture/specification evidence is complete: the corrected handoff and
exact interface/event/storage tables are present, contributor-share and protocol-funding decisions
are closed, and the architecture fine-comb is reconciled. The full-pool compatibility freeze adds
no initial ABI/storage. PRD-796 must be accepted before this lane is deliberately dispatched. Do
not turn its future stages into PRD-721 deliverables.

Before **starting the first contracts PR**:

- The corrected sources merge to `develop`.
- The authorized live Linear convergence write and re-read completes.
- `status.json` is updated from that live evidence and the user explicitly dispatches PRD-721.

During the **first contracts PR**, before bounded module behavior is called GREEN:

- RED ABI/storage/event tests and the bounds harness land first.
- The 2026-08-05 authorized 8/16/24/32/40 table above is measured and all five values are frozen;
  this supersedes the historical four-size wording in the 2026-07-28 amendment below.
- Standalone schema-registration and isolated deployment targets gain their specified dry-run
  acceptance.
- The two Arbitrum Sepolia post-deploy verifier targets and the `421614` network record land before
  any broadcast.
- GREEN includes the same tests plus storage/deploy evidence. PR #649 remains the indexer cut-in
  prerequisite, not a reason to leave the contract ABI unspecified.

## Binding architecture amendment — 2026-07-28

- Replace the single-provider fulfillment model with one accountable `leadProvider` plus a contributor roster. Only the lead consumes the non-transferable register slot; every roster member is excluded from confirmation.
- Accept repeatable `CommitmentRequirementInput` rows containing only `actionUID` and `requiredCount`; derive stored `domain` and `approvedCount` inside the module. There is no four-requirement product rule; set `MAX_REQUIREMENTS` only from the named gas/indexer benchmark.
- That benchmark is one named NET-NEW Foundry harness,
  `packages/contracts/test/CommitmentPoolingBounds.t.sol`, sitting beside the existing top-level
  `test/GasBenchmarks.t.sol` and `test/StorageLayout.t.sol`, and run as
  `bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`. It
  measures all five bounded vectors — `MAX_REQUIREMENTS`, `MAX_LINKED_WORKS_PER_COMMITMENT`,
  `MAX_CONTRIBUTORS_PER_COMMITMENT`, `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT`, and
  `MAX_CONFIRMERS` — at the superseding 8/16/24/32/40 matrix, for creation, approval credit, Ready
  evaluation, measured canonical-fixture event payload, and replay cost. The result table is
  recorded in this handoff, above, and no constant may be frozen before that table exists.
- Reject a DomainImpact requirement-total above the separately measured
  `MAX_LINKED_WORKS_PER_COMMITMENT`; the active Work array is the authoritative enumerable
  readiness set, so creation must never accept a quota that the link bound makes unfulfillable.
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

- Implement the 38-feature-slot Commitment Pooling declaration order and `__gap[12]`, including
  `nextCommitmentSeriesId`, `commitmentSeries`, the holder-scoped
  `seriesIdByCreationRequest` idempotency mapping,
  `workRequirementIndexPlusOne`, `workCreditActive`, and the latest resolver-owned Work decision
  sequence plus audit UID, the bounded enumerable active Work set, and the write-once
  `protocolPoolId` followed by initializer-fixed `rootGarden`,
  `commitmentIdByCreationRequest`, and `workLinkPayloadHashByOperation`, but treat the generated compiler
  baseline plus concrete
  slot/offset assertions as authoritative.
- `attachEvidence` rejects an empty or repeated exact CID, requires a non-empty unique
  measured-bounded credited list, and may mutate recognition credit only while the commitment is
  Accepted and unfrozen. `evidenceCount` still records every distinct evidence object, but each
  contributor's first attribution alone changes `evidenceCredits` from 0 to 1 and increments
  `totalVerifiedCredits`; later CIDs remain provenance without multiplying recognition. A queued
  job that lands after freeze fails without a partial write. `isEligibleContributor` additionally
  requires `Fulfilled`.
- The provisional evidence-recipient bound is 32 only until the required 8/16/24/32 benchmark in `test/CommitmentPoolingBounds.t.sol` selects the transaction-safe value and its result table is recorded here. It is not a semantic team-size cap.
- `MAX_CONTRIBUTORS_PER_COMMITMENT` is the measured end-to-end vector bound (provisional 32);
  add/join reject max-plus-one before mutation. Open contributors may self-leave only before
  freeze with zero linked Work and zero credit; neither the lead, a credited contributor, nor a
  contributor with uncounted linked Work may leave/be removed. `ContributorRecord` carries the
  O(1) `uncountedLinkedWorkCount`: link increments, Accepted-and-unfrozen unlink decrements, and
  the first countable approval decrements exactly once.
- Every `createCommitment` requires a non-zero creator-scoped `creationRequestKey`, stores the
  resulting ID and the **frozen** `creationPayloadHash` preimage defined in contract-spec §6.1
  "Creation payload hash (frozen preimage)", returns the original ID without mutation/event
  on exact replay, and rejects conflicting key reuse. Pool `liveCommitmentCount` increments once
  per successful creation and follows the same reversible live/terminal transition helper.
  `closePool` requires that count and `nonTerminalCycleCount` to both be zero.
- **`CommitmentCreated` emits `creationPayloadHash`** (amendment 2026-08-05). This is not optional
  telemetry: the indexer's `Commitment.creationPayloadHash` has no other legal source, because
  handler RPC backfill is prohibited. Implement the preimage byte-for-byte as specified —
  every `CreateCommitmentParams` member once in declaration order, dynamic members pre-hashed,
  `creator`/`creationRequestKey` excluded, `domainTags` hashed as submitted rather than derived,
  and the effective (empty-list-forced-to-1) confirmation threshold. Add a unit test asserting the
  emitted hash equals the value later returned by `getCommitment`, and a second asserting that a
  same-key resend of a byte-identical payload reverts nothing and emits nothing while a
  single-field change reverts `CommitmentCreationRequestConflict`.
- `linkWork(commitmentId, workUID, requirementIndex, operationKey)` binds a repeated action to one exact row and
  stores index-plus-one. `WorkApprovalResolver` forwards both approved and rejected decisions.
  The non-zero caller-scoped operation key stores the exact link payload hash; replay is a no-op
  even after a later unlink, and conflicting reuse reverts.
  `approvalCounted` makes each decision-attestation delivery idempotent; WorkApprovalResolver
  assigns and persists a monotonic per-Work sequence in EVM execution order, including same-block
  transactions, and the greatest non-zero sequence is the deterministic effective decision.
  Before freeze,
  approval activates the exact requirement/contributor credit and a newer rejection reverses it;
  repeated same-state or older decisions do not double-mutate. A sequence-zero historical
  decision rejects catch-up and requires re-attestation. Before mutation, catch-up must prove the
  greatest supplied sequence for every included Work equals the resolver's current public
  maximum and apply only that current decision. Before any readiness or direct-fulfillment
  freeze, enumerate the complete bounded active Work set and require every stored sequence to
  equal the resolver maximum; omitting stale Work A while syncing Work B reverts without credit
  or freeze. After freeze, decisions are
  observed but cannot mutate credit, requirements, units, or recognition.
  The active contributor, accountable lead, or resolved pool steward may link after all shared
  validation; only the steward may unlink, and unlink is Accepted-and-unfrozen with current
  `workCreditActive == false`, including after an effective rejection despite a historical
  delivered approval UID.
- Every Ready transition and a direct `Disputed -> Fulfilled` resolution require at least one
  pre-freeze verified credit (`totalVerifiedCredits > 0`) plus either the cycle's opened
  recognition policy or the
  immutable cycle-less 20/80 default. The direct dispute path freezes and validates the roster
  before emitting the Fulfilled resolution, and rejects the resolving steward when that address
  is a current or frozen contributor.
- Each non-zero-cycle commitment increments `Cycle.liveCommitmentCount` after successful
  creation; each live-to-Fulfilled/Cancelled/Expired transition decrements exactly once. Ready and
  disputes raised from live states preserve the count; Expired-to-Disputed re-increments it, and
  that dispute's RestorePrevious(Expired) or Cancelled resolution decrements once.
  `closeCycle` plus `cancelCycle` require the O(1) count to be zero.
- Garden-claimed Requests use the authenticated Open `claimCommitment` caller or the consumed
  ApprovalGated pending claim's stored `requestedBy` as the accountable lead while retaining the
  GardenAccount as counterparty/provider scope. The requester and canonical claimant are each
  checked against creator, and `acceptClaim` rechecks the stored requester. Garden pools reject
  institutional claims, and a protocol garden cannot target itself as the institutional claimant;
  both open and approval-gated attempts fail before accepted/pending state. CeloSettlement
  declarations require zero source/token sentinels; SettlementModule derives its configured G$
  token and immutable payer-garden Safe, and separately freezes an external beneficiary Safe for
  a Garden-claimed Request.
- Maintain eligible-contributor/verified-credit totals and expose
  `validateRecognitionSnapshot`; Settlement must always use its on-chain recomputation rather
  than trust a caller-selected vector/hash. Hypercert composition uses it only for commitments
  from one non-zero cycle whose current on-chain state is exactly Reconciled; the shared composer
  rejects every other cycle state before allowlist/metadata construction.
- For the gardeners-class cross-commitment split, sort fulfilled commitment IDs ascending, assign
  the floor share to each, and give one remainder unit to the lowest IDs before applying the
  within-commitment contributor policy. Within a commitment, allocate the equal-policy bps and
  verified-policy bps in two independent passes. Finish the equal remainder pass first by
  ascending lowercase address; then finish the verified remainder pass by descending fractional
  remainder and ascending lowercase address. Add the two row results only after both passes;
  remainders are never pooled, and one contributor may receive one remainder unit from each pass.

## Binding CommitmentSeries amendment — 2026-08-02

- Read `standing-commitments-spec.md` first. It supersedes this handoff wherever older text says
  Offer capacity begins at acceptance or `acceptExchange` performs two registry commits.
- Add module-owned `CommitmentSeries`, storage entries 15, 20, and 21 in the amended layout, exact
  errors/events/functions, holder-scoped creation-request replay, direct-holder
  Active/Resting/Retired lifecycle, and validated `commitmentSeriesId` on
  Commitment/Create params/creation event.
- A non-zero series reference is Active, same-pool, current-holder-authored, Individual Offer,
  with zero `onBehalfOf`. `0` preserves one-shot behavior. No holder mutation or other succession
  verb ships initially.
- Offer creation registers and commits its exact class against the creator, reserving the provider
  slot through Offered and Accepted. Offer acceptance and `acceptExchange` do not recommit.
  They verify the existing full reservation without reapplying provider-cap headroom; a later cap
  reduction constrains only a new reservation and cannot strand an existing Offer.
  Requests remain Registered until provider acceptance. Cancel/expiry/fulfillment release only
  when the direction/state currently owns a committed class.
- RED proof must cover zero creation key, exact replay returning one ID with one increment/event,
  a still-pending first submission followed by the same-key call, same-holder key reuse with a
  different pool/initial metadata reverting, and independent holders safely reusing the same
  key. It must also cover unknown/wrong-pool/non-holder/resting/retired/request/garden/on-behalf-of
  references, prospective metadata, no instance mutation on series lifecycle, cap exhaustion at
  Offer creation, unaccepted Offer release, unaccepted Request no-op, no double count at claim or
  exchange, and exact storage/ABI/event layout.
