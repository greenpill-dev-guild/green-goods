/**
 * Controller-shaped builders over the pool fixtures: the pool console, the
 * commitment dialog and the Hub confirm queue, each returning the shape the
 * real hook hands its view. Acts resolve without sending anything.
 */

import {
  type CommitmentDialogController,
  DEFAULT_CHAIN_ID,
  type HubConfirmQueueController,
  type OntologyChainCapability,
  type PoolConsoleController,
} from "@green-goods/shared";
import {
  type CommitmentPoolRecord,
  type CommitmentReadModel,
  selectPoolConsoleModel,
  selectPromiseKeptRate,
} from "@green-goods/shared/commitment-pooling";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { STORY_GARDEN, STORY_JOAO, STORY_MARIA, STORY_NOW, STORY_STEWARD } from "./poolStoryActors";
import {
  STORY_CLAIMS,
  STORY_COMMITMENTS,
  STORY_TITLES,
  STORY_TO_CONFIRM,
  storyCommitment,
} from "./poolStoryCommitments";
import { STORY_CYCLE_NAMES, STORY_CYCLES, storyPool } from "./poolStoryPools";

const noop = async (): Promise<`0x${string}`> => "0x0";
const availableCapability: OntologyChainCapability = {
  deployment: "deployed",
  activation: "active",
  integration: "integrated",
  availability: "available",
  evidence: [],
  verified_at: "2026-08-23",
};

/** The real controller's shape over the fixtures above; acts resolve without sending. */
export function storyPoolConsole(
  overrides: Omit<Partial<PoolConsoleController>, "pool"> & {
    pool?: CommitmentPoolRecord | null;
  } = {}
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
    availability: { status: "available", capability: availableCapability },
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
    refetch: async () => [],
    ...overrides,
    ...(overrides.model ? { model: overrides.model } : {}),
    // After the spread on purpose: `pool` already folds in `overrides.pool`,
    // and the real hook hands the console a record with `promiseKeptRate`
    // computed. Letting the spread put the raw record back would give stories a
    // shape `useCommitmentPools` never returns.
    pool: pool ? { ...pool, promiseKeptRate: selectPromiseKeptRate(pool) } : null,
    poolId: pool?.poolId,
  };
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
    sendForConfirmation: async () => "job",
    attachAssessment: noop,
    raiseDispute: noop,
    resolveDispute: noop,
    expire: noop,
    confirmOrdinary: async () => "job",
    confirmFallback: noop,
    acceptClaim: noop,
    declineClaim: noop,
  };
  return {
    chainId: DEFAULT_CHAIN_ID,
    garden: STORY_GARDEN,
    viewer: STORY_STEWARD,
    isOnline: true,
    availability: { status: "available", capability: availableCapability },
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
    unavailable: false,
    notFound: false,
    refetch: async () => [],
    ...overrides,
  };
}

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
    acts: { confirm: async () => "job", notYet: noop },
    ...overrides,
  };
}
