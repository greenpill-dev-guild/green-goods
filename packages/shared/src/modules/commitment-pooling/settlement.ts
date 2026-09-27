import { encodeAbiParameters, type Hex, keccak256 } from "viem";

import type { Address } from "../../types/domain";

export type IndexedDisbursementState =
  | "UNKNOWN"
  | "QUEUED"
  | "DISPATCHED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export type SettlementDeliveryState =
  | { status: "confirmed" }
  | { status: "cancelled"; from: "queued" | "failed" }
  | { status: "failed"; failureCode?: number }
  | { status: "executed-acknowledgment-pending" }
  | { status: "dispatched" }
  | { status: "delivery-delayed" }
  | { status: "queued" }
  | { status: "member-delivery-disabled" }
  | { status: "not-started" }
  | { status: "unknown" };

/** The indexer stores the on-chain execution enum verbatim. */
export function isSuccessfulSettlementExecution(status: string | null | undefined): boolean {
  return status === "SUCCESS";
}

export function deriveSettlementDeliveryState(input: {
  state: IndexedDisbursementState | null;
  cancelledFromState?: "QUEUED" | "FAILED" | null;
  failureCode?: number;
  executed?: boolean;
  acknowledgmentPending?: boolean;
  deliveryDelayed?: boolean;
  gardenerDeliveryEnabled?: boolean | null;
}): SettlementDeliveryState {
  if (input.state === "CONFIRMED") return { status: "confirmed" };
  if (input.state === "CANCELLED") {
    return {
      status: "cancelled",
      from: input.cancelledFromState === "FAILED" ? "failed" : "queued",
    };
  }
  if (input.state === "FAILED") {
    return {
      status: "failed",
      ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
    };
  }
  if (input.state === "DISPATCHED" && input.executed && input.acknowledgmentPending) {
    return { status: "executed-acknowledgment-pending" };
  }
  if (input.state === "DISPATCHED" && input.deliveryDelayed) {
    return { status: "delivery-delayed" };
  }
  if (input.state === "DISPATCHED") return { status: "dispatched" };
  if (input.state === "QUEUED") return { status: "queued" };
  if (input.state === null) {
    return input.gardenerDeliveryEnabled === true
      ? { status: "not-started" }
      : { status: "member-delivery-disabled" };
  }
  return { status: "unknown" };
}

export interface RecognitionEntryInput {
  contributor: Address;
  recognitionWeightBps: number;
}

/**
 * The hash `createCommitmentPayoutPlan` expects beside the recognition vector.
 * Mirrors RecognitionLib.validateRecognitionSnapshot, which proves the entries
 * equal the recomputed vector and then hashes
 * `abi.encode(block.chainid, commitmentId, entries)`; a vector in the wrong
 * order or with a stale weight produces a different hash and the chain refuses
 * it by name (`InvalidAllocation`), so nothing is created against a stale roster.
 */
export function hashRecognitionSnapshot(input: {
  chainId: number;
  commitmentId: bigint;
  entries: readonly RecognitionEntryInput[];
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        {
          type: "tuple[]",
          components: [
            { name: "contributor", type: "address" },
            { name: "recognitionWeightBps", type: "uint16" },
          ],
        },
      ],
      [
        BigInt(input.chainId),
        input.commitmentId,
        input.entries.map((entry) => ({
          contributor: entry.contributor,
          recognitionWeightBps: entry.recognitionWeightBps,
        })),
      ]
    )
  );
}

export function selectSettlementActions(input: {
  state: IndexedDisbursementState;
  isBatch: boolean;
  isBatchMember: boolean;
  kind?:
    | "CONTRIBUTOR_CONSIDERATION"
    | "FUNDING"
    | "LOAN_PRINCIPAL"
    | "GARDEN_BENEFICIARY"
    | "REFUND";
  sourcePaused: boolean;
  canDispatchOrRetry: boolean;
  canRequeueOrCancel: boolean;
}) {
  const canDispatchOrRetry = input.canDispatchOrRetry;
  const canRequeueOrCancel = input.canRequeueOrCancel;
  return {
    dispatch: canDispatchOrRetry && !input.sourcePaused && input.state === "QUEUED",
    retrySameCommand: canDispatchOrRetry && !input.sourcePaused && input.state === "DISPATCHED",
    startNewAttempt:
      canRequeueOrCancel && !input.sourcePaused && !input.isBatch && input.state === "FAILED",
    cancelIndividual:
      canRequeueOrCancel &&
      !input.isBatch &&
      input.kind !== "REFUND" &&
      (input.state === "FAILED" || (input.state === "QUEUED" && !input.isBatchMember)),
    cancelBatch: canRequeueOrCancel && input.isBatch && input.state === "QUEUED",
  } as const;
}

export function selectOperationsCapabilities(input: {
  authorityResolved: boolean;
  isSettlementOwner: boolean;
  isProtocolSteward: boolean;
  isExecutorSteward: boolean;
  isDispatcher: boolean;
  isDeployer: boolean;
}) {
  if (!input.authorityResolved) {
    return {
      canQueueFunding: false,
      canDispatchOrRetry: false,
      canRequeueOrCancel: false,
      showOperations: input.isDeployer,
    };
  }
  const canQueueFunding = input.isSettlementOwner || input.isProtocolSteward;
  const canDispatchOrRetry = input.isExecutorSteward || input.isDispatcher;
  const canRequeueOrCancel = input.isExecutorSteward;
  return {
    canQueueFunding,
    canDispatchOrRetry,
    canRequeueOrCancel,
    showOperations: input.isDeployer || canQueueFunding || canDispatchOrRetry || canRequeueOrCancel,
  };
}
