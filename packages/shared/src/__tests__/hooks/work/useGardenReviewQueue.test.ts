/**
 * @vitest-environment jsdom
 */

import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { workSessionStartedAt } from "../../../hooks/work/gardenWorkListQuery";
import { useGardenReviewQueue } from "../../../hooks/work/useGardenReviewQueue";
import type { GardenReviewQueue } from "../../../types/garden-detail";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111";
const WORK_LIST = worksKeys.online(GARDEN, DEFAULT_CHAIN_ID);
const FIRST: GardenReviewQueue = { lastReviewedAt: 100, waiting: [] };
const SECOND: GardenReviewQueue = { lastReviewedAt: 200, waiting: [] };
const THIRD: GardenReviewQueue = { lastReviewedAt: 300, waiting: [] };

const mocks = vi.hoisted(() => ({ readGardenReviewQueue: vi.fn() }));
vi.mock("../../../modules/data/eas-review-queue", () => ({
  readGardenReviewQueue: mocks.readGardenReviewQueue,
}));

function queryClientWithWorkList() {
  const queryClient = createTestQueryClient();
  // No screen observes the work list here: keep its entry, so its
  // invalidations and reads still reach the queue.
  queryClient.setQueryDefaults(WORK_LIST, { gcTime: Number.POSITIVE_INFINITY });
  return queryClient;
}

describe("useGardenReviewQueue", () => {
  it("reads a garden this session, and again whenever its work list is refreshed or read", async () => {
    mocks.readGardenReviewQueue
      .mockResolvedValueOnce(FIRST)
      .mockResolvedValueOnce(SECOND)
      .mockResolvedValueOnce(THIRD);
    const queryClient = queryClientWithWorkList();
    queryClient.setQueryData(WORK_LIST, []);

    const { result } = renderHookWithQueryClient(() => useGardenReviewQueue(GARDEN), {
      queryClient,
    });

    await waitFor(() => expect(result.current).toEqual(FIRST));
    expect(mocks.readGardenReviewQueue).toHaveBeenCalledWith(GARDEN, { chainId: DEFAULT_CHAIN_ID });

    // What a decision and its follow-ups do to the work list.
    await queryClient.invalidateQueries({ queryKey: WORK_LIST });
    await waitFor(() => expect(result.current).toEqual(SECOND));

    // A cache write is not a read; a fetched read is, invalidated or not.
    queryClient.setQueryData(WORK_LIST, []);
    await queryClient.fetchQuery({ queryKey: WORK_LIST, queryFn: () => [] });
    await waitFor(() => expect(result.current).toEqual(THIRD));
    expect(mocks.readGardenReviewQueue).toHaveBeenCalledTimes(3);
  });

  it("says nothing for a copy restored from storage, or one a failed refresh left behind", async () => {
    mocks.readGardenReviewQueue.mockReset();
    const restoredClient = queryClientWithWorkList();
    restoredClient.setQueryData(worksKeys.reviewQueue(GARDEN, DEFAULT_CHAIN_ID), FIRST, {
      updatedAt: workSessionStartedAt() - 1,
    });

    const restored = renderHookWithQueryClient(
      () => useGardenReviewQueue(GARDEN, { enabled: false }),
      { queryClient: restoredClient }
    );

    expect(restored.result.current).toBeUndefined();
    expect(mocks.readGardenReviewQueue).not.toHaveBeenCalled();

    mocks.readGardenReviewQueue
      .mockResolvedValueOnce(FIRST)
      .mockRejectedValueOnce(new Error("EAS unavailable"));
    const queryClient = queryClientWithWorkList();
    const refreshed = renderHookWithQueryClient(() => useGardenReviewQueue(GARDEN), {
      queryClient,
    });
    await waitFor(() => expect(refreshed.result.current).toEqual(FIRST));

    await queryClient.invalidateQueries({
      queryKey: worksKeys.reviewQueue(GARDEN, DEFAULT_CHAIN_ID),
    });

    await waitFor(() => expect(refreshed.result.current).toBeUndefined());
  });
});
