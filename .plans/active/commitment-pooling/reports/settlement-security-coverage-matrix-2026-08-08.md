# Settlement security and lifecycle coverage matrix

Date: 2026-08-08
Range under hardening: `4769211dc013026013d8e9cd4fc8a569289257cf..a0066c08a4902da65203257313cac52de992bb23`
Scope: dormant pre-deploy `SettlementModule` and `CeloSettlementExecutor` implementation only

This matrix maps all 88 frozen interface functions (56 source, 32 executor) plus the inherited
UUPS and CCIP receiver boundaries to direct tests or a named shared boundary. It is selector
coverage, not a substitute for measured LCOV. The contract coverage audit must still compile and
meet its line/branch thresholds.

## Arbitrum source module

| Selector or selector group | Requirement | Direct proof |
|---|---|---|
| `initialize`, `paused`, `protocolGarden`, `gDollarToken`, `hatsModule`, `commitmentPoolingModule` | Paused-first, non-zero, write-once canonical trust roots | `SettlementPayerTest.setUp`; `testSourceUpgradeAndRollbackPreserveState` |
| `setCcipRoute`, `ccipRoute` | Same-lane peer rotation, bounded grace, monotonic maintenance extension | `testPeerRotationGraceIsBoundedAndExtensionCannotShorten` |
| `setBatchSizeLimit`, `batchSizeLimit`, `HARD_MAX_BATCH_SIZE` | Disabled-at-zero and hard maximum 24 | `testBatchExecutionKeySeparatesBatchFromSameNumberedChild`; `testFuzzBatchLimitRejectsValuesAboveHardMaximum` |
| `setDispatcher`, `dispatcher` | Dispatcher has dispatch/retry authority only, never closeout authority | `testDispatcherCanDispatchButCannotCancel` |
| `setFeeReserveMinimum`, `feeReserveMinimum`, `fundFees`, `withdrawExcessFees`, `nativeFeeBalance`, `isFeeReserveLow` | Native reserve floor survives send and withdrawal | `testSourceFeeWithdrawalPreservesFloor`; `invariantSourceFeeFloorRemainsFunded` |
| `registerSettlementAccount`, `settlementAccountOf` | Destination chain, account, roles facts, ordered 2-of-3 recovery identity | shared setup in `SettlementPayerTest`; payer/beneficiary account assertions |
| `updateSettlementRecovery` | Ordered non-zero owners, executor exclusion, exact recovery hash | `testRecoveryOwnerRotationUpdatesFrozenHash`; `testRecoveryOwnerRotationRejectsExecutorOwner` |
| `setAccountActive` | Active account rechecked at preparation, batching, and dispatch | `testBeneficiaryPreparationIgnoresGardenerDeliveryButRechecksAccount`; lifecycle integration failure/recovery test |
| `setGardenerDeliveryEnabled`, `gardenerDeliveryEnabled` | Contributor-only gate; Garden Safe beneficiary remains independent | `testBeneficiaryPreparationIgnoresGardenerDeliveryButRechecksAccount` |
| `setHatsModule`, `setCommitmentPoolingModule`, `setPaused` | Pause-only dependency replacement and complete-unpause gate | existing initialization/configuration suite plus full package tests |
| `createCommitmentPayoutPlan`, `getPayoutPlan`, `payoutPlanOfCommitment` | Immutable payer/provider/shape, zero payer rejection, active beneficiary | `SettlementPayer.t.sol`; `Settlement.t.sol` |
| `setContributorPayouts`, `contributorPayoutOf`, `payoutContributors`, `MAX_PAYOUT_CONTRIBUTORS` | Recognition-bound complete vector, retention/conservation, stable order | `testCrossGardenContributorPlanRejectsRetention`; `testGardenInternalContributorPlanMayRetainAndConserves`; existing plan tests |
| `finalizeCommitmentPayoutPlan`, `payoutPlanStatus` | Immutable finalization; beneficiary never completes locally | beneficiary success/failure/cancel tests |
| `prepareContributorPayout`, `prepareGardenBeneficiaryPayout` | Idempotent child creation and claimant-based recipient rules | `SettlementPayer.t.sol`; existing full plan suite |
| `queueFunding` | Protocol-to-garden only, active source and target accounts | source security batch/dispatcher tests plus existing funding tests |
| `createBatch`, `getBatch` | Homogeneous immutable membership, unique entries and recipients | `testQueuedBatchCancellationIsAtomic`; existing lifecycle tests |
| `dispatchDisbursement`, `dispatchBatch` | Stable command tuple, account rechecks, batch/member mirrored state | `testBatchExecutionKeySeparatesBatchFromSameNumberedChild`; CCIP integration tests |
| `retryCommand`, `retryBatchCommand`, `commandRecord`, `quoteCommandFee`, `isAcknowledgmentPending` | Exact route/payload/attempt snapshot and message-to-key binding | `testCommandRetryUsesOriginalRouteSnapshotAfterPeerRotation`; existing acknowledgment tests |
| `requeue` | Authenticated failure only, new attempt, stale execution data cleared | `testBeneficiaryFailureRequeueAndCancelMovesParentCounters`; `testExecutionFailureRequeuesIntoNewAttemptAndThenConfirms` |
| `cancelDisbursement`, `cancelBatch` | Queued or Failed child only; queued batch cancels atomically | beneficiary cancellation test; `testQueuedBatchCancellationIsAtomic` |
| `getDisbursement` | Every lifecycle transition remains externally inspectable | all source lifecycle tests |
| `CCIP_ROUTER`, `SOURCE_CHAIN_SELECTOR`, `DESTINATION_EVM_CHAIN_ID` | Immutable across UUPS upgrades | `testSourceUpgradeRejectsImmutableRouterAndChainChanges`; rollback test |
| inherited `upgradeToAndCall` | Owner-only, paused-only, immutable identity, rollback-safe state | three source upgrade tests |
| inherited `ccipReceive` | Router-only, snapshotted selector/sender, no tokens, current message key | command retry/ack test plus existing acknowledgment suite |

## Celo executor

| Selector or selector group | Requirement | Direct proof |
|---|---|---|
| `initialize`, `paused`, `sourcePeer` | Paused-first source identity and protocol version | shared executor setup; peer rotation tests |
| `configureGardenRoute`, `gardenRouteOf` | Safe/Roles membership, no executor ownership, one Safe per garden | shared executor setup and beneficiary route test |
| `setGardenRouteActive` | Paused-only route availability and beneficiary validation | `testGardenBeneficiaryRequiresRegisteredActiveSafe`; cross-chain failure/recovery test |
| `setSourcePeer`, `sourcePeer` | Current/previous peer, expiry, no version grace | `testPreviousPeerWorksDuringGraceAndFailsAfterExpiry`; `testPeerVersionRotationCannotCarryGrace` |
| `setCaps`, `maxBatchSize`, `maxTransferAmount`, `maxBatchAmount`, `HARD_MAX_BATCH_SIZE` | Per-transfer, aggregate, configured and hard batch bounds | `testTransferBatchAndFeeCapsAtBoundaries`; bounded transfer fuzz test |
| `setFeePolicy`, `maxFeeBps`, `maxFeeAmount` | Exact-net sender-paid fee only; proportional and absolute ceilings | sender/receiver fee tests; boundary test |
| `setPeriodicCap`, `periodDuration`, `maxPeriodAmount`, `gardenPeriodSpend` | Period spend cannot exceed cap and resets only at boundary | `testPeriodicCapResetsOnlyAtBoundary`; `invariantPeriodSpendNeverExceedsConfiguredCap` |
| `setAcknowledgmentFeeReserveMinimum`, `acknowledgmentFeeReserveMinimum`, `nativeFeeBalance`, `isAcknowledgmentFeeReserveLow` | Sponsored sends preserve reserve floor | caller-funded/sponsored retry tests |
| `setPaused` | Complete policy required before execution; pause rejects new commands | existing setup and peer/configuration tests |
| `retryAcknowledgment`, `quoteAcknowledgmentFee` | Exact caller funding, stored receiver/version, no second G$ transfer | caller-funded unit and integration retry tests |
| `retryAcknowledgmentSponsored` | Owner-only reserve send, no second G$ transfer | `testSponsoredAcknowledgmentRetrySpendsOnlyExcessReserve` |
| `fundAcknowledgmentFees`, `withdrawExcessAcknowledgmentFees` | Observable funding and floor-preserving withdrawal | `testAcknowledgmentFeeWithdrawalPreservesFloor` |
| `executionResultOf` | Idempotent result, bounded failure and deferral codes | duplicate, malformed, cap, fee, and deferral tests |
| `CCIP_ROUTER`, `G_DOLLAR_TOKEN` | Both immutable across UUPS upgrades | executor upgrade mismatch and rollback tests |
| inherited `upgradeToAndCall` | Owner-only, paused-only, immutable configuration, rollback-safe state | two executor upgrade tests |
| inherited `ccipReceive` | Router/source/sender/version/token authentication and idempotency | existing executor unit tests plus peer expiry test |
| public self-call execution boundary | No arbitrary caller can invoke Safe transfers | `testSelfOnlyBatchExecutionRejectsExternalCaller` |

## Cross-chain lifecycle proof

| Requirement | Proof |
|---|---|
| Payer Safe to beneficiary Safe command/acknowledgment | `testGardenBeneficiaryCommandExecutesAndAcknowledgesEndToEnd` |
| Authenticated failure, source requeue, attempt increment, later success | `testExecutionFailureRequeuesIntoNewAttemptAndThenConfirms` |
| Deferred acknowledgment, exact caller-funded retry, no duplicate transfer | `testCallerFundedAcknowledgmentRetryCompletesWithoutSecondTransfer` |
| Same numeric child and batch IDs remain domain-separated | `testBatchExecutionKeySeparatesBatchFromSameNumberedChild` |
| Payer and beneficiary facts survive the asynchronous boundary | `DualChainSettlement.t.sol` |

The two-process courier is deliberately not added here: this checkpoint forbids deployment/courier
tooling and treats that proof as a deferred release-path gate. The in-process asynchronous routers
prove command/ack ordering and retry semantics without sharing contract state, but they do not
stand in for the later two-Anvil courier rehearsal.
