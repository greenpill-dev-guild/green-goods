/**
 * Pool and cycle records for the pool console stories, shaped exactly as the
 * shared read models return them on the frozen Storybook clock.
 */

import { DEFAULT_CHAIN_ID } from "@green-goods/shared";
import {
  type CommitmentCycleRecord,
  type CommitmentPoolRecord,
} from "@green-goods/shared/commitment-pooling";
import { daysAgo, daysFromNow } from "../../../../../shared/.storybook/fixtures";
import { STORY_GARDEN } from "./poolStoryActors";

export function storyPool(overrides: Partial<CommitmentPoolRecord> = {}): CommitmentPoolRecord {
  return {
    id: `${DEFAULT_CHAIN_ID}-7`,
    chainId: DEFAULT_CHAIN_ID,
    poolId: 7n,
    registrationSeen: true,
    garden: STORY_GARDEN,
    gardenId: STORY_GARDEN,
    poolType: "GARDEN",
    state: "OPEN",
    charterCID: "bafy-charter",
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: 12n,
    openSeasonCycleEntityId: `${DEFAULT_CHAIN_ID}-12`,
    openCampaignIds: [13n],
    openCampaignEntityIds: [`${DEFAULT_CHAIN_ID}-13`],
    providerOpenCommitmentCap: 24n,
    liveCommitmentCount: 3n,
    nonTerminalCycleCount: 2n,
    commitmentsOffered: 1n,
    commitmentsRequested: 1n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 4n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 1n,
    commitmentsDisputed: 0n,
    workLinkedCount: 2n,
    workApprovedCount: 1n,
    openCommitmentCount: 3n,
    distinctProviderCount: 3n,
    commitmentsDue: 0n,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

export function storyCycle(overrides: Partial<CommitmentCycleRecord> = {}): CommitmentCycleRecord {
  return {
    id: `${DEFAULT_CHAIN_ID}-12`,
    chainId: DEFAULT_CHAIN_ID,
    cycleId: 12n,
    seedSeen: true,
    poolId: 7n,
    poolEntityId: `${DEFAULT_CHAIN_ID}-7`,
    garden: STORY_GARDEN,
    gardenId: STORY_GARDEN,
    cycleType: "SEASON",
    state: "OPEN",
    startTime: BigInt(daysAgo(20)),
    endTime: BigInt(daysFromNow(25)),
    metadataCID: "bafy-season",
    gardenersBps: 6000,
    treasuryBps: 1500,
    operatorBps: 1000,
    evaluatorBps: 500,
    communityBps: 500,
    funderBps: 500,
    equalParticipationBps: 2000,
    verifiedContributionBps: 8000,
    liveCommitmentCount: 3n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 3n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 3n,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

export const STORY_CYCLES: CommitmentCycleRecord[] = [
  storyCycle(),
  storyCycle({
    id: `${DEFAULT_CHAIN_ID}-13`,
    cycleId: 13n,
    cycleType: "CAMPAIGN",
    metadataCID: "bafy-campaign",
    liveCommitmentCount: 1n,
    commitmentsFulfilled: 1n,
  }),
  storyCycle({
    id: `${DEFAULT_CHAIN_ID}-11`,
    cycleId: 11n,
    state: "COMPOSTED",
    metadataCID: "bafy-last-season",
    startTime: BigInt(daysAgo(80)),
    endTime: BigInt(daysAgo(50)),
    liveCommitmentCount: 0n,
  }),
];

export const STORY_CYCLE_NAMES = new Map([
  ["12", { status: "resolved" as const, name: "Season of First Rains" }],
  ["13", { status: "resolved" as const, name: "Market rides" }],
  ["11", { status: "resolved" as const, name: "Season of Long Days" }],
]);

export function storyNotReadyPool(): CommitmentPoolRecord {
  return storyPool({
    state: "NOT_READY",
    charterCID: null,
    providerOpenCommitmentCap: 0n,
    openSeasonCycleId: null,
    openSeasonCycleEntityId: null,
    openCampaignIds: [],
    openCampaignEntityIds: [],
    liveCommitmentCount: 0n,
    nonTerminalCycleCount: 0n,
    commitmentsOffered: 0n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 0n,
    commitmentsFulfilled: 0n,
    commitmentsExpired: 0n,
    openCommitmentCount: 0n,
  });
}
