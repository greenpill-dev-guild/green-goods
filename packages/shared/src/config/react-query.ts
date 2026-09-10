import { QueryClient } from "@tanstack/react-query";
import { PERSIST_MAX_AGE } from "./query-cache-policy";
import { connectivityStore } from "../stores/connectivity";

/**
 * Centralized stale time constants for consistent caching behavior
 */
export const STALE_TIMES = {
  /** Gardens, actions, gardeners - base data that changes infrequently */
  baseLists: 5 * 60_000, // 5 minutes
  /** Actions list should refresh faster than other base lists */
  actions: 60_000, // 1 minute
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
  baseLists: PERSIST_MAX_AGE,
  works: PERSIST_MAX_AGE,
  queue: 30_000, // 30 seconds
} as const;

// Offline-first QueryClient: prefer cache, retry on failure, refetch on reconnect
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: PERSIST_MAX_AGE,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnReconnect: "always",
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: false,
    },
  },
});

// Resume paused mutations on reconnect
if (typeof window !== "undefined") {
  connectivityStore.subscribe(() => {
    if (connectivityStore.getSnapshot()) void queryClient.resumePausedMutations();
  });
}
