/** @vitest-environment jsdom */

/**
 * useCommitmentCompletionRefresh — what a reader sees after their act lands.
 *
 * Queueing an act refreshes the commitment reads, but the act is sent later, and
 * nothing refreshed them again when it completed: the pending chip cleared and
 * the commitment underneath still showed its old state. The indexer also trails
 * the receipt, so one refresh at completion is not enough either.
 */

import type { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitmentPoolingKeys } from "../config/query-keys/commitment-pooling";
import { INDEXER_LAG_SCHEDULE_MS } from "../config/query-keys/constants";
import { useCommitmentCompletionRefresh } from "../hooks/commitment-pooling/useCommitmentCompletionRefresh";
import { jobQueueEventBus } from "../modules/job-queue/event-bus";
import type { Job } from "../types/job-queue";
import { createTestWrapper } from "./test-utils";
import { createTestQueryClient } from "./test-utils/query-client";

const CHAIN = 42161;

function completed(kind: string, chainId: number | undefined = CHAIN) {
  const job = { id: "job-1", kind, chainId, payload: {}, synced: true } as unknown as Job;
  jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash: "0xabc" });
}

describe("useCommitmentCompletionRefresh", () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = createTestQueryClient();
    invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    renderHook(() => useCommitmentCompletionRefresh(), {
      wrapper: createTestWrapper(queryClient),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  it("re-reads the chain's commitments when an act lands, then again as the indexer catches up", () => {
    completed("claim");

    const everyCommitmentRead = { queryKey: commitmentPoolingKeys.all(CHAIN) };
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenLastCalledWith(everyCommitmentRead);

    for (const [index, delay] of INDEXER_LAG_SCHEDULE_MS.entries()) {
      vi.advanceTimersByTime(delay - (INDEXER_LAG_SCHEDULE_MS[index - 1] ?? 0));
      expect(invalidate).toHaveBeenCalledTimes(index + 2);
      expect(invalidate).toHaveBeenLastCalledWith(everyCommitmentRead);
    }
  });

  it("leaves work and decisions to the handlers that already refresh them", () => {
    completed("work");
    completed("approval");
    vi.advanceTimersByTime(INDEXER_LAG_SCHEDULE_MS.at(-1) ?? 0);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
