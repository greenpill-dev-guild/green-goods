import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { readGardenReviewQueue } from "../../modules/data/eas-review-queue";
import type { GardenReviewQueue } from "../../types/garden-detail";
import { workSessionStartedAt } from "./gardenWorkListQuery";

/**
 * A garden's whole review queue, for a garden with more work than its newest
 * page holds. It speaks only for a read made this session whose latest refresh
 * succeeded: a copy restored from storage, or one a failed refresh left behind,
 * says nothing about the queue now.
 */
export function useGardenReviewQueue(
  gardenId: string,
  { enabled = true }: { enabled?: boolean } = {}
): GardenReviewQueue | undefined {
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: worksKeys.reviewQueue(gardenId, chainId),
    queryFn: () => readGardenReviewQueue(gardenId, { chainId }),
    enabled: enabled && Boolean(gardenId),
    networkMode: "online",
    staleTime: (read) =>
      read.state.dataUpdatedAt < workSessionStartedAt() ? 0 : STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });

  // The garden's whole queue follows its work list. A decision marks the list
  // stale, now and again as the indexer catches up, and every fetched read of
  // the list may find the queue moved. React Query folds a repeat invalidation
  // of a list still stale, so the reads count too; a cache write does not.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated") return;
        const { action } = event;
        const followed =
          action.type === "invalidate" || (action.type === "success" && !action.manual);
        if (!followed) return;
        if (
          JSON.stringify(event.query.queryKey) !==
          JSON.stringify(worksKeys.online(gardenId, chainId))
        )
          return;
        void queryClient.invalidateQueries({ queryKey: worksKeys.reviewQueue(gardenId, chainId) });
      }),
    [queryClient, gardenId, chainId]
  );

  const current =
    query.data !== undefined &&
    !query.isError &&
    !query.isPaused &&
    query.dataUpdatedAt >= workSessionStartedAt();
  return current ? query.data : undefined;
}
