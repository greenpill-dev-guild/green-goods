import assert from "assert";

import { Addresses, createTestIndexer, SettlementModule } from "./v3";

const CHAIN_ID = 42161;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

function addr(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString(16).padStart(40, "0")}`;
}

function txHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function mockEvent(timestamp: number, logIndex = 0) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp, number: 0 },
    srcAddress: addr(90),
    transaction: { hash: txHash(timestamp) },
    logIndex,
  };
}

async function seedProtocolGarden(protocolGarden: string) {
  const mockDb = createTestIndexer();
  const event = SettlementModule.FundingConfigurationLocked.createMockEvent({
    protocolGarden,
    gDollarToken: addr(91),
    mockEventData: mockEvent(1),
  });
  return SettlementModule.FundingConfigurationLocked.processEvent({ event, mockDb });
}

describe("SettlementModule read model", () => {
  it("reconciles settlement flow when the protocol configuration arrives after the plan", async () => {
    const protocolGarden = addr(1);
    const providerGarden = addr(2);
    let mockDb = createTestIndexer();
    const created = SettlementModule.CommitmentPayoutPlanCreated.createMockEvent({
      payoutPlanId: 10n,
      commitmentId: 100n,
      providerGarden,
      payerGarden: protocolGarden,
      source: addr(4),
      token: addr(91),
      payoutKind: 3n,
      declaredAmount: 100n,
      gardenRetainedAmount: 0n,
      beneficiaryGarden: providerGarden,
      beneficiaryRecipient: addr(3),
      beneficiaryAmount: 100n,
      recognitionSnapshotHash: ZERO_BYTES32,
      createdBy: addr(5),
      mockEventData: mockEvent(1),
    });
    mockDb = await SettlementModule.CommitmentPayoutPlanCreated.processEvent({
      event: created,
      mockDb,
    });
    assert.equal(
      (await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-10`))?.settlementFlow,
      "UNKNOWN"
    );

    const configured = SettlementModule.FundingConfigurationLocked.createMockEvent({
      protocolGarden,
      gDollarToken: addr(91),
      mockEventData: mockEvent(2),
    });
    mockDb = await SettlementModule.FundingConfigurationLocked.processEvent({
      event: configured,
      mockDb,
    });

    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-10`);
    const configuration = await mockDb.SettlementConfiguration.get(`${CHAIN_ID}-settlement-config`);
    assert.ok(plan);
    assert.equal(plan.settlementFlow, "PROTOCOL_TO_GARDEN");
    assert.deepEqual(configuration?.pendingPayoutPlanEntityIds, []);
  });

  it("indexes a protocol Request beneficiary payout with payer identity and flow", async () => {
    const protocolGarden = addr(1);
    const providerGarden = addr(2);
    const beneficiarySafe = addr(3);
    let mockDb = await seedProtocolGarden(protocolGarden);

    const created = SettlementModule.CommitmentPayoutPlanCreated.createMockEvent({
      payoutPlanId: 11n,
      commitmentId: 101n,
      providerGarden,
      payerGarden: protocolGarden,
      source: addr(4),
      token: addr(91),
      payoutKind: 3n,
      declaredAmount: 900n,
      gardenRetainedAmount: 0n,
      beneficiaryGarden: providerGarden,
      beneficiaryRecipient: beneficiarySafe,
      beneficiaryAmount: 900n,
      recognitionSnapshotHash: txHash(55),
      createdBy: addr(5),
      mockEventData: mockEvent(2),
    });
    mockDb = await SettlementModule.CommitmentPayoutPlanCreated.processEvent({
      event: created,
      mockDb,
    });

    const finalized = SettlementModule.CommitmentPayoutPlanFinalized.createMockEvent({
      payoutPlanId: 11n,
      payoutKind: 3n,
      payablePayoutCount: 1n,
      contributorPayoutTotal: 0n,
      beneficiaryAmount: 900n,
      gardenRetainedAmount: 0n,
      recognitionSnapshotHash: txHash(55),
      paymentSnapshotHash: txHash(56),
      completedWithoutDispatch: false,
      finalizedAt: 3n,
      mockEventData: mockEvent(3),
    });
    mockDb = await SettlementModule.CommitmentPayoutPlanFinalized.processEvent({
      event: finalized,
      mockDb,
    });

    const queued = SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId: 21n,
      commitmentId: 101n,
      garden: protocolGarden,
      payoutPlanId: 11n,
      contributor: ZERO_ADDRESS,
      executorGarden: protocolGarden,
      kind: 3n,
      fundingRoute: 0n,
      source: addr(4),
      recipient: beneficiarySafe,
      token: addr(91),
      amount: 900n,
      mockEventData: mockEvent(4),
    });
    mockDb = await SettlementModule.DisbursementQueued.processEvent({ event: queued, mockDb });

    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-11`);
    const disbursement = await mockDb.Disbursement.get(`${CHAIN_ID}-21`);
    assert.ok(plan);
    assert.equal(plan.payerGarden, protocolGarden.toLowerCase());
    assert.equal(plan.payerGardenId, protocolGarden.toLowerCase());
    assert.equal(plan.providerGarden, providerGarden.toLowerCase());
    assert.equal(plan.settlementFlow, "PROTOCOL_TO_GARDEN");
    assert.equal(plan.payoutKind, "GARDEN_BENEFICIARY");
    assert.equal(plan.beneficiaryGarden, providerGarden.toLowerCase());
    assert.equal(plan.beneficiaryRecipient, beneficiarySafe.toLowerCase());
    assert.equal(plan.beneficiaryDisbursementId, 21n);
    assert.equal(plan.contributorPayoutTotal, 0n);
    assert.ok(disbursement);
    assert.equal(disbursement.kind, "GARDEN_BENEFICIARY");
    assert.equal(disbursement.settlementFlow, "PROTOCOL_TO_GARDEN");
    assert.equal(disbursement.contributor, undefined);
  });

  it("indexes a protocol Offer as contributor consideration paid by the claiming garden", async () => {
    const protocolGarden = addr(1);
    const payerGarden = addr(6);
    let mockDb = await seedProtocolGarden(protocolGarden);

    const created = SettlementModule.CommitmentPayoutPlanCreated.createMockEvent({
      payoutPlanId: 12n,
      commitmentId: 102n,
      providerGarden: protocolGarden,
      payerGarden,
      source: addr(7),
      token: addr(91),
      payoutKind: 0n,
      declaredAmount: 500n,
      gardenRetainedAmount: 0n,
      beneficiaryGarden: ZERO_ADDRESS,
      beneficiaryRecipient: ZERO_ADDRESS,
      beneficiaryAmount: 0n,
      recognitionSnapshotHash: ZERO_BYTES32,
      createdBy: addr(8),
      mockEventData: mockEvent(10),
    });
    mockDb = await SettlementModule.CommitmentPayoutPlanCreated.processEvent({
      event: created,
      mockDb,
    });

    const queued = SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId: 22n,
      commitmentId: 102n,
      garden: payerGarden,
      payoutPlanId: 12n,
      contributor: addr(9),
      executorGarden: payerGarden,
      kind: 0n,
      fundingRoute: 0n,
      source: addr(7),
      recipient: addr(9),
      token: addr(91),
      amount: 500n,
      mockEventData: mockEvent(11),
    });
    mockDb = await SettlementModule.DisbursementQueued.processEvent({ event: queued, mockDb });

    const plan = await mockDb.CommitmentPayoutPlan.get(`${CHAIN_ID}-12`);
    const disbursement = await mockDb.Disbursement.get(`${CHAIN_ID}-22`);
    assert.ok(plan);
    assert.equal(plan.payerGarden, payerGarden.toLowerCase());
    assert.equal(plan.providerGarden, protocolGarden.toLowerCase());
    assert.equal(plan.settlementFlow, "GARDEN_TO_PROTOCOL");
    assert.equal(plan.payoutKind, "CONTRIBUTOR_CONSIDERATION");
    assert.ok(disbursement);
    assert.equal(disbursement.kind, "CONTRIBUTOR_CONSIDERATION");
    assert.equal(disbursement.settlementFlow, "GARDEN_TO_PROTOCOL");
  });
});

describe("SettlementModule credit release seam", () => {
  function loanDisbursement(disbursementId: bigint, logIndex: number) {
    return SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId,
      commitmentId: 0n,
      garden: addr(1),
      payoutPlanId: 0n,
      contributor: ZERO_ADDRESS,
      executorGarden: addr(1),
      kind: 2n,
      fundingRoute: 0n,
      source: addr(2),
      recipient: addr(3),
      token: addr(91),
      amount: 100n,
      mockEventData: mockEvent(100, logIndex),
    });
  }

  function loanRelationship(disbursementId: bigint, logIndex: number) {
    return SettlementModule.LoanPrincipalQueued.createMockEvent({
      disbursementId,
      creditRegistry: addr(80),
      loanId: 77n,
      mockEventData: mockEvent(100, logIndex),
    });
  }

  it("indexes the two-way credit binding from its dedicated configuration event", async () => {
    const mockDb = createTestIndexer();
    const event = SettlementModule.CreditRegistryUpdated.createMockEvent({
      previousRegistry: ZERO_ADDRESS,
      newRegistry: addr(80),
      mockEventData: mockEvent(99),
    });
    const after = await SettlementModule.CreditRegistryUpdated.processEvent({ event, mockDb });
    assert.equal(
      (await after.SettlementConfiguration.get(`${CHAIN_ID}-settlement-config`))?.creditRegistry,
      addr(80).toLowerCase()
    );
  });

  it("converges the loan relationship in either replay order", async () => {
    for (const reverse of [false, true]) {
      let mockDb = createTestIndexer();
      const queued = loanDisbursement(reverse ? 902n : 901n, reverse ? 1 : 0);
      const linked = loanRelationship(reverse ? 902n : 901n, reverse ? 0 : 1);
      for (const event of reverse ? [linked, queued] : [queued, linked]) {
        mockDb = await SettlementModule[
          event.event as "DisbursementQueued" | "LoanPrincipalQueued"
        ].processEvent({
          event,
          mockDb,
        });
      }
      const entity = await mockDb.Disbursement.get(`${CHAIN_ID}-${reverse ? 902 : 901}`);
      assert.equal(entity?.kind, "LOAN_PRINCIPAL");
      assert.equal(entity?.creditRegistry, addr(80).toLowerCase());
      assert.equal(entity?.loanId, 77n);
    }
  });
});
