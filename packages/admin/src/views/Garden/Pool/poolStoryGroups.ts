/**
 * A group of ten copies made together, for the group row and its inspector:
 * the Household water survey, five days in. Four are available, three in
 * progress (one waiting to be confirmed, one with proof, one just taken), two
 * kept and one ended; Ana took two. Each copy asks $5.00 in G$, recorded in the
 * group's metadata document the way Seed Promises writes it.
 */

import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  buildCommitmentMetadata,
  type CommitmentMetadataV1,
} from "@green-goods/shared/modules/commitment-pooling/metadata";
import type {
  CommitmentEventRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { daysFromNow, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { STORY_ANA, STORY_JOAO, STORY_MARIA, STORY_STEWARD } from "./poolStoryActors";
import { storyCommitment } from "./poolStoryCommitments";

export const STORY_GROUP_ID = "group-00000001";
const GROUP_CID = "bafy-group-survey";
/** $5.00 at the story price. */
const REWARD_WEI = 38_865_763_105_965_141_239_068n;

export const STORY_GROUP_METADATA: CommitmentMetadataV1 = buildCommitmentMetadata({
  title: "Household water survey",
  displayGroup: { version: 1, id: STORY_GROUP_ID },
  reward: { version: 1, usdCents: "500", goodDollarWei: REWARD_WEI.toString() },
});

/** The group's metadata under its CID, to add to a console's titles. */
export const STORY_GROUP_TITLES = new Map([[GROUP_CID, STORY_GROUP_METADATA]]);

function copy(id: number, overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-${id}`,
    commitmentId: BigInt(id),
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    state: "REQUESTED",
    direction: "REQUEST",
    creator: STORY_STEWARD,
    leadProvider: null,
    counterparty: null,
    unitLabel: "survey",
    targetUnits: 1n,
    dueDate: BigInt(daysFromNow(12)),
    metadataCID: GROUP_CID,
    considerationRail: "CELO_SETTLEMENT",
    considerationAmount: REWARD_WEI,
    claimMode: "OPEN",
    ...overrides,
  });
}

const taken = (who: Address, overrides: Partial<CommitmentReadModel> = {}) => ({
  onchainState: "ACCEPTED" as const,
  derivedState: "ACTIVE" as const,
  state: "ACCEPTED" as const,
  leadProvider: who,
  counterparty: who,
  counterpartyKind: "INDIVIDUAL" as const,
  ...overrides,
});

export const STORY_GROUP_COPIES: CommitmentReadModel[] = [
  copy(21),
  copy(22),
  copy(23),
  copy(24),
  copy(25, taken(STORY_MARIA, { onchainState: "READY_FOR_CONFIRMATION", evidenceCount: 1 })),
  copy(26, taken(STORY_JOAO, { derivedState: "EVIDENCE_SUBMITTED", evidenceCount: 2 })),
  copy(27, taken(STORY_ANA)),
  copy(
    28,
    taken(STORY_ANA, {
      onchainState: "FULFILLED",
      state: "FULFILLED",
      derivedState: "FULFILLED",
      evidenceCount: 1,
      considerationPaid: true,
    })
  ),
  copy(
    29,
    taken(STORY_JOAO, {
      onchainState: "FULFILLED",
      state: "FULFILLED",
      derivedState: "FULFILLED",
      evidenceCount: 1,
    })
  ),
  copy(
    30,
    taken(STORY_MARIA, { onchainState: "CANCELLED", state: "CANCELLED", derivedState: "CANCELLED" })
  ),
];

/**
 * The steward made this request group, so they confirm its copies: the one
 * with its proof in waits on them ("Needs you", a8). The pool controller works
 * this out from the seat rules; stories name it.
 */
export const STORY_GROUP_WAITING_ON_YOU: ReadonlySet<string> = new Set(
  STORY_GROUP_COPIES.filter((copy) => copy.onchainState === "READY_FOR_CONFIRMATION").map(
    (copy) => copy.id
  )
);

function event(
  commitmentId: number,
  eventType: string,
  hours: number,
  actor: Address
): CommitmentEventRecord {
  return {
    id: `${commitmentId}-${eventType}-${hours}`,
    chainId: DEFAULT_CHAIN_ID,
    poolId: 7n,
    cycleId: 12n,
    commitmentId: BigInt(commitmentId),
    eventType,
    actor,
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: `0x${"0".repeat(64)}`,
    timestamp: hoursAgo(hours),
  };
}

/** When the set was created, and each copy taken, proven and confirmed, as the pool's activity has it. */
export const STORY_GROUP_EVENTS: CommitmentEventRecord[] = [
  event(21, "CREATED", 122, STORY_STEWARD),
  event(25, "ACCEPTED", 110, STORY_MARIA),
  event(25, "EVIDENCE_ATTACHED", 30, STORY_MARIA),
  event(26, "ACCEPTED", 96, STORY_JOAO),
  event(26, "EVIDENCE_ATTACHED", 20, STORY_JOAO),
  event(27, "ACCEPTED", 40, STORY_ANA),
  event(28, "ACCEPTED", 118, STORY_ANA),
  event(28, "EVIDENCE_ATTACHED", 70, STORY_ANA),
  event(28, "CONFIRMATION_RECORDED", 52, STORY_STEWARD),
  event(29, "ACCEPTED", 100, STORY_JOAO),
  event(29, "EVIDENCE_ATTACHED", 60, STORY_JOAO),
  event(29, "CONFIRMATION_RECORDED", 26, STORY_STEWARD),
  event(30, "ACCEPTED", 104, STORY_MARIA),
];
