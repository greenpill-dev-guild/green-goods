/**
 * useMyWorks Hook
 *
 * Fetches works submitted by the current user with optional offline merging and time filtering.
 *
 * @module hooks/work/useMyWorks
 */

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getWorksByGardener } from "../../modules/data/eas";
import { filterByTimeRange, sortByCreatedAt, type TimeFilter } from "../../utils/time";
import { deduplicateById, mergeAndDeduplicateByClientId } from "../../utils/work/deduplication";
import { fetchOfflineWorks } from "../../utils/work/offline";
import { useUser } from "../auth/useUser";

export interface UseMyWorksOptions {
  /**
   * Include offline (queued) works in the result
   * @default false
   */
  includeOffline?: boolean;

  /**
   * Filter works by time range
   */
  timeFilter?: TimeFilter;

  /**
   * Limit number of results
   * @default 50
   */
  limit?: number;

  /**
   * Chain ID to query
   * @default DEFAULT_CHAIN_ID
   */
  chainId?: number;
}

/**
 * Hook for fetching works submitted by the current user
 *
 * Features:
 * - Fetches online works from EAS/indexer
 * - Optionally merges offline works from job queue
 * - Deduplicates by ID and clientWorkId
 * - Optionally filters by time range
 * - Sorts by creation time (newest first)
 *
 * @param options - Configuration options
 * @returns Query result with user's works
 *
 * @example
 * ```tsx
 * // Fetch online works only
 * const { data: works } = useMyWorks();
 *
 * // Include offline works
 * const { data: allWorks } = useMyWorks({ includeOffline: true });
 *
 * // Filter by time
 * const { data: recentWorks } = useMyWorks({ timeFilter: "week" });
 * ```
 */
export function useMyWorks(options: UseMyWorksOptions = {}) {
  const { includeOffline = false, timeFilter, limit = 50, chainId = DEFAULT_CHAIN_ID } = options;
  const { user } = useUser();
  const activeAddress = user?.id;

  return useQuery({
    queryKey: ["myWorks", activeAddress, chainId, includeOffline, timeFilter, limit],
    queryFn: async () => {
      if (!activeAddress) return [];

      // Fetch online works
      const onlineWorksRaw = await getWorksByGardener(activeAddress, chainId);

      // Deduplicate online works
      let works = deduplicateById(onlineWorksRaw);

      // Merge offline works if requested
      if (includeOffline) {
        const offlineWorks = await fetchOfflineWorks(activeAddress);
        works = mergeAndDeduplicateByClientId(works, offlineWorks);
      }

      // Filter by time if specified
      if (timeFilter) {
        works = filterByTimeRange(works, timeFilter);
      }

      // Sort and limit
      const sorted = sortByCreatedAt(works);
      return sorted.slice(0, limit);
    },
    enabled: !!activeAddress,
    staleTime: includeOffline ? 10_000 : 30_000, // Faster refresh when including offline
  });
}

/**
 * Hook for fetching only online works (no offline merging)
 *
 * Convenience wrapper around useMyWorks with includeOffline=false.
 */
export function useMyOnlineWorks(options: Omit<UseMyWorksOptions, "includeOffline"> = {}) {
  return useMyWorks({ ...options, includeOffline: false });
}

/**
 * Hook for fetching merged online + offline works
 *
 * Convenience wrapper around useMyWorks with includeOffline=true.
 */
export function useMyMergedWorks(options: Omit<UseMyWorksOptions, "includeOffline"> = {}) {
  return useMyWorks({ ...options, includeOffline: true });
}
