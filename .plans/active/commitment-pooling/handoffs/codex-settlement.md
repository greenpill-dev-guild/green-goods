# Commitment Pooling - Codex CCIP Settlement Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: settlement
- Owner: Codex
- Branch signal: `codex/settlement/commitment-pooling`
- Current state: ready for implementation after the frozen pooling reward/provider interface is available
- Linear context: PRD-686 under parent PRD-650
- Dispatch boundary: this plan handoff does not authorize code changes on its own; implementation requires a separate explicit lane dispatch.

## Inputs

- Frozen CommitmentPoolingModule Fulfilled reward/provider interface.
- `settlement-spec.md` exact command/ack tuples, state machine, events, authority boundary, fee model, and no-active-Celo-testnet gate.
- Existing `@chainlink/contracts-ccip` dependency plus ENS CCIP fee quoting, sponsored-reserve sending, receiver authentication, and wrong-route test patterns.
- Official Chainlink CCIP directory reread immediately before implementation/dry-run; the 2026-07-23 snapshot is Arbitrum One selector/router `4949039107694359620` / `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` and Celo selector/router `1346049177634351622` / `0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62`, but live route evidence wins.
- Existing Safe/Zodiac patterns; live owner identities, final selectors/caps, audit, broadcasts, and canary remain Release inputs rather than implementation prerequisites.

## Outputs

- Versioned settlement message library shared by both contracts:
  - command `(uint8 version,uint256 settlementId,bool isBatch,uint32 attempt,address executorGarden,uint8 disbursementKind,address[] recipients,uint256[] amounts)`; `isBatch` domain-separates independent disbursement/batch counters; funding commands always encode `protocolGarden` in `executorGarden` and put the target garden Safe only in `recipients`;
  - acknowledgment `(uint8 version,bytes32 executionKey,bytes32 originatingCommandMessageId,bool success,uint8 failureCode)`.
- Arbitrum UUPS `SettlementModule`: immutable implementation router plus official source CCIP selector, write-once protocol garden/canonical G$, canonical reward/funding derivation, immutable batch membership with a hard ceiling of 24 and a measurement-gated 0–24 configured limit, exact dispatch-only delegate, observable native-fee floor, data-only CCIP dispatch, same-key retry, authenticated acknowledgment receiver, failure/new-attempt recovery, unbatched-Queued or Failed individual cancellation, and atomic whole-batch cancellation while Queued.
- Celo UUPS `CeloSettlementExecutor`: immutable implementation router and canonical G$, exact source authentication, bounded previous-peer grace, zero token amounts, write-once garden → Safe/Roles route binding, and canonical G$ execution in one non-reentrant transaction whose direct Zodiac Roles calls all target G$ and roll back the full batch if any transfer rejects, reverts, or returns false. It also provides idempotent execution outcome, independent acknowledgment retry, observable native-CELO reserve floor, and fail-closed per-transfer, per-batch, and periodic caps.
- Paused-first deployment simulations, bounded current/previous peer rotation, immutable-router drained-upgrade rehearsal, bytecode/code-hash checks, strict Safe/Zodiac role probes, and deployment-artifact schema. No broadcast or authority mutation.
- Exact selector serialization: migrate `networks.json` selectors from unsafe JSON numbers to decimal strings, update every Solidity/TypeScript consumer for exact `uint64`/`bigint` parsing, and prove Ethereum/Sepolia/Arbitrum/Celo round trips with no IEEE-754 coercion.
- Arbitrum/Celo unit tests and an asynchronous paired-router integration harness.
- Frozen Arbitrum and Celo event/interface contracts for the independently owned indexer, shared state/API, client, and admin lanes.

## Acceptance

- Queue derives garden, recipients, amounts, kind, and funding route from canonical
  Fulfilled/funding facts. Commitment rewards require `RewardRail.CeloSettlement`; core
  `recordRewardPaid` accepts only `ArbitrumExternal`, proving mutual exclusion. Caller cannot
  supply token, Safe, target, selector, or calldata. Every batch is homogeneous by executor
  garden, source, token, kind, and funding route because one command carries one kind.
- `executionKey = keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))`; tests prove same-numbered disbursement and batch subjects cannot collide.
- Initial dispatch snapshots destination selector, executor, gas, version, and payload hash. A transport retry reuses that exact route/attempt/key/payload and cannot reroute to a replacement executor or execute G$ twice. Acknowledgment sender/selector must match the command snapshot, not merely a globally allowed previous peer, and `originatingCommandMessageId` must be an initial/retry message ID already mapped to that key. A new attempt is allowed only after an authenticated failure acknowledgment and steward requeue; requeue clears the active batch association while the immutable failed Batch retains historical membership.
- A Failed member may instead be terminally cancelled without a new attempt. An unbatched Queued disbursement may be cancelled individually; a Queued batch may be cancelled only in full through `cancelBatch`, atomically terminalizing its immutable member set. No cancellation is allowed from Dispatched, and every member records whether cancellation came from Queued or Failed.
- Celo stores the outcome, exact authenticated acknowledgment receiver, original protocol version, and bounded acknowledgment-deferral code before/around acknowledgment delivery. `retryAcknowledgment(executionKey)` cannot touch G$; it always targets the stored originating module with the stored version, not a later active peer/config. Caller-funded send failure reverts atomically, while automatic/sponsored deferral distinguishes quote, reserve, and send failure.
- Each receiver accepts only its implementation's immutable router, then validates the active or
  unexpired bounded-previous peer, exact chain selector and encoded sender pair, protocol
  version, tuple shape, and empty token amounts. Router change requires a paused, old-message-
  drained implementation upgrade; the source proxy preserves its immutable official source
  selector and no mutable router/selector setter exists.
- Same-selector/same-version peer grace is capped at 30 days from the configuration call. While
  paused, a same-route maintenance call may only extend the unchanged previous peer's expiry;
  it cannot shorten expiry, revive a cleared peer, or reshuffle peer order. Tests cover those
  guards and the release runbook keeps the lane paused until the retiring peer has zero
  unresolved commands.
- `HARD_MAX_BATCH_SIZE == 24`, but batching starts disabled and uses a measured configured
  0–24 limit shared by both chains. Returning either side to zero disables only batch commands;
  unbatched commands still require exactly one recipient and the non-zero transfer/aggregate/
  period policies. Production cannot assume 24 is executable until worst-case
  destination gas and atomic Safe execution proof passes.
- Authenticated, well-formed route/recipient/batch/transfer/aggregate/period-cap/Safe failures
  store the frozen bounded failure code and negatively acknowledge. Unauthenticated,
  token-bearing, malformed, or unsupported-version messages revert without creating an
  execution result. Success pairs only with `FailureCode.None`; failure pairs only with a
  bounded non-zero code.
- Only an authenticated success acknowledgment for the subject's current execution key and
  attempt sets `Confirmed`; timeout/manual-execution eligibility is not payment failure.
- Source pause blocks new queue/batch/dispatch/command-retry/requeue but permits exact configuration, terminal closeout, fee maintenance, and authenticated acknowledgment receipt. Destination pause rejects new execution without recording a business failure and still permits stored acknowledgment retry.
- `CeloSettlementExecutor` is a narrowly scoped Zodiac Roles member and never a Safe owner. Its only allowed path is `execTransactionWithRoleReturnData(gDollarToken,0,transferCalldata,Enum.Operation.Call,roleKey,true)` through the exact stored `bytes32 roleKey`; the role grants neither a self-call nor an arbitrary batch target. The executor also rejects a non-reverting ERC-20 `false` return. One non-reentrant outer transaction makes the transfer loop atomic, with per-transfer, per-batch, and periodic caps. Zero policy values fail closed until a human-approved policy is configured while paused.
- Every commitment reward sources G$ from the owning pool garden's registered Safe (`commitment.garden`; protocol pool → GG protocol Safe). Individual rewards target the provider's same-address Celo AA. Garden rewards target the separate registered `providerGarden` Safe. `ProtocolToGarden` is the only funding route.
- Native ETH/CELO fee balances, quote, reserve threshold, low-balance state, and withdrawal constraints are observable and tested. Arbitrum command dispatch/retry always spends the module reserve; Celo `AcknowledgmentSent.reserveFunded` distinguishes automatic/sponsored reserve spend from an exact caller-funded retry. LINK fee payment is out of scope.
- `dispatcher` is a single optional Arbitrum address with dispatch/retry authority only. Protocol garden and canonical G$ have no post-initialization setter. Both contracts preserve their configured native-fee floor on sends and withdrawals.
- `memberDeliveryEnabled()` remains the canonical AA capability gate; failure keeps member delivery blocked without disabling `ProtocolToGarden`.

## RED / GREEN

- RED: focused tests fail for tuple compatibility, exact decimal-string selector parsing/round-trip without JS number coercion, disbursement/batch execution-key domain separation, homogeneous batch kind/funding-route enforcement, source/sender/version/token validation, originating-message-to-key binding, per-command destination snapshot and previous-peer forgery/cross-executor retry rejection, write-once canonical configuration, dispatcher scope, observable fee floors, unbatched-Queued/Failed individual cancellation, failed-batch member requeue clearing only the active batch association, atomic Queued-batch cancellation with no partial-member path, disabled/configured/hard batch bounds, same-key duplicate/out-of-order delivery, acknowledgment retry, stale/duplicate acknowledgment, bounded failure codes, fee shortage, pause, previous-peer command acknowledgment back to its exact originating module, UUPS immutable-router cutover with unchanged G$, Safe owner/role separation, direct-G$ role scoping with no executor self-call permission, cap failure, and generated storage layouts.
- GREEN: the same tests pass; a deterministic two-router local harness and separate fork processes prove asynchronous command/ack behavior without broadcasting.

## Exact Bun commands

The named test files are intentional RED-first targets.

- `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`
- `bun run --filter @green-goods/contracts test:match -- test/unit/CeloSettlementExecutor.t.sol`
- `bun run --filter @green-goods/contracts test:match -- test/integration/CCIPSettlement.t.sol`
- `bun run --filter @green-goods/contracts test:script`
- `bun run --filter @green-goods/contracts build:full`
- `bun run --filter @green-goods/contracts lint:check`
- `bun run --filter @green-goods/contracts test`

Deployment commands must be added through the existing deploy wrapper and verified with `--help` before use. Once the implementation lane is explicitly dispatched, its authority is limited to code, tests, simulation, and dry runs; this plan-only pass authorizes none of those actions.

## Out of scope

- Broadcasts, Safe role grants, message-only mainnet ping/ack, value canary, arbitrary Safe execution, CCIP token transfer, bridged G$, raw G$ indexing, manual report/verification, any `packages/agent` settlement relayer or write authority, garden-custody member claims, transferable vouchers, and CreditRegister. Optional later agent alerts may consume indexed health read-only.

## Release blockers that do not block implementation

- External audit with no unresolved critical/high findings.
- Exact live 2-of-3 owner identities and evidence that `CeloSettlementExecutor` is not an owner.
- Reviewed live Zodiac selector/cap configuration and code hashes.
- Current CCIP peer/router/selector/gas configuration, official-directory source/date/block/code-hash evidence, and monitored native fee reserves.
- No-active-Celo-testnet alternative gate: deterministic local routers, separate forks, paused/no-authority deploy, message-only ping/ack, audit/timelock, human-authorized minimum-value canary, observation, and explicit cap increase.
- AA/paymaster outcome for member delivery, GoodDollar operating evidence, and explicit human broadcast/canary authorization.
