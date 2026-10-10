/** @vitest-environment happy-dom */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenPoolController } from "../../../hooks/client-ui/pool/useGardenPoolController";
import { commitmentFixture, poolFixture } from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  commitments: [] as ReturnType<typeof commitmentFixture>[],
  cycles: [] as Array<{ cycleId: bigint; state: string }>,
  commitmentsInput: null as { cycleId?: bigint } | null,
  pendingCreates: [] as Array<{ jobId: string; poolId: string; direction: "OFFER" | "REQUEST" }>,
  metadata: new Map<string, { title: string }>(),
  hasRole: false,
  roleRead: { isLoading: false, error: null as Error | null },
  isMember: true as boolean | null,
  isOnline: true,
  refresh: vi.fn(),
  flush: vi.fn(),
  retryAndSend: vi.fn(),
  retryJob: vi.fn(),
  discardJob: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1111111111111111111111111111111111111111",
}));
vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));
vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: mocks.hasRole, ...mocks.roleRead }),
}));
vi.mock("../../../hooks/roles/useGardenMembership", () => ({
  useGardenMembership: () => ({
    isMember: mocks.isMember,
    isLoading: mocks.isMember === null,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({ sendsFromTap: false }),
}));
vi.mock("../../../providers/JobQueue", () => ({
  useJobQueue: () => ({ flush: mocks.flush, retryAndSend: mocks.retryAndSend }),
}));
vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { retryJob: mocks.retryJob, discardJob: mocks.discardJob },
}));
vi.mock("../../../commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../commitment-pooling")>()),
  useCommitmentCycles: () => ({ cycles: mocks.cycles }),
  useCommitmentQueueState: () => ({
    pendingCreates: mocks.pendingCreates,
    refresh: mocks.refresh,
  }),
  useCommitments: (input: { cycleId?: bigint }) => {
    mocks.commitmentsInput = input;
    return {
      commitments: mocks.commitments,
      availability: { status: "available", capability: {} },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    };
  },
  useCommitmentMetadata: () => ({ byCID: mocks.metadata }),
}));

describe("useGardenPoolController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commitments = [
      commitmentFixture({ commitmentId: 1n, direction: "OFFER", metadataCID: "offer-cid" }),
      commitmentFixture({ commitmentId: 2n, direction: "REQUEST", metadataCID: "request-cid" }),
    ];
    mocks.cycles = [{ cycleId: 8n, state: "OPEN" }];
    mocks.pendingCreates = [
      { jobId: "job-7", poolId: "7", direction: "OFFER" },
      { jobId: "job-9", poolId: "9", direction: "OFFER" },
    ];
    mocks.metadata = new Map([["request-cid", { title: "Water the orchard" }]]);
    mocks.hasRole = false;
    mocks.roleRead = { isLoading: false, error: null };
    mocks.isMember = true;
    mocks.isOnline = true;
    mocks.flush.mockResolvedValue(undefined);
    mocks.retryAndSend.mockResolvedValue(undefined);
    mocks.retryJob.mockResolvedValue(undefined);
    mocks.discardJob.mockResolvedValue(undefined);
  });

  it("projects rows, local creations, titles, and direction filters", () => {
    const targetPool = poolFixture({ poolId: 7n, state: "OPEN", poolType: "GARDEN" });
    const { result } = renderHookWithProviders(() => useGardenPoolController(targetPool));

    expect(result.current.rows).toHaveLength(2);
    expect(result.current.ownCreations).toEqual([
      { jobId: "job-7", poolId: "7", direction: "OFFER" },
    ]);
    expect(result.current.shownCreations).toEqual(result.current.ownCreations);
    expect(result.current.titleOf("request-cid")).toBe("Water the orchard");
    expect(result.current.cycles).toEqual([{ cycleId: 8n, state: "OPEN" }]);
    expect(result.current.canCreate).toBe(true);

    act(() => result.current.setDirection("REQUEST"));
    expect(result.current.rows.map((row) => row.commitment.direction)).toEqual(["REQUEST"]);
    // A creation on this phone follows the filters too, and is never settled.
    expect(result.current.shownCreations).toEqual([]);
    act(() => result.current.setDirection("OFFER"));
    expect(result.current.shownCreations).toHaveLength(1);
    act(() => result.current.setLiveness("settled"));
    expect(result.current.shownCreations).toEqual([]);
    expect(result.current.ownCreations).toHaveLength(1);
  });

  it("leaves cancelled seasons out of the rail, as the public page does", () => {
    mocks.cycles = [
      { cycleId: 8n, state: "OPEN" },
      { cycleId: 9n, state: "CANCELLED" },
      { cycleId: 10n, state: "SEEDED" },
    ];
    const { result } = renderHookWithProviders(() =>
      useGardenPoolController(poolFixture({ poolId: 7n, state: "OPEN" }))
    );
    expect(result.current.cycles.map((cycle) => cycle.cycleId)).toEqual([8n, 10n]);
    // Their commitments are not filtered out: All still reads the whole pool.
    expect(mocks.commitmentsInput?.cycleId).toBeUndefined();
  });

  it("falls back to All when the chosen season is cancelled", () => {
    const { result, rerender } = renderHookWithProviders(() =>
      useGardenPoolController(poolFixture({ poolId: 7n, state: "OPEN" }))
    );
    act(() => result.current.setSelectedCycleId(8n));
    expect(result.current.selectedCycleId).toBe(8n);
    expect(mocks.commitmentsInput?.cycleId).toBe(8n);

    mocks.cycles = [{ cycleId: 8n, state: "CANCELLED" }];
    rerender();
    expect(result.current.selectedCycleId).toBeNull();
    expect(mocks.commitmentsInput?.cycleId).toBeUndefined();
  });

  it("owns retry, flush, discard, and queue refresh outcomes", async () => {
    const { result } = renderHookWithProviders(() =>
      useGardenPoolController(poolFixture({ poolId: 7n }))
    );

    await act(async () => result.current.acts.retry("job-7"));
    // Retrying one act sends only that act, never the queued work beside it.
    expect(mocks.retryAndSend).toHaveBeenCalledWith("job-7");
    expect(mocks.flush).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();

    await act(async () => result.current.acts.discard("job-7"));
    expect(mocks.discardJob).toHaveBeenCalledWith("job-7");
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    expect(result.current.busyJobId).toBeNull();
  });

  it("shows live, settled or all promises, as Status asks", () => {
    mocks.commitments = [
      commitmentFixture({ commitmentId: 1n, derivedState: "ACTIVE" }),
      commitmentFixture({ commitmentId: 2n, derivedState: "FULFILLED" }),
      commitmentFixture({ commitmentId: 3n, derivedState: "CANCELLED" }),
    ];
    const { result } = renderHookWithProviders(() =>
      useGardenPoolController(poolFixture({ poolId: 7n, state: "OPEN" }))
    );
    const ids = () => result.current.rows.map((row) => row.commitment.commitmentId);

    expect(ids()).toEqual([1n]);
    act(() => result.current.setLiveness("settled"));
    expect(ids()).toEqual([2n, 3n]);
    act(() => result.current.setLiveness("all"));
    expect(ids()).toEqual([1n, 2n, 3n]);
  });

  it("offers creation in a garden's pool only to its members", () => {
    const gardenPool = poolFixture({ state: "OPEN", poolType: "GARDEN" });
    const { result, rerender } = renderHookWithProviders(() => useGardenPoolController(gardenPool));
    expect(result.current.canCreate).toBe(true);

    // A visitor joins from the garden header; the tab draws no + for them.
    mocks.isMember = false;
    rerender();
    expect(result.current.canCreate).toBe(false);

    // Membership that is still reading, or could not be read, draws no + either.
    mocks.isMember = null;
    rerender();
    expect(result.current.canCreate).toBe(false);
  });

  it("closes creation for lifecycle and protocol permission gates", () => {
    const { result, rerender } = renderHookWithProviders(
      ({ targetPool }) => useGardenPoolController(targetPool),
      {
        initialProps: {
          targetPool: poolFixture({ state: "CLOSED", poolType: "GARDEN" }),
        },
      }
    );
    expect(result.current.isParticipating).toBe(false);
    expect(result.current.canCreate).toBe(false);

    // Membership alone does not open the protocol pool: its stewards start promises.
    rerender({ targetPool: poolFixture({ state: "OPEN", poolType: "PROTOCOL" }) });
    expect(result.current.isParticipating).toBe(true);
    expect(result.current.canCreate).toBe(false);

    mocks.hasRole = true;
    rerender({ targetPool: poolFixture({ state: "OPEN", poolType: "PROTOCOL" }) });
    expect(result.current.canCreate).toBe(true);
  });

  it("knows whether the reader stewards the pool only once the role reads answer", () => {
    const targetPool = poolFixture({ state: "NOT_READY", poolType: "GARDEN" });
    const { result, rerender } = renderHookWithProviders(() => useGardenPoolController(targetPool));
    expect(result.current.stewardsPool).toBe(false);

    mocks.roleRead = { isLoading: true, error: null };
    rerender();
    expect(result.current.stewardsPool).toBeNull();

    mocks.roleRead = { isLoading: false, error: new Error("RPC unavailable") };
    rerender();
    expect(result.current.stewardsPool).toBeNull();

    mocks.hasRole = true;
    rerender();
    expect(result.current.stewardsPool).toBe(true);
  });
});
