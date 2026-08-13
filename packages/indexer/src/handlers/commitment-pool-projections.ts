import type {
  Commitment,
  CommitmentContributor,
  CommitmentCycle,
  CommitmentPool,
  CommitmentSeries,
  CommitmentWorkAttribution,
} from "envio";
import { keccak256, toBytes } from "viem";

import { normalizeAddress } from "./shared";

export function poolingEntityId(chainId: number, rawId: bigint): string {
  return `${chainId}-${rawId}`;
}

export function commitmentMemberId(chainId: number, commitmentId: bigint, account: string): string {
  return `${chainId}-${commitmentId}-${normalizeAddress(account)}`;
}

export function poolMemberId(chainId: number, poolId: bigint, account: string): string {
  return `${chainId}-${poolId}-${normalizeAddress(account)}`;
}

export function workAttributionId(chainId: number, workUID: string): string {
  return `${chainId}-${workUID.toLowerCase()}`;
}

export function eventAuditId(chainId: number, transactionHash: string, logIndex: number): string {
  return `${chainId}-${transactionHash.toLowerCase()}-${logIndex}`;
}

export function fundingIndexId(chainId: number, commitmentId: bigint, funder: string): string {
  return `${chainId}-${commitmentId}-${normalizeAddress(funder)}`;
}

export function exactLabelHash(label: string): string {
  return keccak256(toBytes(label));
}

export function sortedUnique<T extends string | number | bigint>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => {
    if (typeof left === "bigint" && typeof right === "bigint") {
      return left < right ? -1 : left > right ? 1 : 0;
    }
    return String(left).localeCompare(String(right));
  });
}

export function cursorWins(
  blockNumber: number,
  logIndex: number,
  currentBlock: bigint | undefined,
  currentLogIndex: number | undefined
): boolean {
  if (currentBlock === undefined || currentLogIndex === undefined) return true;
  const incoming = BigInt(blockNumber);
  return incoming > currentBlock || (incoming === currentBlock && logIndex > currentLogIndex);
}

export function commitmentPoolType(value: bigint): CommitmentPool["poolType"] {
  return value === 0n ? "GARDEN" : value === 1n ? "PROTOCOL" : "UNKNOWN";
}

export function commitmentCycleType(value: bigint): CommitmentCycle["cycleType"] {
  return value === 0n ? "SEASON" : value === 1n ? "CAMPAIGN" : "UNKNOWN";
}

export function commitmentDirection(value: bigint): Commitment["direction"] {
  return value === 0n ? "OFFER" : value === 1n ? "REQUEST" : "UNKNOWN";
}

export function commitmentKind(value: bigint): Commitment["commitmentType"] {
  const values = [
    "DOMAIN_IMPACT",
    "SUPPORT_SERVICE",
    "SEASON_CAMPAIGN",
    "STEWARD_CAPTURED",
  ] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function commitmentClaimType(value: bigint): Commitment["claimType"] {
  return value === 0n ? "GARDEN" : value === 1n ? "INDIVIDUAL" : "UNKNOWN";
}

export function commitmentClaimMode(value: bigint): Commitment["claimMode"] {
  return value === 0n ? "OPEN" : value === 1n ? "APPROVAL_GATED" : "UNKNOWN";
}

export function contributorPolicy(value: bigint): Commitment["contributorPolicy"] {
  return value === 0n ? "OPEN" : value === 1n ? "LEAD_MANAGED" : "UNKNOWN";
}

export function considerationRail(value: bigint): Commitment["considerationRail"] {
  const values = ["NONE", "ARBITRUM_EXTERNAL", "CELO_SETTLEMENT"] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function confirmationPath(value: bigint): Commitment["confirmationPath"] {
  const values = ["ORDINARY", "POOL_FALLBACK", "PROTOCOL_FALLBACK"] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function commitmentState(value: bigint): Commitment["state"] {
  const values = [
    "UNKNOWN",
    "OFFERED",
    "REQUESTED",
    "ACCEPTED",
    "READY_FOR_CONFIRMATION",
    "FULFILLED",
    "CANCELLED",
    "EXPIRED",
    "DISPUTED",
  ] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function createPool(chainId: number, poolId: bigint, timestamp: number): CommitmentPool {
  return {
    id: poolingEntityId(chainId, poolId),
    chainId,
    poolId,
    registrationSeen: false,
    garden: undefined,
    gardenId: undefined,
    poolType: undefined,
    state: undefined,
    charterCID: undefined,
    pauseReasonCID: undefined,
    openSeasonCycleId: undefined,
    openSeasonCycleEntityId: undefined,
    openCampaignIds: [],
    openCampaignEntityIds: [],
    providerOpenCommitmentCap: 0n,
    liveCommitmentCount: 0n,
    nonTerminalCycleCount: 0n,
    lifecycleBlockNumber: undefined,
    lifecycleLogIndex: undefined,
    charterUpdateBlockNumber: undefined,
    charterUpdateLogIndex: undefined,
    providerCapUpdateBlockNumber: undefined,
    providerCapUpdateLogIndex: undefined,
    commitmentsOffered: 0n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 0n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    workLinkedCount: 0n,
    workApprovedCount: 0n,
    openCommitmentCount: 0n,
    commitmentsDue: 0n,
    createdAt: undefined,
    updatedAt: timestamp,
  };
}

export function createCycle(
  chainId: number,
  cycleId: bigint,
  poolId: bigint,
  timestamp: number
): CommitmentCycle {
  return {
    id: poolingEntityId(chainId, cycleId),
    chainId,
    cycleId,
    seedSeen: false,
    poolId,
    poolEntityId: poolingEntityId(chainId, poolId),
    garden: undefined,
    gardenId: undefined,
    cycleType: undefined,
    state: undefined,
    startTime: undefined,
    endTime: undefined,
    metadataCID: undefined,
    gardenersBps: 0,
    treasuryBps: 0,
    operatorBps: 0,
    evaluatorBps: 0,
    communityBps: 0,
    funderBps: 0,
    equalParticipationBps: 0,
    verifiedContributionBps: 0,
    liveCommitmentCount: 0n,
    lifecycleBlockNumber: undefined,
    lifecycleLogIndex: undefined,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 0n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 0n,
    createdAt: undefined,
    updatedAt: timestamp,
  };
}

export function createSeries(
  chainId: number,
  seriesId: bigint,
  timestamp: number
): CommitmentSeries {
  return {
    id: poolingEntityId(chainId, seriesId),
    chainId,
    seriesId,
    creationSeen: false,
    poolId: undefined,
    poolEntityId: undefined,
    createdBy: undefined,
    currentHolder: undefined,
    state: undefined,
    metadataCID: undefined,
    instanceCount: 0n,
    offeredCount: 0n,
    acceptedCount: 0n,
    readyCount: 0n,
    fulfilledCount: 0n,
    cancelledCount: 0n,
    expiredCount: 0n,
    disputedCount: 0n,
    fulfilledCycleIds: [],
    latestLifecycleBlock: undefined,
    latestLifecycleLogIndex: undefined,
    latestMetadataBlock: undefined,
    latestMetadataLogIndex: undefined,
    createdAt: undefined,
    updatedAt: timestamp,
  };
}

export function createCommitment(
  chainId: number,
  commitmentId: bigint,
  timestamp: number
): Commitment {
  return {
    id: poolingEntityId(chainId, commitmentId),
    chainId,
    commitmentId,
    creationSeen: false,
    acceptanceSeen: false,
    creationRequestKey: undefined,
    creationPayloadHash: undefined,
    poolId: undefined,
    poolEntityId: undefined,
    cycleId: undefined,
    cycleEntityId: undefined,
    commitmentSeriesId: undefined,
    commitmentSeriesEntityId: undefined,
    garden: undefined,
    gardenId: undefined,
    creator: undefined,
    recordedBy: undefined,
    counterparty: undefined,
    leadProvider: undefined,
    providerGarden: undefined,
    providerGardenId: undefined,
    payerGarden: undefined,
    payerGardenId: undefined,
    counterpartyKind: undefined,
    direction: undefined,
    commitmentType: undefined,
    state: undefined,
    claimType: undefined,
    claimMode: undefined,
    contributorPolicy: undefined,
    domains: [],
    requirementCount: 0,
    contributorCount: 0,
    contributorsFrozen: false,
    frozenContributorCount: undefined,
    memberHistoryOutcome: undefined,
    fulfilledParticipantHistoryApplied: false,
    contributorEntityIds: [],
    unitLabel: undefined,
    targetUnits: undefined,
    approvedUnits: 0n,
    confirmationThreshold: 0,
    confirmationCount: 0,
    confirmers: [],
    protocolFallbackEnabled: false,
    confirmerRuleUpdateBlockNumber: undefined,
    confirmerRuleUpdateLogIndex: undefined,
    requiresAssessment: undefined,
    assessmentUID: undefined,
    needUID: undefined,
    counterCommitmentId: undefined,
    counterCommitmentEntityId: undefined,
    declaredUnitValue: undefined,
    declaredValueBasis: undefined,
    declaredValueUpdateBlockNumber: undefined,
    declaredValueUpdateLogIndex: undefined,
    metadataCID: undefined,
    workUIDs: [],
    evidenceCIDs: [],
    evidenceCount: 0,
    dueDate: undefined,
    considerationRail: undefined,
    considerationSource: undefined,
    considerationRecipient: undefined,
    considerationToken: undefined,
    considerationAmount: undefined,
    considerationPaid: false,
    considerationPayoutRef: undefined,
    considerationRecordedBy: undefined,
    considerationUpdateBlockNumber: undefined,
    considerationUpdateLogIndex: undefined,
    readyOverridden: false,
    fulfilledBy: undefined,
    confirmationPath: undefined,
    fallbackReason: undefined,
    fulfilledByFallback: false,
    preDisputeState: undefined,
    acceptanceBlockNumber: undefined,
    acceptanceLogIndex: undefined,
    lifecycleBlockNumber: undefined,
    lifecycleLogIndex: undefined,
    disputeReasonCID: undefined,
    cancelReasonCID: undefined,
    createdAt: undefined,
    updatedAt: timestamp,
  };
}

export function createContributor(
  chainId: number,
  commitmentId: bigint,
  contributor: string,
  timestamp: number
): CommitmentContributor {
  const normalized = normalizeAddress(contributor);
  return {
    id: commitmentMemberId(chainId, commitmentId, normalized),
    chainId,
    commitmentId,
    commitmentEntityId: poolingEntityId(chainId, commitmentId),
    contributor: normalized,
    additionSeen: false,
    active: false,
    isLead: false,
    approvedWorkCredits: 0,
    evidenceCredits: 0,
    uncountedLinkedWorkCount: 0,
    requirementIndexes: [],
    recognitionWeightBps: undefined,
    membershipBlockNumber: undefined,
    membershipLogIndex: undefined,
    addedBy: undefined,
    addedAt: undefined,
    removedBy: undefined,
    removedAt: undefined,
    updatedAt: timestamp,
  };
}

export function createWorkAttribution(
  chainId: number,
  commitmentId: bigint,
  workUID: string,
  timestamp: number
): CommitmentWorkAttribution {
  return {
    id: workAttributionId(chainId, workUID),
    chainId,
    workUID: workUID.toLowerCase(),
    commitmentId,
    commitmentEntityId: poolingEntityId(chainId, commitmentId),
    linkSeen: false,
    contributor: undefined,
    contributorEntityId: undefined,
    requirementIndex: undefined,
    operationKey: undefined,
    linked: false,
    creditActive: false,
    linkLifecycleBlockNumber: undefined,
    linkLifecycleLogIndex: undefined,
    latestDecisionSequence: undefined,
    latestDecisionUID: undefined,
    linkedBy: undefined,
    linkedAt: undefined,
    unlinkedBy: undefined,
    unlinkedAt: undefined,
    updatedAt: timestamp,
  };
}
