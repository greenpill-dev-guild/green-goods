/** @vitest-environment jsdom */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenPoolController } from "../../../hooks/client-ui/pool/useGardenPoolController";
import { commitmentFixture, poolFixture, renderHookWithProviders } from "../../test-utils";

const mocks = vi.hoisted(() => ({
  commitments: [] as ReturnType<typeof commitmentFixture>[],
  cycles: [] as Array<{ cycleId: bigint; state: string }>,
  commitmentsInput: null as { cycleId?: bigint } | null,
  pendingCreates: [] as Array<{ jobId: string; poolId: string }>,
  metadata: new Map<string, { title: string }>(),
  hasRole: false,
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
  useHasRole: () => ({ hasRole: mocks.hasRole, isLoading: false }),
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
      { jobId: "job-7", poolId: "7" },
      { jobId: "job-9", poolId: "9" },
    ];
    mocks.metadata = new Map([["request-cid", { title: "Water the orchard" }]]);
    mocks.hasRole = false;
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
    expect(result.current.ownCreations).toEqual([{ jobId: "job-7", poolId: "7" }]);
    expect(result.current.titleOf("request-cid")).toBe("Water the orchard");
    expect(result.current.cycles).toEqual([{ cycleId: 8n, state: "OPEN" }]);
    expect(result.current.canCreate).toBe(true);

    act(() => result.current.setDirection("REQUEST"));
    expect(result.current.rows.map((row) => row.commitment.direction)).toEqual(["REQUEST"]);
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

    rerender({ targetPool: poolFixture({ state: "OPEN", poolType: "PROTOCOL" }) });
    expect(result.current.isParticipating).toBe(true);
    expect(result.current.canCreate).toBe(false);

    mocks.hasRole = true;
    rerender({ targetPool: poolFixture({ state: "OPEN", poolType: "PROTOCOL" }) });
    expect(result.current.canCreate).toBe(true);
  });
});
