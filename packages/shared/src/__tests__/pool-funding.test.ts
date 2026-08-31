import { describe, expect, it } from "vitest";

import {
  calculateEffectiveZodiacAllowance,
  calculateKnownTransferFeeBuffer,
  calculateUnknownSplitFeeBuffer,
  type PoolFundingCalculationInput,
  type PoolFundingDisbursement,
  selectPoolFundingSnapshot,
} from "../modules/commitment-pooling/pool-funding";

const SAFE = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0x3333333333333333333333333333333333333333" as const;

function disbursement(overrides: Partial<PoolFundingDisbursement> = {}): PoolFundingDisbursement {
  return {
    id: "42161-1",
    disbursementId: 1n,
    commitmentId: 10n,
    payoutPlanId: 3n,
    fundingId: null,
    kind: "CONTRIBUTOR_PAYOUT",
    source: SAFE,
    recipient: OTHER,
    amount: 100n,
    state: "QUEUED",
    executionKey: null,
    ...overrides,
  };
}

function input(overrides: Partial<PoolFundingCalculationInput> = {}): PoolFundingCalculationInput {
  return {
    safe: SAFE,
    token: TOKEN,
    balance: { value: 1_000n, blockNumber: 50n, blockTimestamp: 2_000, readAt: 2_001 },
    ledgerReadAt: 2_000,
    ledgerFresh: true,
    ledgerAvailable: true,
    feePolicy: { maxFeeBps: 100, maxFeeAmount: 50n },
    feeQuotes: [],
    commitments: [],
    payoutPlans: [],
    fundings: [],
    disbursements: [],
    executions: [],
    readiness: {
      accountConfigured: true,
      accountActive: true,
      routeConfigured: true,
      routeActive: true,
      routeMatches: true,
      sourcePaused: false,
      executorPaused: false,
      tokenPaused: false,
    },
    limits: {
      rolesAllowanceRemaining: 1_000n,
      periodAllowanceRemaining: 1_000n,
      maxTransferAmount: 500n,
      maxBatchAmount: 1_000n,
      batchSizeLimit: 20,
    },
    nativeFeeBalance: 2n,
    acknowledgmentFeeReserveLow: false,
    ...overrides,
  };
}

describe("pool funding fee and allowance arithmetic", () => {
  it("applies sender-paid fee ceilings and conservative unknown-split rounding", () => {
    const policy = { maxFeeBps: 100, maxFeeAmount: 2n };
    expect(calculateKnownTransferFeeBuffer(999n, policy)).toBe(2n);
    expect(calculateUnknownSplitFeeBuffer(999n, policy)).toBe(9n);
  });

  it("matches Roles v2 interval refill and max-refill clamping", () => {
    expect(
      calculateEffectiveZodiacAllowance(
        { refill: 10n, maxRefill: 100n, period: 0n, timestamp: 100n, balance: 7n },
        1_000n
      )
    ).toBe(7n);
    expect(
      calculateEffectiveZodiacAllowance(
        { refill: 10n, maxRefill: 100n, period: 50n, timestamp: 100n, balance: 7n },
        149n
      )
    ).toBe(7n);
    expect(
      calculateEffectiveZodiacAllowance(
        { refill: 10n, maxRefill: 100n, period: 50n, timestamp: 100n, balance: 7n },
        260n
      )
    ).toBe(37n);
    expect(
      calculateEffectiveZodiacAllowance(
        { refill: 100n, maxRefill: 120n, period: 50n, timestamp: 100n, balance: 70n },
        260n
      )
    ).toBe(120n);
  });
});

describe("selectPoolFundingSnapshot", () => {
  it("never reports an unreadable balance as zero", () => {
    const snapshot = selectPoolFundingSnapshot(input({ balance: null }));
    expect(snapshot.balance).toBeNull();
    expect(snapshot.available).toBeNull();
    expect(snapshot.committed).toBeNull();
    expect(snapshot.fundingState).toBe("unavailable");
    expect(snapshot.fundingUnavailableReasons).toContain("balance_unreadable");
  });

  it("makes derived values unavailable while retaining a readable balance for a stale ledger", () => {
    const snapshot = selectPoolFundingSnapshot(input({ ledgerFresh: false }));
    expect(snapshot.balance?.value).toBe(1_000n);
    expect(snapshot.available).toBeNull();
    expect(snapshot.fundingUnavailableReasons).toContain("ledger_stale");
  });

  it("reserves finalized payout rows once without adding their child disbursements twice", () => {
    const child = disbursement();
    const snapshot = selectPoolFundingSnapshot(
      input({
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [
              { id: "row-1", amount: 100n, recipient: OTHER, disbursementId: 1n },
              { id: "row-2", amount: 50n, recipient: OTHER, disbursementId: null },
            ],
          },
        ],
        disbursements: [child],
      })
    );
    expect(snapshot.committed).toBe(150n);
    expect(snapshot.obligations).toHaveLength(1);
    expect(snapshot.available).toBe(849n);
  });

  it.each([
    "QUEUED",
    "FAILED",
    "DISPATCHED",
  ] as const)("keeps a %s finalized payout reserved", (state) => {
    const child = disbursement({ state, executionKey: state === "DISPATCHED" ? "0x1234" : null });
    const snapshot = selectPoolFundingSnapshot(
      input({
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [{ id: "row-1", amount: 100n, recipient: OTHER, disbursementId: 1n }],
          },
        ],
        disbursements: [child],
      })
    );
    expect(snapshot.committed).toBe(100n);
    if (state === "DISPATCHED") expect(snapshot.transit.dispatched).toBe(100n);
  });

  it("stops reserving a successful execution only after a newer balance block", () => {
    const child = disbursement({ state: "DISPATCHED", executionKey: "0x1234" });
    const base = {
      payoutPlans: [
        {
          id: "plan-3",
          payoutPlanId: 3n,
          commitmentId: 10n,
          finalized: true,
          rows: [{ id: "row-1", amount: 100n, recipient: OTHER, disbursementId: 1n }],
        },
      ],
      disbursements: [child],
      executions: [
        {
          executionKey: "0x1234" as const,
          status: "SUCCESS",
          createdAt: 2_000,
          acknowledgmentSent: false,
        },
      ],
    };
    expect(selectPoolFundingSnapshot(input(base)).committed).toBe(100n);
    const reflected = selectPoolFundingSnapshot(
      input({
        ...base,
        balance: { value: 900n, blockNumber: 51n, blockTimestamp: 2_001, readAt: 2_002 },
      })
    );
    expect(reflected.committed).toBe(0n);
    expect(reflected.transit.executedAwaitingConfirmation).toBe(100n);
  });

  it("uses the larger of open member funding and the finalized plan for one commitment", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [{ id: "row-1", amount: 80n, recipient: OTHER, disbursementId: null }],
          },
        ],
        fundings: [
          {
            id: "funding-4",
            fundingId: 4n,
            commitmentId: 10n,
            depositedAmount: 100n,
            state: "CONSUMED",
          },
        ],
      })
    );
    expect(snapshot.committed).toBe(100n);
  });

  it("does not count an accepted member-funded commitment as expected demand twice", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        commitments: [
          {
            id: "commitment-10",
            commitmentId: 10n,
            state: "ACCEPTED",
            considerationRail: "CELO_SETTLEMENT",
            considerationAmount: 100n,
            considerationPaid: false,
          },
        ],
        fundings: [
          {
            id: "funding-4",
            fundingId: 4n,
            commitmentId: 10n,
            depositedAmount: 100n,
            state: "DEPOSIT_RECORDED",
          },
        ],
      })
    );
    expect(snapshot.committed).toBe(100n);
    expect(snapshot.expected).toBe(0n);
    expect(snapshot.obligations).toHaveLength(1);
  });

  it("releases consumed member funding after its linked payout is reflected in the Safe balance", () => {
    const child = disbursement({ state: "DISPATCHED", executionKey: "0x1234" });
    const snapshot = selectPoolFundingSnapshot(
      input({
        commitments: [
          {
            id: "commitment-10",
            commitmentId: 10n,
            state: "FULFILLED",
            considerationRail: "CELO_SETTLEMENT",
            considerationAmount: 100n,
            considerationPaid: false,
            consumedFundingId: 4n,
          },
        ],
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [{ id: "row-1", amount: 100n, recipient: OTHER, disbursementId: 1n }],
          },
        ],
        fundings: [
          {
            id: "funding-4",
            fundingId: 4n,
            commitmentId: 10n,
            depositedAmount: 100n,
            state: "CONSUMED",
          },
        ],
        disbursements: [child],
        executions: [
          {
            executionKey: "0x1234",
            status: "SUCCESS",
            createdAt: 1_999,
            acknowledgmentSent: false,
          },
        ],
      })
    );
    expect(snapshot.committed).toBe(0n);
  });

  it("reserves standalone funding, loan principal, and unlinked refunds by disbursement id", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [
          disbursement({
            disbursementId: 1n,
            commitmentId: null,
            payoutPlanId: null,
            kind: "FUNDING",
            amount: 10n,
          }),
          disbursement({
            disbursementId: 2n,
            commitmentId: null,
            payoutPlanId: null,
            kind: "LOAN_PRINCIPAL",
            amount: 20n,
          }),
          disbursement({
            disbursementId: 3n,
            commitmentId: null,
            payoutPlanId: null,
            kind: "REFUND",
            amount: 30n,
          }),
        ],
      })
    );
    expect(snapshot.committed).toBe(60n);
    expect(snapshot.obligations).toHaveLength(3);
  });

  it("shows incoming Protocol funding without adding it to availability", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [
          disbursement({
            commitmentId: null,
            payoutPlanId: null,
            source: OTHER,
            recipient: SAFE,
            kind: "FUNDING",
            amount: 200n,
          }),
        ],
      })
    );
    expect(snapshot.transit.incoming).toBe(200n);
    expect(snapshot.committed).toBe(0n);
    expect(snapshot.available).toBe(1_000n);
  });

  it("classifies insufficient, low, healthy, and no-demand from authorized and expected demand", () => {
    const expected = {
      id: "commitment-8",
      commitmentId: 8n,
      state: "ACCEPTED",
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: 100n,
      considerationPaid: false,
    };
    const authorized = disbursement({ commitmentId: null, payoutPlanId: null, amount: 100n });
    expect(
      selectPoolFundingSnapshot(
        input({
          balance: { value: 100n, blockNumber: 1n, blockTimestamp: 2_000, readAt: 2_001 },
          disbursements: [authorized],
        })
      ).fundingState
    ).toBe("insufficient");
    expect(
      selectPoolFundingSnapshot(
        input({
          balance: { value: 150n, blockNumber: 1n, blockTimestamp: 2_000, readAt: 2_001 },
          disbursements: [authorized],
          commitments: [expected],
        })
      ).fundingState
    ).toBe("low");
    expect(selectPoolFundingSnapshot(input({ commitments: [expected] })).fundingState).toBe(
      "healthy"
    );
    expect(selectPoolFundingSnapshot(input()).fundingState).toBe("no-demand");
  });

  it("keeps financial health separate from paused and exhausted settlement readiness", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        readiness: {
          ...input().readiness,
          tokenPaused: true,
          executorPaused: true,
        },
        limits: { ...input().limits, rolesAllowanceRemaining: 0n },
      })
    );
    expect(snapshot.fundingState).toBe("no-demand");
    expect(snapshot.settlementReadiness).toBe("unavailable");
    expect(snapshot.settlementUnavailableReasons).toEqual(
      expect.arrayContaining(["executor_paused", "token_paused", "roles_allowance_exhausted"])
    );
  });

  it("reports transfer and batch cap breaches without subtracting either cap from liquidity", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [
          disbursement({
            disbursementId: 1n,
            commitmentId: null,
            payoutPlanId: null,
            batchId: 9n,
            amount: 300n,
          }),
          disbursement({
            disbursementId: 2n,
            commitmentId: null,
            payoutPlanId: null,
            batchId: 9n,
            amount: 300n,
          }),
        ],
        limits: {
          ...input().limits,
          maxTransferAmount: 250n,
          maxBatchAmount: 500n,
        },
      })
    );
    expect(snapshot.settlementUnavailableReasons).toEqual(
      expect.arrayContaining(["transfer_cap_exceeded", "batch_cap_exceeded"])
    );
    expect(snapshot.available).toBe(394n);
  });

  it("checks transfer caps per payout instead of against the aggregate plan", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [
              { id: "row-1", amount: 300n, recipient: OTHER, disbursementId: null },
              { id: "row-2", amount: 300n, recipient: OTHER, disbursementId: null },
            ],
          },
        ],
        feeQuotes: [
          { id: "row-1", amount: 300n, fee: 0n, senderPays: true, recipient: OTHER },
          { id: "row-2", amount: 300n, fee: 0n, senderPays: true, recipient: OTHER },
        ],
        limits: { ...input().limits, maxTransferAmount: 500n },
      })
    );
    expect(snapshot.settlementUnavailableReasons).not.toContain("transfer_cap_exceeded");
  });

  it("checks pending commands against remaining Roles and period allowances", () => {
    const pending = disbursement({ commitmentId: null, payoutPlanId: null });
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [pending],
        feeQuotes: [{ id: pending.id, amount: 100n, fee: 1n, senderPays: true, recipient: OTHER }],
        limits: {
          ...input().limits,
          rolesAllowanceRemaining: 50n,
          periodAllowanceRemaining: 100n,
        },
      })
    );
    expect(snapshot.settlementUnavailableReasons).toEqual(
      expect.arrayContaining(["roles_allowance_insufficient", "period_allowance_insufficient"])
    );
  });

  it("checks the live batch-size limit", () => {
    const first = disbursement({
      disbursementId: 1n,
      commitmentId: null,
      payoutPlanId: null,
      batchId: 9n,
    });
    const second = disbursement({
      id: "42161-2",
      disbursementId: 2n,
      commitmentId: null,
      payoutPlanId: null,
      batchId: 9n,
    });
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [first, second],
        feeQuotes: [first, second].map((row) => ({
          id: row.id,
          amount: row.amount,
          fee: 0n,
          senderPays: true,
          recipient: row.recipient,
        })),
        limits: { ...input().limits, batchSizeLimit: 1 },
      })
    );
    expect(snapshot.settlementUnavailableReasons).toContain("batch_size_exceeded");
  });

  it.each([
    "maxTransferAmount",
    "maxBatchAmount",
    "batchSizeLimit",
  ] as const)("fails settlement readiness when %s is unreadable", (limit) => {
    const snapshot = selectPoolFundingSnapshot(
      input({ limits: { ...input().limits, [limit]: null } })
    );
    expect(snapshot.settlementReadiness).toBe("unavailable");
    expect(snapshot.settlementUnavailableReasons).toContain("caps_unreadable");
  });

  it("rejects receiver-paid, failed, and above-policy GoodDollar fee quotes", () => {
    const snapshot = selectPoolFundingSnapshot(
      input({
        feeQuotes: [
          { id: "a", amount: 100n, fee: 2n, senderPays: false, recipient: OTHER },
          { id: "b", amount: 100n, fee: null, senderPays: null, recipient: OTHER },
          { id: "c", amount: 100n, fee: 5n, senderPays: true, recipient: OTHER },
        ],
      })
    );
    expect(snapshot.settlementUnavailableReasons).toEqual(
      expect.arrayContaining(["receiver_paid_fee", "fee_quote_unavailable", "fee_policy_breach"])
    );
  });

  it("allows a zero-fee receiver-paid quote", () => {
    const pending = disbursement({ commitmentId: null, payoutPlanId: null });
    const snapshot = selectPoolFundingSnapshot(
      input({
        disbursements: [pending],
        feeQuotes: [
          { id: pending.id, amount: pending.amount, fee: 0n, senderPays: false, recipient: OTHER },
        ],
      })
    );
    expect(snapshot.settlementUnavailableReasons).not.toContain("receiver_paid_fee");
  });

  it("marks authorized underfunding as financially and operationally unavailable", () => {
    const pending = disbursement({ commitmentId: null, payoutPlanId: null });
    const snapshot = selectPoolFundingSnapshot(
      input({
        balance: { value: 50n, blockNumber: 50n, blockTimestamp: 2_000, readAt: 2_001 },
        disbursements: [pending],
        feeQuotes: [
          { id: pending.id, amount: pending.amount, fee: 0n, senderPays: true, recipient: OTHER },
        ],
      })
    );
    expect(snapshot.fundingState).toBe("insufficient");
    expect(snapshot.settlementReadiness).toBe("unavailable");
    expect(snapshot.settlementUnavailableReasons).toContain("insufficient_authorized_balance");
  });

  it.each([
    [true, "acknowledgment_reserve_low"],
    [null, "acknowledgment_reserve_unreadable"],
  ] as const)("reports acknowledgment reserve readiness when the live probe is %s", (low, reason) => {
    const snapshot = selectPoolFundingSnapshot(input({ acknowledgmentFeeReserveLow: low }));
    expect(snapshot.settlementUnavailableReasons).toContain(reason);
  });

  it("marks a confirmed row without a successful Celo execution as an inconsistent ledger", () => {
    const child = disbursement({ state: "CONFIRMED", executionKey: "0x1234" });
    const snapshot = selectPoolFundingSnapshot(
      input({
        payoutPlans: [
          {
            id: "plan-3",
            payoutPlanId: 3n,
            commitmentId: 10n,
            finalized: true,
            rows: [{ id: "row-1", amount: 100n, recipient: OTHER, disbursementId: 1n }],
          },
        ],
        disbursements: [child],
      })
    );
    expect(snapshot.available).toBeNull();
    expect(snapshot.fundingUnavailableReasons).toContain("ledger_inconsistent");
  });
});
