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
- Settlement phase: settlement account/disbursement/batch entities plus a singleton `SettlementConfiguration` read model carrying `memberDeliveryEnabled`.
- Exact Arbitrum/Sepolia contract blocks and idempotent create-if-not-exists handlers.
- Commitment-keyed request index that marks accept/decline/supersede without a database-wide scan.
- Full Garden.id migration to chainId-lowercaseAddress with replay/backfill, every foreign-key/helper/query/fixture cutover, and no mixed-ID interval.
- Nullable generic audit actor populated only from explicit event parameters, never transaction.from.
- Commitment read model persists provider, providerGarden composite relation, preDisputeState, positional requirement rows (`requirementIndex`, domain/action, required/approved counts), the per-commitment `approvedUnits` value emitted by the contract, and derived reward facts. Hypercert persists `bundleKind`, composite fulfilled-commitment relationships, ascending unique Need UIDs, and legacy Work-bundle readability.
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
- Reported, checking, Verified, receipt-invalid Failed, infrastructure retry, and per-member batch recovery remain distinguishable.
- The preservation fixture runs the updater twice and retains exact event signatures; unknown EAS or raw Celo token blocks still fail.
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

- EAS attestation indexing, raw Celo/G$ transfer indexing, receipt verification, contract changes, UI, Sarafu ingestion, and credit/leaderboard entities.
- A compatibility period with mixed raw and composite Garden IDs.

## Unblock evidence

- Core dispatch requires only pooling event signatures frozen and identical between contract-spec and Envio config. Settlement handlers remain blocked until the settlement signatures freeze; core GREEN must not be reported as full settlement GREEN.
- Garden replay procedure, pre-replay snapshot, switch criterion, rollback package, and accountable owner Afolabi Aiyeloja are named. The implementer produces the rehearsal; `human-release-ops.md` owns the authorized live cutover.
- Updater/boundary allowlist changes and preservation fixture are part of the lane.
- RED fixture evidence is recorded; final GREEN includes codegen, generated build, boundary check, targeted handlers, and package build.
