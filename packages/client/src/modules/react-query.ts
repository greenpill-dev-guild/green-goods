import { QueryClient } from "@tanstack/react-query";

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
