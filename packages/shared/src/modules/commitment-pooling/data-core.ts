import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import { deriveCommitmentState } from "./selectors";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
  CommitmentSeriesRecord,
  CommitmentUnitSummaryRecord,
} from "./types";

export type RawRow = Record<string, unknown>;

export const POOL_FIELDS = /* GraphQL */ `
  id chainId poolId registrationSeen garden gardenId poolType state charterCID
  openSeasonCycleId openSeasonCycleEntityId openCampaignIds openCampaignEntityIds
  providerOpenCommitmentCap liveCommitmentCount nonTerminalCycleCount
  commitmentsOffered commitmentsRequested commitmentsAccepted commitmentsReadyForConfirmation
  commitmentsFulfilled commitmentsCancelled commitmentsExpired commitmentsDisputed
  workLinkedCount workApprovedCount openCommitmentCount commitmentsDue createdAt updatedAt
`;

export const CYCLE_FIELDS = /* GraphQL */ `
  id chainId cycleId seedSeen poolId poolEntityId garden gardenId cycleType state
  startTime endTime metadataCID gardenersBps treasuryBps operatorBps evaluatorBps communityBps
  funderBps equalParticipationBps verifiedContributionBps liveCommitmentCount
  commitmentsAccepted commitmentsReadyForConfirmation commitmentsFulfilled commitmentsCancelled
  commitmentsExpired commitmentsDisputed commitmentsDue openCommitmentCount createdAt updatedAt
`;

export const COMMITMENT_FIELDS = /* GraphQL */ `
  id chainId commitmentId creationSeen poolId cycleId commitmentSeriesId creator recordedBy
  counterparty leadProvider providerGarden payerGarden counterpartyKind direction commitmentType
  state claimType claimMode contributorPolicy domains requirementCount contributorCount
  contributorsFrozen frozenContributorCount unitLabel targetUnits approvedUnits confirmationThreshold
  confirmationCount confirmers protocolFallbackEnabled requiresAssessment assessmentUID needUID
  counterCommitmentId counterCommitmentEntityId declaredUnitValue declaredValueBasis payoutPlanId
  metadataCID workUIDs evidenceCIDs evidenceCount dueDate considerationRail considerationSource
  considerationRecipient considerationToken considerationAmount considerationPaid
  considerationPayoutRef considerationRecordedBy readyOverridden fulfilledBy confirmationPath
  fallbackReason fulfilledByFallback preDisputeState acceptanceAt cancelledAt expiredAt
  disputeReasonCID cancelReasonCID createdAt updatedAt
`;

export const SERIES_FIELDS = /* GraphQL */ `
  id chainId seriesId creationSeen poolId poolEntityId createdBy currentHolder state metadataCID
  instanceCount offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount
  disputedCount fulfilledCycleIds createdAt updatedAt
`;

export const UNIT_SUMMARY_FIELDS = /* GraphQL */ `
  id chainId scope scopeId poolId cycleId unitLabel unitLabelHash expectedUnits approvedUnits
  fulfilledUnits openUnits updatedAt
`;

export const CLAIM_FIELDS = /* GraphQL */ `
  id chainId commitmentId claimant requestSeen requestedBy claimType gardenContext state reasonCID
  resolutionCode requestedAt resolvedAt updatedAt
`;

export const EVENT_FIELDS = /* GraphQL */ `
  id chainId poolId cycleId commitmentId eventType actor configurationKey previousValue newValue
  units data txHash timestamp
`;

export function integer(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return 0n;
}

export function optionalInteger(value: unknown): bigint | null {
  return value === null || value === undefined || value === "" ? null : integer(value);
}

export function number(value: unknown): number {
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
}

export function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value);
}

export function address(value: unknown): Address | null {
  return typeof value === "string" && value !== "" ? (value.toLowerCase() as Address) : null;
}

export function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function hexString(value: unknown): `0x${string}` | null {
  const candidate = string(value);
  return candidate ? (candidate.toLowerCase() as `0x${string}`) : null;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function integers(value: unknown): bigint[] {
  return Array.isArray(value) ? value.map(integer) : [];
}

export async function queryRows(
  query: string,
  variables: Record<string, unknown>,
  field: string,
  operationName: string
): Promise<RawRow[]> {
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    variables,
    operationName
  );
  if (result.error) throw result.error;
  return result.data?.[field] ?? [];
}

export function mapPool(row: RawRow): CommitmentPoolRecord {
  if (row.registrationSeen !== true) throw new Error("unseen commitment pool placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    poolId: integer(row.poolId),
    registrationSeen: true,
    garden: address(row.garden),
    gardenId: string(row.gardenId),
    poolType: row.poolType as CommitmentPoolRecord["poolType"],
    state: row.state as CommitmentPoolRecord["state"],
    charterCID: string(row.charterCID),
    openSeasonCycleId: optionalInteger(row.openSeasonCycleId),
    openSeasonCycleEntityId: string(row.openSeasonCycleEntityId),
    openCampaignIds: integers(row.openCampaignIds),
    openCampaignEntityIds: strings(row.openCampaignEntityIds),
    providerOpenCommitmentCap: integer(row.providerOpenCommitmentCap),
    liveCommitmentCount: integer(row.liveCommitmentCount),
    nonTerminalCycleCount: integer(row.nonTerminalCycleCount),
    commitmentsOffered: integer(row.commitmentsOffered),
    commitmentsRequested: integer(row.commitmentsRequested),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsReadyForConfirmation: integer(row.commitmentsReadyForConfirmation),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    workLinkedCount: integer(row.workLinkedCount),
    workApprovedCount: integer(row.workApprovedCount),
    openCommitmentCount: integer(row.openCommitmentCount),
    commitmentsDue: integer(row.commitmentsDue),
    createdAt: optionalNumber(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapCycle(row: RawRow): CommitmentCycleRecord {
  if (row.seedSeen !== true) throw new Error("unseen commitment cycle placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    cycleId: integer(row.cycleId),
    seedSeen: true,
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    garden: address(row.garden),
    gardenId: string(row.gardenId),
    cycleType: row.cycleType as CommitmentCycleRecord["cycleType"],
    state: row.state as CommitmentCycleRecord["state"],
    startTime: optionalInteger(row.startTime),
    endTime: optionalInteger(row.endTime),
    metadataCID: string(row.metadataCID),
    gardenersBps: number(row.gardenersBps),
    treasuryBps: number(row.treasuryBps),
    operatorBps: number(row.operatorBps),
    evaluatorBps: number(row.evaluatorBps),
    communityBps: number(row.communityBps),
    funderBps: number(row.funderBps),
    equalParticipationBps: number(row.equalParticipationBps),
    verifiedContributionBps: number(row.verifiedContributionBps),
    liveCommitmentCount: integer(row.liveCommitmentCount),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsReadyForConfirmation: integer(row.commitmentsReadyForConfirmation),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    commitmentsDue: integer(row.commitmentsDue),
    openCommitmentCount: integer(row.openCommitmentCount),
    createdAt: optionalNumber(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapCommitment(row: RawRow): CommitmentReadModel {
  const onchainState = String(row.state ?? "UNKNOWN") as CommitmentReadModel["onchainState"];
  const mapped: CommitmentReadModel = {
    ...row,
    id: String(row.id),
    chainId: number(row.chainId),
    commitmentId: integer(row.commitmentId),
    creationSeen: row.creationSeen === true,
    state: onchainState,
    onchainState,
    derivedState: onchainState,
    approvedUnits: integer(row.approvedUnits),
    evidenceCount: number(row.evidenceCount),
    cycleId: optionalInteger(row.cycleId),
    poolId: optionalInteger(row.poolId),
    commitmentSeriesId: optionalInteger(row.commitmentSeriesId),
    creator: address(row.creator),
    leadProvider: address(row.leadProvider),
    unitLabel: string(row.unitLabel),
    targetUnits: integer(row.targetUnits),
    needUID: string(row.needUID),
    counterCommitmentId: optionalInteger(row.counterCommitmentId),
    declaredUnitValue: optionalInteger(row.declaredUnitValue),
    declaredValueBasis: string(row.declaredValueBasis),
    considerationRail: row.considerationRail as CommitmentReadModel["considerationRail"],
    considerationPaid: row.considerationPaid === true,
  };
  return { ...mapped, derivedState: deriveCommitmentState(mapped) };
}

export function mapSeries(row: RawRow): CommitmentSeriesRecord {
  if (row.creationSeen !== true) throw new Error("unseen commitment series placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    seriesId: integer(row.seriesId),
    creationSeen: true,
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    createdBy: address(row.createdBy)!,
    currentHolder: address(row.currentHolder)!,
    state: String(row.state ?? "UNKNOWN") as CommitmentSeriesRecord["state"],
    metadataCID: String(row.metadataCID ?? ""),
    instanceCount: integer(row.instanceCount),
    offeredCount: integer(row.offeredCount),
    acceptedCount: integer(row.acceptedCount),
    readyCount: integer(row.readyCount),
    fulfilledCount: integer(row.fulfilledCount),
    cancelledCount: integer(row.cancelledCount),
    expiredCount: integer(row.expiredCount),
    disputedCount: integer(row.disputedCount),
    fulfilledCycleIds: strings(row.fulfilledCycleIds),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapUnitSummary(row: RawRow): CommitmentUnitSummaryRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    scope: row.scope as "POOL" | "CYCLE",
    scopeId: integer(row.scopeId),
    poolId: integer(row.poolId),
    cycleId: optionalInteger(row.cycleId),
    unitLabel: String(row.unitLabel),
    unitLabelHash: String(row.unitLabelHash).toLowerCase() as `0x${string}`,
    expectedUnits: integer(row.expectedUnits),
    approvedUnits: integer(row.approvedUnits),
    fulfilledUnits: integer(row.fulfilledUnits),
    openUnits: integer(row.openUnits),
    updatedAt: number(row.updatedAt),
  };
}
