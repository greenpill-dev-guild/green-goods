/**
 * Storage Quota Hook
 *
 * React hook for monitoring browser storage quota usage.
 * Provides reactive access to storage quota information that components
 * can use to show warnings when storage is running low.
 *
 * Uses React Query for caching with a slow stale time since storage
 * quota doesn't change frequently.
 *
 * @module hooks/storage/useStorageQuota
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import {
  getStorageQuota,
  isStorageQuotaSupported,
  trackStorageQuota,
  type StorageQuotaInfo,
  type StorageQuotaThresholds,
} from "../../utils/storage/quota";
import { STALE_TIME_RARE } from "../query-keys";

// ============================================================================
// QUERY KEYS
// ============================================================================

const STORAGE_QUOTA_KEY = ["greengoods", "storage", "quota"] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface UseStorageQuotaOptions extends Partial<StorageQuotaThresholds> {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
  /** Whether to track quota to analytics on first load (default: false) */
  trackOnLoad?: boolean;
  /** Source identifier for analytics tracking */
  trackingSource?: string;
}

export interface UseStorageQuotaResult extends StorageQuotaInfo {
  /** Whether the query is currently loading */
  isLoading: boolean;
  /** Whether there was an error fetching quota */
  isError: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch quota information */
  refetch: () => Promise<void>;
  /** Whether the Storage API is supported */
  isSupported: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to monitor browser storage quota usage.
 *
 * Returns reactive storage quota information that updates when refetched.
 * Includes utility flags for low/critical storage warnings.
 *
 * @param options - Configuration options
 * @returns Storage quota information with loading/error states
 *
 * @example
 * ```typescript
 * function StorageWarning() {
 *   const { isLow, isCritical, percentUsed, used, quota } = useStorageQuota();
 *
 *   if (isCritical) {
 *     return (
 *       <Alert variant="destructive">
 *         Storage critically low ({percentUsed.toFixed(0)}% used).
 *         Please free up space.
 *       </Alert>
 *     );
 *   }
 *
 *   if (isLow) {
 *     return (
 *       <Alert variant="warning">
 *         Storage running low ({percentUsed.toFixed(0)}% used).
 *       </Alert>
 *     );
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useStorageQuota(options: UseStorageQuotaOptions = {}): UseStorageQuotaResult {
  const {
    enabled = true,
    trackOnLoad = false,
    trackingSource = "useStorageQuota",
    lowThreshold,
    criticalThreshold,
  } = options;

  const queryClient = useQueryClient();
  const isSupported = isStorageQuotaSupported();

  // Query for storage quota
  // Include threshold params in query key so caching works correctly when they change
  const {
    data,
    isLoading,
    isError,
    error,
    refetch: queryRefetch,
  } = useQuery<StorageQuotaInfo, Error>({
    queryKey: [...STORAGE_QUOTA_KEY, { lowThreshold, criticalThreshold }],
    queryFn: () => getStorageQuota({ lowThreshold, criticalThreshold }),
    // Storage quota changes slowly, use longer stale time
    staleTime: STALE_TIME_RARE,
    // Keep in cache for longer
    gcTime: STALE_TIME_RARE * 2,
    // Only enable if Storage API is supported
    enabled: enabled && isSupported,
    // Retry once on failure
    retry: 1,
    // Don't refetch on window focus (quota doesn't change that fast)
    refetchOnWindowFocus: false,
  });

  // Track quota on initial load if requested (use ref to prevent duplicate tracking)
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (trackOnLoad && data && !isLoading && !hasTrackedRef.current) {
      hasTrackedRef.current = true;
      void trackStorageQuota(trackingSource);
    }
  }, [trackOnLoad, trackingSource, data, isLoading]);

  // Refetch function that also invalidates cache
  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STORAGE_QUOTA_KEY });
    await queryRefetch();
  }, [queryClient, queryRefetch]);

  // Default values when data is not available
  const defaultQuota: StorageQuotaInfo = {
    used: 0,
    quota: 0,
    percentUsed: 0,
    isLow: false,
    isCritical: false,
  };

  return {
    ...(data ?? defaultQuota),
    isLoading,
    isError,
    error: error ?? null,
    refetch,
    isSupported,
  };
}

/**
 * Hook to check storage quota before an operation.
 *
 * Returns a function that checks if there's enough storage and
 * optionally tracks the check to analytics.
 *
 * @example
 * ```typescript
 * function WorkSubmitForm() {
 *   const checkStorage = useStorageQuotaCheck();
 *
 *   const handleSubmit = async (data) => {
 *     const { hasSpace, quota } = await checkStorage(5 * 1024 * 1024); // 5MB
 *
 *     if (!hasSpace) {
 *       toast.error("Not enough storage space. Please free up space.");
 *       return;
 *     }
 *
 *     await submitWork(data);
 *   };
 * }
 * ```
 */
export function useStorageQuotaCheck() {
  return useCallback(
    async (
      requiredBytes: number = 0,
      options: { trackSource?: string } = {}
    ): Promise<{
      hasSpace: boolean;
      quota: StorageQuotaInfo;
    }> => {
      const quota = await getStorageQuota();

      // Track if we're checking for specific space requirements
      if (requiredBytes > 0 && options.trackSource) {
        void trackStorageQuota(options.trackSource);
      }

      // If we can't determine quota, assume we have space
      if (quota.quota === 0) {
        return { hasSpace: true, quota };
      }

      const availableBytes = quota.quota - quota.used;
      // Leave 10% safety margin
      const safetyBuffer = quota.quota * 0.1;
      const hasSpace = availableBytes - safetyBuffer >= requiredBytes;

      return { hasSpace, quota };
    },
    []
  );
}
