/**
 * @vitest-environment jsdom
 */

import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { workSessionStartedAt } from "../../../hooks/work/gardenWorkListQuery";
import { useGardenReviewQueue } from "../../../hooks/work/useGardenReviewQueue";
import type { GardenReviewQueue } from "../../../types/garden-detail";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111";
const FIRST: GardenReviewQueue = { lastReviewedAt: 100, waiting: [] };
const SECOND: GardenReviewQueue = { lastReviewedAt: 200, waiting: [] };

const mocks = vi.hoisted(() => ({ readGardenReviewQueue: vi.fn() }));
vi.mock("../../../modules/data/eas-review-queue", () => ({
  readGardenReviewQueue: mocks.readGardenReviewQueue,
}));

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useGardenReviewQueue", () => {
  it("speaks for a garden read this session, and reads it again when a decision refreshes its work", async () => {
    mocks.readGardenReviewQueue.mockResolvedValueOnce(FIRST).mockResolvedValueOnce(SECOND);
    const queryClient = newQueryClient();
    // The garden's work list, which an approval and its follow-ups invalidate.
    queryClient.setQueryData(worksKeys.online(GARDEN, DEFAULT_CHAIN_ID), []);

    const { result } = renderHookWithQueryClient(() => useGardenReviewQueue(GARDEN), {
      queryClient,
    });

    await waitFor(() => expect(result.current).toEqual(FIRST));
    expect(mocks.readGardenReviewQueue).toHaveBeenCalledWith(GARDEN, { chainId: DEFAULT_CHAIN_ID });

    await queryClient.invalidateQueries({ queryKey: worksKeys.online(GARDEN, DEFAULT_CHAIN_ID) });

    await waitFor(() => expect(result.current).toEqual(SECOND));
  });

  it("says nothing for a copy restored from storage, or one a failed refresh left behind", async () => {
    mocks.readGardenReviewQueue.mockReset();
    const restoredClient = newQueryClient();
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
    const queryClient = newQueryClient();
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
