import assert from "node:assert/strict";

import { Addresses, createTestIndexer, SettlementModule } from "./v3";

const CHAIN_ID = 42161;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(timestamp: number) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp, number: timestamp },
    srcAddress: address(90),
    transaction: { hash: hash(timestamp) },
    logIndex: 0,
  };
}

function payoutPlanCreated(payoutPlanId: bigint, commitmentId: bigint, timestamp: number) {
  return SettlementModule.CommitmentPayoutPlanCreated.createMockEvent({
    payoutPlanId,
    commitmentId,
    providerGarden: address(2),
    payerGarden: address(1),
    source: address(4),
    token: address(91),
    payoutKind: 0n,
    declaredAmount: 100n,
    gardenRetainedAmount: 0n,
    beneficiaryGarden: ZERO_ADDRESS,
    beneficiaryRecipient: ZERO_ADDRESS,
    beneficiaryAmount: 0n,
    recognitionSnapshotHash: ZERO_BYTES32,
    createdBy: address(5),
    mockEventData: eventData(timestamp),
  });
}

function payoutPlanFinalized(payoutPlanId: bigint, timestamp: number) {
  return SettlementModule.CommitmentPayoutPlanFinalized.createMockEvent({
    payoutPlanId,
    payoutKind: 0n,
    payablePayoutCount: 0n,
    contributorPayoutTotal: 0n,
    beneficiaryAmount: 0n,
    gardenRetainedAmount: 0n,
    recognitionSnapshotHash: ZERO_BYTES32,
    paymentSnapshotHash: hash(500),
    completedWithoutDispatch: true,
    finalizedAt: BigInt(timestamp),
    mockEventData: eventData(timestamp),
  });
}

function fundingConsumed(fundingId: bigint, commitmentId: bigint, timestamp: number) {
  return SettlementModule.FundingConsumed.createMockEvent({
    fundingId,
    commitmentId,
    funder: address(6),
    depositedAmount: 100n,
    consumedBy: address(7),
    mockEventData: eventData(timestamp),
  });
}

function fundingWithdrawn(fundingId: bigint, commitmentId: bigint, timestamp: number) {
  return SettlementModule.FundingWithdrawn.createMockEvent({
    fundingId,
    commitmentId,
    funder: address(6),
    withdrawnBy: address(7),
    mockEventData: eventData(timestamp),
  });
}

function settlementCommand(
  eventName: "SettlementCommandDispatched" | "SettlementCommandRetried",
  executionKey: string,
  commandMessageId: string,
  subjectId: bigint,
  attempt: bigint,
  timestamp: number
) {
  return SettlementModule[eventName].createMockEvent({
    executionKey,
    commandMessageId,
    isBatch: false,
    subjectId,
    attempt,
    destinationChainSelector: 16_688_752_181_858_512n,
    destinationExecutor: address(80),
    destinationGasLimit: 600_000n,
    protocolVersion: 1n,
    commandPayloadHash: hash(timestamp + 100),
    fee: 3n,
    mockEventData: eventData(timestamp),
  });
}

function settlementAcknowledged(
  executionKey: string,
  acknowledgmentMessageId: string,
  commandMessageId: string,
  subjectId: bigint,
  success: boolean,
  timestamp: number
) {
  return SettlementModule.SettlementAcknowledged.createMockEvent({
    executionKey,
    acknowledgmentMessageId,
    originatingCommandMessageId: commandMessageId,
    isBatch: false,
    subjectId,
    success,
    failureCode: success ? 0n : 8n,
    mockEventData: eventData(timestamp),
  });
}

describe("Settlement review regressions", () => {
  it("indexes FundingWithdrawn in normal, duplicate, and reverse pledge order", async () => {
    const pledge = SettlementModule.FundingPledged.createMockEvent({
      fundingId: 60n,
      commitmentId: 50n,
      funder: address(6),
      garden: address(2),
      refundAccount: address(8),
      expectedAmount: 100n,
      recordedBy: address(7),
      mockEventData: eventData(1),
    });
    const withdrawn = fundingWithdrawn(60n, 50n, 2);

    let db = createTestIndexer();
    db = await SettlementModule.FundingPledged.processEvent({ event: pledge, mockDb: db });
    db = await SettlementModule.FundingWithdrawn.processEvent({ event: withdrawn, mockDb: db });
    db = await SettlementModule.FundingWithdrawn.processEvent({ event: withdrawn, mockDb: db });
    let funding = await db.CommitmentFunding.get(`${CHAIN_ID}-60`);
    const pledgeAudit = (await db.CommitmentEvent.getAll()).find(
      (row) => row.eventType === "FUNDING_PLEDGED"
    );
    assert.equal(funding?.state, "WITHDRAWN");
    assert.equal(funding?.withdrawnAt, 2);
    assert.equal(funding?.closedAt, 2);
    assert.equal(pledgeAudit?.actor, address(7).toLowerCase());

    db = createTestIndexer();
    db = await SettlementModule.FundingWithdrawn.processEvent({ event: withdrawn, mockDb: db });
    db = await SettlementModule.FundingPledged.processEvent({ event: pledge, mockDb: db });
    funding = await db.CommitmentFunding.get(`${CHAIN_ID}-60`);
    assert.equal(funding?.state, "WITHDRAWN");
    assert.equal(funding?.garden, address(2).toLowerCase());
    assert.equal(funding?.refundAccount, address(8).toLowerCase());
  });

  it("applies a pre-existing successful acknowledgment when a refund is queued", async () => {
    let db = createTestIndexer();
    const pledge = SettlementModule.FundingPledged.createMockEvent({
      fundingId: 61n,
      commitmentId: 51n,
      funder: address(6),
      garden: address(2),
      refundAccount: address(8),
      expectedAmount: 100n,
      recordedBy: address(7),
      mockEventData: eventData(1),
    });
    const acknowledgment = SettlementModule.SettlementAcknowledged.createMockEvent({
      executionKey: hash(601),
      acknowledgmentMessageId: hash(602),
      originatingCommandMessageId: hash(603),
      isBatch: false,
      subjectId: 91n,
      success: true,
      failureCode: 0n,
      mockEventData: eventData(3),
    });
    const refund = SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId: 91n,
      commitmentId: 51n,
      garden: address(2),
      payoutPlanId: 0n,
      contributor: address(6),
      executorGarden: address(2),
      kind: 4n,
      fundingRoute: 0n,
      source: address(4),
      recipient: address(8),
      token: address(91),
      amount: 100n,
      mockEventData: eventData(2),
    });
    db = await SettlementModule.FundingPledged.processEvent({ event: pledge, mockDb: db });
    db = await SettlementModule.SettlementAcknowledged.processEvent({
      event: acknowledgment,
      mockDb: db,
    });
    db = await SettlementModule.DisbursementQueued.processEvent({ event: refund, mockDb: db });

    const funding = await db.CommitmentFunding.get(`${CHAIN_ID}-61`);
    const disbursement = await db.Disbursement.get(`${CHAIN_ID}-91`);
    assert.equal(disbursement?.state, "CONFIRMED");
    assert.equal(funding?.state, "REFUNDED");
    assert.equal(funding?.closedAt, 3);
  });

  it("closes consumed funding when its payout plan completes in either replay order", async () => {
    let db = createTestIndexer();
    db = await SettlementModule.FundingConsumed.processEvent({
      event: fundingConsumed(62n, 52n, 1),
      mockDb: db,
    });
    db = await SettlementModule.CommitmentPayoutPlanCreated.processEvent({
      event: payoutPlanCreated(72n, 52n, 2),
      mockDb: db,
    });
    db = await SettlementModule.CommitmentPayoutPlanFinalized.processEvent({
      event: payoutPlanFinalized(72n, 3),
      mockDb: db,
    });
    assert.equal((await db.CommitmentFunding.get(`${CHAIN_ID}-62`))?.state, "CLOSED");

    db = createTestIndexer();
    db = await SettlementModule.CommitmentPayoutPlanCreated.processEvent({
      event: payoutPlanCreated(73n, 53n, 4),
      mockDb: db,
    });
    db = await SettlementModule.CommitmentPayoutPlanFinalized.processEvent({
      event: payoutPlanFinalized(73n, 5),
      mockDb: db,
    });
    db = await SettlementModule.FundingConsumed.processEvent({
      event: fundingConsumed(63n, 53n, 6),
      mockDb: db,
    });
    const reverseFunding = await db.CommitmentFunding.get(`${CHAIN_ID}-63`);
    assert.equal(reverseFunding?.state, "CLOSED");
    assert.ok(reverseFunding?.closedAt !== undefined);
  });

  it("keeps a successful refund terminal when an older failed attempt arrives late", async () => {
    let db = createTestIndexer();
    const fundingId = 64n;
    const commitmentId = 54n;
    const disbursementId = 94n;
    const firstKey = hash(640);
    const firstCommand = hash(641);
    const retryKey = hash(642);
    const retryCommand = hash(643);
    const pledge = SettlementModule.FundingPledged.createMockEvent({
      fundingId,
      commitmentId,
      funder: address(6),
      garden: address(2),
      refundAccount: address(8),
      expectedAmount: 100n,
      recordedBy: address(7),
      mockEventData: eventData(1),
    });
    const refund = SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId,
      commitmentId,
      garden: address(2),
      payoutPlanId: 0n,
      contributor: address(6),
      executorGarden: address(2),
      kind: 4n,
      fundingRoute: 0n,
      source: address(4),
      recipient: address(8),
      token: address(91),
      amount: 100n,
      mockEventData: eventData(2),
    });
    const firstDispatched = settlementCommand(
      "SettlementCommandDispatched",
      firstKey,
      firstCommand,
      disbursementId,
      0n,
      3
    );
    const requeued = SettlementModule.DisbursementRequeued.createMockEvent({
      disbursementId,
      attempt: 1n,
      mockEventData: eventData(5),
    });
    const retryDispatched = settlementCommand(
      "SettlementCommandRetried",
      retryKey,
      retryCommand,
      disbursementId,
      1n,
      6
    );
    const success = settlementAcknowledged(
      retryKey,
      hash(644),
      retryCommand,
      disbursementId,
      true,
      7
    );
    const olderFailure = settlementAcknowledged(
      firstKey,
      hash(645),
      firstCommand,
      disbursementId,
      false,
      4
    );
    for (const [api, event] of [
      [SettlementModule.FundingPledged, pledge],
      [SettlementModule.DisbursementQueued, refund],
      [SettlementModule.SettlementCommandDispatched, firstDispatched],
      [SettlementModule.DisbursementRequeued, requeued],
      [SettlementModule.SettlementCommandRetried, retryDispatched],
      [SettlementModule.SettlementAcknowledged, success],
      [SettlementModule.SettlementAcknowledged, olderFailure],
    ] as const) {
      db = await api.processEvent({ event, mockDb: db });
    }

    const funding = await db.CommitmentFunding.get(`${CHAIN_ID}-${fundingId}`);
    const disbursement = await db.Disbursement.get(`${CHAIN_ID}-${disbursementId}`);
    const subject = await db.SettlementSubjectState.get(`${CHAIN_ID}-D-${disbursementId}`);
    assert.equal(funding?.state, "REFUNDED");
    assert.equal(funding?.closedAt, 7);
    assert.equal(disbursement?.state, "CONFIRMED");
    assert.equal(disbursement?.attempt, 1);
    assert.equal(subject?.state, "CONFIRMED");
    assert.equal(subject?.attempt, 1);
  });
});
