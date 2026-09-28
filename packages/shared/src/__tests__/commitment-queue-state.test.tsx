/** @vitest-environment happy-dom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentQueueState } from "../hooks/commitment-pooling/useCommitmentQueueState";
import { jobQueueEventBus } from "../modules/job-queue/event-bus";
import type { Job } from "../types/job-queue";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;

const mocks = vi.hoisted(() => ({ getJobs: vi.fn() }));

vi.mock("../modules/job-queue/db", () => ({
  jobQueueDB: { getJobs: (input: unknown) => mocks.getJobs(input) },
}));

function creation(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    kind: "commitment",
    payload: { poolId: 7n, direction: 0, metadata: { title: "Prune" } },
    meta: {},
    chainId: 42161,
    userAddress: VIEWER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    ...overrides,
  };
}

describe("useCommitmentQueueState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-reads the stored job when a flush ends without completing or failing it", async () => {
    // A flush that only parks a creation on its membership preflight rewrites
    // the record without a completed or failed event. The query never goes
    // stale on its own, so the one signal every flush emits has to refresh it,
    // or the row keeps saying "waiting to send" when it is waiting for a hat.
    mocks.getJobs.mockResolvedValueOnce([creation()]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCreates).toHaveLength(1));
    expect(result.current.pendingCreates[0]?.waitingForMembership).toBe(false);

    mocks.getJobs.mockResolvedValueOnce([
      creation({
        meta: { waitingForDependency: true, waitingReason: "membership-unavailable" },
      }),
    ]);
    jobQueueEventBus.emit("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 1 },
    });

    await waitFor(() => expect(result.current.pendingCreates[0]?.waitingForMembership).toBe(true));
  });

  it("preserves terminal link causes and does not offer an impossible retry", async () => {
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "link-1",
        kind: "workLink",
        payload: { commitmentId: 9n },
        attempts: 5,
        lastError: "identity_conflict:membership-lost",
      }),
    ]);

    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));

    await waitFor(() => expect(result.current.failedCount).toBe(1));
    expect(result.current.failedJobs.get("9")).toEqual({
      jobId: "link-1",
      discardable: true,
      reason: "membershipLost",
      retryable: false,
    });
  });

  it("names the act still on this phone for its commitment, with why it waits", async () => {
    // A wallet reader has no background flush, so the screen needs the job
    // itself to offer Send Now and Discard, not only the fact that one exists.
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "claim-1",
        kind: "claim",
        payload: { commitmentId: 9n, gardenAddress: VIEWER },
        meta: { waitingForDependency: true, waitingReason: "membership-unavailable" },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCommitmentIds.has("9")).toBe(true));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      jobId: "claim-1",
      kind: "claim",
      waitingReason: "membership-unavailable",
      discardable: true,
    });
    // A creation names no commitment yet, so it is a pending create, not an act.
    expect(result.current.pendingActs.size).toBe(1);
  });

  it("holds Discard back from an act whose send is on record, and says it is confirming", async () => {
    // The transaction may still land; dropping the job would lose its only
    // local record, so the row confirms it instead.
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "claim-2",
        kind: "claim",
        payload: {
          commitmentId: 9n,
          gardenAddress: VIEWER,
          sendCheckpoint: { broadcastPending: false, transactionHash: `0x${"44".repeat(32)}` },
        },
        attempts: 1,
        lastError: "receipt timeout",
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingActs.has("9")).toBe(true));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      discardable: false,
      waitingReason: "awaiting-confirmation",
    });
  });
});
