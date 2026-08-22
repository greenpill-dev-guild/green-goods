/**
 * Constants and record builders for the demo world.
 *
 * Addresses are real members of the local "Green Goods Community Garden",
 * so names, roles and the membership preflight resolve against the live
 * stack rather than against more fixtures. Commitment ids start at 1001 so
 * they can never collide with a real record.
 *
 * @module modules/commitment-pooling/demo/demo-builders
 */

import type { Address } from "../../../types/domain";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
} from "../types-core";

export const DEMO_CHAIN_ID = 42161;

/**
 * Green Goods Community Garden on Arbitrum (the local fork); the deployer
 * mock is one of its stewards and gardeners, so roles and membership are real.
 */
export const DEMO_GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
/**
 * TAS HUB hosts the demo's protocol pool. On chain the protocol pool sits on
 * the root garden above, but a garden page shows one pool, so the demo gives
 * the protocol pool a page of its own.
 */
export const DEMO_PROTOCOL_GARDEN = "0xa2df8eb73444a3f3cf9b8e3749313c7471d7d5e3" as Address;
/** Growecosystems, whose pool the demo pauses with a reason. */
export const DEMO_PAUSED_GARDEN = "0xd1f8e787a325f91f5d4be2d30ea1e67b19e28b30" as Address;

export const DEMO_GARDEN_POOL_ID = 101n;
export const DEMO_PROTOCOL_POOL_ID = 1n;
export const DEMO_PAUSED_POOL_ID = 102n;
export const DEMO_SEASON_ID = 7n;
export const DEMO_CAMPAIGN_ID = 8n;

/** Real stewards and gardeners of the demo garden, beside the deployer. */
export const ROSA = "0xfbaf2a9734eae75497e1695706cc45ddfa346ad6" as Address;
export const TUNDE = "0x6166e1964447e0959bc7c8d543db3ab82db65044" as Address;
export const MARIA = "0xacd59e854adf632d2322404198624f757c868c97" as Address;
export const EDU = "0xed47b5f719ea74405eb96ff700c11d1685b953b1" as Address;

/** Real action UIDs on the local fork, so requirement rows read as the action. */
export const ACTION_PLANTING = 6n;
export const ACTION_SURVIVAL = 7n;
export const ACTION_MAINTENANCE = 8n;
export const ACTION_CLEANUP = 17n;

// Noon UTC dates, so the rail reads the same day in every timezone.
export const MAR_1 = 1_772_366_400n;
export const MAY_31 = 1_780_228_800n;
export const APR_12 = 1_775_995_200n;
export const NOW = 1_771_800_000;

export function pool(
  overrides: Partial<CommitmentPoolRecord> &
    Pick<CommitmentPoolRecord, "poolId" | "garden" | "poolType" | "state">
): CommitmentPoolRecord {
  return {
    id: `${DEMO_CHAIN_ID}-${overrides.poolId.toString()}`,
    chainId: DEMO_CHAIN_ID,
    registrationSeen: true,
    gardenId: overrides.garden,
    charterCID: "bafy-demo-charter",
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: null,
    openSeasonCycleEntityId: null,
    openCampaignIds: [],
    openCampaignEntityIds: [],
    providerOpenCommitmentCap: 5n,
    liveCommitmentCount: 0n,
    nonTerminalCycleCount: 0n,
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
    distinctProviderCount: 0n,
    commitmentsDue: 0n,
    createdAt: NOW - 86_400 * 40,
    updatedAt: NOW,
    ...overrides,
  };
}

export function cycle(
  overrides: Partial<CommitmentCycleRecord> & Pick<CommitmentCycleRecord, "cycleId" | "cycleType">
): CommitmentCycleRecord {
  return {
    id: `${DEMO_CHAIN_ID}-${overrides.cycleId.toString()}`,
    chainId: DEMO_CHAIN_ID,
    seedSeen: true,
    poolId: DEMO_GARDEN_POOL_ID,
    poolEntityId: `${DEMO_CHAIN_ID}-${DEMO_GARDEN_POOL_ID.toString()}`,
    garden: DEMO_GARDEN,
    gardenId: DEMO_GARDEN,
    state: "OPEN",
    startTime: MAR_1,
    endTime: MAY_31,
    metadataCID: null,
    gardenersBps: 6000,
    treasuryBps: 1000,
    operatorBps: 1000,
    evaluatorBps: 500,
    communityBps: 1000,
    funderBps: 500,
    equalParticipationBps: 5000,
    verifiedContributionBps: 5000,
    liveCommitmentCount: 0n,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 0n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 0n,
    createdAt: NOW - 86_400 * 30,
    updatedAt: NOW,
    ...overrides,
  };
}

export type CommitmentSeed = Partial<CommitmentReadModel> &
  Pick<CommitmentReadModel, "commitmentId" | "direction" | "commitmentType" | "onchainState">;

export function commitment(seed: CommitmentSeed): CommitmentReadModel {
  const state = seed.onchainState;
  return {
    id: `${DEMO_CHAIN_ID}-${seed.commitmentId.toString()}`,
    chainId: DEMO_CHAIN_ID,
    creationSeen: true,
    state,
    derivedState: state,
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: DEMO_SEASON_ID,
    poolId: DEMO_GARDEN_POOL_ID,
    commitmentSeriesId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    unitLabel: "hours",
    needUID: null,
    counterCommitmentId: null,
    considerationRail: null,
    considerationPaid: false,
    counterparty: null,
    recordedBy: null,
    claimMode: "OPEN",
    contributorPolicy: "LEAD_MANAGED",
    confirmers: [],
    confirmationCount: 0,
    confirmationThreshold: 1,
    protocolFallbackEnabled: true,
    fulfilledBy: null,
    confirmationPath: null,
    fallbackReason: null,
    contributorCount: 1,
    contributorsFrozen: false,
    metadataCID: `bafy-demo-c${seed.commitmentId.toString()}`,
    ...seed,
  };
}

export function requirement(
  commitmentId: bigint,
  requirementIndex: number,
  actionUID: bigint,
  requiredCount: number,
  approvedCount: number
): CommitmentRequirementRecord {
  return {
    id: `${DEMO_CHAIN_ID}-${commitmentId.toString()}-${requirementIndex}`,
    chainId: DEMO_CHAIN_ID,
    commitmentId,
    requirementIndex,
    creationSeen: true,
    domain: null,
    actionUID,
    requiredCount,
    approvedCount,
    createdAt: NOW - 86_400 * 10,
    updatedAt: NOW,
  };
}

export function contributor(
  commitmentId: bigint,
  who: Address,
  overrides: Partial<CommitmentContributorRecord> = {}
): CommitmentContributorRecord {
  return {
    id: `${DEMO_CHAIN_ID}-${commitmentId.toString()}-${who}`,
    chainId: DEMO_CHAIN_ID,
    commitmentId,
    contributor: who,
    additionSeen: true,
    active: true,
    isLead: false,
    approvedWorkCredits: 0,
    evidenceCredits: 0,
    uncountedLinkedWorkCount: 0,
    requirementIndexes: [],
    recognitionWeightBps: null,
    addedBy: null,
    addedAt: NOW - 86_400 * 9,
    removedBy: null,
    removedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

export function claim(
  commitmentId: bigint,
  claimant: Address,
  state: CommitmentClaimRequestRecord["state"],
  overrides: Partial<CommitmentClaimRequestRecord> = {}
): CommitmentClaimRequestRecord {
  return {
    id: `${DEMO_CHAIN_ID}-${commitmentId.toString()}-claim-${claimant}`,
    chainId: DEMO_CHAIN_ID,
    commitmentId,
    claimant,
    requestSeen: true,
    requestedBy: claimant,
    claimType: "INDIVIDUAL",
    gardenContext: DEMO_GARDEN,
    state,
    reasonCID: null,
    resolutionCode: null,
    requestedAt: NOW - 86_400 * 3,
    resolvedAt: state === "PENDING" ? null : NOW - 86_400,
    updatedAt: NOW - 86_400,
    ...overrides,
  };
}

export function metadata(title: string, note?: string, links?: { url: string; label?: string }[]) {
  return { version: 1, title, note, links };
}
