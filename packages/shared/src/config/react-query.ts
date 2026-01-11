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

// Offline-first QueryClient: prefer cache, retry on failure, refetch on reconnect
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnReconnect: "always",
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 2,
    },
  },
});

// Resume paused mutations on reconnect
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void queryClient.resumePausedMutations();
  });
}
