/** @vitest-environment jsdom */

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
});
