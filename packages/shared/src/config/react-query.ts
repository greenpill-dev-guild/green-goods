import { QueryClient } from "@tanstack/react-query";

/**
 * Centralized stale time constants for consistent caching behavior
 */
export const STALE_TIMES = {
  /** Gardens, actions, gardeners - base data that changes infrequently */
  baseLists: 60_000, // 1 minute
  /** Work submissions - changes more frequently */
  works: 15_000, // 15 seconds
  /** Job queue stats - needs to be responsive */
  queue: 5_000, // 5 seconds
  /** Merged online+offline data */
  merged: 5_000, // 5 seconds
} as const;

/**
 * Garbage collection time constants
 */
export const GC_TIMES = {
  baseLists: 30 * 60 * 1000, // 30 minutes
  works: 5 * 60 * 1000, // 5 minutes
  queue: 30_000, // 30 seconds
} as const;

// Configure a shared QueryClient with offline-first defaults
// Queries: prefer cache when offline; refetch on reconnect
// Mutations: queue when offline and resume on reconnect

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      // Reduce churn for base lists
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 1,
    },
  },
});

// Proactively resume paused mutations whenever we regain connectivity
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Best-effort resume; errors surface via individual mutation handlers
    void queryClient.resumePausedMutations();
  });
}
