import assert from "assert";
import type { Address } from "viem";

import {
  Addresses,
  CommitmentPoolingModule,
  CreditRegistry,
  createTestIndexer,
  processEvents,
  SettlementModule,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_713_812;
const CREDIT_REGISTRY: Address = "0x8080808080808080808080808080808080808080";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

function addr(index: number): Address {
  return (Addresses.mockAddresses[index] || `0x${index.toString(16).padStart(40, "0")}`) as Address;
}

function txHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function mockEvent(sequence: number, logIndex = 0) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp: 1_700_000_000 + sequence, number: START_BLOCK + sequence },
    srcAddress: CREDIT_REGISTRY,
    transaction: { hash: txHash(sequence) },
    logIndex,
  };
}

async function registerCreditRegistry() {
  const mockDb = createTestIndexer();
  const event = SettlementModule.CreditRegistryUpdated.createMockEvent({
    previousRegistry: ZERO_ADDRESS,
    newRegistry: CREDIT_REGISTRY,
    mockEventData: { ...mockEvent(1), srcAddress: undefined },
  });
  return SettlementModule.CreditRegistryUpdated.processEvent({ event, mockDb });
}

async function seedPool(
  mockDb: Awaited<ReturnType<typeof registerCreditRegistry>>,
  poolId = 7n,
  sequence = 2
) {
  const event = CommitmentPoolingModule.PoolRegistered.createMockEvent({
    poolId,
    garden: addr(2),
    poolType: 0n,
    mockEventData: { ...mockEvent(sequence), srcAddress: undefined },
  });
  return CommitmentPoolingModule.PoolRegistered.processEvent({ event, mockDb });
}

function loanLifecycle(loanId = 11n, poolId = 7n) {
  const requested = CreditRegistry.LoanRequested.createMockEvent({
    loanId,
    poolId,
    borrower: addr(3),
    requestedBy: addr(3),
    commitmentId: 99n,
    token: addr(4),
    principal: 100n,
    dueDate: 1_800_000_000n,
    installmentsTotal: 2n,
    termsCID: "ipfs://terms",
    mockEventData: mockEvent(10),
  });
  const approved = CreditRegistry.LoanApproved.createMockEvent({
    loanId,
    approvedBy: addr(5),
    mockEventData: mockEvent(11),
  });
  const disbursed = CreditRegistry.LoanDisbursed.createMockEvent({
    loanId,
    rail: 2n,
    token: addr(4),
    amount: 100n,
    disbursementId: 0n,
    executionRef: txHash(100),
    recordedBy: addr(5),
    mockEventData: mockEvent(12),
  });
  const partial = CreditRegistry.RepaymentRecorded.createMockEvent({
    loanId,
    amount: 40n,
    repaidAmount: 40n,
    newOutstanding: 60n,
    installmentsPaid: 1n,
    executionRef: txHash(101),
    recordedBy: addr(5),
    mockEventData: mockEvent(13),
  });
  const defaulted = CreditRegistry.LoanDefaulted.createMockEvent({
    loanId,
    reasonCID: "ipfs://late-season",
    markedBy: addr(5),
    mockEventData: mockEvent(14),
  });
  const recovered = CreditRegistry.RepaymentRecorded.createMockEvent({
    loanId,
    amount: 60n,
    repaidAmount: 100n,
    newOutstanding: 0n,
    installmentsPaid: 2n,
    executionRef: txHash(102),
    recordedBy: addr(6),
    mockEventData: mockEvent(15),
  });
  const repaid = CreditRegistry.LoanRepaid.createMockEvent({
    loanId,
    recoveredFromDefault: true,
    recordedBy: addr(6),
    mockEventData: mockEvent(15, 1),
  });
  return { requested, approved, disbursed, partial, defaulted, recovered, repaid };
}

async function project(
  events: ReturnType<typeof loanLifecycle>[keyof ReturnType<typeof loanLifecycle>][]
) {
  let mockDb = await registerCreditRegistry();
  mockDb = await seedPool(mockDb);
  return processEvents(mockDb, events);
}

describe("CreditRegistry read model", () => {
  it("projects installments, default recovery, and integer pool accounting", async () => {
    const events = loanLifecycle();
    const mockDb = await project(Object.values(events));
    const loan = await mockDb.Loan.get(`${CHAIN_ID}-11`);
    const stats = await mockDb.CreditPoolStats.get(`${CHAIN_ID}-7`);

    assert.ok(loan);
    assert.equal(loan.chainId, CHAIN_ID);
    assert.equal(loan.garden, addr(2).toLowerCase());
    assert.equal(loan.state, "REPAID");
    assert.equal(loan.rail, "TREASURY");
    assert.equal(loan.repaidAmount, 100n);
    assert.equal(loan.outstanding, 0n);
    assert.equal(loan.installmentsPaid, 2);
    assert.equal(loan.defaultedAt, 1_700_000_014);
    assert.equal(loan.defaultReasonCID, "ipfs://late-season");
    assert.equal(loan.recoveredFromDefault, true);

    assert.ok(stats);
    assert.equal(stats.creditIssued, 100n);
    assert.equal(stats.creditRepaid, 100n);
    assert.equal(stats.creditOutstanding, 0n);
    assert.equal(stats.repaymentRateNumerator, 100n);
    assert.equal(stats.repaymentRateDenominator, 100n);
    assert.equal(stats.defaultRateNumerator, 1n);
    assert.equal(stats.defaultRateDenominator, 1n);
  });

  it("converges normal, reverse, duplicate, replayed, and stale delivery", async () => {
    const events = loanLifecycle(12n);
    const stalePartial = {
      ...events.partial,
      ...mockEvent(13, 1),
      params: { ...events.partial.params },
    };
    const staleDisbursement = {
      ...events.disbursed,
      ...mockEvent(12, 1),
      params: { ...events.disbursed.params },
    };
    const duplicatePartial = {
      ...events.partial,
      ...mockEvent(18),
      transaction: events.partial.transaction,
      logIndex: events.partial.logIndex,
      params: { ...events.partial.params },
    };
    let canonical = await project([...Object.values(events), stalePartial, staleDisbursement]);
    let reverse = await project([
      events.repaid,
      events.recovered,
      events.partial,
      events.defaulted,
      events.disbursed,
      events.approved,
      events.requested,
      stalePartial,
      staleDisbursement,
    ]);
    canonical = await CreditRegistry.RepaymentRecorded.processEvent({
      event: duplicatePartial,
      mockDb: canonical,
    });
    reverse = await CreditRegistry.RepaymentRecorded.processEvent({
      event: duplicatePartial,
      mockDb: reverse,
    });

    const canonicalLoan = await canonical.Loan.get(`${CHAIN_ID}-12`);
    const reverseLoan = await reverse.Loan.get(`${CHAIN_ID}-12`);
    const canonicalStats = await canonical.CreditPoolStats.get(`${CHAIN_ID}-7`);
    const reverseStats = await reverse.CreditPoolStats.get(`${CHAIN_ID}-7`);

    assert.deepEqual(reverseLoan, canonicalLoan);
    assert.deepEqual(reverseStats, canonicalStats);
    assert.equal(reverseLoan?.repaidAmount, 100n);
    assert.equal(reverseLoan?.outstanding, 0n);
    assert.equal((await reverse.LoanEvent.get(`${CHAIN_ID}-${txHash(13)}-0`))?.amount, 40n);
  });

  it("joins the settlement relationship in either order and leaves other rails unbound", async () => {
    for (const relationshipFirst of [true, false]) {
      const loanId = relationshipFirst ? 21n : 22n;
      const disbursementId = relationshipFirst ? 501n : 502n;
      const events = loanLifecycle(loanId);
      events.disbursed = CreditRegistry.LoanDisbursed.createMockEvent({
        loanId,
        rail: 3n,
        token: addr(4),
        amount: 100n,
        disbursementId,
        executionRef: txHash(Number(disbursementId)),
        recordedBy: addr(5),
        mockEventData: mockEvent(22),
      });
      const relationship = SettlementModule.LoanPrincipalQueued.createMockEvent({
        disbursementId,
        creditRegistry: CREDIT_REGISTRY,
        loanId,
        mockEventData: { ...mockEvent(21), srcAddress: undefined },
      });
      const ordered = relationshipFirst
        ? [events.requested, events.approved, relationship, events.disbursed]
        : [events.requested, events.approved, events.disbursed, relationship];
      const mockDb = await project(ordered);
      const loan = await mockDb.Loan.get(`${CHAIN_ID}-${loanId}`);
      assert.equal(loan?.disbursementId, disbursementId);
      assert.equal(loan?.settlementRelationshipEntityId, `${CHAIN_ID}-${disbursementId}`);
    }

    const jar = loanLifecycle(23n);
    const mockDb = await project([jar.requested, jar.approved, jar.disbursed]);
    assert.equal(
      (await mockDb.Loan.get(`${CHAIN_ID}-23`))?.settlementRelationshipEntityId,
      undefined
    );
  });

  it("keeps linked loan attempts synchronized when a disbursement is requeued", async () => {
    const loanId = 24n;
    const disbursementId = 503n;
    const events = loanLifecycle(loanId);
    events.disbursed = CreditRegistry.LoanDisbursed.createMockEvent({
      loanId,
      rail: 3n,
      token: addr(4),
      amount: 100n,
      disbursementId,
      executionRef: txHash(Number(disbursementId)),
      recordedBy: addr(5),
      mockEventData: mockEvent(42),
    });
    const queued = SettlementModule.DisbursementQueued.createMockEvent({
      disbursementId,
      commitmentId: 0n,
      garden: addr(2),
      payoutPlanId: 0n,
      contributor: ZERO_ADDRESS,
      executorGarden: addr(2),
      kind: 2n,
      fundingRoute: 0n,
      source: addr(5),
      recipient: addr(3),
      token: addr(4),
      amount: 100n,
      mockEventData: { ...mockEvent(40), srcAddress: undefined },
    });
    const relationship = SettlementModule.LoanPrincipalQueued.createMockEvent({
      disbursementId,
      creditRegistry: CREDIT_REGISTRY,
      loanId,
      mockEventData: { ...mockEvent(43), srcAddress: undefined },
    });
    const requeued = SettlementModule.DisbursementRequeued.createMockEvent({
      disbursementId,
      attempt: 2n,
      mockEventData: { ...mockEvent(44), srcAddress: undefined },
    });

    const mockDb = await project([
      events.requested,
      events.approved,
      events.disbursed,
      queued,
      relationship,
      requeued,
    ]);

    assert.equal((await mockDb.Disbursement.get(`${CHAIN_ID}-${disbursementId}`))?.attempt, 2);
    assert.equal((await mockDb.Loan.get(`${CHAIN_ID}-${loanId}`))?.attempts, 2);
    assert.equal((await mockDb.CreditLoanProjection.get(`${CHAIN_ID}-${loanId}`))?.attempts, 2);
  });

  it("covers the frozen configuration, executor, pause, cancellation, and dependency events", async () => {
    let mockDb = await registerCreditRegistry();
    mockDb = await seedPool(mockDb);
    const events = [
      CreditRegistry.CreditRegistryInitialized.createMockEvent({
        owner: addr(1),
        hatsModule: addr(7),
        commitmentPoolingModule: addr(8),
        settlementModule: addr(9),
        mockEventData: mockEvent(30),
      }),
      CreditRegistry.PoolCreditConfigured.createMockEvent({
        poolId: 7n,
        token: addr(4),
        previousBorrowerCap: 0n,
        borrowerCap: 1_000n,
        previouslyEnabled: false,
        enabled: true,
        configuredBy: addr(5),
        mockEventData: mockEvent(31),
      }),
      CreditRegistry.ExecutorUpdated.createMockEvent({
        poolId: 7n,
        executor: addr(6),
        enabled: true,
        updatedBy: addr(5),
        mockEventData: mockEvent(32),
      }),
      CreditRegistry.HatsModuleUpdated.createMockEvent({
        previousModule: addr(7),
        newModule: addr(17),
        mockEventData: mockEvent(33),
      }),
      CreditRegistry.CommitmentPoolingModuleUpdated.createMockEvent({
        previousModule: addr(8),
        newModule: addr(18),
        mockEventData: mockEvent(34),
      }),
      CreditRegistry.SettlementModuleUpdated.createMockEvent({
        previousModule: addr(9),
        newModule: addr(19),
        mockEventData: mockEvent(35),
      }),
      CreditRegistry.PausedSet.createMockEvent({ paused: false, mockEventData: mockEvent(36) }),
      CreditRegistry.LoanRequested.createMockEvent({
        loanId: 31n,
        poolId: 7n,
        borrower: addr(3),
        requestedBy: addr(3),
        commitmentId: 0n,
        token: addr(4),
        principal: 10n,
        dueDate: 1_800_000_000n,
        installmentsTotal: 0n,
        termsCID: "ipfs://cancelled",
        mockEventData: mockEvent(37),
      }),
      CreditRegistry.LoanCancelled.createMockEvent({
        loanId: 31n,
        reasonCID: "ipfs://withdrawn",
        cancelledBy: addr(3),
        mockEventData: mockEvent(38),
      }),
      ...Object.values(loanLifecycle(32n)),
      CreditRegistry.LoanRequested.createMockEvent({
        loanId: 33n,
        poolId: 7n,
        borrower: addr(3),
        requestedBy: addr(3),
        commitmentId: 0n,
        token: addr(4),
        principal: 25n,
        dueDate: 1_800_000_000n,
        installmentsTotal: 1n,
        termsCID: "ipfs://approved",
        mockEventData: mockEvent(39),
      }),
      CreditRegistry.LoanApproved.createMockEvent({
        loanId: 33n,
        approvedBy: addr(5),
        mockEventData: mockEvent(40),
      }),
      CreditRegistry.LoanRequested.createMockEvent({
        loanId: 34n,
        poolId: 7n,
        borrower: addr(3),
        requestedBy: addr(3),
        commitmentId: 0n,
        token: addr(4),
        principal: 100n,
        dueDate: 1_800_000_000n,
        installmentsTotal: 2n,
        termsCID: "ipfs://partial",
        mockEventData: mockEvent(41),
      }),
      CreditRegistry.LoanApproved.createMockEvent({
        loanId: 34n,
        approvedBy: addr(5),
        mockEventData: mockEvent(42),
      }),
      CreditRegistry.LoanDisbursed.createMockEvent({
        loanId: 34n,
        rail: 1n,
        token: addr(4),
        amount: 100n,
        disbursementId: 0n,
        executionRef: txHash(340),
        recordedBy: addr(5),
        mockEventData: mockEvent(43),
      }),
      CreditRegistry.RepaymentRecorded.createMockEvent({
        loanId: 34n,
        amount: 40n,
        repaidAmount: 40n,
        newOutstanding: 60n,
        installmentsPaid: 1n,
        executionRef: txHash(341),
        recordedBy: addr(5),
        mockEventData: mockEvent(44),
      }),
    ];
    mockDb = await processEvents(mockDb, events);

    const configuration = await mockDb.CreditRegistryConfiguration.get(
      `${CHAIN_ID}-${CREDIT_REGISTRY.toLowerCase()}`
    );
    const stats = await mockDb.CreditPoolStats.get(`${CHAIN_ID}-7`);
    const executor = await mockDb.CreditPoolExecutor.get(`${CHAIN_ID}-7-${addr(6).toLowerCase()}`);
    assert.equal(configuration?.owner, addr(1).toLowerCase());
    assert.equal(configuration?.initializedAt, 1_700_000_030);
    assert.equal(configuration?.hatsModule, addr(17).toLowerCase());
    assert.equal(configuration?.commitmentPoolingModule, addr(18).toLowerCase());
    assert.equal(configuration?.settlementModule, addr(19).toLowerCase());
    assert.equal(configuration?.paused, false);
    assert.equal(stats?.borrowerCap, 1_000n);
    assert.equal(stats?.enabled, true);
    assert.equal(executor?.enabled, true);
    assert.equal((await mockDb.Loan.get(`${CHAIN_ID}-31`))?.state, "CANCELLED");
    assert.equal((await mockDb.Loan.get(`${CHAIN_ID}-33`))?.state, "APPROVED");
    assert.deepEqual(
      {
        state: (await mockDb.Loan.get(`${CHAIN_ID}-34`))?.state,
        repaidAmount: (await mockDb.Loan.get(`${CHAIN_ID}-34`))?.repaidAmount,
        outstanding: (await mockDb.Loan.get(`${CHAIN_ID}-34`))?.outstanding,
        installmentsPaid: (await mockDb.Loan.get(`${CHAIN_ID}-34`))?.installmentsPaid,
      },
      { state: "DISBURSED", repaidAmount: 40n, outstanding: 60n, installmentsPaid: 1 }
    );

    assert.deepEqual(
      new Set((await mockDb.LoanEvent.getAll()).map((event) => event.eventType)),
      new Set([
        "CREDIT_REGISTRY_INITIALIZED",
        "POOL_CREDIT_CONFIGURED",
        "EXECUTOR_UPDATED",
        "LOAN_REQUESTED",
        "LOAN_APPROVED",
        "LOAN_DISBURSED",
        "REPAYMENT_RECORDED",
        "LOAN_REPAID",
        "LOAN_DEFAULTED",
        "LOAN_CANCELLED",
        "HATS_MODULE_UPDATED",
        "COMMITMENT_POOLING_MODULE_UPDATED",
        "SETTLEMENT_MODULE_UPDATED",
        "PAUSED_SET",
      ])
    );
  });

  it("retries pool configuration materialization when the pool arrives after the audit event", async () => {
    let mockDb = await registerCreditRegistry();
    const configured = CreditRegistry.PoolCreditConfigured.createMockEvent({
      poolId: 77n,
      token: addr(4),
      previousBorrowerCap: 0n,
      borrowerCap: 500n,
      previouslyEnabled: false,
      enabled: true,
      configuredBy: addr(5),
      mockEventData: mockEvent(50),
    });

    mockDb = await processEvents(mockDb, [configured]);
    assert.equal(await mockDb.CreditPoolStats.get(`${CHAIN_ID}-77`), undefined);
    mockDb = await seedPool(mockDb, 77n, 51);
    const replayed = {
      ...configured,
      ...mockEvent(52),
      transaction: configured.transaction,
      logIndex: configured.logIndex,
      params: { ...configured.params },
    };
    mockDb = await processEvents(mockDb, [replayed]);

    const materialized = await mockDb.CreditPoolStats.get(`${CHAIN_ID}-77`);
    assert.equal(materialized?.token, addr(4).toLowerCase());
    assert.equal(materialized?.borrowerCap, 500n);
    assert.equal(materialized?.enabled, true);
    assert.equal(
      (await mockDb.LoanEvent.getAll()).filter(
        (event) => event.eventType === "POOL_CREDIT_CONFIGURED"
      ).length,
      1
    );
  });
});
