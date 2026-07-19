# Commitment Pooling - Codex Settlement Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: settlement
- Owner: Codex
- Branch signal: codex/settlement/commitment-pooling
- Current state: manually blocked
- Linear context: PRD-686; parent-only mode remains unchanged

## Inputs

- settlement-spec.md after its Functions-only interface/event reconciliation
- acceptance-matrix.md for payout formulas, status copy, and final proof
- Frozen CommitmentPoolingModule ABI and Fulfilled reward/provider semantics
- Written GoodDollar token/operating confirmation
- Celo Safe recovery/Roles/Allowance configuration
- Chainlink Functions router, subscription, DON, callback gas, source, and secrets-reference decisions
- Celo AA/paymaster spike evidence for member delivery

## Outputs

- Arbitrum SettlementModule with reward-bound disbursements and only the ProtocolToGarden funding route.
- Immutable batches of 1-24 members, per-member failed-batch recovery, retry/cancel state, and complete event/error contract.
- Exact request bytes, 160-byte response ABI, bounded result/failure codes, snapshotted expiry, permissioned timeout recovery, and oracle-only Verified transition.
- Deterministic one-Safe-per-garden deploy/register tooling, persisted sorted pilot 2-of-3 owners + Roles/Allowance configuration, bounded owner/executor rejection, and post-deploy health checks.
- Contract, script, receipt-fixture, and integration proof.

## Acceptance

- Queue derives reward source, recipient, token, and amount from a Fulfilled commitment; callers cannot override them.
- Individual reward beneficiary is the stored provider's same-address Celo AA account. Garden reward beneficiary is the registered Safe at `settlementAccounts[providerGarden].account`, never the Arbitrum GardenAccount.
- The funding route derives every address and canonical G$ token. HoA-to-protocol-Safe remains upstream context.
- A Batch stores immutable member IDs and rejects 0 or more than 24 members. A rejected batch remains immutable; each failed member is individually requeued or canceled and requeue clears its prior batch/reference/verification fields.
- Reporting persists reportedBy and the Celo transaction hash but leaves state Reported.
- Both unbatched and batched disbursements have an explicit Queued -> Executing function before reporting.
- A verification request records request ID, time, and expiry. Only the configured Functions callback may set Verified or receipt-invalid Failed; malformed/Functions/RPC/finality errors leave Reported and allow a new request; stale callbacks cannot mutate state.
- Receipt proof checks chain 42220 and receipt at/before the RPC finalized block, successful Safe/module execution, canonical G$ `Transfer.from == stored Safe`, and exact recipient/amount multiset coverage. It never requires outer `transaction.from == Safe`.
- verifiedBy records the oracle contract. No manual receipt-verification path exists.
- Pilot owners are protocol multisig, Dev Guild recovery multisig, and named garden recovery delegate, threshold 2. No owner is an executor.
- If AA/paymaster proof fails, protocol/garden funding may continue but automated member delivery remains disabled.
- `memberDeliveryEnabled()` and `MemberDeliveryStatusChanged` provide one canonical read model for the indexer and apps.
- The implementation pins direct `@chainlink/contracts@1.5.0` and imports `FunctionsClient` from `src/v0.8/functions/v1_3_0`; an unpinned `v1_X` or development path is not acceptable.

## RED / GREEN

- RED: focused Settlement tests fail for route binding, single/batch execution, batch bounds/recovery, request payload/response ABI, callback authorization, malformed/stale callback, receipt-invalid result, infrastructure/timeout retry, Safe owner/executor separation, generated 19+31 storage layout, pause behavior, and member-delivery gate.
- GREEN: the same tests pass; script tests and one receipt-fixture integration pass. Live Celo/Functions proof remains an external gate, not something unit tests can substitute.

## Exact Bun commands

`test/unit/Settlement.t.sol` does not exist yet; it is the intentional to-be-created RED-first test target for this lane.

- bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol
- bun run --filter @green-goods/contracts test:script
- bun run --filter @green-goods/contracts build:full
- bun run --filter @green-goods/contracts lint:check
- bun run --filter @green-goods/contracts test

Run the dry-run command from packages/contracts once implemented; the filtered verification targets run from the repository root:

- bun script/deploy.ts settlement --network sepolia --dry-run
- bun script/deploy.ts settlement-safe --network celo --garden <arbitrumGardenAccount> --dry-run --pure-simulation
- bun run --filter @green-goods/contracts verify:post-deploy:sepolia
- bun run --filter @green-goods/contracts verify:post-deploy:indexer:sepolia

## Out of scope

- Any broadcast, bridged G$, bridge custody, manual verification, garden-custody member claims, transferable vouchers, CreditRegister, raw Celo/G$ indexing, or arbitrary Safe execution.
- Treating an oracle infrastructure error as an invalid receipt.

## Unblock evidence

Before dispatch, record only the external inputs needed to write the first RED PR:

- Frozen pooling ABI plus reconciled Functions-only settlement ABI/events and exact request/response/failure-code contract.
- GoodDollar canonical-token and operating confirmation.
- Functions router/subscription/DON/callback gas, pinned `@chainlink/contracts@1.5.0` source/import, secrets reference, and a finalized Celo receipt fixture.
- Exact per-garden 2-of-3 owner roles plus the scoped Roles/Allowance selectors and caps.
- The Celo AA/paymaster outcome. A failed outcome is a valid recorded result that keeps only member delivery disabled.

The implementation GREEN produces—rather than presupposes—the generated 19-slot + 31-gap proof, mocked callback tests, deterministic Safe deploy/register dry run, and owner/executor separation checks. Separately authorized broadcast, post-deploy checks, Garden-ID cutover, and the live Celo/Functions exit proof belong to `human-release-ops.md` and cannot block opening the implementation PR once the pre-dispatch inputs above exist.
