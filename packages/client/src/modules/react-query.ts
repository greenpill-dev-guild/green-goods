import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce background refetch frequency for better performance
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount, error: any) => {
        // Smart retry logic
        if (error?.status === 404 || error?.status === 403) {
          return false; // Don't retry for these errors
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      // Global error handling for mutations
      onError: (error: any) => {
        console.error("Mutation error:", error);
        // Could integrate with toast notifications here
      },
    },
  },
});
