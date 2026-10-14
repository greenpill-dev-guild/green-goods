import { QueryClient } from "@tanstack/react-query";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let sharedTestQueryClient: QueryClient | null = null;

export function getTestQueryClient(): QueryClient {
  if (!sharedTestQueryClient) {
    sharedTestQueryClient = createTestQueryClient();
  }
  return sharedTestQueryClient;
}

export function resetTestQueryClient(): void {
  sharedTestQueryClient?.clear();
  sharedTestQueryClient = null;
}
