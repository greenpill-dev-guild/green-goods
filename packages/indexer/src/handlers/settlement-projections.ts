import type {
  CommitmentPayoutPlan,
  CommitmentFunding,
  Disbursement,
  SettlementConfiguration,
  SettlementExecution,
  SettlementSubjectState,
} from "envio";

import { normalizeAddress, ZERO_ADDRESS } from "./shared";

export const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

export function configurationId(chainId: number): string {
  return `${chainId}-settlement-config`;
}

export function payoutPlanId(chainId: number, id: bigint): string {
  return `${chainId}-${id}`;
}

export function disbursementId(chainId: number, id: bigint): string {
  return `${chainId}-${id}`;
}

export function settlementAccountId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function contributorPayoutId(
  chainId: number,
  payoutPlan: bigint,
  contributor: string
): string {
  return `${chainId}-${payoutPlan}-${normalizeAddress(contributor)}`;
}

export function payoutSnapshotId(chainId: number, payoutPlan: bigint, version: bigint): string {
  return `${chainId}-${payoutPlan}-${version}`;
}

export function payoutSnapshotRowId(
  chainId: number,
  payoutPlan: bigint,
  version: bigint,
  contributor: string
): string {
  return `${payoutSnapshotId(chainId, payoutPlan, version)}-${normalizeAddress(contributor)}`;
}

export function settlementBatchId(chainId: number, id: bigint): string {
  return `${chainId}-${id}`;
}

export function settlementSubjectId(chainId: number, isBatch: boolean, id: bigint): string {
  return `${chainId}-${isBatch ? "B" : "D"}-${id}`;
}

export function settlementMessageId(chainId: number, id: string): string {
  return `${chainId}-${id.toLowerCase()}`;
}

export function settlementCommandIndexId(chainId: number, key: string): string {
  return `${chainId}-${key.toLowerCase()}`;
}

export function settlementExecutionId(chainId: number, key: string): string {
  return `${chainId}-${key.toLowerCase()}`;
}

export function settlementGardenRouteId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function optionalAddress(value: string): string | undefined {
  const normalized = normalizeAddress(value);
  return normalized === ZERO_ADDRESS ? undefined : normalized;
}

export function derivedFundingState(funding: CommitmentFunding): CommitmentFunding["state"] {
  if (funding.state === "REFUNDED") return "REFUNDED";
  if (funding.withdrawBlockNumber !== undefined) return "WITHDRAWN";
  if (funding.refundDisbursementId !== undefined) return "REFUND_QUEUED";
  if (funding.closedAt !== undefined) return "CLOSED";
  if (funding.consumeBlockNumber !== undefined) return "CONSUMED";
  if (funding.depositBlockNumber !== undefined) return "DEPOSIT_RECORDED";
  if (funding.pledgeSeen) return "PLEDGED";
  return "UNKNOWN";
}

export function disbursementKind(kind: bigint): Disbursement["kind"] {
  switch (kind) {
    case 0n:
      return "CONTRIBUTOR_CONSIDERATION";
    case 1n:
      return "FUNDING";
    case 2n:
      return "LOAN_PRINCIPAL";
    case 3n:
      return "GARDEN_BENEFICIARY";
    case 4n:
      return "REFUND";
    default:
      return "UNKNOWN";
  }
}

export function fundingRoute(route: bigint): Disbursement["fundingRoute"] {
  switch (route) {
    case 0n:
      return "NONE";
    case 1n:
      return "PROTOCOL_TO_GARDEN";
    default:
      return "UNKNOWN";
  }
}

export function settlementFlow(
  payerGarden: string,
  providerGarden: string,
  protocolGarden: string | undefined
): CommitmentPayoutPlan["settlementFlow"] {
  if (payerGarden === providerGarden) return "INTERNAL";
  if (!protocolGarden) return "UNKNOWN";
  if (payerGarden === protocolGarden) return "PROTOCOL_TO_GARDEN";
  if (providerGarden === protocolGarden) return "GARDEN_TO_PROTOCOL";
  return "GARDEN_TO_GARDEN";
}

export type PayoutStatusFacts = Pick<
  CommitmentPayoutPlan,
  | "finalized"
  | "payablePayoutCount"
  | "confirmedPayoutCount"
  | "failedPayoutCount"
  | "cancelledPayoutCount"
>;

export function payoutStatus(plan: PayoutStatusFacts): CommitmentPayoutPlan["status"] {
  if (!plan.finalized) return "DRAFT";
  if (plan.payablePayoutCount === 0 || plan.confirmedPayoutCount === plan.payablePayoutCount) {
    return "COMPLETE";
  }
  if (plan.confirmedPayoutCount !== 0) return "PARTIAL";
  if (plan.failedPayoutCount + plan.cancelledPayoutCount === plan.payablePayoutCount) {
    return "FAILED";
  }
  return "PENDING";
}

export function applySubjectStateToDisbursement(
  entity: Disbursement,
  subject: SettlementSubjectState
): Disbursement {
  return {
    ...entity,
    state: subject.state,
    attempt: subject.attempt,
    executionKey: subject.executionKey,
    commandMessageId: subject.commandMessageId,
    acknowledgmentMessageId: subject.acknowledgmentMessageId,
    failureCode: subject.failureCode,
    dispatchedAt: subject.dispatchedAt,
    confirmedAt: subject.confirmedAt,
    reasonCID: subject.reasonCID ?? entity.reasonCID,
    updatedAt: Math.max(entity.updatedAt, subject.updatedAt),
  };
}

export function executionStatus(status: bigint): SettlementExecution["status"] {
  if (status === 1n) return "SUCCESS";
  if (status === 2n) return "FAILED";
  return "UNKNOWN";
}

export function acknowledgmentDeferralCode(
  code: bigint
): SettlementExecution["acknowledgmentDeferralCode"] {
  switch (code) {
    case 0n:
      return "NONE";
    case 1n:
      return "QUOTE_FAILED";
    case 2n:
      return "FEE_RESERVE_LOW";
    case 3n:
      return "SEND_FAILED";
    default:
      return "UNKNOWN";
  }
}

export function sourceConfiguration(
  chainId: number,
  localContract: string,
  gDollarToken: string,
  updatedAt: number,
  existing?: SettlementConfiguration
): SettlementConfiguration {
  return {
    id: configurationId(chainId),
    chainId,
    role: "SOURCE",
    gardenerDeliveryEnabled: existing?.gardenerDeliveryEnabled,
    protocolGarden: existing?.protocolGarden,
    gDollarToken: normalizeAddress(gDollarToken),
    hatsModule: existing?.hatsModule,
    commitmentPoolingModule: existing?.commitmentPoolingModule,
    creditRegistry: existing?.creditRegistry,
    localContract: normalizeAddress(localContract),
    localRouter: existing?.localRouter ?? ZERO_ADDRESS,
    localChainSelector: existing?.localChainSelector ?? 0n,
    remoteChainSelector: existing?.remoteChainSelector,
    remoteEvmChainId: existing?.remoteEvmChainId,
    destinationGasLimit: existing?.destinationGasLimit,
    activePeer: existing?.activePeer,
    previousPeer: existing?.previousPeer,
    previousPeerExpiresAt: existing?.previousPeerExpiresAt,
    protocolVersion: existing?.protocolVersion ?? 0,
    dispatcher: existing?.dispatcher,
    batchSizeLimit: existing?.batchSizeLimit ?? 0,
    maxTransferAmount: undefined,
    maxBatchAmount: undefined,
    maxFeeBps: undefined,
    maxFeeAmount: undefined,
    periodDuration: undefined,
    maxPeriodAmount: undefined,
    feeReserveMinimum: existing?.feeReserveMinimum ?? 0n,
    nativeFeeBalance: existing?.nativeFeeBalance ?? 0n,
    feeReserveLow: existing?.feeReserveLow ?? true,
    peerConfigured: existing?.peerConfigured ?? false,
    paused: existing?.paused ?? true,
    pendingPayoutPlanEntityIds: existing?.pendingPayoutPlanEntityIds ?? [],
    updatedAt,
  };
}

export function executorConfiguration(
  chainId: number,
  localContract: string,
  updatedAt: number,
  existing?: SettlementConfiguration
): SettlementConfiguration {
  return {
    id: configurationId(chainId),
    chainId,
    role: "EXECUTOR",
    gardenerDeliveryEnabled: undefined,
    protocolGarden: undefined,
    gDollarToken: existing?.gDollarToken ?? ZERO_ADDRESS,
    hatsModule: undefined,
    commitmentPoolingModule: undefined,
    creditRegistry: undefined,
    localContract: normalizeAddress(localContract),
    localRouter: existing?.localRouter ?? ZERO_ADDRESS,
    localChainSelector: existing?.localChainSelector ?? 0n,
    remoteChainSelector: existing?.remoteChainSelector,
    remoteEvmChainId: existing?.remoteEvmChainId,
    destinationGasLimit: existing?.destinationGasLimit,
    activePeer: existing?.activePeer,
    previousPeer: existing?.previousPeer,
    previousPeerExpiresAt: existing?.previousPeerExpiresAt,
    protocolVersion: existing?.protocolVersion ?? 0,
    dispatcher: undefined,
    batchSizeLimit: existing?.batchSizeLimit ?? 0,
    maxTransferAmount: existing?.maxTransferAmount,
    maxBatchAmount: existing?.maxBatchAmount,
    maxFeeBps: existing?.maxFeeBps,
    maxFeeAmount: existing?.maxFeeAmount,
    periodDuration: existing?.periodDuration,
    maxPeriodAmount: existing?.maxPeriodAmount,
    feeReserveMinimum: existing?.feeReserveMinimum ?? 0n,
    nativeFeeBalance: existing?.nativeFeeBalance ?? 0n,
    feeReserveLow: existing?.feeReserveLow ?? true,
    peerConfigured: existing?.peerConfigured ?? false,
    paused: existing?.paused ?? true,
    pendingPayoutPlanEntityIds: [],
    updatedAt,
  };
}
