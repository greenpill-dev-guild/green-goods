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

  // A decision refreshes the garden's work list, and again as the indexer
  // catches up; the garden's whole queue follows it.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "invalidate") return;
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
