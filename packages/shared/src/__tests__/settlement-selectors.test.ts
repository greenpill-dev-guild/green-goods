import { describe, expect, it } from "vitest";

import {
  deriveSettlementDeliveryState,
  isSuccessfulSettlementExecution,
  selectOperationsCapabilities,
  selectSettlementActions,
} from "../modules/commitment-pooling/settlement";

describe("settlement status precedence", () => {
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

describe("settlement authority and action separation", () => {
  it.each([
    {
      name: "module owner only",
      roles: {
        isSettlementOwner: true,
        isProtocolSteward: false,
        isExecutorSteward: false,
        isDispatcher: false,
        isDeployer: false,
      },
      expected: {
        canQueueFunding: true,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        showOperations: true,
      },
    },
    {
      name: "protocol steward only",
      roles: {
        isSettlementOwner: false,
        isProtocolSteward: true,
        isExecutorSteward: false,
        isDispatcher: false,
        isDeployer: false,
      },
      expected: {
        canQueueFunding: true,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        showOperations: true,
      },
    },
    {
      name: "dispatcher only",
      roles: {
        isSettlementOwner: false,
        isProtocolSteward: false,
        isExecutorSteward: false,
        isDispatcher: true,
        isDeployer: false,
      },
      expected: {
        canQueueFunding: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: false,
        showOperations: true,
      },
    },
    {
      name: "executor steward",
      roles: {
        isSettlementOwner: false,
        isProtocolSteward: false,
        isExecutorSteward: true,
        isDispatcher: false,
        isDeployer: false,
      },
      expected: {
        canQueueFunding: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: true,
        showOperations: true,
      },
    },
    {
      name: "deployer only",
      roles: {
        isSettlementOwner: false,
        isProtocolSteward: false,
        isExecutorSteward: false,
        isDispatcher: false,
        isDeployer: true,
      },
      expected: {
        canQueueFunding: false,
        canDispatchOrRetry: false,
        canRequeueOrCancel: false,
        showOperations: true,
      },
    },
  ])("maps $name to the contract's action-level authority", ({ roles, expected }) => {
    expect(selectOperationsCapabilities({ authorityResolved: true, ...roles })).toEqual(expected);
  });

  it("fails closed while settlement authority is unresolved", () => {
    expect(
      selectOperationsCapabilities({
        authorityResolved: false,
        isSettlementOwner: true,
        isProtocolSteward: true,
        isExecutorSteward: true,
        isDispatcher: true,
        isDeployer: false,
      })
    ).toEqual({
      canQueueFunding: false,
      canDispatchOrRetry: false,
      canRequeueOrCancel: false,
      showOperations: false,
    });
  });

  it("offers batch cancellation atomically and never on a queued member", () => {
    expect(
      selectSettlementActions({
        state: "QUEUED",
        isBatch: true,
        isBatchMember: false,
        sourcePaused: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: true,
      })
    ).toMatchObject({ cancelBatch: true, cancelIndividual: false });
    expect(
      selectSettlementActions({
        state: "QUEUED",
        isBatch: false,
        isBatchMember: true,
        sourcePaused: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: true,
      })
    ).toMatchObject({ cancelBatch: false, cancelIndividual: false });
    expect(
      selectSettlementActions({
        state: "FAILED",
        isBatch: false,
        isBatchMember: false,
        sourcePaused: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: true,
      })
    ).toMatchObject({ retrySameCommand: false, startNewAttempt: true });
  });

  it("keeps dispatcher recovery actions hidden while allowing dispatch and retry", () => {
    expect(
      selectSettlementActions({
        state: "QUEUED",
        isBatch: false,
        isBatchMember: false,
        sourcePaused: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: false,
      })
    ).toMatchObject({ dispatch: true, cancelIndividual: false });
    expect(
      selectSettlementActions({
        state: "FAILED",
        isBatch: false,
        isBatchMember: false,
        sourcePaused: false,
        canDispatchOrRetry: true,
        canRequeueOrCancel: false,
      })
    ).toMatchObject({ startNewAttempt: false, cancelIndividual: false });
  });
});
