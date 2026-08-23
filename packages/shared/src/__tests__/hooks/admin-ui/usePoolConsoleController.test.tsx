/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../../config/query-keys";
import { usePoolConsoleController } from "../../../hooks/admin-ui/pool/usePoolConsoleController";
import type { CommitmentMutationInput } from "../../../hooks/commitment-pooling/useCommitmentMutations";
import type { CommitmentPoolMutationInput } from "../../../hooks/commitment-pooling/useCommitmentPoolMutations";
import type { CommitmentQueueState } from "../../../hooks/commitment-pooling/useCommitmentQueueState";
import type {
  getCommitmentCycles,
  getCommitmentPools,
  getCommitments,
  getPoolClaimRequests,
} from "../../../modules/commitment-pooling/data";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  NOW,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import type { HexString } from "../../../modules/commitment-pooling/types";
import {
  availableCapability,
  commitmentFixture,
  cycleFixture,
  poolClaimRowFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { createTestWrapper } from "../../test-utils";

type PoolMutate = (input: CommitmentPoolMutationInput) => Promise<HexString>;
type CommitmentMutate = (input: CommitmentMutationInput) => Promise<HexString>;

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-23",
  },
  viewer: "0x6166e1964447e0959bc7c8d543db3ab82db65044" as string | null,
  isOnline: true,
  getCommitmentPools: vi.fn<typeof getCommitmentPools>(),
  getCommitmentCycles: vi.fn<typeof getCommitmentCycles>(),
  getCommitments: vi.fn<typeof getCommitments>(),
  getPoolClaimRequests: vi.fn<typeof getPoolClaimRequests>(),
  cycleNames: vi.fn(),
  metadata: vi.fn(),
  charter: vi.fn(),
  reason: vi.fn(),
  queueState: vi.fn(),
  poolMutate: vi.fn<PoolMutate>(),
  commitmentMutate: vi.fn<CommitmentMutate>(),
  poolPending: false,
  commitmentPending: false,
  pinPoolCharter: vi.fn(),
}));

vi.mock("../../../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../../../modules/commitment-pooling/data", async () => {
  const actual = await vi.importActual<typeof import("../../../modules/commitment-pooling/data")>(
    "../../../modules/commitment-pooling/data"
  );
  return {
    ...actual,
    getCommitmentPools: mocks.getCommitmentPools,
    getCommitmentCycles: mocks.getCommitmentCycles,
    getCommitments: mocks.getCommitments,
    getPoolClaimRequests: mocks.getPoolClaimRequests,
  };
});

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentCycleNames", () => ({
  useCommitmentCycleNames: mocks.cycleNames,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadata: mocks.metadata,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: mocks.queueState,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentReason", () => ({
  useCommitmentReason: mocks.reason,
}));

vi.mock("../../../hooks/commitment-pooling/usePoolCharter", () => ({
  usePoolCharter: mocks.charter,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPoolMutations", () => ({
  useCommitmentPoolMutation: () => ({
    mutateAsync: mocks.poolMutate,
    isPending: mocks.poolPending,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMutations", () => ({
  useCommitmentMutation: () => ({
    mutateAsync: mocks.commitmentMutate,
    isPending: mocks.commitmentPending,
  }),
}));

vi.mock("../../../modules/commitment-pooling/pool-charter", async () => {
  const actual = await vi.importActual<
    typeof import("../../../modules/commitment-pooling/pool-charter")
  >("../../../modules/commitment-pooling/pool-charter");
  return { ...actual, pinPoolCharter: mocks.pinPoolCharter };
});

const CHAIN_ID = DEMO_CHAIN_ID;
const GARDEN = DEMO_GARDEN;
const POOL_ID = 101n;
const CYCLE_ID = 7n;
const CLAIMANT = MARIA;
const COMMITMENT_METADATA_CID = "bafy-controller-commitment";
const POOL = poolFixture({
  poolId: POOL_ID,
  charterCID: "bafy-old-charter",
  providerOpenCommitmentCap: 5n,
});
const CYCLE = cycleFixture({ poolId: POOL_ID, cycleId: CYCLE_ID, endTime: null });
const COMMITMENT = commitmentFixture({
  commitmentId: 1001n,
  poolId: POOL_ID,
  cycleId: CYCLE_ID,
  dueDate: null,
  metadataCID: COMMITMENT_METADATA_CID,
});
const CLAIM = poolClaimRowFixture({ commitment: COMMITMENT });

const poolsKey = queryKeys.commitmentPooling.pools(CHAIN_ID, GARDEN);
const cyclesKey = queryKeys.commitmentPooling.cycles(CHAIN_ID, POOL_ID);
const commitmentsKey = queryKeys.commitmentPooling.commitments(CHAIN_ID, {
  chainId: CHAIN_ID,
  poolId: POOL_ID,
});
const claimsKey = queryKeys.commitmentPooling.poolClaims(CHAIN_ID, POOL_ID, "PENDING");

function queueState(overrides: Partial<CommitmentQueueState> = {}): CommitmentQueueState {
  return {
    pendingCommitmentIds: new Set(),
    failedCount: 0,
    failedCommitmentIds: new Set(),
    failedJobs: new Map(),
    hasPendingCreate: false,
    pendingCreates: [],
    isUnavailable: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

function seedControllerQueries(
  queryClient: QueryClient,
  input: {
    pools?: (typeof POOL)[];
    cycles?: (typeof CYCLE)[];
    commitments?: (typeof COMMITMENT)[];
    claims?: (typeof CLAIM)[];
  } = {}
) {
  queryClient.setQueryData(poolsKey, input.pools ?? [POOL]);
  queryClient.setQueryData(cyclesKey, input.cycles ?? [CYCLE]);
  queryClient.setQueryData(commitmentsKey, input.commitments ?? [COMMITMENT]);
  queryClient.setQueryData(claimsKey, input.claims ?? [CLAIM]);
}

function renderController(queryClient: QueryClient) {
  return renderHook(() => usePoolConsoleController({ chainId: CHAIN_ID, garden: GARDEN }), {
    wrapper: createTestWrapper(queryClient),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer = TUNDE;
  mocks.isOnline = true;
  mocks.poolPending = false;
  mocks.commitmentPending = false;
  mocks.cycleNames.mockReturnValue({
    byCycleId: new Map([[CYCLE_ID.toString(), { status: "resolved", name: "Season One" }]]),
    isLoading: false,
  });
  mocks.metadata.mockReturnValue({
    byCID: new Map([[COMMITMENT_METADATA_CID, { version: 1, title: "Repair tools" }]]),
    isLoading: false,
  });
  mocks.charter.mockReturnValue({
    charter: { version: 1, purpose: "Keep tools in service" },
    isLoading: false,
    isUnavailable: false,
  });
  mocks.reason.mockReturnValue({ reason: null, isLoading: false, isUnavailable: false });
  mocks.queueState.mockReturnValue(queueState());
  mocks.poolMutate.mockResolvedValue("0xpool");
  mocks.commitmentMutate.mockResolvedValue("0xcommitment");
  mocks.pinPoolCharter.mockResolvedValue("bafy-new-charter");
  mocks.getCommitmentPools.mockResolvedValue([POOL]);
  mocks.getCommitmentCycles.mockResolvedValue([CYCLE]);
  mocks.getCommitments.mockResolvedValue([COMMITMENT]);
  mocks.getPoolClaimRequests.mockResolvedValue([CLAIM]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("usePoolConsoleController", () => {
  it("projects the seeded reads and filters pending creates to the active pool", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    mocks.queueState.mockReturnValue(
      queueState({
        isUnavailable: true,
        pendingCreates: [
          {
            jobId: "matching",
            chainId: CHAIN_ID,
            poolId: POOL_ID.toString(),
            direction: "OFFER",
            title: "Matching",
            unitLabel: "hours",
            targetUnits: "3",
            waitingForMembership: false,
            failed: false,
            discardable: false,
            createdAt: 3,
          },
          {
            jobId: "other-chain",
            chainId: 11155111,
            poolId: POOL_ID.toString(),
            direction: "OFFER",
            title: null,
            unitLabel: "hours",
            targetUnits: "1",
            waitingForMembership: false,
            failed: false,
            discardable: false,
            createdAt: 2,
          },
          {
            jobId: "other-pool",
            chainId: CHAIN_ID,
            poolId: "999",
            direction: "REQUEST",
            title: null,
            unitLabel: "items",
            targetUnits: "1",
            waitingForMembership: false,
            failed: false,
            discardable: false,
            createdAt: 1,
          },
        ],
      })
    );

    const { result } = renderController(queryClient);

    expect(result.current.poolId).toBe(POOL_ID);
    expect(result.current.viewer).toBe(TUNDE);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.availability).toEqual({
      status: "available",
      capability: availableCapability,
    });
    expect(result.current.cycles).toEqual([CYCLE]);
    expect(result.current.commitments).toEqual([COMMITMENT]);
    expect(result.current.claims).toEqual([CLAIM]);
    expect(result.current.cycleNames.get(CYCLE_ID.toString())).toEqual({
      status: "resolved",
      name: "Season One",
    });
    expect(result.current.titles.get(COMMITMENT_METADATA_CID)?.title).toBe("Repair tools");
    expect(result.current.pendingCreates.map((row) => row.jobId)).toEqual(["matching"]);
    expect(result.current.queueUnavailable).toBe(true);
    expect(mocks.cycleNames).toHaveBeenCalledWith([CYCLE]);
    expect(mocks.metadata).toHaveBeenCalledWith([COMMITMENT]);
    expect(mocks.charter).toHaveBeenCalledWith("bafy-old-charter");
    expect(mocks.reason).toHaveBeenCalledWith(null);
    expect(mocks.queueState).toHaveBeenCalledWith(TUNDE);
  });

  it("arms one due timer, reveals the row after 30 seconds, and does not re-arm", async () => {
    vi.useFakeTimers();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    const due = commitmentFixture({
      commitmentId: 1002n,
      poolId: POOL_ID,
      cycleId: CYCLE_ID,
      dueDate: BigInt(NOW + 30),
      onchainState: "ACCEPTED",
    });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient, { commitments: [due] });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const { result } = renderController(queryClient);

    expect(result.current.model.dueLive).toEqual([]);
    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 30_000)).toHaveLength(1);

    dateNow.mockReturnValue((NOW + 31) * 1000);
    act(() => vi.advanceTimersByTime(30_000));

    expect(result.current.model.dueLive).toEqual([due]);
    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 30_000)).toHaveLength(1);
  });

  it("clears the pending due timer on unmount", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    const due = commitmentFixture({ dueDate: BigInt(NOW + 30), onchainState: "ACCEPTED" });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient, { commitments: [due] });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderController(queryClient);
    const controllerTimerIndex = setTimeoutSpy.mock.calls.findIndex(
      ([, delay]) => delay === 30_000
    );
    expect(controllerTimerIndex).toBeGreaterThanOrEqual(0);
    const controllerTimer = setTimeoutSpy.mock.results[controllerTimerIndex]?.value;

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(controllerTimer);
  });

  it("rejects every pool-scoped act when the garden has no pool", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient, { pools: [] });
    const { result } = renderController(queryClient);
    const expected = "This garden has no commitment pool";

    const synchronousCalls = [
      () => result.current.acts.pause("Maintenance"),
      () => result.current.acts.resume(),
      () => result.current.acts.closePool(),
      () => result.current.acts.compostPool(),
      () => result.current.acts.reopenPool(true),
    ];
    for (const call of synchronousCalls) {
      expect(call).toThrow(expected);
    }
    await expect(result.current.acts.saveSettings({ purpose: "", cap: 0n })).rejects.toThrow(
      expected
    );
    expect(mocks.poolMutate).not.toHaveBeenCalled();
    expect(mocks.pinPoolCharter).not.toHaveBeenCalled();
  });

  it("forwards every lifecycle and claim act exactly", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderController(queryClient);

    await act(async () => {
      await result.current.acts.pause("Maintenance");
      await result.current.acts.resume();
      await result.current.acts.closePool();
      await result.current.acts.compostPool();
      await result.current.acts.reopenPool(false);
      await result.current.acts.cancelCycle(20n, "No longer needed");
      await result.current.acts.closeCycle(21n);
      await result.current.acts.compostCycle(22n);
      await result.current.acts.expire(30n);
      await result.current.acts.acceptClaim(31n, CLAIMANT);
      await result.current.acts.declineClaim(32n, CLAIMANT, "Capacity reached");
    });

    expect(mocks.poolMutate.mock.calls.map(([input]) => input)).toEqual([
      { action: "pausePool", poolId: POOL_ID, reason: "Maintenance", gardenAddress: GARDEN },
      { action: "resumePool", poolId: POOL_ID },
      { action: "closePool", poolId: POOL_ID },
      { action: "compostPool", poolId: POOL_ID },
      { action: "reopenPool", poolId: POOL_ID, toOpen: false },
      {
        action: "cancelCycle",
        cycleId: 20n,
        reason: "No longer needed",
        gardenAddress: GARDEN,
      },
      { action: "closeCycle", cycleId: 21n },
      { action: "compostCycle", cycleId: 22n },
    ]);
    expect(mocks.commitmentMutate.mock.calls.map(([input]) => input)).toEqual([
      { action: "expireCommitment", commitmentId: 30n },
      { action: "acceptClaim", commitmentId: 31n, claimant: CLAIMANT },
      {
        action: "declineClaim",
        commitmentId: 32n,
        claimant: CLAIMANT,
        reason: "Capacity reached",
        gardenAddress: GARDEN,
      },
    ]);
  });

  it("writes changed settings in pin, charter, cap order and skips unchanged values", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderController(queryClient);

    await act(async () => {
      await result.current.acts.saveSettings({ purpose: "Keep tools in service", cap: 5n });
    });
    expect(mocks.pinPoolCharter).not.toHaveBeenCalled();
    expect(mocks.poolMutate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.acts.saveSettings({ purpose: "Expand the tool library", cap: 9n });
    });

    expect(mocks.pinPoolCharter).toHaveBeenCalledWith({
      purpose: "Expand the tool library",
      gardenAddress: GARDEN,
    });
    expect(mocks.poolMutate.mock.calls.map(([input]) => input)).toEqual([
      {
        action: "setPoolCharter",
        poolId: POOL_ID,
        charterCID: "bafy-new-charter",
      },
      { action: "setProviderOpenCommitmentCap", poolId: POOL_ID, cap: 9n },
    ]);
    expect(mocks.pinPoolCharter.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.poolMutate.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(mocks.poolMutate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.poolMutate.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY
    );
  });

  it("stops before both writes when charter pinning rejects", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    mocks.pinPoolCharter.mockRejectedValue(new Error("gateway down"));
    const { result } = renderController(queryClient);

    await expect(
      result.current.acts.saveSettings({ purpose: "Expand the tool library", cap: 9n })
    ).rejects.toThrow("gateway down");
    expect(mocks.poolMutate).not.toHaveBeenCalled();
  });

  it("composes pending state from either mutation hook", () => {
    mocks.poolPending = true;
    let queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const acting = renderController(queryClient);
    expect(acting.result.current.isActing).toBe(true);
    acting.unmount();

    mocks.poolPending = false;
    mocks.commitmentPending = true;
    queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const commitmentActing = renderController(queryClient);
    expect(commitmentActing.result.current.isActing).toBe(true);
    commitmentActing.unmount();
  });

  it("composes loading state from a dependent pool read", () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const cyclesQuery = queryClient.getQueryCache().find({ queryKey: cyclesKey, exact: true });
    if (!cyclesQuery) throw new Error("cycles query was not seeded");
    cyclesQuery.setState({
      ...cyclesQuery.state,
      data: undefined,
      status: "pending",
      fetchStatus: "fetching",
    });
    mocks.getCommitmentCycles.mockImplementation(() => new Promise(() => undefined));
    const loading = renderController(queryClient);
    expect(loading.result.current.isLoading).toBe(true);
    loading.unmount();
  });

  it("composes errors from either pools or dependent reads", async () => {
    let queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const failed = renderController(queryClient);
    const claimsQuery = queryClient.getQueryCache().find({ queryKey: claimsKey, exact: true });
    if (!claimsQuery) throw new Error("claims query was not seeded");
    expect(claimsQuery.getObserversCount()).toBe(1);
    await act(async () => {
      claimsQuery.setState({
        ...claimsQuery.state,
        data: undefined,
        error: new Error("claims unavailable"),
        errorUpdatedAt: Date.now(),
        errorUpdateCount: claimsQuery.state.errorUpdateCount + 1,
        status: "error",
        fetchStatus: "idle",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(failed.result.current.isError).toBe(true);
    failed.unmount();

    queryClient = testQueryClient();
    queryClient.setQueryData(poolsKey, [POOL]);
    const poolFailed = renderController(queryClient);
    const poolsQuery = queryClient.getQueryCache().find({ queryKey: poolsKey, exact: true });
    if (!poolsQuery) throw new Error("pools query was not seeded");
    await act(async () => {
      poolsQuery.setState({
        ...poolsQuery.state,
        data: undefined,
        error: new Error("pools unavailable"),
        errorUpdatedAt: Date.now(),
        errorUpdateCount: poolsQuery.state.errorUpdateCount + 1,
        status: "error",
        fetchStatus: "idle",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(poolFailed.result.current.isError).toBe(true);
    expect(poolFailed.result.current.isLoading).toBe(false);
  });

  it("refetches pools, cycles, commitments, and pool claims", async () => {
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderController(queryClient);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mocks.getCommitmentPools).toHaveBeenCalledTimes(1);
    expect(mocks.getCommitmentPools).toHaveBeenCalledWith(CHAIN_ID, GARDEN);
    expect(mocks.getCommitmentCycles).toHaveBeenCalledTimes(1);
    expect(mocks.getCommitmentCycles).toHaveBeenCalledWith({ chainId: CHAIN_ID, poolId: POOL_ID });
    expect(mocks.getCommitments).toHaveBeenCalledTimes(1);
    expect(mocks.getCommitments).toHaveBeenCalledWith({ chainId: CHAIN_ID, poolId: POOL_ID });
    expect(mocks.getPoolClaimRequests).toHaveBeenCalledTimes(1);
    expect(mocks.getPoolClaimRequests).toHaveBeenCalledWith({
      chainId: CHAIN_ID,
      poolId: POOL_ID,
      state: "PENDING",
    });
  });
});
