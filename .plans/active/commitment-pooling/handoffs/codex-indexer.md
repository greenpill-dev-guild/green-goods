# Commitment Pooling - Codex Indexer Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: indexer
- Owner: Codex
- Branch signal: codex/indexer/commitment-pooling
- Current state: blocked; corrected-and-merged PR #649 and its Envio `3.2.1` proof come first,
  then core pooling indexing waits for the final architecture freeze and frozen PRD-721 events.
  Settlement indexing separately waits for frozen settlement events.
- Linear context: PRD-722 (indexer lane) under parent PRD-650; PRD-673 is historical context

## Inputs

- Exact event/config tables in contract-spec.md for the core phase; settlement-spec.md joins only in the settlement phase
- acceptance-matrix.md for indexed identity/status/public-state outputs
- Broadcast artifacts or zero-address pre-broadcast placeholders for Arbitrum One `42161`,
  Arbitrum Sepolia `421614`, Celo `42220`, and rehearsal-only Celo Sepolia `11142220`.
  Existing Ethereum Sepolia `11155111` blocks remain legacy-only and unchanged unless the
  pooling contracts are separately deployed there.
- Existing schema.graphql, config.yaml, generated operations, helpers, handlers, fixtures, Envio updater, and boundary checker
- Approved no-EAS/no-Celo-transfer indexing boundary

## Outputs

- Core phase: the ten pooling entities — pool, cycle, commitment, requirement, claim request, claim-request index, event, `NeedCommitmentIndex`, `CommitmentUnitSummary`, and `CommitmentProviderExposure` — with chainId and explicit composite relationship fields. Requests persist canonical claimant and requestedBy; pools persist the current pause reason CID; cycles persist the six-field allocation only from `CycleOpened`.
- Pool-less `ModuleUpdated`, pooling dependency/schema/pause events use the generic
  `CommitmentEvent.configurationKey/previousValue/newValue` audit fields, never a synthetic pool
  zero, and never mutate accounting entities.
- Settlement phase: Arbitrum settlement account/disbursement/batch/message entities; Celo `SettlementGardenRoute`, bounded `CeloSettlementExecutor` execution, and acknowledgment-message entities; and one chain-composite `SettlementConfiguration` singleton per source/executor chain carrying role, local contract/router, nullable remote selector, nullable verified `remoteEvmChainId`, nullable active/previous peer + expiry, protocol version, pause state, source/executor batch limit, executor transfer/aggregate/period caps, dispatcher where applicable, native-fee floor/balance/low state, peer readiness, and nullable source-only `gardenerDeliveryEnabled`.
- Source `SettlementConfiguration` additionally persists the write-once protocol garden/canonical
  G$ plus event-owned Hats and CommitmentPoolingModule dependency addresses; handlers update those
  trust roots only from their exact old/new events.
- Exact pooling blocks for `CommitmentPoolingModule` and `CommitmentRegister` on `42161` and
  `421614`; exact `SettlementModule` blocks on `42161` and `421614`; and exact
  `CeloSettlementExecutor` blocks on `42220` and rehearsal-only `11142220`. The `11142220`
  network uses explicit `rpc_config` rather than assumed HyperSync coverage. Every address is a
  deployment-artifact placeholder before broadcast and a verified persisted address afterward;
  handlers remain idempotent create-if-not-exists.
- Deployment-block configuration seeds generated from verified artifacts: every component carries
  role, local contract/router, and exact decimal-string local selector; only the verified
  production `42161`↔`42220` pair must carry the remote CCIP selector and paired remote EVM chain
  ID. Independent `421614`/`11142220` component rehearsals retain null `remoteEvmChainId`,
  `peerConfigured = false`, and no cross-chain relationship output unless a fresh official
  directory/API read publishes the exact lane/router. Mutable configuration remains event-owned,
  and any missing/rounded/mismatched required seed fails preservation.
- Corrected and merged PR #649 is a hard prerequisite. The lane targets Envio `3.2.1`, re-reads
  that version's config schema, and must not copy the v2-only `unordered_multichain_mode` flag.
  Root commands and the PR test plan remain Bun-first; generated Envio/ReScript internals may use
  the package-local pnpm pin where the tool requires it.
  Configuration rows seed from generated verified deployment constants on the first relevant
  protocol event; no imaginary deployment-block callback is assumed. Celo Sepolia uses
  `rpc_config` because HyperSync coverage is not assumed.
- Commitment-keyed request index that marks accept/decline/supersede without a database-wide scan.
- Full Garden.id migration to chainId-lowercaseAddress with replay/backfill, every foreign-key/helper/query/fixture cutover, and no mixed-ID interval.
- Nullable generic audit actor populated only from explicit event parameters, never transaction.from.
- Commitment read model persists provider, providerGarden composite relation, preDisputeState, positional requirement rows (`requirementIndex`, domain/action, required/approved counts), the per-commitment `approvedUnits` value emitted by the contract, and explicit `RewardRail` plus derived reward facts. `rewardRecipient` is the ArbitrumExternal `RewardPaid` recipient only; a Celo beneficiary lives on the settlement `Disbursement`. Hypercert persists `bundleKind`, composite fulfilled-commitment relationships, ascending unique Need UIDs, legacy Work-bundle readability, and certificate-scoped `HypercertCommitmentContributorAllocation` rows; integer recognition units never live on or overwrite the commitment contributor.
- `CommitmentUnitSummary` is keyed by `chainId-scope-scopeId-unitLabelHash`, where the hash is computed from exact stored UTF-8 label bytes. POOL and CYCLE rows keep expected, approved, fulfilled, and open units only for that exact hash; `hours` and `Hours` never merge.
- `CommitmentProviderExposure` is keyed by chain, pool, and provider and stores only the current open commitment count.
- `CommitmentCycle.liveCommitmentCount` mirrors the on-chain close/cancel guard independently of
  accepted-only exposure: non-zero-cycle `CommitmentCreated` increments it, and the first
  Fulfilled/Cancelled/Expired transition decrements it. Offered/Requested rows therefore block
  close in the indexed read model exactly as they do on-chain.
- Generated-config preservation changes and a regression fixture proving
  `CommitmentPoolingModule`, `CommitmentRegister`, `SettlementModule`, and
  `CeloSettlementExecutor` blocks survive repeated artifact updates on every applicable
  production/component-rehearsal network without turning the two Sepolia components into a peer
  pair.
- Codegen/generated artifacts, handler tests, build proof, and query contract for shared.

## Acceptance

- Every entity has chainId and a composite ID; same address on Arbitrum and Sepolia remains distinct.
- Celo routes, executions, Garden/account joins, and command/ack message directions require the
  verified configuration seed's non-null `remoteEvmChainId`; handlers fail closed when it is null
  and never translate selectors into EVM chain IDs or substitute the local Celo event chain.
- Full replay produces no raw-address Garden lookup and shared consumers are cut over to the replayed dataset.
- Handlers are idempotent, tolerate out-of-order events, update both sides of relationships, and never infer immutable creation facts from RPC.
- ApprovalGated claim acceptance consumes the stored request identity and supersedes only
  still-pending sibling requests through the companion index; Open acceptance has no request row
  and stores the emitted authenticated requester as the Garden Request lead.
- Evidence replay preserves every distinct attribution row but changes a contributor's
  `evidenceCredits` only on the first 0-to-1 transition. Multiple CIDs attributed to the same
  contributor never multiply recognition, while the first attribution to another contributor
  adds exactly one participation credit.
- A `COMMITMENT` ClaimStored replay upserts
  `HypercertCommitmentContributorAllocation` by
  `chainId-hypercertId-commitmentId-lowercaseContributor`. Reusing one fulfilled commitment in
  two Hypercerts produces distinct unit rows and never overwrites either certificate or the
  contributor's stable commitment-level `recognitionWeightBps`.
- Commitment cancellation/expiry supersede still-pending requests through the same companion index; no terminal commitment retains an actionable Pending row.
- `ApprovedWorkCounted` and `ApprovedWorkReversed` update exactly the matching
  `requirementIndex`, replace that row's cumulative count, and store the event-emitted
  per-commitment `approvedUnits`. The count event adds `newlyApprovedUnits`; the reversal event
  subtracts `removedApprovedUnits` from only the matching exact-label pool/cycle summary.
  `UnitsReleased` and `UnitsFulfilled` update only that same label hash; cumulative event values
  are never summed or re-derived.
- `CommitmentAccepted` stores the canonical claimant/counterparty/provider/providerGarden and
  resolves claim-request rows, but it never mutates count exposure. `UnitsCommitted` is the
  sole increment for pool/cycle open counts and `CommitmentProviderExposure`; `UnitsReleased`
  and `UnitsFulfilled` are the sole decrements. Fulfillment, accepted cancellation, and
  accepted expiry therefore change exposure only through the emitted register event. Dispute
  entry/restoration emits no register delta and preserves the count. Replaying any event leaves
  summaries and exposure unchanged.
- Unit events are independently self-describing with `poolId`, `cycleId`, and exact
  `unitLabel`; an event arriving before `CommitmentCreated` still produces the final canonical
  IDs. `cycleId == 0` never creates or mutates a cycle summary.
- `ModuleUpdated` creates one pool-less `CommitmentEvent` with
  `eventType = MODULE_UPDATED`, `configurationKey = null`, the normalized old/new module
  addresses in generic `previousValue`/`newValue`, and null
  pool/cycle/commitment relationships. It mutates no accounting row, never invents pool `0`, and
  never infers an actor from `transaction.from`.
- Pool/cycle entities retain state counts and expose no raw-unit aggregate fields; no handler or query adds unlike label hashes.
- Queued, Dispatched, Celo executed/acknowledgment-pending, Confirmed, authenticated execution Failed, transport-delayed, same-key command retry, acknowledgment retry, and per-member recovery remain distinguishable.
- `DisbursementCancelled` persists whether an individual cancellation came from an unbatched Queued item or from an authenticated Failed result; a failed member is never made to look like a pre-dispatch withdrawal.
- `BatchCancelled(uint256 indexed batchId,address indexed actor,string reasonCID)` atomically marks the still-Queued batch and every immutable member Cancelled-from-Queued in one replay-idempotent handler. No indexed state can present a partially cancelled Queued batch.
- `SettlementExecutionStored` records the bounded Celo executor transaction, exact authenticated acknowledgment receiver, decoded `isBatch`, settlement ID, and attempt, and derives acknowledgment-pending without waiting for an Arbitrum join. `AcknowledgmentDeferred` stores the bounded quote/reserve/send deferral code; only Arbitrum `SettlementAcknowledged(success=true)` makes canonical state Confirmed.
- `AcknowledgmentSent(...,fee,reserveFunded)` decrements the indexed CELO reserve only when `reserveFunded == true`; an exact caller-funded retry creates its message row without reducing protocol reserves. Arbitrum command sends always reduce the source reserve by their emitted fee.
- Every command/ack message row is chain-composite and replay-idempotent. Source command rows preserve the snapshotted destination peer, gas, version, and payload hash; every acknowledgment's originating command ID joins to the same execution key even when it is an older retry ID delivered out of order. Duplicate/out-of-order messages never duplicate settlement execution or make a previous peer look authoritative for a new command. Message `fee` is nullable on receipt-only rows because the destination receipt event does not emit the source-chain fee.
- `isBatch` is preserved on every source message and Celo execution record and participates in the canonical execution-key domain. Same-numbered disbursement and batch subjects never join to one command/execution row, including under inverted cross-network replay order.
- The preservation fixture runs the updater twice and retains the exact pooling/register blocks
  on `42161`/`421614`, Arbitrum route/batch-limit/pause/dispatcher/reserve/cancellation
  signatures (including `BatchCancelled`) on `42161`/`421614`, and all fourteen Celo executor
  signatures (including `FeePolicyUpdated`) on `42220`/`11142220`; unknown EAS or raw Celo
  token blocks still fail.
- The same fixture seeds the full source/executor pairing only for production from verified
  deployment metadata. It preserves independent `421614` and `11142220` component rows with null
  remote EVM identity and non-ready peer state, and rejects a missing local contract or router,
  numeric/rounded selector, wrong deployment block, contract-block mismatch, or fabricated
  Sepolia pairing.
- Envio reads only Green Goods protocol events.
- Adding direct `viem@2.55.0` requires the repository owner's explicit dependency approval at
  implementation time. It matches the root pin; Envio's internal viem version is not imported
  or treated as the application hashing API.

## RED / GREEN

- RED: `test/commitmentPool.test.ts`, `test/settlement.test.ts`, and `test/gardenCompositeIdMigration.test.ts` are explicit to-be-created first-failing deliverables; focused handler/migration/preservation fixtures fail before schema, config, helper, and handler changes.
- GREEN: the same fixtures pass after codegen; generated operations expose every entity; setup-generated, boundary, tests, and build pass.
- Generated ReScript setup runs through the exact pnpm `10.33.2` Corepack pin declared by
  `packages/indexer/package.json`. The root monorepo remains `bun@1.3.14`; no generated-workspace
  command may walk up to or replace that root package-manager declaration.

## Exact Bun commands

- bun run --filter @green-goods/indexer codegen
- bun run --filter @green-goods/indexer setup-generated
- bun run --filter @green-goods/indexer check:indexing-boundary
- bun run --filter @green-goods/indexer test -- test/commitmentPool.test.ts
- bun run --filter @green-goods/indexer test -- test/settlement.test.ts
- bun run --filter @green-goods/indexer test -- test/gardenCompositeIdMigration.test.ts
- bun run --filter @green-goods/indexer migrate:garden-ids -- --dry-run
- bun run --filter @green-goods/indexer build

The three named test files and the `migrate:garden-ids` target do not exist yet; they are intentional RED-first deliverables of this lane and must be created before their commands can pass.

## Out of scope

- EAS attestation indexing, raw Celo/G$ transfer indexing, arbitrary Celo token ingestion, contract changes, UI, Sarafu ingestion, and credit/ranking entities.
- A compatibility period with mixed raw and composite Garden IDs.

## Unblock evidence

- Corrected PR #649 is merged and its generation, build, tests, migration/replay, and block
  preservation proof pass before Commitment Pooling adds entities or handlers.
- Core dispatch then requires pooling event signatures frozen and identical between contract-spec and Envio config. Settlement handlers use the frozen Arbitrum command/ack and Celo executor signatures in settlement-spec; core GREEN must not be reported as full settlement GREEN.
- Garden replay procedure, pre-replay snapshot, switch criterion, rollback package, and accountable owner Afolabi Aiyeloja are named. The implementer produces the rehearsal; `human-release-ops.md` owns the authorized live cutover.
- Updater/boundary allowlist changes and preservation fixture are part of the lane.
- RED fixture evidence is recorded; final GREEN includes codegen, generated build, boundary check, targeted handlers, and package build.

## Binding architecture amendment — 2026-07-28

- Index `CommitmentRequirement`, `CommitmentContributor`, contributor indexes, and Work/evidence
  attribution without positional-domain assumptions. Maintain
  `CommitmentContributor.uncountedLinkedWorkCount` from WorkLinked, WorkUnlinked,
  ApprovedWorkCounted, and ApprovedWorkReversed. Track the emitted resolver-owned
  `latestDecisionSequence`, audit UID, and active-credit state from those explicit events; a
  reversal restores the uncounted-linked count and removes one
  contributor credit before freeze. The unlink handler resolves the contributor from the
  existing Work attribution row before removing it. `CommitmentEvidenceAttributionIndex` owns the
  stable IDs loaded on fulfillment; no handler scan is permitted. Evidence rows remain repeatable
  provenance, but the handler mirrors the 0-or-1 on-chain `evidenceCredits` value per contributor
  instead of incrementing it for every CID.
  `WorkUnlinked` remains valid whenever the durable attribution's current `creditActive` is false,
  including after `ApprovedWorkReversed`; a historical approval delivery marker is never used as
  current-credit state.
- Materialize the recognition inputs and deterministic gardener-share output: equal budget per
  fulfilled commitment, then the cycle's opened recognition policy or the immutable cycle-less
  20/80 default among eligible contributors. Only the frozen effective Work decision contributes.
  Expand each commitment's 10,000-bps vector into its integer unit budget using the canonical
  largest-fractional-remainder and ascending-address tie-break pass. Zero eligible contributors
  produce a blocking W26 inconsistent-state review item, never a lead fallback or metadata repair.
  Keep stable bps on `CommitmentContributor`, and persist each integer result on
  `HypercertCommitmentContributorAllocation` so every certificate owns an immutable allocation
  snapshot even when commitments are bundled again.
- Index `CommitmentPayoutPlan` and `ContributorPayout`; draft events carry no child ID, while each
  later `DisbursementQueued` binds one prepared child to its stable parent row and garden payer.
  Buffer every version-tagged `ContributorPayoutSet` row by `(payoutPlanId,
  paymentSnapshotVersion)` and atomically publish a replacement only when the trailing
  `CommitmentPayoutSnapshotCommitted` row count and payment hash match; that event owns retention,
  contributor total, version, reason, and actor without an RPC read. Recompute the hash only from
  chain ID, plan ID, version, retention, contributor total, and the ordered immutable
  `{ contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }` rows. Never hash
  disbursement IDs or child counters; there is no inclusion flag, because a row is payable
  exactly when its `amount > 0` (register #70). Keep payment weights
  amount-derived and derive parent status from finalization, unprepared payable rows, and child
  counters; do not infer payment from Hypercert weights or raw token transfers.
- Migration/replay fixtures must include solo lead, multi-person team, roster freeze at
  `ReadyForConfirmation` and direct `Disputed -> Fulfilled`, one-credit-per-Work replay, stale
  catch-up rejection before mutation, unlink after effective rejection, exact
  `liveCommitmentCount` including Offered/Requested,
  one-evidence-participation-credit across multiple CIDs, the same commitment in two
  certificate-scoped allocation snapshots, opened
  cycle policy and cycle-less default, zero-eligible inconsistent-state blocking with no metadata
  repair, version-1 untouched-plan replay with the canonical immutable-row hash, a later complete
  version replacement, child preparation that leaves the hash unchanged, incomplete or
  mismatched snapshot rejection, reasoned payment correction, all-retained zero-child finalization,
  idempotent preparation, stable pointer after child/batch cancellation, duplicate-recipient batch
  rejection, partial payout, retry, and complete payout.
