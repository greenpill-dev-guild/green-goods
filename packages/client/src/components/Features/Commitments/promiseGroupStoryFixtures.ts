/**
 * Fictional promise groups for the group row, page and sheet stories: one set
 * of ten requests a garden's steward made, spread across available, in
 * progress and kept, with the reader holding one when a story asks.
 */

import {
  type CommitmentMetadataV1,
  type CommitmentReadModel,
  commitmentNeedsSeat,
  type InboxCommitment,
} from "@green-goods/shared/commitment-pooling";
import {
  type DisplayGroupEntry,
  groupCommitmentsForDisplay,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { Address } from "@green-goods/shared/types/domain";

const STORY_VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const STEWARD = "0x2222222222222222222222222222222222222222" as Address;
const NEIGHBOUR = "0x3333333333333333333333333333333333333333" as Address;

export const STORY_GROUP_TITLE = "Survey household water use on Mill Lane";
const CID = "bafy-story-water-survey";
/** Due Fri, Oct 30, 2026, 5:00 PM UTC. */
const DUE = 1_793_379_600n;

const METADATA = new Map<string, CommitmentMetadataV1>([
  [
    CID,
    {
      version: 1,
      title: STORY_GROUP_TITLE,
      note: "Visit one household, ask the six survey questions, and photograph the meter.",
      displayGroup: { version: 1, id: "story-water-survey" },
    },
  ],
]);

export const STORY_GROUP_NOTE = METADATA.get(CID)?.note ?? null;

type CopyState = "available" | "inProgress" | "kept";

const STATES: Record<
  CopyState,
  Pick<CommitmentReadModel, "onchainState" | "derivedState" | "state">
> = {
  available: { onchainState: "REQUESTED", derivedState: "REQUESTED", state: "REQUESTED" },
  inProgress: { onchainState: "ACCEPTED", derivedState: "ACTIVE", state: "ACCEPTED" },
  kept: { onchainState: "FULFILLED", derivedState: "FULFILLED", state: "FULFILLED" },
};

function copy(
  id: number,
  state: CopyState,
  taker: Address | null,
  overrides: Partial<CommitmentReadModel>
): CommitmentReadModel {
  return {
    id: `42161-${id}`,
    chainId: 42161,
    commitmentId: BigInt(id),
    creationSeen: true,
    ...STATES[state],
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    poolId: 7n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 2n,
    unitLabel: "hours",
    creator: STEWARD,
    leadProvider: taker,
    counterparty: null,
    direction: "REQUEST",
    claimMode: "OPEN",
    confirmers: [],
    contributorCount: taker ? 1 : 0,
    contributorsFrozen: false,
    dueDate: DUE,
    metadataCID: CID,
    ...overrides,
  };
}

export interface StoryGroup {
  group: DisplayGroupEntry<CommitmentReadModel>;
  sample: CommitmentReadModel;
  /** The reader's own copies, as the page lists them. */
  yours: InboxCommitment[];
}

/**
 * The set, with how many copies stand in each state. `yours` hands the reader
 * one of the in-progress or kept copies.
 */
export function storyGroup(input: {
  available: number;
  inProgress?: number;
  kept?: number;
  yours?: "inProgress" | "kept";
  overrides?: Partial<CommitmentReadModel>;
}): StoryGroup {
  const { available, inProgress = 0, kept = 0, yours, overrides = {} } = input;
  const plan: CopyState[] = [
    ...Array<CopyState>(available).fill("available"),
    ...Array<CopyState>(inProgress).fill("inProgress"),
    ...Array<CopyState>(kept).fill("kept"),
  ];
  let yoursGiven = false;
  const copies = plan.map((state, index) => {
    const mine = !yoursGiven && state === yours;
    if (mine) yoursGiven = true;
    const taker = state === "available" ? null : mine ? STORY_VIEWER : NEIGHBOUR;
    return copy(101 + index, state, taker, overrides);
  });
  const [entry] = groupCommitmentsForDisplay({ commitments: copies, metadataByCID: METADATA });
  if (!entry || entry.kind !== "group") throw new Error("the story set must fold into a group");
  const mine = copies.filter((record) => record.leadProvider === STORY_VIEWER);
  return {
    group: entry,
    sample: copies[0] as CommitmentReadModel,
    yours: mine.map((commitment) => ({
      commitment,
      seat: "provider",
      needsYou: commitmentNeedsSeat({ commitment, seat: "provider" }),
    })),
  };
}
