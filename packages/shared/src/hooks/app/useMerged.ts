import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/** Configuration for combining online and offline sources into a merged query. */
type UseMergedOptions<TOnline, TOffline, TMerged> = {
  onlineKey: QueryKey;
  offlineKey: QueryKey;
  mergedKey: QueryKey;
  fetchOnline: () => Promise<TOnline>;
  fetchOffline: () => Promise<TOffline>;
  merge: (online: TOnline | undefined, offline: TOffline | undefined) => Promise<TMerged> | TMerged;
  events?: Array<{
    subscribe: (listener: () => void) => () => void;
  }>;
  staleTimeOnline?: number;
  staleTimeOffline?: number;
  staleTimeMerged?: number;
  gcTimeOnline?: number;
  gcTimeOffline?: number;
  gcTimeMerged?: number;
  /** Default value for merged data when sources are loading */
  defaultMergedValue?: TMerged;
};

/** Synchronises remote data with offline caches and exposes dedicated queries for each source. */
export function useMerged<TOnline, TOffline, TMerged>(
  options: UseMergedOptions<TOnline, TOffline, TMerged>
) {
  const queryClient = useQueryClient();
  // Track previous data timestamps to detect updates
  const prevOnlineUpdatedAt = useRef<number | undefined>(undefined);
  const prevOfflineUpdatedAt = useRef<number | undefined>(undefined);

  const onlineQuery = useQuery({
    queryKey: options.onlineKey,
    queryFn: options.fetchOnline,
    staleTime: options.staleTimeOnline ?? 30_000,
    gcTime: options.gcTimeOnline ?? 300_000,
  });

  const offlineQuery = useQuery({
    queryKey: options.offlineKey,
    queryFn: options.fetchOffline,
    staleTime: options.staleTimeOffline ?? 5_000,
    gcTime: options.gcTimeOffline ?? 30_000,
  });

  const mergedQuery = useQuery({
    queryKey: options.mergedKey,
    queryFn: async () => {
      // Handle undefined data gracefully - pass to merge function to handle
      return options.merge(onlineQuery.data, offlineQuery.data);
    },
    // Enable only when BOTH sources are done loading to prevent race conditions
    // where merge runs before online data arrives (offline is much faster)
    enabled: !onlineQuery.isLoading && !offlineQuery.isLoading,
    staleTime: options.staleTimeMerged ?? 5_000,
    gcTime: options.gcTimeMerged ?? 30_000,
    // Use placeholder data for smoother transitions
    // Cast is safe: defaultMergedValue is TMerged which satisfies NonFunctionGuard<TMerged>
    placeholderData: (previousData) =>
      (previousData ?? options.defaultMergedValue) as typeof previousData,
  });

  // Invalidate merged query when source data changes
  useEffect(() => {
    const onlineUpdatedAt = onlineQuery.dataUpdatedAt;
    const offlineUpdatedAt = offlineQuery.dataUpdatedAt;

    // Check if either source has new data
    const hasNewOnlineData = onlineUpdatedAt > 0 && onlineUpdatedAt !== prevOnlineUpdatedAt.current;
    const hasNewOfflineData =
      offlineUpdatedAt > 0 && offlineUpdatedAt !== prevOfflineUpdatedAt.current;

    if (hasNewOnlineData || hasNewOfflineData) {
      // Update refs
      prevOnlineUpdatedAt.current = onlineUpdatedAt;
      prevOfflineUpdatedAt.current = offlineUpdatedAt;

      // Invalidate merged query to trigger re-merge
      queryClient.invalidateQueries({ queryKey: options.mergedKey });
    }
  }, [onlineQuery.dataUpdatedAt, offlineQuery.dataUpdatedAt, options.mergedKey, queryClient]);

  // Handle external events (job queue updates, etc.)
  useEffect(() => {
    const unsubs = (options.events || []).map(({ subscribe }) =>
      subscribe(() => {
        queryClient.invalidateQueries({ queryKey: options.offlineKey });
        queryClient.invalidateQueries({ queryKey: options.mergedKey });
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [options.events, options.offlineKey, options.mergedKey, queryClient]);

  return {
    online: onlineQuery,
    offline: offlineQuery,
    merged: mergedQuery,
  };
}
