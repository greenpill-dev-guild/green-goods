import type { Address } from "../../types/domain";
import type {
  CommitmentPayoutPlanRecord,
  ContributorPayoutRecord,
  SettlementAccountRecord,
  SettlementConfigurationRecord,
  SettlementExecutionRecord,
  SettlementGardenRouteRecord,
  SettlementMessageRecord,
  SettlementSubjectRecord,
} from "./types";
import {
  type RawRow,
  address,
  hexString,
  integer,
  number,
  optionalInteger,
  optionalNumber,
  string,
  strings,
} from "./data-core";

export function mapSettlementConfiguration(row: RawRow): SettlementConfigurationRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    role: String(row.role),
    gardenerDeliveryEnabled:
      row.gardenerDeliveryEnabled === null || row.gardenerDeliveryEnabled === undefined
        ? null
        : row.gardenerDeliveryEnabled === true,
    protocolGarden: address(row.protocolGarden),
    gDollarToken: address(row.gDollarToken)!,
    hatsModule: address(row.hatsModule),
    commitmentPoolingModule: address(row.commitmentPoolingModule),
    localContract: address(row.localContract)!,
    localRouter: address(row.localRouter)!,
    localChainSelector: integer(row.localChainSelector),
    remoteChainSelector: optionalInteger(row.remoteChainSelector),
    remoteEvmChainId: optionalNumber(row.remoteEvmChainId),
    destinationGasLimit: optionalNumber(row.destinationGasLimit),
    activePeer: address(row.activePeer),
    previousPeer: address(row.previousPeer),
    previousPeerExpiresAt: optionalInteger(row.previousPeerExpiresAt),
    protocolVersion: number(row.protocolVersion),
    dispatcher: address(row.dispatcher),
    batchSizeLimit: number(row.batchSizeLimit),
    maxTransferAmount: optionalInteger(row.maxTransferAmount),
    maxBatchAmount: optionalInteger(row.maxBatchAmount),
    maxFeeBps: optionalNumber(row.maxFeeBps),
    maxFeeAmount: optionalInteger(row.maxFeeAmount),
    periodDuration: optionalNumber(row.periodDuration),
    maxPeriodAmount: optionalInteger(row.maxPeriodAmount),
    feeReserveMinimum: integer(row.feeReserveMinimum),
    nativeFeeBalance: integer(row.nativeFeeBalance),
    feeReserveLow: row.feeReserveLow === true,
    peerConfigured: row.peerConfigured === true,
    paused: row.paused === true,
    updatedAt: number(row.updatedAt),
  };
}

export function mapSettlementSubject(row: RawRow, isBatch: boolean): SettlementSubjectRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    isBatch,
    subjectId: integer(isBatch ? row.batchId : row.disbursementId),
    executorGarden: address(row.executorGarden)!,
    state: String(row.state ?? "UNKNOWN") as SettlementSubjectRecord["state"],
    attempt: number(row.attempt),
    executionKey: hexString(row.executionKey),
    commandMessageId: hexString(row.commandMessageId),
    acknowledgmentMessageId: hexString(row.acknowledgmentMessageId),
    dispatchedAt: optionalNumber(row.dispatchedAt),
    confirmedAt: optionalNumber(row.confirmedAt),
    failureCode: optionalNumber(row.failureCode),
    reasonCID: string(row.reasonCID),
    cancelledFromState:
      row.cancelledFromState === "FAILED" || row.cancelledFromState === "QUEUED"
        ? row.cancelledFromState
        : null,
    batchId: isBatch ? integer(row.batchId) : optionalInteger(row.batchId),
    kind: string(row.kind),
    fundingRoute: string(row.fundingRoute),
    source: address(row.source),
    recipient: address(row.recipient),
    token: address(row.token),
    amount: optionalInteger(row.amount),
    updatedAt: number(row.updatedAt),
  };
}

export function mapSettlementMessage(row: RawRow): SettlementMessageRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    messageId: String(row.messageId).toLowerCase() as `0x${string}`,
    executionKey: String(row.executionKey).toLowerCase() as `0x${string}`,
    direction: row.direction as "COMMAND" | "ACKNOWLEDGMENT",
    status: String(row.status),
    isBatch: row.isBatch === true,
    subjectId: integer(row.subjectId),
    attempt: optionalNumber(row.attempt),
    destinationPeer: address(row.destinationPeer),
    destinationGasLimit: optionalNumber(row.destinationGasLimit),
    protocolVersion: number(row.protocolVersion),
    commandPayloadHash: hexString(row.commandPayloadHash),
    sourceChainId: number(row.sourceChainId),
    destinationChainId: number(row.destinationChainId),
    fee: optionalInteger(row.fee),
    reserveFunded:
      row.reserveFunded === null || row.reserveFunded === undefined
        ? null
        : row.reserveFunded === true,
    failureCode: optionalNumber(row.failureCode),
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapSettlementExecution(row: RawRow): SettlementExecutionRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    sourceChainId: number(row.sourceChainId),
    executionKey: String(row.executionKey).toLowerCase() as `0x${string}`,
    commandMessageId: String(row.commandMessageId).toLowerCase() as `0x${string}`,
    acknowledgmentReceiver: address(row.acknowledgmentReceiver)!,
    protocolVersion: number(row.protocolVersion),
    executorGarden: address(row.executorGarden)!,
    isBatch: row.isBatch === true,
    settlementId: integer(row.settlementId),
    attempt: number(row.attempt),
    status: String(row.status),
    failureCode: number(row.failureCode),
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    acknowledgmentMessageId: hexString(row.acknowledgmentMessageId),
    acknowledgmentSent: row.acknowledgmentSent === true,
    acknowledgmentDeferralCode: String(row.acknowledgmentDeferralCode),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapCommitmentPayoutPlan(row: RawRow): CommitmentPayoutPlanRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    payoutPlanId: integer(row.payoutPlanId),
    commitmentId: integer(row.commitmentId),
    payerGarden: address(row.payerGarden)!,
    payerGardenId: String(row.payerGardenId),
    providerGarden: address(row.providerGarden)!,
    providerGardenId: String(row.providerGardenId),
    settlementFlow: String(row.settlementFlow) as CommitmentPayoutPlanRecord["settlementFlow"],
    payoutKind: String(row.payoutKind) as CommitmentPayoutPlanRecord["payoutKind"],
    declaredAmount: integer(row.declaredAmount),
    gardenRetainedAmount: integer(row.gardenRetainedAmount),
    contributorPayoutTotal: integer(row.contributorPayoutTotal),
    beneficiaryGarden: address(row.beneficiaryGarden),
    beneficiaryRecipient: address(row.beneficiaryRecipient),
    beneficiaryAmount: integer(row.beneficiaryAmount),
    beneficiaryDisbursementId: optionalInteger(row.beneficiaryDisbursementId),
    recognitionSnapshotHash: String(row.recognitionSnapshotHash).toLowerCase() as `0x${string}`,
    paymentSnapshotHash: String(row.paymentSnapshotHash).toLowerCase() as `0x${string}`,
    paymentSnapshotVersion: number(row.paymentSnapshotVersion),
    finalized: row.finalized === true,
    status: String(row.status),
    payablePayoutCount: number(row.payablePayoutCount),
    preparedPayoutCount: number(row.preparedPayoutCount),
    confirmedPayoutCount: number(row.confirmedPayoutCount),
    failedPayoutCount: number(row.failedPayoutCount),
    cancelledPayoutCount: number(row.cancelledPayoutCount),
    createdAt: number(row.createdAt),
    finalizedAt: optionalNumber(row.finalizedAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapContributorPayout(row: RawRow): ContributorPayoutRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    payoutPlanId: integer(row.payoutPlanId),
    commitmentId: integer(row.commitmentId),
    contributor: address(row.contributor)!,
    recipient: address(row.recipient)!,
    paymentSnapshotVersion: number(row.paymentSnapshotVersion),
    recognitionWeightBps: number(row.recognitionWeightBps),
    paymentWeightBps: number(row.paymentWeightBps),
    amount: integer(row.amount),
    disbursementId: optionalInteger(row.disbursementId),
    disbursementEntityId: string(row.disbursementEntityId),
    latestEditReasonCID: string(row.latestEditReasonCID),
    editedBy: address(row.editedBy)!,
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapSettlementAccount(row: RawRow): SettlementAccountRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    garden: address(row.garden)!,
    gardenId: String(row.gardenId),
    accountChainId: integer(row.accountChainId),
    account: address(row.account)!,
    active: row.active === true,
    recoveryOwners: strings(row.recoveryOwners).map((value) => value.toLowerCase() as Address),
    rolesModifier: address(row.rolesModifier)!,
    roleKey: String(row.roleKey).toLowerCase() as `0x${string}`,
    allowanceKey: String(row.allowanceKey).toLowerCase() as `0x${string}`,
    permissionsConfigHash: String(row.permissionsConfigHash).toLowerCase() as `0x${string}`,
    recoveryConfigHash: String(row.recoveryConfigHash).toLowerCase() as `0x${string}`,
    recoveryThreshold: number(row.recoveryThreshold),
    updatedAt: number(row.updatedAt),
  };
}

export function mapSettlementGardenRoute(row: RawRow): SettlementGardenRouteRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    sourceChainId: number(row.sourceChainId),
    garden: address(row.garden)!,
    gardenId: String(row.gardenId),
    settlementAccountId: String(row.settlementAccountId),
    safe: address(row.safe)!,
    rolesModifier: address(row.rolesModifier)!,
    roleKey: String(row.roleKey).toLowerCase() as `0x${string}`,
    allowanceKey: String(row.allowanceKey).toLowerCase() as `0x${string}`,
    permissionsConfigHash: String(row.permissionsConfigHash).toLowerCase() as `0x${string}`,
    active: row.active === true,
    configuredAt: number(row.configuredAt),
    updatedAt: number(row.updatedAt),
  };
}
