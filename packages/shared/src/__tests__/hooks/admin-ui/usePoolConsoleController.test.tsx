/** @vitest-environment happy-dom */

import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { type Config, WagmiContext } from "wagmi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../../config/query-keys";
import {
  usePoolConsoleController,
  useVoucherConsole,
} from "../../../hooks/admin-ui/pool/usePoolConsoleController";
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
  selectVoucherAskStage,
  type VoucherAsk,
  type VoucherBooking,
  type VoucherConsoleSnapshot,
} from "../../../modules/commitment-pooling/voucher-console";
import { claimActKey } from "../../../modules/transactions/act-phase";
import {
  availableCapability,
  commitmentFixture,
  cycleFixture,
  poolClaimRowFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import esMessages from "../../../i18n/es.json";
import { createTestWrapper } from "../../test-utils/render-helpers";

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
  fundingRefetch: vi.fn(),
  sender: { authMode: "wallet" },
  retryQueuedCommitmentJob: vi.fn(),
  discardJob: vi.fn(),
  getBlock: vi.fn(),
  handlerConfigs: [] as Array<{ source: string } & Record<string, unknown>>,
  reportError: vi.fn(),
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

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../hooks/commitment-pooling/useCommitmentJobs")>()),
  retryQueuedCommitmentJob: mocks.retryQueuedCommitmentJob,
}));

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { discardJob: mocks.discardJob },
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: (config: { source: string } & Record<string, unknown>) => {
    mocks.handlerConfigs.push(config);
    return mocks.reportError;
  },
}));

// The chain's latest block is the edge an acceptance reads its time from.
vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  getBlock: mocks.getBlock,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: mocks.queueState,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentReason", () => ({
  useCommitmentReason: mocks.reason,
}));

vi.mock("../../../hooks/commitment-pooling/usePoolFunding", () => ({
  usePoolFunding: () => ({
    snapshot: null,
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    hasStaleBalance: false,
    lastReadAt: null,
    ledgerReadAt: null,
    refetch: mocks.fundingRefetch,
  }),
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

/** A booking asked on the console's promise, ready to accept unless `setup` says otherwise. */
function voucherAsk(at: number, setup: Partial<NonNullable<VoucherAsk["setup"]>> = {}): VoucherAsk {
  return {
    commitmentId: COMMITMENT.commitmentId,
    buyer: CLAIMANT,
    claimHash: `0x${"c1".repeat(32)}`,
    agreed: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
    current: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
    agreedAt: at - 172_800,
    issuer: { name: "Tech and Sun", chainId: 100, safe: GARDEN, decimals: 6 },
    setup: {
      voucherUnits: 1_000_000n,
      approvedAt: at - 86_400,
      depositedUnits: 1_000_000n,
      depositConfirmed: true,
      acceptBy: at + 432_000,
      ...setup,
    },
  };
}

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
    pendingActs: new Map(),
    hasPendingCreate: false,
    pendingCreates: [],
    proofJobs: [],
    linkedWorkIds: new Set<string>(),
    takeUpIds: new Set<string>(),
    failedLinkWorkIds: new Set<string>(),
    isUnavailable: false,
    isLoading: false,
    isFetching: false,
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

/** The console where the app's wallet runtime mounts, so an act can read the chain's time. */
function renderControllerOnChain(queryClient: QueryClient) {
  const Base = createTestWrapper(queryClient);
  return renderHook(() => usePoolConsoleController({ chainId: CHAIN_ID, garden: GARDEN }), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        Base,
        null,
        createElement(WagmiContext.Provider, { value: {} as Config }, children)
      ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlerConfigs.length = 0;
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
  mocks.getCommitmentPools.mockResolvedValue([POOL]);
  mocks.getCommitmentCycles.mockResolvedValue([CYCLE]);
  mocks.getCommitments.mockResolvedValue([COMMITMENT]);
  mocks.getPoolClaimRequests.mockResolvedValue([CLAIM]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
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

  it("marks the promises whose next act is the steward's own, not the ones they may choose", () => {
    const queryClient = testQueryClient();
    const request = { poolId: POOL_ID, cycleId: CYCLE_ID, direction: "REQUEST" as const };
    // The steward asked for it and the proof is in: only they can confirm it.
    const toConfirm = commitmentFixture({
      ...request,
      commitmentId: 2001n,
      creator: TUNDE,
      leadProvider: MARIA,
      counterparty: MARIA,
      onchainState: "READY_FOR_CONFIRMATION",
    });
    // Someone else's request: the steward has no part in it.
    const theirs = commitmentFixture({
      ...request,
      commitmentId: 2002n,
      creator: MARIA,
      leadProvider: MARIA,
      counterparty: MARIA,
      onchainState: "READY_FOR_CONFIRMATION",
    });
    // The steward's own request nobody has taken: withdrawing it is a choice, not a need.
    const untaken = commitmentFixture({
      ...request,
      commitmentId: 2003n,
      creator: TUNDE,
      leadProvider: null,
      onchainState: "REQUESTED",
    });
    seedControllerQueries(queryClient, { commitments: [toConfirm, theirs, untaken] });

    const { result } = renderController(queryClient);

    expect([...result.current.waitingOnYou]).toEqual([toConfirm.id]);
  });

  it("keeps the due timer through re-renders and offers expiry after the due second", async () => {
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

    const { result, rerender } = renderController(queryClient);

    expect(result.current.model.dueLive).toEqual([]);
    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 31_000)).toHaveLength(1);

    dateNow.mockReturnValue((NOW + 10) * 1000);
    act(() => vi.advanceTimersByTime(10_000));
    rerender();
    dateNow.mockReturnValue((NOW + 20) * 1000);
    act(() => vi.advanceTimersByTime(10_000));
    rerender();
    expect(result.current.model.dueLive).toEqual([]);

    dateNow.mockReturnValue((NOW + 31) * 1000);
    act(() => vi.advanceTimersByTime(11_000));

    expect(result.current.model.dueLive).toEqual([due]);
    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 31_000)).toHaveLength(1);
  });

  it("caps a far-future wait and re-arms until the due moment", () => {
    vi.useFakeTimers();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    const farDue = NOW + 30 * 24 * 60 * 60;
    const due = commitmentFixture({
      commitmentId: 1002n,
      poolId: POOL_ID,
      cycleId: CYCLE_ID,
      dueDate: BigInt(farDue),
      onchainState: "ACCEPTED",
    });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient, { commitments: [due] });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const { result } = renderController(queryClient);
    const cappedTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 2_147_483_647)?.[0];
    expect(cappedTimer).toEqual(expect.any(Function));
    expect(result.current.model.dueLive).toEqual([]);

    dateNow.mockReturnValue(NOW * 1000 + 2_147_483_647);
    act(() => (cappedTimer as () => void)());
    expect(result.current.model.dueLive).toEqual([]);
    const remaining = (farDue + 1) * 1000 - (NOW * 1000 + 2_147_483_647);
    const rearmedTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === remaining)?.[0];
    expect(rearmedTimer).toEqual(expect.any(Function));

    dateNow.mockReturnValue((farDue + 1) * 1000);
    act(() => (rearmedTimer as () => void)());
    expect(result.current.model.dueLive).toEqual([due]);
  });

  it("reads an external commitment change while the console stays mounted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
    const updated = commitmentFixture({
      ...COMMITMENT,
      onchainState: "EXPIRED",
    });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    mocks.getCommitments.mockResolvedValue([updated]);

    const { result, unmount } = renderController(queryClient);
    expect(result.current.commitments[0]?.onchainState).toBe(COMMITMENT.onchainState);
    expect(mocks.getCommitments).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(mocks.getCommitments).toHaveBeenCalledTimes(1);
    expect(result.current.commitments[0]?.onchainState).toBe("EXPIRED");

    mocks.getCommitments.mockResolvedValue([COMMITMENT]);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.commitments[0]?.onchainState).toBe(COMMITMENT.onchainState);

    mocks.getCommitments.mockResolvedValue([updated]);
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.commitments[0]?.onchainState).toBe("EXPIRED");
    expect(mocks.getCommitments).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(mocks.getCommitments).toHaveBeenCalledTimes(3);
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
      ([, delay]) => delay === 31_000
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
    expect(mocks.poolMutate).not.toHaveBeenCalled();
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
      // Resume follows its own send, so the status card can say where it stands.
      { action: "resumePool", poolId: POOL_ID, send: { onBroadcast: expect.any(Function) } },
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
      // Accept follows its own send, so its row can say where it stands.
      {
        action: "acceptClaim",
        commitmentId: 31n,
        claimant: CLAIMANT,
        send: { onBroadcast: expect.any(Function) },
      },
      {
        action: "declineClaim",
        commitmentId: 32n,
        claimant: CLAIMANT,
        reason: "Capacity reached",
        gardenAddress: GARDEN,
      },
    ]);
  });

  it("accepts a voucher booking through acceptServiceClaim, refusing before the wallet while a check fails", async () => {
    const at = 1_761_600_000;
    vi.spyOn(Date, "now").mockReturnValue(at * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(at) });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderControllerOnChain(queryClient);
    const booking = voucherAsk(at, { depositConfirmed: false });

    // The deposit hasn't reached Green Goods: the contract would refuse, so the wallet never asks.
    await expect(result.current.acts.acceptServiceClaim(booking, at)).rejects.toThrow(
      "This booking isn't ready to accept"
    );
    expect(mocks.commitmentMutate).not.toHaveBeenCalled();

    const ready = { ...booking, setup: { ...booking.setup!, depositConfirmed: true } };
    await act(async () => {
      await result.current.acts.acceptServiceClaim(ready, at);
    });
    expect(mocks.commitmentMutate.mock.calls.map(([input]) => input)).toEqual([
      {
        action: "acceptServiceClaim",
        commitmentId: COMMITMENT.commitmentId,
        buyer: CLAIMANT,
        expectedClaimHash: ready.claimHash,
        send: { onBroadcast: expect.any(Function) },
      },
    ]);
    // It is the ask's decision, on the same line Approve uses, so its row keeps the outcome.
    expect(
      result.current.claimDecisions[claimActKey(COMMITMENT.commitmentId, CLAIMANT)]
    ).toMatchObject({ kind: "approved", commitmentId: COMMITMENT.commitmentId.toString() });
  });

  // A tab left open across the deadline hands the act the time its dialog last drew, and a clock
  // whose calibration is still pending stands in with the device's own (Codex on #1320 and on
  // #1352): the act reads the chain's latest block as it starts.
  it("judges an acceptance on the chain's latest block as the act starts, not on a slow device", async () => {
    const at = 1_761_600_000;
    const ready = voucherAsk(at);
    const acceptBy = ready.setup!.acceptBy;
    // The device runs ten minutes slow; the chain is half a minute past the deadline.
    vi.spyOn(Date, "now").mockReturnValue((acceptBy - 600) * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(acceptBy + 30) });
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderControllerOnChain(queryClient);

    await expect(result.current.acts.acceptServiceClaim(ready, acceptBy - 600)).rejects.toThrow(
      "This booking isn't ready to accept"
    );
    expect(mocks.commitmentMutate).not.toHaveBeenCalled();
  });

  it("refuses an acceptance while the chain's time can't be read", async () => {
    const at = 1_761_600_000;
    vi.spyOn(Date, "now").mockReturnValue(at * 1000);
    mocks.getBlock.mockRejectedValue(new Error("RPC unavailable"));
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderControllerOnChain(queryClient);

    await expect(result.current.acts.acceptServiceClaim(voucherAsk(at), at)).rejects.toThrow(
      "The chain's time can't be read right now, so nothing was accepted"
    );
    expect(mocks.commitmentMutate).not.toHaveBeenCalled();
  });

  it("sends or drops a queued creation and re-reads the row either way", async () => {
    // Nothing else in the admin sends a queued creation. A retry that fails is
    // reported rather than thrown, because the row that offered it is still there.
    const refresh = vi.fn();
    mocks.queueState.mockReturnValue(queueState({ refresh }));
    mocks.retryQueuedCommitmentJob
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("User rejected the request"));
    mocks.discardJob.mockResolvedValue(true);
    const queryClient = testQueryClient();
    seedControllerQueries(queryClient);
    const { result } = renderController(queryClient);

    await act(async () => {
      await result.current.acts.retryQueued("job-1");
      await result.current.acts.retryQueued("job-1");
      await result.current.acts.discardQueued("job-2");
    });

    // Each send reports how it ended, and the row it came from reads it:
    // the second one failed, and no other row carries a line.
    expect(mocks.retryQueuedCommitmentJob).toHaveBeenCalledWith(
      "job-1",
      mocks.sender,
      expect.any(Function)
    );
    expect(result.current.queuedPhase("job-1")).toEqual({ status: "failed", key: "job-1" });
    expect(result.current.queuedPhase("job-2")).toEqual({ status: "idle" });
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    expect(mocks.discardJob).toHaveBeenCalledWith("job-2");
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  // Retry Transfer is one tap from its row: a failure used to reach only the logger, so the
  // steward never learned that nothing changed (Codex on #1320).
  it("reports a failed transfer retry through the shared toast and leaves the row to try again", async () => {
    const { result } = renderHook(() => useVoucherConsole({ chainId: CHAIN_ID, garden: GARDEN }), {
      wrapper: createTestWrapper(testQueryClient()),
    });
    const booking: VoucherBooking = {
      commitmentId: 51n,
      holder: CLAIMANT,
      setupId: `0x${"b5".repeat(32)}`,
      issuer: { name: "Green Goods", chainId: 100, safe: GARDEN, decimals: 6 },
      voucherUnits: 10_000_000n,
      service: { kind: "access", daysUsed: 12, daysOf: 30 },
      stage: { kind: "return-failed", units: 6_000_000n },
    };

    await expect(result.current.acts.retryTransfer(booking)).resolves.toBeUndefined();

    expect(mocks.reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      gardenAddress: GARDEN,
      metadata: { act: "retryTransfer", commitmentId: "51" },
    });
  });

  // The toast fell back to English under Spanish or Portuguese (Codex on #1352).
  it("words a failed transfer retry's toast in the steward's language", () => {
    const client = testQueryClient();
    renderHook(() => useVoucherConsole({ chainId: CHAIN_ID, garden: GARDEN }), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          QueryClientProvider,
          { client },
          createElement(IntlProvider, { locale: "es", messages: esMessages }, children)
        ),
    });
    const retry = mocks.handlerConfigs.find((config) => config.source === "useVoucherConsole");
    expect(retry).toMatchObject({ formatMessage: expect.any(Function) });
    expect((retry!.getFallbackTitle as () => string)()).toBe("No se reintentó la transferencia");
    expect((retry!.getFallbackMessage as () => string)()).toBe(
      "No cambió nada. Puedes reintentar la misma transferencia."
    );
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

describe("useVoucherConsole", () => {
  const voucherKey = queryKeys.commitmentPooling.voucherConsole(CHAIN_ID, GARDEN);
  const renderVouchers = (queryClient: QueryClient) =>
    renderHook(() => useVoucherConsole({ chainId: CHAIN_ID, garden: GARDEN }), {
      wrapper: createTestWrapper(queryClient),
    });
  const snapshot = (asks: VoucherAsk[]): VoucherConsoleSnapshot => ({
    status: "observed",
    observedAt: NOW,
    asks,
    bookings: [],
    issuer: null,
    reserve: null,
  });

  // The clock used to be read only when the tab drew, so a console left open across a deadline
  // kept offering Accept (Codex on #1320).
  it("ticks past an ask's acceptance deadline while the console stays open", () => {
    vi.useFakeTimers();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    const ask = voucherAsk(NOW, { acceptBy: NOW + 1 });
    const queryClient = testQueryClient();
    queryClient.setQueryData(voucherKey, snapshot([ask]));
    const { result } = renderVouchers(queryClient);
    expect(selectVoucherAskStage(ask, result.current.now)).toBe("ready");

    dateNow.mockReturnValue((NOW + 2) * 1000);
    act(() => vi.advanceTimersByTime(2_000));

    expect(selectVoucherAskStage(ask, result.current.now)).toBe("past-deadline");
  });
});
