/**
 * Commitment records, their titles, the claim requests raised against them,
 * and the confirmation queue they feed — the plain read-model shapes the
 * pool console and Hub stories render.
 */

import {
  type CommitmentReadModel,
  type CommitmentsToConfirm,
  DEFAULT_CHAIN_ID,
  type PoolClaimRequestRow,
} from "@green-goods/shared";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import { daysAgo, daysFromNow } from "../../../../../shared/.storybook/fixtures";
import { STORY_ANA, STORY_GARDEN, STORY_JOAO, STORY_MARIA } from "./poolStoryActors";

export function storyCommitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: `${DEFAULT_CHAIN_ID}-1`,
    chainId: DEFAULT_CHAIN_ID,
    commitmentId: 1n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: 12n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 6n,
    unitLabel: "hours",
    direction: "OFFER",
    commitmentType: "SUPPORT_SERVICE",
    creator: STORY_MARIA,
    leadProvider: STORY_MARIA,
    counterparty: STORY_JOAO,
    counterpartyKind: "INDIVIDUAL",
    confirmers: [],
    confirmationThreshold: 1,
    confirmationCount: 0,
    protocolFallbackEnabled: true,
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: BigInt(daysFromNow(10)),
    metadataCID: "bafy-1",
    considerationRail: "NONE",
    requiresAssessment: false,
    assessmentUID: null,
    readyOverridden: false,
    preDisputeState: null,
    ...overrides,
  };
}

export const STORY_COMMITMENTS: CommitmentReadModel[] = [
  storyCommitment(),
  storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-2`,
    commitmentId: 2n,
    onchainState: "ACCEPTED",
    derivedState: "EVIDENCE_SUBMITTED",
    evidenceCount: 2,
    targetUnits: 1n,
    unitLabel: "repair session",
    metadataCID: "bafy-2",
  }),
  storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-3`,
    commitmentId: 3n,
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    state: "REQUESTED",
    direction: "REQUEST",
    counterparty: null,
    leadProvider: null,
    creator: STORY_JOAO,
    targetUnits: 1n,
    unitLabel: "ride",
    metadataCID: "bafy-3",
    claimMode: "APPROVAL_GATED",
  }),
  storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-4`,
    commitmentId: 4n,
    onchainState: "FULFILLED",
    derivedState: "FULFILLED",
    state: "FULFILLED",
    confirmationCount: 1,
    fulfilledBy: STORY_JOAO,
    confirmationPath: "ORDINARY",
    metadataCID: "bafy-4",
  }),
  storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-5`,
    commitmentId: 5n,
    cycleId: 13n,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    creator: STORY_JOAO,
    leadProvider: STORY_JOAO,
    counterparty: STORY_ANA,
    targetUnits: 16n,
    unitLabel: "rides",
    dueDate: BigInt(daysAgo(3)),
    metadataCID: "bafy-5",
  }),
  storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-6`,
    commitmentId: 6n,
    onchainState: "EXPIRED",
    derivedState: "EXPIRED",
    state: "EXPIRED",
    metadataCID: "bafy-6",
  }),
];

export const STORY_TITLES = new Map([
  ["bafy-1", { version: 1, title: "Prune the north beds" }],
  ["bafy-2", { version: 1, title: "Repair tool handles" }],
  ["bafy-3", { version: 1, title: "Ride to the market on Saturday" }],
  ["bafy-4", { version: 1, title: "Repair the greenhouse" }],
  ["bafy-5", { version: 1, title: "Market rides" }],
  ["bafy-6", { version: 1, title: "Seedling trays" }],
]);

export const STORY_CLAIMS: PoolClaimRequestRow[] = [
  {
    claim: {
      id: `${DEFAULT_CHAIN_ID}-3-${STORY_MARIA}`,
      chainId: DEFAULT_CHAIN_ID,
      commitmentId: 3n,
      claimant: STORY_MARIA,
      requestSeen: true,
      requestedBy: STORY_MARIA,
      claimType: "INDIVIDUAL",
      gardenContext: null,
      state: "PENDING",
      reasonCID: null,
      resolutionCode: null,
      requestedAt: daysAgo(2),
      resolvedAt: null,
      updatedAt: daysAgo(2),
    },
    commitment: STORY_COMMITMENTS[2]!,
  },
  {
    claim: {
      id: `${DEFAULT_CHAIN_ID}-3-${STORY_ANA}`,
      chainId: DEFAULT_CHAIN_ID,
      commitmentId: 3n,
      claimant: STORY_ANA,
      requestSeen: true,
      requestedBy: STORY_ANA,
      claimType: "INDIVIDUAL",
      gardenContext: null,
      state: "PENDING",
      reasonCID: null,
      resolutionCode: null,
      requestedAt: daysAgo(1),
      resolvedAt: null,
      updatedAt: daysAgo(1),
    },
    commitment: STORY_COMMITMENTS[2]!,
  },
];

export const STORY_TO_CONFIRM: CommitmentsToConfirm = {
  groups: [
    {
      garden: STORY_GARDEN,
      gardenName: STORYBOOK_PRIMARY_ADMIN_GARDEN.name,
      rows: [
        {
          commitment: storyCommitment({
            id: `${DEFAULT_CHAIN_ID}-8`,
            commitmentId: 8n,
            onchainState: "READY_FOR_CONFIRMATION",
            derivedState: "READY_FOR_CONFIRMATION",
            state: "READY_FOR_CONFIRMATION",
            counterparty: STORY_GARDEN,
            counterpartyKind: "GARDEN",
            confirmationThreshold: 2,
            confirmationCount: 1,
            contributorsFrozen: true,
            evidenceCount: 2,
            metadataCID: "bafy-8",
          }),
          seat: "confirmer",
          needsYou: true,
        },
      ],
    },
  ],
  fallback: [
    {
      commitment: storyCommitment({
        id: `${DEFAULT_CHAIN_ID}-9`,
        commitmentId: 9n,
        onchainState: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        contributorsFrozen: true,
        evidenceCount: 1,
        metadataCID: "bafy-9",
      }),
      path: "POOL_FALLBACK",
      garden: STORY_GARDEN,
      gardenName: STORYBOOK_PRIMARY_ADMIN_GARDEN.name,
      activeContributors: [STORY_MARIA, STORY_JOAO],
    },
  ],
  count: 2,
  isSteward: true,
  isProtocolSteward: false,
  availability: { status: "available", capability: {} as never },
  isLoading: false,
  isError: false,
  refetch: async () => [] as never,
};
