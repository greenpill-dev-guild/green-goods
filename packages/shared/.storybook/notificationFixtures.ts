import type { QueryKey } from "@tanstack/react-query";
import type { GardenNotification } from "../src/hooks/garden/useGardenNotifications";
import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
} from "../src/modules/commitment-pooling/types-core";
import type { Address, Work } from "../src/types/domain";
import { FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_WASTE } from "./fixtures";
import { STORY_ACCOUNT, TAS_HUB } from "./homeFixtures";

/**
 * The bell's story fixtures (PWA Home step 15, DL-130): one event of each kind for the deployer
 * mock in TAS HUB, newest first, as `useGardenNotifications` lists them. Ages are relative to
 * now, so the rows read "2 hr. ago" whenever the story renders.
 */

export const KOFI = "0xb0b0000000000000000000000000000000000002" as Address;
export const AMA = "0x3333333333333333333333333333333333333333" as Address;

/** The names the rows show for the other people, as the Green Goods name read gives them. */
export const NOTIFICATION_NAMES: Record<string, string> = {
  [KOFI.toLowerCase()]: "kofi.greengoods.eth",
  [AMA.toLowerCase()]: "ama.greengoods.eth",
};

const HOUR = 3_600;
const SEEDLINGS_CID = "bafy-seedlings-for-the-school";
const WORKDAY_CID = "bafy-weekend-workday";

/** The promises' words, keyed as `commitmentPoolingKeys.metadata` keys them, for a seeded cache. */
export const NOTIFICATION_METADATA_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  [
    ["greengoods", "commitment-pooling", "metadata", SEEDLINGS_CID],
    { version: 1, title: "Seedlings for the school" },
  ],
  [
    ["greengoods", "commitment-pooling", "metadata", WORKDAY_CID],
    { version: 1, title: "Weekend workday" },
  ],
];

/** What each promise is called once its metadata resolves, for rows drawn outside the sheet. */
export const NOTIFICATION_PROMISE_TITLES: Record<string, string> = {
  [SEEDLINGS_CID]: "Seedlings for the school",
  [WORKDAY_CID]: "Weekend workday",
};

function work(overrides: Partial<Work> & Pick<Work, "id" | "title">): Work {
  return {
    actionUID: 1,
    gardenerAddress: STORY_ACCOUNT,
    gardenAddress: TAS_HUB.id,
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: 0,
    status: "pending",
    ...overrides,
  };
}

/** The fields the bell's rows read of a promise, over a record the rest of the app ignores. */
function promise(
  overrides: Partial<CommitmentReadModel> & Pick<CommitmentReadModel, "commitmentId">
): CommitmentReadModel {
  return {
    id: `42161-${overrides.commitmentId.toString()}`,
    chainId: 42161,
    creationSeen: true,
    onchainState: "ACCEPTED",
    state: "ACCEPTED",
    derivedState: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 6n,
    unitLabel: "hours",
    poolId: 101n,
    direction: "OFFER",
    creator: STORY_ACCOUNT,
    leadProvider: STORY_ACCOUNT,
    counterparty: KOFI,
    metadataCID: SEEDLINGS_CID,
    ...overrides,
  } as unknown as CommitmentReadModel;
}

function claim(
  overrides: Partial<CommitmentClaimRequestRecord> &
    Pick<CommitmentClaimRequestRecord, "commitmentId" | "claimant" | "requestedAt">
): CommitmentClaimRequestRecord {
  return {
    id: `42161-${overrides.commitmentId.toString()}-${overrides.claimant}`,
    chainId: 42161,
    requestSeen: true,
    requestedBy: overrides.claimant,
    claimType: "INDIVIDUAL",
    gardenContext: null,
    state: "PENDING",
    reasonCID: null,
    resolutionCode: null,
    resolvedAt: null,
    updatedAt: overrides.requestedAt,
    ...overrides,
  } as CommitmentClaimRequestRecord;
}

/** One event of each kind, newest first, for a steward of TAS HUB. */
export function notificationEvents(now = Math.floor(Date.now() / 1000)): GardenNotification[] {
  return [
    {
      kind: "takeUpRequested",
      id: `takeUp:21:${now - HOUR}`,
      at: now - HOUR,
      commitment: promise({
        commitmentId: 21n,
        direction: "REQUEST",
        creator: KOFI,
        leadProvider: null,
        counterparty: null,
        onchainState: "REQUESTED",
        state: "REQUESTED",
        targetUnits: 4n,
        metadataCID: WORKDAY_CID,
      }),
      claim: claim({ commitmentId: 21n, claimant: AMA, requestedAt: now - HOUR }),
    },
    {
      kind: "workSubmitted",
      id: "submission:0xw2",
      at: now - 2 * HOUR,
      work: work({
        id: "0xw2",
        title: "Hedge Planting",
        gardenerAddress: KOFI,
        createdAt: now - 2 * HOUR,
        media: [FIXTURE_IMAGE_AGROFORESTRY],
      }),
    },
    {
      kind: "promiseTakenUp",
      id: `takenUp:11:${now - 3 * HOUR}`,
      at: now - 3 * HOUR,
      commitment: promise({ commitmentId: 11n, acceptanceAt: now - 3 * HOUR }),
    },
    {
      kind: "workRejected",
      id: `review:0xw4:${now - 5 * HOUR}`,
      at: now - 5 * HOUR,
      work: work({
        id: "0xw4",
        title: "Compost Turn",
        status: "rejected",
        createdAt: now - 20 * HOUR,
        reviewedAt: now - 5 * HOUR,
        reviewFeedback: "The photo misses the new bed.",
        media: [FIXTURE_IMAGE_WASTE],
      }),
    },
    {
      kind: "workApproved",
      id: `review:0xw1:${now - 26 * HOUR}`,
      at: now - 26 * HOUR,
      work: work({
        id: "0xw1",
        title: "Seed Swap",
        status: "approved",
        createdAt: now - 30 * HOUR,
        reviewedAt: now - 26 * HOUR,
      }),
    },
  ];
}
