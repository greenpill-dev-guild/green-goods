import { describe, expect, it } from "vitest";

import {
  deriveSettlementDeliveryState,
  deriveCommitmentSettlementFlow,
  hashBeneficiarySnapshot,
  hashPaymentSnapshot,
  isSuccessfulSettlementExecution,
  selectConsiderationStatus,
  selectOperationsCapabilities,
  selectConfirmedDisbursementTotal,
  selectSettlementActions,
  selectSettlementReadiness,
} from "../modules/commitment-pooling/settlement";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;

describe("settlement status precedence", () => {
  it("totals only acknowledgment-confirmed disbursements", () => {
    expect(
      selectConfirmedDisbursementTotal([
        { state: "UNKNOWN", amount: 1n },
        { state: "QUEUED", amount: 2n },
        { state: "DISPATCHED", amount: 4n },
        { state: "CONFIRMED", amount: 8n },
        { state: "FAILED", amount: 16n },
        { state: "CANCELLED", amount: 32n },
      ])
    ).toBe(8n);
  });

  it("accepts only the indexer's literal execution success enum", () => {
    expect(isSuccessfulSettlementExecution("SUCCESS")).toBe(true);
    expect(isSuccessfulSettlementExecution("EXECUTED")).toBe(false);
    expect(isSuccessfulSettlementExecution("SUCCEEDED")).toBe(false);
    expect(isSuccessfulSettlementExecution(undefined)).toBe(false);
  });

  it("keeps confirmed, cancellation origin, failure, acknowledgment pending, dispatch, delay, and queue distinct", () => {
    expect(deriveSettlementDeliveryState({ state: "CONFIRMED" })).toEqual({ status: "confirmed" });
    expect(
      deriveSettlementDeliveryState({ state: "CANCELLED", cancelledFromState: "FAILED" })
    ).toEqual({ status: "cancelled", from: "failed" });
    expect(deriveSettlementDeliveryState({ state: "FAILED", failureCode: 7 })).toEqual({
      status: "failed",
      failureCode: 7,
    });
    expect(
      deriveSettlementDeliveryState({
        state: "DISPATCHED",
        executed: true,
        acknowledgmentPending: true,
      })
    ).toEqual({ status: "executed-acknowledgment-pending" });
    expect(deriveSettlementDeliveryState({ state: "DISPATCHED", deliveryDelayed: true })).toEqual({
      status: "delivery-delayed",
    });
    expect(deriveSettlementDeliveryState({ state: "DISPATCHED" })).toEqual({
      status: "dispatched",
    });
    expect(deriveSettlementDeliveryState({ state: "QUEUED" })).toEqual({ status: "queued" });
  });

  it("applies gardener delivery as a fail-closed no-disbursement guard only", () => {
    expect(deriveSettlementDeliveryState({ state: null, gardenerDeliveryEnabled: true })).toEqual({
      status: "not-started",
    });
    expect(deriveSettlementDeliveryState({ state: null, gardenerDeliveryEnabled: false })).toEqual({
      status: "member-delivery-disabled",
    });
    expect(deriveSettlementDeliveryState({ state: null, gardenerDeliveryEnabled: null })).toEqual({
      status: "member-delivery-disabled",
    });
    expect(
      deriveSettlementDeliveryState({ state: "CONFIRMED", gardenerDeliveryEnabled: false })
    ).toEqual({ status: "confirmed" });
  });
});

describe("consideration rail separation", () => {
  it("never merges Arbitrum records with Celo settlement state", () => {
    expect(
      selectConsiderationStatus({
        rail: "ARBITRUM_EXTERNAL",
        considerationPaid: true,
        settlement: { status: "confirmed" },
      })
    ).toEqual({ rail: "ARBITRUM_EXTERNAL", status: "paid" });
    expect(
      selectConsiderationStatus({
        rail: "CELO_SETTLEMENT",
        considerationPaid: true,
        settlement: { status: "queued" },
      })
    ).toEqual({ rail: "CELO_SETTLEMENT", status: "queued" });
    expect(
      selectConsiderationStatus({
        rail: "NONE",
        considerationPaid: true,
        settlement: { status: "confirmed" },
      })
    ).toEqual({ rail: "NONE", status: "none" });
  });
});

describe("settlement snapshot hashes", () => {
  it("hashes the immutable payment and beneficiary snapshot shapes deterministically", () => {
    const payment = hashPaymentSnapshot({
      chainId: 42161,
      payoutPlanId: 9n,
      paymentSnapshotVersion: 2,
      gardenRetainedAmount: 10n,
      contributorPayoutTotal: 90n,
      rows: [
        {
          contributor: A,
          recipient: B,
          recognitionWeightBps: 6000,
          paymentWeightBps: 7000,
          amount: 70n,
        },
        {
          contributor: B,
          recipient: A,
          recognitionWeightBps: 4000,
          paymentWeightBps: 3000,
          amount: 20n,
        },
      ],
    });
    const beneficiary = hashBeneficiarySnapshot({
      chainId: 42161,
      payoutPlanId: 9n,
      payoutKind: "GARDEN_BENEFICIARY",
      beneficiaryGarden: A,
      beneficiaryRecipient: B,
      amount: 100n,
    });
    expect(payment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(beneficiary).toMatch(/^0x[0-9a-f]{64}$/);
    expect(payment).not.toBe(beneficiary);
  });
});

describe("settlement authority and action separation", () => {
  it("does not treat deployer visibility as funding authority", () => {
    expect(
      selectOperationsCapabilities({
        authorityResolved: true,
        isSettlementOwner: false,
        isProtocolSteward: false,
        isExecutorSteward: false,
        isDispatcher: false,
        isDeployer: true,
      })
    ).toEqual({ canQueueFunding: false, canOperateSettlement: false, showOperations: true });
    expect(
      selectOperationsCapabilities({
        authorityResolved: false,
        isSettlementOwner: true,
        isProtocolSteward: true,
        isExecutorSteward: true,
        isDispatcher: true,
        isDeployer: false,
      })
    ).toEqual({ canQueueFunding: false, canOperateSettlement: false, showOperations: false });
  });

  it("offers batch cancellation atomically and never on a queued member", () => {
    expect(
      selectSettlementActions({
        state: "QUEUED",
        isBatch: true,
        isBatchMember: false,
        sourcePaused: false,
        canOperate: true,
      })
    ).toMatchObject({ cancelBatch: true, cancelIndividual: false });
    expect(
      selectSettlementActions({
        state: "QUEUED",
        isBatch: false,
        isBatchMember: true,
        sourcePaused: false,
        canOperate: true,
      })
    ).toMatchObject({ cancelBatch: false, cancelIndividual: false });
    expect(
      selectSettlementActions({
        state: "FAILED",
        isBatch: false,
        isBatchMember: false,
        sourcePaused: false,
        canOperate: true,
      })
    ).toMatchObject({ retrySameCommand: false, startNewAttempt: true });
  });

  it("derives flow only from payer, provider, and protocol Garden identities", () => {
    expect(
      deriveCommitmentSettlementFlow({ payerGarden: A, providerGarden: B, protocolGarden: A })
    ).toBe("PROTOCOL_TO_GARDEN");
    expect(
      deriveCommitmentSettlementFlow({ payerGarden: A, providerGarden: A, protocolGarden: B })
    ).toBe("INTERNAL");
  });

  it("keeps every readiness capability independently visible", () => {
    const readiness = selectSettlementReadiness({
      sourcePaused: false,
      executorPaused: false,
      batchWithinLimit: true,
      amountWithinCap: true,
      batchAmountWithinCap: true,
      feeReserveLow: true,
      peerConfigured: true,
      sourceAccountActive: true,
      executorRouteActive: true,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.feeReserveReady).toBe(false);
    expect(readiness.peerReady).toBe(true);
  });
});
