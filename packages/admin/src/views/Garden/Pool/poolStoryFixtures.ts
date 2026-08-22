/**
 * Storybook fixtures for the pool console surfaces. Plain records shaped
 * exactly as the shared read models and controllers return them, on the
 * frozen Storybook clock, so every story renders the real component over
 * data the hooks could have produced. Not a component: no story of its own.
 */

import {
  type Address,
  type CommitmentCycleRecord,
  type CommitmentDialogController,
  type CommitmentPoolRecord,
  type CommitmentReadModel,
  type CommitmentsToConfirm,
  DEFAULT_CHAIN_ID,
  type HubConfirmQueueController,
  type PoolClaimRequestRow,
  type PoolConsoleController,
  queryKeys,
  selectPoolConsoleModel,
} from "@green-goods/shared";
import type { QueryKey } from "@tanstack/react-query";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import {
  daysAgo,
  daysFromNow,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";

export const STORY_GARDEN = STORYBOOK_PRIMARY_ADMIN_GARDEN.id as Address;
export const STORY_STEWARD = "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;
export const STORY_MARIA = "0x1111111111111111111111111111111111111111" as Address;
export const STORY_JOAO = "0x2222222222222222222222222222222222222222" as Address;
export const STORY_ANA = "0x3333333333333333333333333333333333333333" as Address;
export const STORY_ROOT_GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
export const STORY_NOW = BigInt(STORYBOOK_NOW_SECONDS);

const noop = async () => "0x0" as never;

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

/** The real controller's shape over the fixtures above; acts resolve without sending. */
export function storyPoolConsole(
  overrides: Partial<PoolConsoleController> & { pool?: CommitmentPoolRecord | null } = {}
): PoolConsoleController {
  const pool = overrides.pool === undefined ? storyPool() : overrides.pool;
  const cycles = overrides.cycles ?? (pool ? STORY_CYCLES : []);
  const commitments = overrides.commitments ?? (pool ? STORY_COMMITMENTS : []);
  const claims = overrides.claims ?? (pool ? STORY_CLAIMS : []);
  const acts: PoolConsoleController["acts"] = {
    pause: noop,
    resume: noop,
    closePool: noop,
    compostPool: noop,
    reopenPool: noop,
    cancelCycle: noop,
    closeCycle: noop,
    compostCycle: noop,
    expire: noop,
    acceptClaim: noop,
    declineClaim: noop,
    saveSettings: async () => undefined,
  };
  return {
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    viewer: STORY_STEWARD,
    isOnline: true,
    availability: { status: "available", capability: {} as never },
    pool,
    poolId: pool?.poolId,
    model: selectPoolConsoleModel({
      pool,
      cycles,
      commitments,
      pendingClaimCount: claims.length,
      now: STORY_NOW,
    }),
    cycles,
    cycleNames: STORY_CYCLE_NAMES,
    commitments,
    titles: STORY_TITLES,
    claims,
    charter: {
      charter: {
        version: 1,
        purpose:
          "Neighbours in Rio offer help and ask for it: rides, tools, workshops, garden work. Commitments are kept in the open and confirmed by the person they were made to.",
      },
      isLoading: false,
      isUnavailable: false,
    },
    pauseReason: { reason: null, isLoading: false, isUnavailable: false },
    pendingCreates: [],
    queueUnavailable: false,
    acts,
    isActing: false,
    isLoading: false,
    isError: false,
    refetch: async () => [] as never,
    ...overrides,
    ...(overrides.model ? { model: overrides.model } : {}),
  };
}

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

export function storyCommitmentDialog(
  overrides: Partial<CommitmentDialogController> & { commitment?: CommitmentReadModel | null } = {}
): CommitmentDialogController {
  const commitment =
    overrides.commitment === undefined
      ? storyCommitment({ ...STORY_COMMITMENTS[1] })
      : overrides.commitment;
  const acts: CommitmentDialogController["acts"] = {
    cancel: noop,
    markReady: noop,
    sendForConfirmation: async () => "job" as never,
    attachAssessment: noop,
    raiseDispute: noop,
    resolveDispute: noop,
    expire: noop,
    confirmOrdinary: async () => "job" as never,
    confirmFallback: noop,
    acceptClaim: noop,
    declineClaim: noop,
  };
  return {
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    viewer: STORY_STEWARD,
    isOnline: true,
    availability: { status: "available", capability: {} as never },
    commitment,
    detail: commitment
      ? {
          commitment,
          requirements: [],
          contributors: [
            {
              id: "c-1",
              chainId: DEFAULT_CHAIN_ID,
              commitmentId: commitment.commitmentId,
              contributor: STORY_MARIA,
              additionSeen: true,
              active: true,
              isLead: true,
              approvedWorkCredits: 0,
              evidenceCredits: 2,
              uncountedLinkedWorkCount: 0,
              requirementIndexes: [],
              recognitionWeightBps: null,
              addedBy: null,
              addedAt: daysAgo(9),
              removedBy: null,
              removedAt: null,
              updatedAt: daysAgo(9),
            },
          ],
          assignments: [],
          workAttributions: [],
          evidenceAttributions: [],
          claimRequests: [],
          counterpartCommitments: [],
        }
      : null,
    title: "Repair tool handles",
    note: "One Saturday session at the tool library.",
    cycle: STORY_CYCLES[0] ?? null,
    events: [
      {
        id: "e-3",
        chainId: DEFAULT_CHAIN_ID,
        poolId: 7n,
        cycleId: 12n,
        commitmentId: 2n,
        eventType: "EVIDENCE_ATTACHED",
        actor: STORY_MARIA,
        configurationKey: null,
        previousValue: null,
        newValue: null,
        units: null,
        data: null,
        txHash: "0x3",
        timestamp: daysAgo(1),
      },
      {
        id: "e-2",
        chainId: DEFAULT_CHAIN_ID,
        poolId: 7n,
        cycleId: 12n,
        commitmentId: 2n,
        eventType: "ACCEPTED",
        actor: STORY_JOAO,
        configurationKey: null,
        previousValue: null,
        newValue: null,
        units: null,
        data: null,
        txHash: "0x2",
        timestamp: daysAgo(9),
      },
      {
        id: "e-1",
        chainId: DEFAULT_CHAIN_ID,
        poolId: 7n,
        cycleId: 12n,
        commitmentId: 2n,
        eventType: "CREATED",
        actor: STORY_MARIA,
        configurationKey: null,
        previousValue: null,
        newValue: null,
        units: null,
        data: null,
        txHash: "0x1",
        timestamp: daysAgo(12),
      },
    ],
    disputeReason: { reason: null, isLoading: false, isUnavailable: false },
    cancelReason: { reason: null, isLoading: false, isUnavailable: false },
    assessments: [],
    assessmentsLoading: false,
    activeContributors: [STORY_MARIA],
    seat: "bystander",
    isLocalSteward: true,
    isProtocolSteward: false,
    onRoster: false,
    poolPaused: false,
    ordinaryReachable: true,
    confirmation: { allowed: false, path: null, reason: "not-eligible" },
    isDue: false,
    hasPendingJob: false,
    can: {
      cancel: true,
      markReady: true,
      sendForConfirmation: true,
      attachAssessment: false,
      raiseDispute: true,
      resolveDispute: false,
      resolveFulfilled: false,
      expire: false,
      confirmOrdinary: false,
      confirmFallback: false,
      acceptClaim: false,
      declineClaim: false,
    },
    acts,
    isActing: false,
    isLoading: false,
    isError: false,
    notFound: false,
    refetch: async () => [] as never,
    ...overrides,
  };
}

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

export function storyConfirmQueue(
  overrides: Partial<HubConfirmQueueController> = {}
): HubConfirmQueueController {
  return {
    rows: [
      {
        commitment: STORY_TO_CONFIRM.groups[0]!.rows[0]!.commitment,
        garden: STORY_GARDEN,
        gardenName: STORYBOOK_PRIMARY_ADMIN_GARDEN.name,
        eligibility: "ORDINARY",
        title: "Survey the wetland edge",
      },
      {
        commitment: STORY_TO_CONFIRM.fallback[0]!.commitment,
        garden: STORY_GARDEN,
        gardenName: STORYBOOK_PRIMARY_ADMIN_GARDEN.name,
        eligibility: "POOL_FALLBACK",
        title: "Prune the north beds",
      },
    ],
    isOnline: true,
    isLoading: false,
    isError: false,
    isConfirming: false,
    isDisputing: false,
    acts: { confirm: async () => "job" as never, notYet: noop },
    ...overrides,
  };
}

/**
 * Seeds for the route stories: the garden's pool, its cycles, commitments
 * and claims under the registry keys the controllers read, so the real
 * route renders over fixtures without an indexer.
 */
export const POOL_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), [storyPool()]],
  [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 7n, {}), STORY_CYCLES],
  [
    queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      poolId: 7n,
    }),
    STORY_COMMITMENTS,
  ],
  [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 7n, "PENDING"), STORY_CLAIMS],
];
