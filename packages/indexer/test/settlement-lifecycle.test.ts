import assert from "assert";
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";

import { CeloSettlementExecutor, createTestIndexer, processEvents, SettlementModule } from "./v3";
import { settlementMessage } from "./helpers/settlement-messages";
import { assertRelationshipInEitherOrder } from "./helpers/delivery";
import { addr, CHAINS, mockEvent as buildEvent, txHash } from "./helpers/events";
import { executorConfiguration, sourceConfiguration } from "../src/handlers/settlement-projections";

const CHAIN_ID = CHAINS.arbitrum;
// The executor contract is indexed on Celo; Arbitrum is its remote lane.
const EXECUTOR_CHAIN_ID = CHAINS.celo;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const SNAPSHOT_PARAMETERS = parseAbiParameters(
  "uint256, uint256, uint32, uint256, uint256, (address contributor,address recipient,uint16 recognitionWeightBps,uint16 paymentWeightBps,uint256 amount)[]"
);

function celoEvent(timestamp: number, logIndex = 0) {
  return buildEvent(EXECUTOR_CHAIN_ID, timestamp, { logIndex });
}

function sourceEvent(timestamp: number, logIndex = 0) {
  return buildEvent(CHAIN_ID, timestamp, { logIndex });
}

function seedSourceLane(mockDb: ReturnType<typeof createTestIndexer>): void {
  mockDb.SettlementConfiguration.set({
    ...sourceConfiguration(CHAIN_ID, addr(90), addr(91), 0),
    localRouter: addr(92),
    localChainSelector: 4_949_039_107_694_359_620n,
    remoteChainSelector: 16_688_752_181_858_512n,
    remoteEvmChainId: 42_220,
  });
}

function seedExecutorLane(mockDb: ReturnType<typeof createTestIndexer>): void {
  mockDb.SettlementConfiguration.set({
    ...executorConfiguration(EXECUTOR_CHAIN_ID, addr(90), 0),
    gDollarToken: addr(91),
    localRouter: addr(92),
    localChainSelector: 16_688_752_181_858_512n,
    remoteChainSelector: 4_949_039_107_694_359_620n,
    remoteEvmChainId: CHAIN_ID,
  });
}

function payoutPlanCreated(payoutPlanId: bigint, commitmentId: bigint, timestamp: number) {
  return SettlementModule.CommitmentPayoutPlanCreated.createMockEvent({
    payoutPlanId,
    commitmentId,
    providerGarden: addr(2),
    payerGarden: addr(1),
    source: addr(4),
    token: addr(91),
    payoutKind: 0n,
    declaredAmount: 300n,
    gardenRetainedAmount: 0n,
    beneficiaryGarden: ZERO_ADDRESS,
    beneficiaryRecipient: ZERO_ADDRESS,
    beneficiaryAmount: 0n,
    recognitionSnapshotHash: ZERO_BYTES32,
    createdBy: addr(5),
    mockEventData: sourceEvent(timestamp),
  });
}

function payoutPlanFinalized(payoutPlanId: bigint, payablePayoutCount: bigint, timestamp: number) {
  return SettlementModule.CommitmentPayoutPlanFinalized.createMockEvent({
    payoutPlanId,
    payoutKind: 0n,
    payablePayoutCount,
    contributorPayoutTotal: 300n,
    beneficiaryAmount: 0n,
    gardenRetainedAmount: 0n,
    recognitionSnapshotHash: ZERO_BYTES32,
    paymentSnapshotHash: txHash(700),
    completedWithoutDispatch: false,
    finalizedAt: BigInt(timestamp),
    mockEventData: sourceEvent(timestamp),
  });
}

function queued(
  payoutPlanId: bigint,
  commitmentId: bigint,
  disbursementId: bigint,
  contributor: string,
  amount: bigint,
  timestamp: number
) {
  return SettlementModule.DisbursementQueued.createMockEvent({
    disbursementId,
    commitmentId,
    garden: addr(1),
    payoutPlanId,
    contributor,
    executorGarden: addr(1),
    kind: 0n,
    fundingRoute: 0n,
    source: addr(4),
    recipient: contributor,
    token: addr(91),
    amount,
    mockEventData: sourceEvent(timestamp),
  });
}

function stranded(executionKey: string, isBatch: boolean, subjectId: bigint, timestamp: number) {
  return SettlementModule.StrandedSubjectFailed.createMockEvent({
    executionKey,
    isBatch,
    subjectId,
    retiredExecutor: addr(80),
    mockEventData: sourceEvent(timestamp),
  });
}

describe("settlement lifecycle projections", () => {
  it("projects account, route, dispatcher, pause, and source fee-reserve configuration", async () => {
    let mockDb = createTestIndexer();
    mockDb = await processEvents(mockDb, [
      SettlementModule.SettlementAccountRegistered.createMockEvent({
        garden: addr(1),
        chainId: 42_220n,
        account: addr(2),
        recoveryOwners: [addr(3), addr(4), addr(5)],
        rolesModifier: addr(6),
        roleKey: txHash(1),
        allowanceKey: txHash(2),
        permissionsConfigHash: txHash(3),
        recoveryConfigHash: txHash(4),
        recoveryThreshold: 2n,
        mockEventData: sourceEvent(1),
      }),
      SettlementModule.SettlementRecoveryUpdated.createMockEvent({
        garden: addr(1),
        recoveryOwners: [addr(7), addr(8), addr(9)],
        recoveryConfigHash: txHash(5),
        mockEventData: sourceEvent(2),
      }),
      SettlementModule.SettlementAccountStatusChanged.createMockEvent({
        garden: addr(1),
        active: false,
        mockEventData: sourceEvent(3),
      }),
      SettlementModule.CcipRouteUpdated.createMockEvent({
        destinationChainSelector: 16_688_752_181_858_512n,
        destinationExecutor: addr(80),
        previousDestinationExecutor: addr(79),
        previousPeerExpiresAt: 99n,
        destinationGasLimit: 600_000n,
        protocolVersion: 2n,
        mockEventData: sourceEvent(4),
      }),
      SettlementModule.GardenerDeliveryStatusChanged.createMockEvent({
        enabled: true,
        mockEventData: sourceEvent(5),
      }),
      SettlementModule.BatchSizeLimitUpdated.createMockEvent({
        previousLimit: 0n,
        limit: 12n,
        mockEventData: sourceEvent(6),
      }),
      SettlementModule.DispatcherUpdated.createMockEvent({
        previousDispatcher: ZERO_ADDRESS,
        dispatcher: addr(10),
        mockEventData: sourceEvent(7),
      }),
      SettlementModule.FeeReserveMinimumUpdated.createMockEvent({
        previousMinimum: 0n,
        minimum: 10n,
        mockEventData: sourceEvent(8),
      }),
      SettlementModule.FeeReserveFunded.createMockEvent({
        funder: addr(11),
        amount: 30n,
        mockEventData: sourceEvent(9),
      }),
      SettlementModule.ExcessFeesWithdrawn.createMockEvent({
        recipient: addr(12),
        amount: 7n,
        mockEventData: sourceEvent(10),
      }),
      SettlementModule.HatsModuleUpdated.createMockEvent({
        previousModule: ZERO_ADDRESS,
        newModule: addr(13),
        mockEventData: sourceEvent(11),
      }),
      SettlementModule.CommitmentPoolingModuleUpdated.createMockEvent({
        previousModule: ZERO_ADDRESS,
        newModule: addr(14),
        mockEventData: sourceEvent(12),
      }),
      SettlementModule.PausedSet.createMockEvent({
        paused: false,
        mockEventData: sourceEvent(13),
      }),
    ]);

    const account = await mockDb.SettlementAccount.get(`${CHAIN_ID}-${addr(1).toLowerCase()}`);
    const config = await mockDb.SettlementConfiguration.get(`${CHAIN_ID}-settlement-config`);
    assert.ok(account);
    assert.equal(account.active, false);
    assert.deepEqual(
      account.recoveryOwners,
      [addr(7), addr(8), addr(9)].map((a) => a.toLowerCase())
    );
    assert.equal(config?.activePeer, addr(80).toLowerCase());
    assert.equal(config?.previousPeer, addr(79).toLowerCase());
    assert.equal(config?.destinationGasLimit, 600_000);
    assert.equal(config?.gardenerDeliveryEnabled, true);
    assert.equal(config?.batchSizeLimit, 12);
    assert.equal(config?.dispatcher, addr(10).toLowerCase());
    assert.equal(config?.nativeFeeBalance, 23n);
    assert.equal(config?.feeReserveLow, false);
    assert.equal(config?.peerConfigured, false);
    assert.equal(config?.paused, false);
  });

  it("publishes contributor payouts only after a complete hash-valid snapshot", async () => {
    const payoutPlanId = 30n;
    const rows = [
      {
        contributor: addr(20),
        recipient: addr(21),
        recognitionWeightBps: 6_000,
        paymentWeightBps: 6_000,
        amount: 180n,
      },
      {
        contributor: addr(22),
        recipient: addr(23),
        recognitionWeightBps: 4_000,
        paymentWeightBps: 4_000,
        amount: 120n,
      },
    ];
    const snapshotHash = keccak256(
      encodeAbiParameters(SNAPSHOT_PARAMETERS, [BigInt(CHAIN_ID), payoutPlanId, 1, 0n, 300n, rows])
    );
    let mockDb = createTestIndexer();
    mockDb = await processEvents(mockDb, [
      SettlementModule.CommitmentPayoutSnapshotCommitted.createMockEvent({
        payoutPlanId,
        paymentSnapshotVersion: 1n,
        rowCount: 2n,
        gardenRetainedAmount: 0n,
        contributorPayoutTotal: 300n,
        paymentSnapshotHash: snapshotHash,
        reasonCID: "ipfs://snapshot-1",
        editedBy: addr(24),
        mockEventData: sourceEvent(1),
      }),
      ...rows.map((row, index) =>
        SettlementModule.ContributorPayoutSet.createMockEvent({
          payoutPlanId,
          paymentSnapshotVersion: 1n,
          ...row,
          reasonCID: "ipfs://snapshot-1",
          editedBy: addr(24),
          mockEventData: sourceEvent(2 + index),
        })
      ),
      payoutPlanCreated(payoutPlanId, 300n, 4),
    ]);

    const first = await mockDb.ContributorPayout.get(
      `${CHAIN_ID}-${payoutPlanId}-${addr(20).toLowerCase()}`
    );
    assert.ok(first);
    assert.equal(first.recipient, addr(21).toLowerCase());
    assert.equal(first.paymentSnapshotVersion, 1);

    mockDb = await processEvents(mockDb, [
      SettlementModule.ContributorPayoutSet.createMockEvent({
        payoutPlanId,
        paymentSnapshotVersion: 2n,
        contributor: addr(20),
        recipient: addr(25),
        recognitionWeightBps: 10_000n,
        paymentWeightBps: 10_000n,
        amount: 300n,
        reasonCID: "ipfs://bad-snapshot",
        editedBy: addr(24),
        mockEventData: sourceEvent(5),
      }),
      SettlementModule.CommitmentPayoutSnapshotCommitted.createMockEvent({
        payoutPlanId,
        paymentSnapshotVersion: 2n,
        rowCount: 1n,
        gardenRetainedAmount: 0n,
        contributorPayoutTotal: 300n,
        paymentSnapshotHash: txHash(999),
        reasonCID: "ipfs://bad-snapshot",
        editedBy: addr(24),
        mockEventData: sourceEvent(6),
      }),
    ]);
    const unchanged = await mockDb.ContributorPayout.get(
      `${CHAIN_ID}-${payoutPlanId}-${addr(20).toLowerCase()}`
    );
    assert.equal(unchanged?.recipient, addr(21).toLowerCase());
    assert.equal(unchanged?.paymentSnapshotVersion, 1);

    const replacementRows = [
      {
        contributor: addr(20),
        recipient: addr(25),
        recognitionWeightBps: 10_000,
        paymentWeightBps: 10_000,
        amount: 300n,
      },
    ];
    const replacementHash = keccak256(
      encodeAbiParameters(SNAPSHOT_PARAMETERS, [
        BigInt(CHAIN_ID),
        payoutPlanId,
        3,
        0n,
        300n,
        replacementRows,
      ])
    );
    mockDb = await processEvents(mockDb, [
      SettlementModule.ContributorPayoutSet.createMockEvent({
        payoutPlanId,
        paymentSnapshotVersion: 3n,
        ...replacementRows[0],
        reasonCID: "ipfs://snapshot-3",
        editedBy: addr(24),
        mockEventData: sourceEvent(7),
      }),
      SettlementModule.CommitmentPayoutSnapshotCommitted.createMockEvent({
        payoutPlanId,
        paymentSnapshotVersion: 3n,
        rowCount: 1n,
        gardenRetainedAmount: 0n,
        contributorPayoutTotal: 300n,
        paymentSnapshotHash: replacementHash,
        reasonCID: "ipfs://snapshot-3",
        editedBy: addr(24),
        mockEventData: sourceEvent(8),
      }),
    ]);
    const replacement = await mockDb.ContributorPayout.get(
      `${CHAIN_ID}-${payoutPlanId}-${addr(20).toLowerCase()}`
    );
    const removed = await mockDb.ContributorPayout.get(
      `${CHAIN_ID}-${payoutPlanId}-${addr(22).toLowerCase()}`
    );
    const replacedPlan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-${payoutPlanId}`);
    assert.equal(replacement?.recipient, addr(25).toLowerCase());
    assert.equal(replacement?.paymentSnapshotVersion, 3);
    assert.equal(removed, undefined);
    assert.deepEqual(replacedPlan?.contributorPayoutEntityIds, [replacement?.id]);
  });

  it("reconciles a reverse-ordered batch command and acknowledgment to every child", async () => {
    const message = settlementMessage(100, { isBatch: true, subjectId: 50n });
    const commandAndAcknowledgment = [
      SettlementModule.SettlementCommandDispatched.createMockEvent({
        ...message.source.dispatched,
        mockEventData: sourceEvent(3),
      }),
      SettlementModule.SettlementAcknowledged.createMockEvent({
        ...message.source.acknowledged(),
        mockEventData: sourceEvent(4),
      }),
    ];
    const batchAndChildren = [
      SettlementModule.BatchCreated.createMockEvent({
        batchId: 50n,
        executorGarden: addr(1),
        source: addr(4),
        token: addr(91),
        kind: 0n,
        fundingRoute: 0n,
        disbursementIds: [51n, 52n],
        mockEventData: sourceEvent(5),
      }),
      queued(40n, 400n, 51n, addr(20), 180n, 6),
      queued(40n, 400n, 52n, addr(22), 120n, 7),
    ];
    const [projection] = await assertRelationshipInEitherOrder({
      relationship: commandAndAcknowledgment,
      entity: batchAndChildren,
      read: async (ordered) => {
        let db = createTestIndexer();
        seedSourceLane(db);
        db = await processEvents(db, [
          payoutPlanCreated(40n, 400n, 1),
          payoutPlanFinalized(40n, 2n, 2),
          ...ordered,
        ]);
        const batch = await db.SettlementBatch.get(`${CHAIN_ID}-50`);
        const first = await db.Disbursement.get(`${CHAIN_ID}-51`);
        const second = await db.Disbursement.get(`${CHAIN_ID}-52`);
        const plan = await db.CommitmentPayoutPlan.get(`${CHAIN_ID}-40`);
        const acknowledgment = await db.SettlementMessage.get(
          `${CHAIN_ID}-${message.ids.acknowledgmentMessageId}`
        );
        return {
          batchState: batch?.state,
          firstState: first?.state,
          secondState: second?.state,
          firstBatchId: first?.batchId,
          confirmedPayoutCount: plan?.confirmedPayoutCount,
          planStatus: plan?.status,
          acknowledgmentStatus: acknowledgment?.status,
        };
      },
    });

    assert.equal(projection.batchState, "CONFIRMED");
    assert.equal(projection.firstState, "CONFIRMED");
    assert.equal(projection.secondState, "CONFIRMED");
    assert.equal(projection.firstBatchId, 50n);
    assert.equal(projection.confirmedPayoutCount, 2);
    assert.equal(projection.planStatus, "COMPLETE");
    assert.equal(projection.acknowledgmentStatus, "ACKNOWLEDGED");
  });

  it("preserves retry history and ignores duplicate or stale acknowledgments idempotently", async () => {
    const message = settlementMessage(200, { subjectId: 61n });
    let mockDb = createTestIndexer();
    seedSourceLane(mockDb);
    mockDb = await processEvents(mockDb, [
      payoutPlanCreated(60n, 600n, 1),
      payoutPlanFinalized(60n, 1n, 2),
      queued(60n, 600n, 61n, addr(20), 300n, 3),
      SettlementModule.SettlementCommandDispatched.createMockEvent({
        ...message.source.dispatched,
        mockEventData: sourceEvent(4),
      }),
      SettlementModule.SettlementAcknowledged.createMockEvent({
        ...message.source.acknowledged({ success: false }),
        mockEventData: sourceEvent(5),
      }),
      SettlementModule.DuplicateAcknowledgmentIgnored.createMockEvent({
        executionKey: message.ids.executionKey,
        acknowledgmentMessageId: message.ids.duplicateAcknowledgmentMessageId,
        mockEventData: sourceEvent(6),
      }),
      SettlementModule.StaleAcknowledgmentIgnored.createMockEvent({
        executionKey: message.ids.executionKey,
        acknowledgmentMessageId: message.ids.staleAcknowledgmentMessageId,
        mockEventData: sourceEvent(7),
      }),
      SettlementModule.DisbursementRequeued.createMockEvent({
        disbursementId: 61n,
        attempt: 1n,
        mockEventData: sourceEvent(8),
      }),
      SettlementModule.SettlementCommandRetried.createMockEvent({
        ...message.source.retried,
        mockEventData: sourceEvent(9),
      }),
      SettlementModule.SettlementAcknowledged.createMockEvent({
        ...message.source.acknowledged({ retry: true }),
        mockEventData: sourceEvent(10),
      }),
    ]);

    const disbursement = await mockDb.Disbursement.get(`${CHAIN_ID}-61`);
    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-60`);
    assert.equal(disbursement?.state, "CONFIRMED");
    assert.equal(disbursement?.attempt, 1);
    assert.equal(plan?.failedPayoutCount, 0);
    assert.equal(plan?.confirmedPayoutCount, 1);
    assert.equal(
      (
        await mockDb.SettlementMessage.get(
          `${CHAIN_ID}-${message.ids.duplicateAcknowledgmentMessageId}`
        )
      )?.status,
      "DUPLICATE"
    );
    assert.equal(
      (
        await mockDb.SettlementMessage.get(
          `${CHAIN_ID}-${message.ids.staleAcknowledgmentMessageId}`
        )
      )?.status,
      "STALE"
    );
  });

  it("preserves attempt timestamps across same-key transport retries", async () => {
    const message = settlementMessage(220, { subjectId: 63n });
    let mockDb = createTestIndexer();
    seedSourceLane(mockDb);
    mockDb = await processEvents(mockDb, [
      payoutPlanCreated(62n, 620n, 1),
      payoutPlanFinalized(62n, 1n, 2),
      queued(62n, 620n, 63n, addr(20), 300n, 3),
      SettlementModule.SettlementCommandDispatched.createMockEvent({
        ...message.source.dispatched,
        mockEventData: sourceEvent(4),
      }),
      SettlementModule.SettlementCommandRetried.createMockEvent({
        ...message.source.retried,
        executionKey: message.ids.executionKey,
        attempt: 0n,
        mockEventData: sourceEvent(9),
      }),
    ]);

    const commandIndex = await mockDb.SettlementCommandIndex.get(
      `${CHAIN_ID}-${message.ids.executionKey.toLowerCase()}`
    );
    const subject = await mockDb.SettlementSubjectState.get(`${CHAIN_ID}-D-63`);
    const disbursement = await mockDb.Disbursement.get(`${CHAIN_ID}-63`);
    assert.equal(commandIndex?.commandMessageId, message.ids.retryCommandMessageId.toLowerCase());
    assert.equal(commandIndex?.createdAt, 4);
    assert.equal(commandIndex?.updatedAt, 9);
    assert.equal(subject?.commandMessageId, message.ids.retryCommandMessageId.toLowerCase());
    assert.equal(subject?.dispatchedAt, 4);
    assert.equal(subject?.updatedAt, 9);
    assert.equal(disbursement?.commandMessageId, message.ids.retryCommandMessageId.toLowerCase());
    assert.equal(disbursement?.dispatchedAt, 4);
    assert.equal(disbursement?.updatedAt, 9);
  });

  it("cancels a batch and every child without clearing stable payout pointers", async () => {
    let mockDb = createTestIndexer();
    mockDb = await processEvents(mockDb, [
      payoutPlanCreated(70n, 700n, 1),
      payoutPlanFinalized(70n, 2n, 2),
      queued(70n, 700n, 71n, addr(20), 180n, 3),
      queued(70n, 700n, 72n, addr(22), 120n, 4),
      SettlementModule.BatchCreated.createMockEvent({
        batchId: 73n,
        executorGarden: addr(1),
        source: addr(4),
        token: addr(91),
        kind: 0n,
        fundingRoute: 0n,
        disbursementIds: [71n, 72n],
        mockEventData: sourceEvent(5),
      }),
      SettlementModule.BatchCancelled.createMockEvent({
        batchId: 73n,
        actor: addr(10),
        reasonCID: "ipfs://cancelled-batch",
        mockEventData: sourceEvent(6),
      }),
    ]);

    const batch = await mockDb.SettlementBatch.get(`${CHAIN_ID}-73`);
    const first = await mockDb.Disbursement.get(`${CHAIN_ID}-71`);
    const second = await mockDb.Disbursement.get(`${CHAIN_ID}-72`);
    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-70`);
    assert.equal(batch?.state, "CANCELLED");
    assert.equal(first?.state, "CANCELLED");
    assert.equal(second?.state, "CANCELLED");
    assert.equal(first?.payoutPlanEntityId, `${CHAIN_ID}-70`);
    assert.equal(second?.payoutPlanEntityId, `${CHAIN_ID}-70`);
    assert.equal(plan?.cancelledPayoutCount, 2);
    assert.equal(plan?.status, "FAILED");
  });

  it("projects a stranded batch failure to every child and payout-plan counter", async () => {
    const message = settlementMessage(280, { isBatch: true, subjectId: 83n });
    let mockDb = createTestIndexer();
    seedSourceLane(mockDb);
    mockDb = await processEvents(mockDb, [
      payoutPlanCreated(80n, 800n, 1),
      payoutPlanFinalized(80n, 2n, 2),
      queued(80n, 800n, 81n, addr(20), 180n, 3),
      queued(80n, 800n, 82n, addr(22), 120n, 4),
      SettlementModule.BatchCreated.createMockEvent({
        batchId: 83n,
        executorGarden: addr(1),
        source: addr(4),
        token: addr(91),
        kind: 0n,
        fundingRoute: 0n,
        disbursementIds: [81n, 82n],
        mockEventData: sourceEvent(5),
      }),
      SettlementModule.SettlementCommandDispatched.createMockEvent({
        ...message.source.dispatched,
        mockEventData: sourceEvent(6),
      }),
      stranded(message.ids.executionKey, true, 83n, 7),
    ]);

    const batch = await mockDb.SettlementBatch.get(`${CHAIN_ID}-83`);
    const first = await mockDb.Disbursement.get(`${CHAIN_ID}-81`);
    const second = await mockDb.Disbursement.get(`${CHAIN_ID}-82`);
    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-80`);
    const subject = await mockDb.SettlementSubjectState.get(`${CHAIN_ID}-B-83`);
    assert.equal(batch?.state, "FAILED");
    assert.equal(first?.state, "FAILED");
    assert.equal(second?.state, "FAILED");
    assert.equal(batch?.failureCode, 12);
    assert.equal(first?.failureCode, 12);
    assert.equal(subject?.state, "FAILED");
    assert.equal(plan?.failedPayoutCount, 2);
    assert.equal(plan?.status, "FAILED");

    mockDb = await processEvents(mockDb, [
      SettlementModule.DisbursementRequeued.createMockEvent({
        disbursementId: 81n,
        attempt: 1n,
        mockEventData: sourceEvent(8),
      }),
    ]);
    assert.equal((await mockDb.Disbursement.get(`${CHAIN_ID}-81`))?.state, "QUEUED");
    assert.equal((await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-80`))?.failedPayoutCount, 1);
  });

  it("projects an unbatched stranded failure without inventing an acknowledgment", async () => {
    const message = settlementMessage(290, { subjectId: 91n });
    let mockDb = createTestIndexer();
    seedSourceLane(mockDb);
    mockDb = await processEvents(mockDb, [
      payoutPlanCreated(90n, 900n, 1),
      payoutPlanFinalized(90n, 1n, 2),
      queued(90n, 900n, 91n, addr(20), 300n, 3),
      SettlementModule.SettlementCommandDispatched.createMockEvent({
        ...message.source.dispatched,
        mockEventData: sourceEvent(4),
      }),
      stranded(message.ids.executionKey, false, 91n, 5),
    ]);

    const disbursement = await mockDb.Disbursement.get(`${CHAIN_ID}-91`);
    const subject = await mockDb.SettlementSubjectState.get(`${CHAIN_ID}-D-91`);
    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-90`);
    assert.equal(disbursement?.state, "FAILED");
    assert.equal(disbursement?.failureCode, 12);
    assert.equal(disbursement?.acknowledgmentMessageId, undefined);
    assert.equal(subject?.state, "FAILED");
    assert.equal(subject?.acknowledgmentMessageId, undefined);
    assert.equal(plan?.failedPayoutCount, 1);

    const attemptId = `${CHAIN_ID}-${message.ids.executionKey.toLowerCase()}`;
    const failedAttempt = await mockDb.SettlementCommandIndex.get(attemptId);
    assert.equal(failedAttempt?.state, "FAILED");
    assert.equal(failedAttempt?.failureCode, 12);
    assert.equal(failedAttempt?.resolvedAt, 5);

    mockDb = await processEvents(mockDb, [
      SettlementModule.DisbursementRequeued.createMockEvent({
        disbursementId: 91n,
        attempt: 1n,
        mockEventData: sourceEvent(6),
      }),
    ]);
    const requeued = await mockDb.Disbursement.get(`${CHAIN_ID}-91`);
    const retainedAttempt = await mockDb.SettlementCommandIndex.get(attemptId);
    assert.equal(requeued?.state, "QUEUED");
    assert.equal(requeued?.failureCode, undefined);
    assert.equal(retainedAttempt?.state, "FAILED");
    assert.equal(retainedAttempt?.failureCode, 12);
    assert.equal(retainedAttempt?.resolvedAt, 5);
  });

  it("projects executor peer, policy, route, execution, deferral, duplicate, and ack reserve", async () => {
    const message = settlementMessage(300, { subjectId: 77n });
    let mockDb = createTestIndexer();
    seedExecutorLane(mockDb);
    mockDb = await processEvents(mockDb, [
      CeloSettlementExecutor.SourcePeerUpdated.createMockEvent({
        sourceChainSelector: 4_949_039_107_694_359_620n,
        sourceSettlementModule: addr(70),
        previousSourceSettlementModule: addr(69),
        previousPeerExpiresAt: 100n,
        protocolVersion: 1n,
        mockEventData: celoEvent(1),
      }),
      CeloSettlementExecutor.CapsUpdated.createMockEvent({
        maxBatchSize: 12n,
        maxTransferAmount: 1_000n,
        maxBatchAmount: 5_000n,
        mockEventData: celoEvent(2),
      }),
      CeloSettlementExecutor.FeePolicyUpdated.createMockEvent({
        maxFeeBps: 100n,
        maxFeeAmount: 25n,
        mockEventData: celoEvent(3),
      }),
      CeloSettlementExecutor.PeriodicCapUpdated.createMockEvent({
        periodDuration: 86_400n,
        maxPeriodAmount: 10_000n,
        mockEventData: celoEvent(4),
      }),
      CeloSettlementExecutor.AcknowledgmentFeeReserveMinimumUpdated.createMockEvent({
        previousMinimum: 0n,
        minimum: 10n,
        mockEventData: celoEvent(5),
      }),
      CeloSettlementExecutor.AcknowledgmentFeeReserveFunded.createMockEvent({
        funder: addr(71),
        amount: 100n,
        mockEventData: celoEvent(6),
      }),
      CeloSettlementExecutor.GardenRouteConfigured.createMockEvent({
        garden: addr(1),
        safe: addr(72),
        rolesModifier: addr(73),
        roleKey: txHash(310),
        allowanceKey: txHash(311),
        permissionsConfigHash: txHash(312),
        mockEventData: celoEvent(7),
      }),
      CeloSettlementExecutor.GardenRouteStatusChanged.createMockEvent({
        garden: addr(1),
        active: false,
        mockEventData: celoEvent(8),
      }),
      CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
        ...message.executor.stored,
        mockEventData: celoEvent(9),
      }),
      CeloSettlementExecutor.AcknowledgmentDeferred.createMockEvent({
        ...message.executor.deferred,
        mockEventData: celoEvent(10),
      }),
      CeloSettlementExecutor.AcknowledgmentSent.createMockEvent({
        ...message.executor.acknowledgmentSent,
        mockEventData: celoEvent(11),
      }),
      CeloSettlementExecutor.DuplicateSettlementMessage.createMockEvent({
        ...message.executor.duplicate,
        mockEventData: celoEvent(12),
      }),
      CeloSettlementExecutor.ExcessAcknowledgmentFeesWithdrawn.createMockEvent({
        recipient: addr(74),
        amount: 15n,
        mockEventData: celoEvent(13),
      }),
      CeloSettlementExecutor.PausedSet.createMockEvent({
        paused: false,
        mockEventData: celoEvent(14),
      }),
    ]);

    const config = await mockDb.SettlementConfiguration.get(
      `${EXECUTOR_CHAIN_ID}-settlement-config`
    );
    const route = await mockDb.SettlementGardenRoute.get(
      `${EXECUTOR_CHAIN_ID}-${addr(1).toLowerCase()}`
    );
    const execution = await mockDb.SettlementExecution.get(
      `${EXECUTOR_CHAIN_ID}-${message.ids.executionKey}`
    );
    assert.equal(config?.role, "EXECUTOR");
    assert.equal(config?.batchSizeLimit, 12);
    assert.equal(config?.nativeFeeBalance, 80n);
    assert.equal(config?.paused, false);
    assert.equal(route?.active, false);
    assert.equal(execution?.status, "SUCCESS");
    assert.equal(execution?.acknowledgmentSent, true);
    assert.equal(execution?.acknowledgmentDeferralCode, "NONE");
    assert.deepEqual(execution?.duplicateMessageIds, [message.ids.duplicateCommandMessageId]);
    assert.equal(
      (
        await mockDb.SettlementMessage.get(
          `${EXECUTOR_CHAIN_ID}-${message.ids.acknowledgmentMessageId}`
        )
      )?.reserveFunded,
      true
    );
  });

  // Every other test here seeds the lane config directly, which is exactly how four entity types
  // came to be permanently uncreated in production without a single failing test: they gate on
  // remoteEvmChainId, and nothing wrote it. This one drives the config through the events the
  // contracts actually emit, so the production write path is covered rather than assumed.
  it("learns router, selector, and remote chain id from the contracts themselves", async () => {
    const mockDb = createTestIndexer();

    const pinned = SettlementModule.SettlementDeploymentPinned.createMockEvent({
      ccipRouter: addr(92),
      localChainSelector: 4_949_039_107_694_359_620n,
      remoteEvmChainId: 42_220n,
      mockEventData: sourceEvent(1_000),
    });
    const after = await processEvents(mockDb, [pinned]);

    const config = await after.SettlementConfiguration.get(`${CHAIN_ID}-settlement-config`);
    assert.equal(config?.localRouter, addr(92).toLowerCase());
    assert.equal(config?.localChainSelector, 4_949_039_107_694_359_620n);
    assert.equal(config?.remoteEvmChainId, 42_220);
  });

  // The executor half needs the same treatment and for a sharper reason: the executor gates garden
  // routes and executions on remoteEvmChainId, and it is the source chain's EVM id — a fact the
  // executor has no other way to state, so it is carried as an implementation immutable.
  it("learns its own selector and the source chain id on the executor side", async () => {
    const mockDb = createTestIndexer();

    const pinned = CeloSettlementExecutor.ExecutorDeploymentPinned.createMockEvent({
      ccipRouter: addr(92),
      gDollarToken: addr(91),
      remoteChainSelector: 4_949_039_107_694_359_620n,
      localChainSelector: 1_346_049_177_634_351_622n,
      sourceEvmChainId: 42_161n,
      mockEventData: celoEvent(1_000),
    });
    const after = await processEvents(mockDb, [pinned]);

    const config = await after.SettlementConfiguration.get(
      `${EXECUTOR_CHAIN_ID}-settlement-config`
    );
    assert.equal(config?.role, "EXECUTOR");
    assert.equal(config?.localChainSelector, 1_346_049_177_634_351_622n);
    assert.equal(config?.remoteEvmChainId, 42_161);
  });
});
