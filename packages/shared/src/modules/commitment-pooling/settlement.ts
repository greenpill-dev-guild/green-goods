import { encodeAbiParameters, keccak256, type Hex } from "viem";

import type { Address } from "../../types/domain";

export type IndexedDisbursementState =
  | "UNKNOWN"
  | "QUEUED"
  | "DISPATCHED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export function selectConfirmedDisbursementTotal(
  disbursements: readonly { state: IndexedDisbursementState; amount: bigint }[]
): bigint {
  return disbursements.reduce(
    (total, disbursement) =>
      disbursement.state === "CONFIRMED" ? total + disbursement.amount : total,
    0n
  );
}

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

export function selectConsiderationStatus(input: {
  rail: "UNKNOWN" | "NONE" | "ARBITRUM_EXTERNAL" | "CELO_SETTLEMENT";
  considerationPaid: boolean;
  settlement?: SettlementDeliveryState;
}) {
  if (input.rail === "ARBITRUM_EXTERNAL") {
    return {
      rail: input.rail,
      status: input.considerationPaid ? "paid" : "unpaid",
    } as const;
  }
  if (input.rail === "CELO_SETTLEMENT") {
    return {
      rail: input.rail,
      status: input.settlement?.status ?? "not-started",
    } as const;
  }
  if (input.rail === "NONE") return { rail: input.rail, status: "none" } as const;
  return { rail: input.rail, status: "unknown" } as const;
}

export interface PaymentSnapshotRowInput {
  contributor: Address;
  recipient: Address;
  recognitionWeightBps: number;
  paymentWeightBps: number;
  amount: bigint;
}

export function hashPaymentSnapshot(input: {
  chainId: number;
  payoutPlanId: bigint;
  paymentSnapshotVersion: number;
  gardenRetainedAmount: bigint;
  contributorPayoutTotal: bigint;
  rows: readonly PaymentSnapshotRowInput[];
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint32" },
        { type: "uint256" },
        { type: "uint256" },
        {
          type: "tuple[]",
          components: [
            { name: "contributor", type: "address" },
            { name: "recipient", type: "address" },
            { name: "recognitionWeightBps", type: "uint16" },
            { name: "paymentWeightBps", type: "uint16" },
            { name: "amount", type: "uint256" },
          ],
        },
      ],
      [
        BigInt(input.chainId),
        input.payoutPlanId,
        input.paymentSnapshotVersion,
        input.gardenRetainedAmount,
        input.contributorPayoutTotal,
        input.rows.map((row) => ({ ...row })),
      ]
    )
  );
}

const PAYOUT_KIND_ORDINAL = {
  CONTRIBUTOR_CONSIDERATION: 0,
  FUNDING: 1,
  LOAN_PRINCIPAL: 2,
  GARDEN_BENEFICIARY: 3,
  REFUND: 4,
} as const;

export function hashBeneficiarySnapshot(input: {
  chainId: number;
  payoutPlanId: bigint;
  payoutKind: keyof typeof PAYOUT_KIND_ORDINAL;
  beneficiaryGarden: Address;
  beneficiaryRecipient: Address;
  amount: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint8" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        BigInt(input.chainId),
        input.payoutPlanId,
        PAYOUT_KIND_ORDINAL[input.payoutKind],
        input.beneficiaryGarden,
        input.beneficiaryRecipient,
        input.amount,
      ]
    )
  );
}

export function deriveCommitmentSettlementFlow(input: {
  payerGarden: Address;
  providerGarden: Address;
  protocolGarden: Address;
}): "PROTOCOL_TO_GARDEN" | "GARDEN_TO_PROTOCOL" | "GARDEN_TO_GARDEN" | "INTERNAL" {
  const payer = input.payerGarden.toLowerCase();
  const provider = input.providerGarden.toLowerCase();
  const protocol = input.protocolGarden.toLowerCase();
  if (payer === provider) return "INTERNAL";
  if (payer === protocol) return "PROTOCOL_TO_GARDEN";
  if (provider === protocol) return "GARDEN_TO_PROTOCOL";
  return "GARDEN_TO_GARDEN";
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
  canOperate: boolean;
}) {
  const enabled = input.canOperate;
  return {
    dispatch: enabled && !input.sourcePaused && input.state === "QUEUED",
    retrySameCommand: enabled && !input.sourcePaused && input.state === "DISPATCHED",
    startNewAttempt: enabled && !input.sourcePaused && !input.isBatch && input.state === "FAILED",
    cancelIndividual:
      enabled &&
      !input.isBatch &&
      input.kind !== "REFUND" &&
      (input.state === "FAILED" || (input.state === "QUEUED" && !input.isBatchMember)),
    cancelBatch: enabled && input.isBatch && input.state === "QUEUED",
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
      canOperateSettlement: false,
      showOperations: input.isDeployer,
    };
  }
  const canQueueFunding = input.isSettlementOwner || input.isProtocolSteward;
  const canOperateSettlement =
    input.isSettlementOwner || input.isExecutorSteward || input.isDispatcher;
  return {
    canQueueFunding,
    canOperateSettlement,
    showOperations: input.isDeployer || canQueueFunding || canOperateSettlement,
  };
}

export function selectSettlementReadiness(input: {
  sourcePaused: boolean;
  executorPaused: boolean;
  batchWithinLimit: boolean;
  amountWithinCap: boolean;
  batchAmountWithinCap: boolean;
  feeReserveLow: boolean;
  peerConfigured: boolean;
  sourceAccountActive: boolean;
  executorRouteActive: boolean;
}) {
  return {
    sourceReady: !input.sourcePaused,
    executorReady: !input.executorPaused && input.executorRouteActive,
    batchWithinLimit: input.batchWithinLimit,
    amountWithinCap: input.amountWithinCap,
    batchAmountWithinCap: input.batchAmountWithinCap,
    feeReserveReady: !input.feeReserveLow,
    peerReady: input.peerConfigured,
    accountReady: input.sourceAccountActive,
    ready:
      !input.sourcePaused &&
      !input.executorPaused &&
      input.batchWithinLimit &&
      input.amountWithinCap &&
      input.batchAmountWithinCap &&
      !input.feeReserveLow &&
      input.peerConfigured &&
      input.sourceAccountActive &&
      input.executorRouteActive,
  } as const;
}
