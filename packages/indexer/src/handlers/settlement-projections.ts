import type { CommitmentPayoutPlan, Disbursement, SettlementConfiguration } from "envio";

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

export function optionalAddress(value: string): string | undefined {
  const normalized = normalizeAddress(value);
  return normalized === ZERO_ADDRESS ? undefined : normalized;
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
    localContract: normalizeAddress(localContract),
    localRouter: existing?.localRouter ?? ZERO_ADDRESS,
    localChainSelector: existing?.localChainSelector ?? 0n,
    remoteChainSelector: existing?.remoteChainSelector,
    remoteEvmChainId: existing?.remoteEvmChainId,
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
