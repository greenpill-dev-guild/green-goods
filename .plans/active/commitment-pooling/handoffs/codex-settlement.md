# Commitment Pooling - Codex CCIP Settlement Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: settlement
- Owner: Codex
- Branch signal: `codex/settlement/commitment-pooling`
- Current state: independent local review/correction complete; blocked for live mirror
  convergence/re-read and the frozen pooling reward/provider interface; follow `status.json`
- Linear context: PRD-686 under parent PRD-650
- Dispatch boundary: this plan handoff does not authorize code changes on its own; implementation requires a separate explicit lane dispatch.

## Inputs

- Frozen CommitmentPoolingModule Fulfilled reward/provider interface.
- `settlement-spec.md` exact command/ack tuples, state machine, events, authority boundary,
  GoodDollar exact-net fee model, and current direct-lane/testnet evidence gate.
- Existing `packages/contracts/src/registries/LocalCCIPRouter.sol` is the local-router starting
  point. Extend or adapt it into the paired-router harness; do not create an unrelated parallel
  CCIP mock that can drift from the repository's existing local transport behavior.
- Existing `@chainlink/contracts-ccip` dependency plus ENS CCIP fee quoting, sponsored-reserve sending, receiver authentication, and wrong-route test patterns.
- Official Chainlink CCIP directory reread immediately before implementation/dry-run. As of
  2026-07-24 the directory publishes Arbitrum One↔Celo Mainnet in both directions at v1.5.0,
  while the exact Arbitrum Sepolia↔Celo Sepolia pair is not listed and Celo's official support
  page currently lists CCIP only for mainnet. Implementation uses local mock routers, Arbitrum
  Sepolia endpoint proof, and Celo Sepolia executor/Safe/roles/surrogate rehearsal; a live Celo
  Sepolia CCIP endpoint requires a fresh official lane/router publication. The current endpoint
  proof uses a separate ephemeral Arbitrum Sepolia↔Ethereum Sepolia deployment with
  `DESTINATION_EVM_CHAIN_ID = 11155111`; its artifacts never enter the canonical registry. Value release requires fresh proof
  that the published mainnet route remains operational and matches the frozen routers,
  selectors, peers, fee quotes, and code hashes. No Ethereum relay is authorized implicitly.
- Minimal Safe and Zodiac interfaces are hand-declared locally and official Safe v1.4.1
  deployment JSON is consumed as pinned data; no new Solidity dependency is required. Any later
  JavaScript package install requires explicit owner approval. Live owner identities, final
  selectors/caps, audit, broadcasts, and canary remain Release inputs.

## Outputs

- Versioned settlement message library shared by both contracts:
  - command `(uint8 version,uint256 settlementId,bool isBatch,uint32 attempt,address executorGarden,uint8 disbursementKind,address[] recipients,uint256[] amounts)`; `isBatch` domain-separates independent disbursement/batch counters; funding commands always encode `protocolGarden` in `executorGarden` and put the target garden Safe only in `recipients`;
  - acknowledgment `(uint8 version,bytes32 executionKey,bytes32 originatingCommandMessageId,bool success,uint8 failureCode)`;
  - the initial configured `protocolVersion` on both chains is exactly `1`, matching the `version`
    field of both tuples; any later version is a drained cutover with zero peer grace, never a live
    bump.
- Arbitrum UUPS `SettlementModule`: immutable implementation router, official source CCIP
  selector, and destination EVM chain ID (`42220` production; `11142220` only for isolated,
  paused local/mock or component proof and never as CCIP-lane evidence);
  write-once protocol garden/canonical G$; canonical reward/funding derivation; immutable batch
  membership with a hard ceiling of 24 and a measurement-gated 0–24 configured limit; exact
  dispatch-only delegate; observable native-fee floor; data-only CCIP dispatch; same-key retry;
  authenticated acknowledgment receiver; failure/new-attempt recovery; unbatched-Queued or
  Failed individual cancellation; and atomic whole-batch cancellation while Queued.
- Celo UUPS `CeloSettlementExecutor`: immutable implementation router and canonical G$, exact
  source authentication, bounded previous-peer grace, zero token amounts, write-once garden →
  Safe/one-Roles-modifier/role-key/native-allowance-key binding, and canonical G$ execution
  through an atomic bounded adapter. It proves exact net recipient balance, accepts zero-fee
  or sender-paid fee modes only, caps gross Safe debit, and rolls back the full batch if any
  quote, transfer, or balance check fails. It also provides idempotent execution outcome,
  independent acknowledgment retry, observable native-CELO reserve floor, and fail-closed
  per-transfer, per-batch, per-fee, and periodic caps.
- The immutable `permissionsConfigHash` commits Safe/Roles/token/selector/condition-tree facts
  only. Mutable transfer/batch/fee/period caps and live allowance balances are independently
  evented and verified, so legitimate paused policy updates never stale the hash.
- Both proxies initialize paused. Source dependency changes are pause-only, reject zero, and emit
  exact old/new addresses; source unpause requires complete route, active protocol account, and a
  non-zero fee floor. Executor unpause requires source peer, caps, period policy, and reserve
  floor. Paused-first deployment simulations, bounded current/previous peer rotation, immutable-router
  drained-upgrade rehearsal, bytecode/code-hash checks, strict Safe/Zodiac role probes, and a
  deployment-artifact schema that records local contract/router/selector facts for every
  component but records a paired remote selector/EVM identity only for a freshly verified
  supported lane. The production `42161`↔`42220` pair is complete; independent
  `421614`/`11142220` rehearsal artifacts remain non-ready and must not fabricate a peer seed.
  No broadcast or authority mutation.
- A dedicated `settlement-executor --network celo|celo-sepolia` target replaces use of the
  historical full-core `deploy:celo --update-schemas` command and preserves all existing Celo
  artifact keys. Protocol and settlement rehearsal gates are role-aware.
- Exact selector serialization: migrate `networks.json` selectors from unsafe JSON numbers to decimal strings, update every Solidity/TypeScript consumer for exact `uint64`/`bigint` parsing, and prove Ethereum/Sepolia/Arbitrum/Celo round trips with no IEEE-754 coercion.
- Arbitrum/Celo unit tests and an asynchronous paired-router integration harness. The paired router
  derives from the existing `packages/contracts/src/registries/LocalCCIPRouter.sol`: same `getFee`
  and `ccipSend` signatures and the same deterministic `messageId` derivation, but the inline
  `ICCIPReceiver.ccipReceive` call is replaced by a stored outbound message plus an emitted
  outbound event and a separate courier-only delivery entrypoint, so delivery is asynchronous and
  externally ordered.
- A dual-chain courier and cross-chain lifecycle fixture, designed in `settlement-spec.md` §7.1:
  `script/settlement/dual-chain-courier.ts` plus `script/settlement/dual-chain-lifecycle.test.ts`,
  both Bun/vitest under `test:script` and never a Foundry test, driving two Anvil processes
  (`--chain-id 421614 --port 3012` and `--chain-id 11142220 --port 3013`; `3010` is the September
  Community PWA's reserved port, so the pair deliberately skips it). Only serialized command
  tuples, acknowledgment tuples, and delivery receipts cross the process boundary; no RPC handle,
  fork snapshot, storage slot, or chain state is shared, and each side asserts only against its own
  chain. Artifacts stay under `.generated/runtime`.
- Frozen Arbitrum and Celo event/interface contracts for the independently owned indexer, shared state/API, client, and admin lanes.

## Acceptance

- Queue derives garden, recipients, amounts, kind, and funding route from canonical
  Fulfilled/funding facts. Commitment rewards require `RewardRail.CeloSettlement`; core
  `recordRewardPaid` accepts only `ArbitrumExternal`, proving mutual exclusion. Caller cannot
  supply token, Safe, target, selector, or calldata. Every batch is homogeneous by executor
  garden, source, token, kind, and funding route because one command carries one kind.
- `executionKey = keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))`; tests prove same-numbered disbursement and batch subjects cannot collide.
- Initial dispatch snapshots destination selector, executor, gas, version, and payload hash. A transport retry reuses that exact route/attempt/key/payload and cannot reroute to a replacement executor or execute G$ twice. Acknowledgment sender/selector must match the command snapshot, not merely a globally allowed previous peer, and `originatingCommandMessageId` must be an initial/retry message ID already mapped to that key. A new attempt is allowed only after an authenticated failure acknowledgment and steward requeue; requeue clears the active batch association while the immutable failed Batch retains historical membership. Requeue clears exactly `executionKey`, `commandMessageId`, `acknowledgmentMessageId`, `dispatchedAt`, and `confirmedAt`; `failureCode` and `reasonCID` survive as the record of the prior attempt, and `state` plus `attempt` remain the only authoritative current facts.
- Batch membership mirrors batch state: `dispatchBatch` moves the batch and every member from Queued to Dispatched together, a success acknowledgment moves the batch and every member to Confirmed, an execution-failure acknowledgment moves the batch and every member to Failed carrying the batch's bounded `failureCode`, and `cancelBatch` moves the batch and every member to Cancelled with `cancelledFromState = Queued`. Plan counters are maintained by those mirrored member transitions, never by the batch row alone.
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
- `CeloSettlementExecutor` is a narrowly scoped Zodiac Roles member and never a Safe owner. Its
  only allowed path is
  `execTransactionWithRoleReturnData(gDollarToken,0,transferCalldata,SafeOperation.Call,roleKey,true)`
  through the exact stored role and native `WithinAllowance(allowanceKey)` condition; there is
  no separate Allowance Module. The role grants neither a self-call nor an arbitrary batch
  target. Exact-net fee and balance-delta tests include zero-fee, sender-pays, receiver-pays,
  fee change, token pause/unpause, maximum-fee-bps/absolute-fee limits, ERC-20 false,
  ERC-777 reentrancy,
  source-as-recipient, and duplicate-recipient cases.
- Every fulfilled commitment payout plan sources G$ from the registered `providerGarden` Safe.
  The pooling declaration supplies zero source/token sentinels; SettlementModule derives the
  payer from that registered Safe and the plan token exclusively from its write-once
  `gDollarToken`.
  Its explicit retained amount plus contributor child disbursements conserves declared support;
  each non-zero eligible contributor target is derived from the frozen plan. If protocol support
  must reach that garden first, `ProtocolToGarden` is the separate and only funding route from the
  protocol Safe to the provider garden Safe. Funding and contributor payout never share a command
  or masquerade as one another.
- Native ETH/CELO fee balances, quote, reserve threshold, low-balance state, and withdrawal constraints are observable and tested. Arbitrum command dispatch/retry always spends the module reserve; Celo `AcknowledgmentSent.reserveFunded` distinguishes automatic/sponsored reserve spend from an exact caller-funded retry. LINK fee payment is out of scope.
- `dispatcher` is a single optional Arbitrum address with dispatch/retry authority only. Protocol garden and canonical G$ have no post-initialization setter. Both contracts preserve their configured native-fee floor on sends and withdrawals.
- `memberDeliveryEnabled()` remains the canonical AA capability gate for non-zero contributor
  preparation and member sends. Failure does not block payout-plan creation/edit/finalization,
  all-retained zero-child completion, or `ProtocolToGarden`.
- Shared currently constructs Kernel `0.3.1` accounts. Pimlico's official support matrix lists
  that implementation on Arbitrum One, Arbitrum Sepolia, and Celo Mainnet, but not on Celo
  Sepolia; Celo Sepolia lists Kernel `0.2.4`. The workaround has two non-interchangeable tiers:
  testnet mechanics use an explicit Kernel `0.2.4` account profile on both `421614` and `11142220`
  with the same EntryPoint/factory/implementation/initializer/passkey/salt and one included
  sponsored surrogate transfer. That proof is non-production and can never enable member
  delivery. Production keeps Kernel `0.3.1` and requires exact same-address Arbitrum One/Celo
  Mainnet derivation, verified EntryPoint/account code hashes, passkey validation, and an active
  bounded `42220` sponsorship policy. Only a separately human-authorized included sponsored
  first-use Celo Mainnet canonical-G$ transfer, with UserOperation and transaction receipts,
  EntryPoint event, deployed code, and exact balance deltas, can enable member delivery. The
  existing unversioned v0.6 registry field stays explicitly legacy; API keys and passkey material
  never enter evidence artifacts.

## RED / GREEN

- RED: focused tests fail for tuple compatibility, exact decimal-string selector parsing/round-trip without JS number coercion, disbursement/batch execution-key domain separation, homogeneous batch kind/funding-route and duplicate-recipient rejection before mutation, inactive protocol-source or target-garden Funding account rejection at batch creation and dispatch, source/sender/version/token validation, originating-message-to-key binding, per-command destination snapshot and previous-peer forgery/cross-executor retry rejection, paused-first initialization, unpaused/zero trust-root rejection, exact old/new dependency events, incomplete-unpause rejection, write-once canonical configuration, dispatcher scope, persisted contributor-order enumeration, version-1 creation snapshot and later versioned full-vector replacement with incomplete/mismatched trailing-summary rejection, observable fee floors, unbatched-Queued/Failed individual cancellation, failed-batch member requeue clearing only the active batch association, atomic Queued-batch cancellation with no partial-member path, disabled/configured/hard batch bounds, same-key duplicate/out-of-order delivery, acknowledgment retry, stale/duplicate acknowledgment, bounded failure codes, fee shortage, pause, previous-peer command acknowledgment back to its exact originating module, UUPS immutable-router cutover with unchanged G$, Safe owner/role/native-allowance separation, exact-net GoodDollar fee modes, token pause, proportional/absolute fee policy, and balance deltas, direct-G$ role scoping with no executor self-call permission, cap failure, and compiler-generated storage layouts with concrete slot/offset assertions.
- GREEN: the same tests pass; a deterministic two-router local harness and separate fork processes prove asynchronous command/ack behavior without broadcasting.

## Exact Bun commands

The named test files are intentional RED-first targets.

- `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`
- `bun run --filter @green-goods/contracts test:match -- test/unit/CeloSettlementExecutor.t.sol`
- `bun run --filter @green-goods/contracts test:match -- test/integration/CCIPSettlement.t.sol`
- `bun run --filter @green-goods/contracts test:match -- test/integration/DualChainSettlement.t.sol`
- `bun run --filter @green-goods/contracts test:script`
- `bun run --filter @green-goods/contracts build:full`
- `bun run --filter @green-goods/contracts lint:check`
- `bun run --filter @green-goods/contracts test`

The four Foundry files cover `settlement-spec.md` §8 proof-ladder rung 1: `Settlement.t.sol` the
Arbitrum source, `CeloSettlementExecutor.t.sol` the Celo executor, `CCIPSettlement.t.sol` both
contracts in one EVM behind the paired routers, and `DualChainSettlement.t.sol` the same pair with
deferred, externally ordered delivery. Rung 2 is `script/settlement/dual-chain-lifecycle.test.ts`
under `test:script`, driving the courier across the two Anvil processes. Rung 3 is
`test/fork/ArbitrumSettlement.t.sol` and `test/fork/CeloSettlement.t.sol` under `test:fork`,
following the existing `test/fork/<Chain><Subject>.t.sol` convention and gated on fork RPC URLs.
Rungs 4 through 7 have no repository test file. Add the courier's own help-documented
`settlement:dual-chain:up`, `settlement:dual-chain:down`, and `settlement:courier` package commands
alongside them.

Deployment commands must be added through the existing deploy wrapper and verified with `--help` before use. Once the implementation lane is explicitly dispatched, its authority is limited to code, tests, simulation, and dry runs; this plan-only pass authorizes none of those actions.

## Out of scope

- Broadcasts, Safe role grants, message-only mainnet ping/ack, value canary, arbitrary Safe execution, CCIP token transfer, bridged G$, raw G$ indexing, manual report/verification, any `packages/agent` settlement relayer or write authority, garden-custody member claims, transferable vouchers, and CreditRegister. Optional later agent alerts may consume indexed health read-only.

## Release blockers that do not block implementation

**Owner ruling on bucketing.** Everything in this section is release-ops evidence and never gates
lane completion. Lane GREEN is `settlement-spec.md` §8 proof-ladder rungs 1 through 3. The ephemeral
Arbitrum Sepolia↔Ethereum Sepolia endpoint proof belongs here, not in the lane's GREEN definition:
this handoff's own authority forbids the live testnet deploys it requires, so a lane-completion
clause depending on it would be unsatisfiable by construction. Where a pre-broadcast GREEN
acceptance sentence names that endpoint proof, the clause constrains **artifact placement only** —
its addresses and artifacts stay under `.generated/runtime` and never merge into canonical
`421614-latest.json`.

- External audit with no unresolved critical/high findings.
- Exact live 2-of-3 owner identities and evidence that `CeloSettlementExecutor` is not an owner.
- Reviewed live Zodiac selector/cap configuration and code hashes.
- Current CCIP peer/router/selector/gas configuration, official-directory source/date/block/code-hash evidence, and monitored native fee reserves.
- Direct-lane/testnet gate (a superset of lane GREEN: the deterministic local routers and pinned
  forks are rungs 1–3 this lane produces; from the Arbitrum Sepolia endpoint rehearsal onward every
  item is release-ops-owned): deterministic dual-process local routers; separate pinned
  Arbitrum/Celo forks; Celo Sepolia fee-aware G$ surrogate and executor/Safe/roles proof;
  Arbitrum Sepolia endpoint rehearsal clearly labeled non-production-route; any Celo Sepolia
  CCIP endpoint proof conditional on a fresh official lane/router; exact live bidirectional mainnet lane;
  paused/no-authority deploy; message-only ping/ack; audit/timelock; human-authorized
  minimum-value canary; observation; and explicit cap increase.
- AA/paymaster gate: same-address Kernel `0.2.4` sponsored surrogate-transfer mechanics on
  Arbitrum Sepolia/Celo Sepolia are recorded as non-enabling test evidence; exact Kernel `0.3.1`
  Arbitrum One/Celo Mainnet derivation, code/policy/passkey proof and one separately authorized
  included Celo Mainnet canonical-G$ first-use operation are required before member delivery.
  GoodDollar operating evidence and explicit human broadcast/canary authorization remain required.

## Binding architecture amendment — 2026-07-28

- The provider garden Safe is the payer for member allocation. Protocol-to-garden funding remains a separate parent transfer and must not be conflated with contributor payout.
- Add one stable `CommitmentPayoutPlan`: creation validates the complete sorted recognition vector
  and hash through CommitmentPooling's canonical on-chain recomputation. Atomic full-vector
  amount edits derive payment weights; callers never author recognition and payment weights
  independently. Creation's deterministic full-reward base-unit allocation is rounding-equivalent
  even when its normalized payment bps cannot exactly equal recognition; every noncanonical
  amount/retention divergence requires a stored reason.
- Explicit finalization verifies declared amount = garden-retained amount + all contributor payout amounts, freezes the plan, and creates no child. A later idempotent `prepareContributorPayout` call materializes exactly one `ContributorReward` disbursement from a frozen non-zero row; an all-retained zero-child plan completes on finalization without CCIP or a self-transfer.
- Re-read the immutable provider-garden settlement account before every value-authorizing payout
  write: edit, finalization, first child preparation, ContributorReward batch creation, and initial
  dispatch all require it to remain Active. Deactivation does not erase history or block public
  reads, authenticated acknowledgments, terminal cancellation, exact-child idempotent returns, or
  same-execution-key retry paths under their existing gates.
- A protocol Safe payment to a garden Safe is only `Funding` through `queueFunding` with
  `FundingRoute.ProtocolToGarden`; it is never a garden-beneficiary `ContributorReward`.
- Funding batch creation and initial dispatch revalidate both immutable sides: the protocol
  source settlement account and every target-garden recipient settlement account must still be
  active immediately before value authority is batched or sent. Deactivation leaves the subject
  Queued and produces no fee quote, execution key, or message ID.
- Parent status is derived from finalization, unprepared payable rows, and children as Draft / Pending / Partial / Complete / Failed. Child or batch cancellation never clears `payoutPlanOfCommitment`, so a second plan cannot bypass the audit trail.
- A failed child never reverses commitment fulfillment, recognition, or successful siblings. No garden-held member claim, custody voucher, manual arrival flag, or arbitrary Safe execution is introduced.

## Binding review closure — 2026-07-29

- Resolve create/edit/finalize/prepare/requeue/cancel authority from the immutable provider or
  executor garden's operator/owner Hats. The exact predicate is
  `IHatsModule.isStewardOf(garden, msg.sender) || IHatsModule.isOwnerOf(garden, msg.sender)`
  against that immutable garden, mirroring `_requireOperator` in
  `packages/contracts/src/modules/Hypercerts.sol`; `isOperatorOf` is the deprecated alias
  `HatsModule` forwards to `isStewardOf`, and the frozen interface uses `isStewardOf`. No
  value-moving payout write has a module-owner fallback. A root-pool steward cannot spend a
  claimant garden Safe; the optional dispatcher may only execute an already-finalized immutable
  plan.
- Creation calls `CommitmentPoolingModule.validateRecognitionSnapshot` and rejects a
  self-consistent but noncanonical vector/hash. That validator is a core-module view, so
  `contract-spec.md` §6.1 canonically owns the
  `recognitionSnapshotHash = keccak256(abi.encode(block.chainid, commitmentId, recognitionEntries))`
  preimage; `settlement-spec.md` restates it for the payout-plan caller only. This lane consumes the
  core module's recomputation and never authors or amends that preimage — a change lands in the
  contracts lane first. It persists the immutable ascending contributor
  order used by full-vector edits and finalization. Creation and every edit emit one complete
  version-tagged ordered `ContributorPayoutSet` sequence followed by
  `CommitmentPayoutSnapshotCommitted(rowCount, retainedAmount, contributorTotal,
  paymentSnapshotHash, reasonCID, actor)`. The indexer buffers by plan/version and publishes the
  atomic replacement only after the trailing summary matches, so untouched drafts and later
  edits are fully observable without RPC enumeration. The hash preimage is exactly chain ID,
  plan ID, version, retention, contributor total, and the ordered immutable
  `{ contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }` rows emitted by
  `ContributorPayoutSet`; mutable disbursement IDs and child counters are
  excluded everywhere. The stored `ContributorPayout` row carries no inclusion flag: every edit
  supplies one unique row per recognition entry, so every contributor always has a row and
  payability is exactly `amount > 0`. Contract, indexer, and shared tests use this one ABI tuple
  and prove child preparation leaves the hash unchanged.
- The measured payout-vector bound equals `MAX_CONTRIBUTORS_PER_COMMITMENT` (provisional 32).
  Tests cover max and max-plus-one before any plan storage/event mutation.
- A zero contributor-payment total derives an explicit all-zero payment-weight vector without
  division or remainder allocation, hashes those rows plus retention, and requires a non-empty
  recognition-divergence reason. Finalization completes that plan locally even when member
  delivery is disabled.
- Tests cover a one-base-unit reward split across multiple contributors: creation floors each
  recognition share, assigns residual units by fractional remainder then lowercase address,
  records no reason for that canonical vector, and still requires a reason for any steward-edited
  amount or retention difference.
- Tests deactivate the provider account after plan creation and prove that edit, finalization,
  first preparation, ContributorReward batch creation, and initial dispatch fail before fee quote
  or mutation. Exact existing-child preparation, reads, acknowledgments, cancellation, and
  same-key retry retain their documented behavior.
- Tests prove protocol-to-garden value is queued only through `queueFunding` as
  `DisbursementKind.Funding` plus `FundingRoute.ProtocolToGarden`; no commitment payout-plan or
  garden-beneficiary reward path can encode the same transfer.
- Child or batch cancellation retains `payoutPlanOfCommitment` and never permits a second plan or
  replacement child. Only authenticated-failure requeue creates a later logical attempt.
- `createBatch` rejects a duplicate derived recipient before fee quote, storage mutation, or
  dispatch even when the two children belong to different payout plans.
