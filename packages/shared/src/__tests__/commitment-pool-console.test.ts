/**
 * The steward's pool console, as a model: what the pool is doing, what its
 * season and campaigns are, what needs the steward, and which rows the
 * Open · Confirmed · Past chips hold. Derived from the read models only, so
 * the W7 view renders from one answer instead of re-asking each card.
 */

import { describe, expect, it } from "vitest";

import { selectPoolConsoleModel } from "../modules/commitment-pooling/pool-console";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "../modules/commitment-pooling/types";

const NOW = 1_756_000_000n;

function pool(overrides: Partial<CommitmentPoolRecord> = {}): CommitmentPoolRecord {
  return {
    id: "42161-7",
    chainId: 42161,
    poolId: 7n,
    registrationSeen: true,
    garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    gardenId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    poolType: "GARDEN",
    state: "OPEN",
    charterCID: "bafy-charter",
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: 12n,
    openSeasonCycleEntityId: "42161-12",
    openCampaignIds: [],
    openCampaignEntityIds: [],
    providerOpenCommitmentCap: 24n,
    liveCommitmentCount: 2n,
    nonTerminalCycleCount: 1n,
    commitmentsOffered: 1n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 3n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 1n,
    commitmentsDisputed: 0n,
    workLinkedCount: 0n,
    workApprovedCount: 0n,
    openCommitmentCount: 2n,
    distinctProviderCount: 2n,
    commitmentsDue: 0n,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
    ...overrides,
  };
}

function cycle(overrides: Partial<CommitmentCycleRecord> = {}): CommitmentCycleRecord {
  return {
    id: "42161-12",
    chainId: 42161,
    cycleId: 12n,
    seedSeen: true,
    poolId: 7n,
    poolEntityId: "42161-7",
    garden: null,
    gardenId: null,
    cycleType: "SEASON",
    state: "OPEN",
    startTime: NOW - 100n,
    endTime: NOW + 1000n,
    metadataCID: "bafy-season",
    gardenersBps: 6000,
    treasuryBps: 1500,
    operatorBps: 1000,
    evaluatorBps: 500,
    communityBps: 500,
    funderBps: 500,
    equalParticipationBps: 2000,
    verifiedContributionBps: 8000,
    liveCommitmentCount: 2n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 1n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 2n,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
    ...overrides,
  };
}

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: "42161-1",
    chainId: 42161,
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
    targetUnits: 1n,
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: NOW + 500n,
    ...overrides,
  };
}

describe("selectPoolConsoleModel", () => {
  it("answers for an unregistered garden without guessing a pool", () => {
    const model = selectPoolConsoleModel({
      pool: null,
      cycles: [],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(model.status).toBe("unregistered");
    expect(model.season).toBeNull();
    expect(model.canSetUp).toBe(false);
  });

  it("reads a pool that has never opened as a setup checklist", () => {
    const model = selectPoolConsoleModel({
      pool: pool({
        state: "NOT_READY",
        charterCID: null,
        providerOpenCommitmentCap: 0n,
        openSeasonCycleId: null,
        liveCommitmentCount: 0n,
        nonTerminalCycleCount: 0n,
      }),
      cycles: [],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(model.status).toBe("not-ready");
    expect(model.readiness).toEqual({ charter: false, cap: false });
    expect(model.canSetUp).toBe(true);
    expect(model.canSeedSeason).toBe(false);
    expect(model.canStartCampaign).toBe(false);
  });

  it("finds the one season, the campaigns beside it, and the finished cycles", () => {
    const model = selectPoolConsoleModel({
      pool: pool(),
      cycles: [
        cycle(),
        cycle({ id: "42161-13", cycleId: 13n, cycleType: "CAMPAIGN", state: "OPEN" }),
        cycle({ id: "42161-14", cycleId: 14n, cycleType: "CAMPAIGN", state: "SEEDED" }),
        cycle({ id: "42161-11", cycleId: 11n, state: "COMPOSTED" }),
        cycle({ id: "42161-10", cycleId: 10n, cycleType: "CAMPAIGN", state: "CANCELLED" }),
      ],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(model.status).toBe("open");
    expect(model.season?.cycleId).toBe(12n);
    expect(model.campaigns.map((row) => row.cycleId)).toEqual([13n, 14n]);
    expect(model.finishedCycles.map((row) => row.cycleId)).toEqual([11n, 10n]);
    // One season at a time: a second cannot be seeded while this one runs.
    expect(model.canSeedSeason).toBe(false);
    expect(model.canStartCampaign).toBe(true);
  });

  it("offers a season when the pool is set up and none is running", () => {
    const model = selectPoolConsoleModel({
      pool: pool({ state: "READY", openSeasonCycleId: null, nonTerminalCycleCount: 0n }),
      cycles: [],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(model.status).toBe("ready");
    expect(model.canSeedSeason).toBe(true);
    // A campaign needs an open pool; a Ready pool opens with its first season.
    expect(model.canStartCampaign).toBe(false);
  });

  it("groups commitments into Open · Confirmed · Past and surfaces what needs the steward", () => {
    const model = selectPoolConsoleModel({
      pool: pool(),
      cycles: [cycle()],
      commitments: [
        commitment(),
        commitment({ id: "42161-2", commitmentId: 2n, onchainState: "OFFERED", state: "OFFERED" }),
        commitment({
          id: "42161-3",
          commitmentId: 3n,
          onchainState: "FULFILLED",
          derivedState: "FULFILLED",
          state: "FULFILLED",
        }),
        commitment({
          id: "42161-4",
          commitmentId: 4n,
          onchainState: "EXPIRED",
          derivedState: "EXPIRED",
          state: "EXPIRED",
        }),
        commitment({
          id: "42161-5",
          commitmentId: 5n,
          onchainState: "DISPUTED",
          derivedState: "DISPUTED",
          state: "DISPUTED",
        }),
        // Past due and still live: the expire act, and a recovery count.
        commitment({ id: "42161-6", commitmentId: 6n, dueDate: NOW - 10n }),
      ],
      pendingClaimCount: 2,
      now: NOW,
    });
    expect(model.groups.open.map((row) => row.commitmentId)).toEqual([1n, 2n, 5n, 6n]);
    expect(model.groups.confirmed.map((row) => row.commitmentId)).toEqual([3n]);
    expect(model.groups.past.map((row) => row.commitmentId)).toEqual([4n]);
    expect(model.dueLive.map((row) => row.commitmentId)).toEqual([6n]);
    expect(model.counts).toEqual({ claimsWaiting: 2, needsRecovery: 2, pastDue: 1 });
  });

  it("blocks closing while anything is live, and names why", () => {
    const blocked = selectPoolConsoleModel({
      pool: pool(),
      cycles: [cycle()],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(blocked.closure).toEqual({
      allowed: false,
      blockers: ["live-commitments", "non-terminal-cycles"],
    });

    const clear = selectPoolConsoleModel({
      pool: pool({ liveCommitmentCount: 0n, nonTerminalCycleCount: 0n, openSeasonCycleId: null }),
      cycles: [cycle({ state: "COMPOSTED" })],
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    });
    expect(clear.closure.allowed).toBe(true);
    expect(clear.status).toBe("open");
  });

  it("reads paused, closed and composted pools by their own names", () => {
    expect(
      selectPoolConsoleModel({
        pool: pool({ state: "PAUSED", pauseReasonCID: "bafy-reason" }),
        cycles: [cycle()],
        commitments: [],
        pendingClaimCount: 0,
        now: NOW,
      }).status
    ).toBe("paused");
    expect(
      selectPoolConsoleModel({
        pool: pool({ state: "CLOSED" }),
        cycles: [],
        commitments: [],
        pendingClaimCount: 0,
        now: NOW,
      }).status
    ).toBe("closed");
    expect(
      selectPoolConsoleModel({
        pool: pool({ state: "COMPOSTED" }),
        cycles: [],
        commitments: [],
        pendingClaimCount: 0,
        now: NOW,
      }).status
    ).toBe("composted");
  });
});
