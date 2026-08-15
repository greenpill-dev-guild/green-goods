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

describe("Settlement review regressions", () => {
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
});
