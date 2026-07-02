/**
 * useReviewerWorks Hook
 *
 * Fetches works for gardens where the user has reviewer privileges,
 * merging online (EAS) and offline (job queue) works with deduplication.
 *
 * @module hooks/work/useReviewerWorks
 */

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { DEFAULT_RETRY_COUNT, queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { logger } from "../../modules/app/logger";
import { getWorks } from "../../modules/data/eas";
import { jobQueue } from "../../modules/job-queue";
import type { Address, Work } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { convertJobsToWorks } from "../../utils/work/offline";

interface ReviewerWorksResult {
  /** Merged and deduplicated works from reviewer gardens */
  works: Work[];
  /**
   * Gardens whose online works fetch failed. Kept out-of-band instead of failing the whole
   * query so the dashboard can still render what loaded, while truth-gated consumers
   * (arrival orientation) treat any failure as "not ready" — a swallowed failure must never
   * read as a successful empty result.
   */
  failedGardenIds: string[];
}

interface UseReviewerWorksResult {
  /** Merged and deduplicated works from reviewer gardens */
  data: Work[];
  /** Gardens whose online fetch failed this cycle (see ReviewerWorksResult). */
  failedGardenIds: string[];
  isLoading: boolean;
  isFetching: boolean;
  /**
   * True only when the query settled successfully. Truth-gated consumers must use this —
   * never `!isLoading`, which is false for a disabled/just-enabled query that hasn't
   * started fetching yet.
   */
  isSuccess: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Fetches works for the given reviewer garden IDs (in parallel), merging online
 * attestations from EAS with offline jobs from the local queue.
 * Deduplicates by matching actionUID + timestamp proximity.
 *
 * Readiness honesty: do NOT add `initialData`/`placeholderData` to this query — either
 * would fake `isSuccess` across an id-set key flip and let the arrival resolver assert
 * an orientation with no data behind it.
 */
export function useReviewerWorks(
  reviewerGardenIds: string[],
  address: Address | undefined
): UseReviewerWorksResult {
  const { data, isLoading, isFetching, isSuccess, isError, refetch } = useQuery({
    queryKey: queryKeys.operatorWorks.byAddress(address, reviewerGardenIds),
    queryFn: async (): Promise<ReviewerWorksResult> => {
      if (!address) return { works: [], failedGardenIds: [] };

      // Offline jobs are viewer-scoped; fetch once and bucket per garden.
      const offlineJobs = await jobQueue.getJobs(address, { kind: "work", synced: false });

      const failedGardenIds: string[] = [];
      const perGarden = await Promise.all(
        reviewerGardenIds.map(async (gardenId) => {
          // Fetch online works from EAS — record per-garden failures instead of masking them
          let online: EASWork[] = [];
          try {
            online = await getWorks([gardenId], DEFAULT_CHAIN_ID);
          } catch (err) {
            logger.warn(`[useReviewerWorks] Failed to fetch works for garden ${gardenId}:`, {
              error: err,
            });
            failedGardenIds.push(gardenId);
          }

          const gardenOfflineJobs = offlineJobs.filter(
            (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
          );
          const offline = await convertJobsToWorks(
            gardenOfflineJobs as Job<WorkJobPayload>[],
            address
          );

          // Merge and deduplicate (prefer online, exclude time-proximate duplicates)
          const workMap = new Map<string, Work>();
          online.forEach((w) => workMap.set(w.id, { ...w, status: "pending" as const }));
          offline.forEach((w) => {
            const isDuplicate = online.some((onlineWork) => {
              const timeDiff = Math.abs(onlineWork.createdAt - w.createdAt);
              return onlineWork.actionUID === w.actionUID && timeDiff < 5 * 60 * 1000;
            });
            if (!isDuplicate) {
              workMap.set(w.id, w);
            }
          });

          return Array.from(workMap.values());
        })
      );

      return {
        works: perGarden.flat().sort((a, b) => b.createdAt - a.createdAt),
        failedGardenIds,
      };
    },
    enabled: reviewerGardenIds.length > 0 && !!address,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  return {
    data: data?.works ?? [],
    failedGardenIds: data?.failedGardenIds ?? [],
    isLoading,
    isFetching,
    isSuccess,
    isError,
    refetch,
  };
}
