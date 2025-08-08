import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

type UseMergedOptions<TOnline, TOffline, TMerged> = {
  onlineKey: QueryKey;
  offlineKey: QueryKey;
  mergedKey: QueryKey;
  fetchOnline: () => Promise<TOnline>;
  fetchOffline: () => Promise<TOffline>;
  merge: (online: TOnline, offline: TOffline) => Promise<TMerged> | TMerged;
  events?: Array<{
    subscribe: (listener: () => void) => () => void;
  }>;
  staleTimeOnline?: number;
  staleTimeOffline?: number;
  staleTimeMerged?: number;
  gcTimeOnline?: number;
  gcTimeOffline?: number;
  gcTimeMerged?: number;
};

export function useMerged<TOnline, TOffline, TMerged>(
  options: UseMergedOptions<TOnline, TOffline, TMerged>
) {
  const queryClient = useQueryClient();

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
    queryFn: () => options.merge(onlineQuery.data as TOnline, offlineQuery.data as TOffline),
    enabled: !onlineQuery.isLoading && !offlineQuery.isLoading,
    staleTime: options.staleTimeMerged ?? 5_000,
    gcTime: options.gcTimeMerged ?? 30_000,
  });

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
