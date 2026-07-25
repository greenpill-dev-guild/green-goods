# Commitment Pooling - Codex Indexer Handoff

## Status

- Machine lane: state_api
- Execution sub-lane: indexer
- Owner: Codex
- Branch signal: codex/indexer/commitment-pooling
- Current state: two-phase — core pooling is blocked only on frozen pooling events; settlement indexing waits for frozen settlement events
- Linear context: PRD-722 (indexer lane) under parent PRD-650; PRD-673 is historical context

## Inputs

- Exact event/config tables in contract-spec.md for the core phase; settlement-spec.md joins only in the settlement phase
- acceptance-matrix.md for indexed identity/status/public-state outputs
- Broadcast artifacts or zero-address pre-broadcast placeholders for Arbitrum and Sepolia
- Existing schema.graphql, config.yaml, generated operations, helpers, handlers, fixtures, Envio updater, and boundary checker
- Approved no-EAS/no-Celo-transfer indexing boundary

## Outputs

- Core phase: the ten pooling entities — pool, cycle, commitment, requirement, claim request, claim-request index, event, `NeedCommitmentIndex`, `CommitmentUnitSummary`, and `CommitmentProviderExposure` — with chainId and explicit composite relationship fields. Requests persist canonical claimant and requestedBy; pools persist the current pause reason CID; cycles persist the six-field allocation only from `CycleOpened`.
- Settlement phase: Arbitrum settlement account/disbursement/batch/message entities; Celo `SettlementGardenRoute`, bounded `CeloSettlementExecutor` execution, and acknowledgment-message entities; and one chain-composite `SettlementConfiguration` singleton per source/executor chain carrying role, local router, remote selector, active/previous peer + expiry, protocol version, pause state, source/executor batch limit, executor transfer/aggregate/period caps, dispatcher where applicable, native-fee floor/balance/low state, peer readiness, and nullable source-only `memberDeliveryEnabled`.
- Exact Arbitrum/Sepolia contract blocks and idempotent create-if-not-exists handlers.
- Deployment-block configuration seeds generated from verified artifacts for both peers:
  role, local contract/router, exact decimal-string local selector, and remote chain identity;
  mutable configuration remains event-owned and any missing/rounded seed fails preservation.
- Commitment-keyed request index that marks accept/decline/supersede without a database-wide scan.
- Full Garden.id migration to chainId-lowercaseAddress with replay/backfill, every foreign-key/helper/query/fixture cutover, and no mixed-ID interval.
- Nullable generic audit actor populated only from explicit event parameters, never transaction.from.
- Commitment read model persists provider, providerGarden composite relation, preDisputeState, positional requirement rows (`requirementIndex`, domain/action, required/approved counts), the per-commitment `approvedUnits` value emitted by the contract, and explicit `RewardRail` plus derived reward facts. `rewardRecipient` is the ArbitrumExternal `RewardPaid` recipient only; a Celo beneficiary lives on the settlement `Disbursement`. Hypercert persists `bundleKind`, composite fulfilled-commitment relationships, ascending unique Need UIDs, and legacy Work-bundle readability.
- `CommitmentUnitSummary` is keyed by `chainId-scope-scopeId-unitLabelHash`, where the hash is computed from exact stored UTF-8 label bytes. POOL and CYCLE rows keep expected, approved, fulfilled, and open units only for that exact hash; `hours` and `Hours` never merge.
- `CommitmentProviderExposure` is keyed by chain, pool, and provider and stores only the current open commitment count.
- Generated-config preservation changes and regression fixture proving CommitmentPoolingModule, CommitmentRegister, and SettlementModule blocks survive repeated artifact updates.
- Codegen/generated artifacts, handler tests, build proof, and query contract for shared.

## Acceptance

- Every entity has chainId and a composite ID; same address on Arbitrum and Sepolia remains distinct.
- Full replay produces no raw-address Garden lookup and shared consumers are cut over to the replayed dataset.
- Handlers are idempotent, tolerate out-of-order events, update both sides of relationships, and never infer immutable creation facts from RPC.
- Claim acceptance consumes the stored request identity and supersedes only still-pending sibling requests through the companion index.
- Commitment cancellation/expiry supersede still-pending requests through the same companion index; no terminal commitment retains an actionable Pending row.
- `ApprovedWorkCounted` updates exactly the matching `requirementIndex`, replaces that row's cumulative count, stores event-emitted per-commitment `approvedUnits`, and increments only the matching exact-label pool/cycle summary by `newlyApprovedUnits`. `UnitsReleased` and `UnitsFulfilled` update only that same label hash; cumulative event values are never summed or re-derived.
- `CommitmentAccepted` increments provider exposure once; fulfillment, cancellation, and expiry decrement it exactly once when the commitment held a slot. Dispute entry/restoration does not change the count. Replaying any event leaves summaries and exposure unchanged.
- Pool/cycle entities retain state counts and expose no raw-unit aggregate fields; no handler or query adds unlike label hashes.
- Queued, Dispatched, Celo executed/acknowledgment-pending, Confirmed, authenticated execution Failed, transport-delayed, same-key command retry, acknowledgment retry, and per-member recovery remain distinguishable.
- `DisbursementCancelled` persists whether an individual cancellation came from an unbatched Queued item or from an authenticated Failed result; a failed member is never made to look like a pre-dispatch withdrawal.
- `BatchCancelled(uint256 indexed batchId,address indexed actor,string reasonCID)` atomically marks the still-Queued batch and every immutable member Cancelled-from-Queued in one replay-idempotent handler. No indexed state can present a partially cancelled Queued batch.
- `SettlementExecutionStored` records the bounded Celo executor transaction, exact authenticated acknowledgment receiver, decoded `isBatch`, settlement ID, and attempt, and derives acknowledgment-pending without waiting for an Arbitrum join. `AcknowledgmentDeferred` stores the bounded quote/reserve/send deferral code; only Arbitrum `SettlementAcknowledged(success=true)` makes canonical state Confirmed.
- `AcknowledgmentSent(...,fee,reserveFunded)` decrements the indexed CELO reserve only when `reserveFunded == true`; an exact caller-funded retry creates its message row without reducing protocol reserves. Arbitrum command sends always reduce the source reserve by their emitted fee.
- Every command/ack message row is chain-composite and replay-idempotent. Source command rows preserve the snapshotted destination peer, gas, version, and payload hash; every acknowledgment's originating command ID joins to the same execution key even when it is an older retry ID delivered out of order. Duplicate/out-of-order messages never duplicate settlement execution or make a previous peer look authoritative for a new command. Message `fee` is nullable on receipt-only rows because the destination receipt event does not emit the source-chain fee.
- `isBatch` is preserved on every source message and Celo execution record and participates in the canonical execution-key domain. Same-numbered disbursement and batch subjects never join to one command/execution row, including under inverted cross-network replay order.
- The preservation fixture runs the updater twice and retains the exact Arbitrum route/batch-limit/pause/dispatcher/reserve/cancellation signatures, including `BatchCancelled`, and all thirteen Celo executor signatures; unknown EAS or raw Celo token blocks still fail.
- The same fixture seeds both chain configuration rows from verified deployment metadata and
  rejects a missing local router, numeric/rounded selector, wrong deployment block, or
  contract-block mismatch.
- Envio reads only Green Goods protocol events.

## RED / GREEN

- RED: `test/commitmentPool.test.ts`, `test/settlement.test.ts`, and `test/gardenCompositeIdMigration.test.ts` are explicit to-be-created first-failing deliverables; focused handler/migration/preservation fixtures fail before schema, config, helper, and handler changes.
- GREEN: the same fixtures pass after codegen; generated operations expose every entity; setup-generated, boundary, tests, and build pass.

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

- Core dispatch requires only pooling event signatures frozen and identical between contract-spec and Envio config. Settlement handlers use the frozen Arbitrum command/ack and Celo executor signatures in settlement-spec; core GREEN must not be reported as full settlement GREEN.
- Garden replay procedure, pre-replay snapshot, switch criterion, rollback package, and accountable owner Afolabi Aiyeloja are named. The implementer produces the rehearsal; `human-release-ops.md` owns the authorized live cutover.
- Updater/boundary allowlist changes and preservation fixture are part of the lane.
- RED fixture evidence is recorded; final GREEN includes codegen, generated build, boundary check, targeted handlers, and package build.
