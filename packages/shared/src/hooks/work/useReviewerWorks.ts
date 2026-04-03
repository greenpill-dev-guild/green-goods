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
import { logger } from "../../modules/app/logger";
import { getWorks } from "../../modules/data/eas";
import { jobQueue } from "../../modules/job-queue";
import type { Address, Work } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { convertJobsToWorks } from "../../utils/work/offline";
import { queryKeys, STALE_TIME_MEDIUM, DEFAULT_RETRY_COUNT } from "../query-keys";

interface UseReviewerWorksResult {
  /** Merged and deduplicated works from reviewer gardens */
  data: Work[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Fetches works for the given reviewer garden IDs, merging online
 * attestations from EAS with offline jobs from the local queue.
 * Deduplicates by matching actionUID + timestamp proximity.
 */
export function useReviewerWorks(
  reviewerGardenIds: string[],
  address: Address | undefined,
): UseReviewerWorksResult {
  const {
    data = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.operatorWorks.byAddress(address, reviewerGardenIds),
    queryFn: async () => {
      if (!address) return [];
      const allWorks: Work[] = [];

      for (const gardenId of reviewerGardenIds) {
        // Fetch online works from EAS — gracefully handle per-garden failures
        let online: EASWork[] = [];
        try {
          online = await getWorks([gardenId], DEFAULT_CHAIN_ID);
        } catch (err) {
          logger.warn(`[useReviewerWorks] Failed to fetch works for garden ${gardenId}:`, {
            error: err,
          });
        }

        // Fetch offline works from job queue (scoped to current user)
        const offlineJobs = await jobQueue.getJobs(address, { kind: "work", synced: false });
        const gardenOfflineJobs = offlineJobs.filter(
          (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId,
        );

        const offline = await convertJobsToWorks(
          gardenOfflineJobs as Job<WorkJobPayload>[],
          address,
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

        allWorks.push(...Array.from(workMap.values()));
      }

      return allWorks.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: reviewerGardenIds.length > 0 && !!address,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  return { data, isLoading, isFetching, isError, refetch };
}
