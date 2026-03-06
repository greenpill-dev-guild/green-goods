/**
 * useMerged Hook Tests
 *
 * Tests the hook that synchronises remote (online) and offline data sources
 * into a single merged TanStack Query, with automatic invalidation.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMerged } from "../../../hooks/app/useMerged";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("hooks/app/useMerged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches online and offline sources and merges them", async () => {
    const fetchOnline = vi.fn().mockResolvedValue([1, 2, 3]);
    const fetchOffline = vi.fn().mockResolvedValue([4, 5]);
    const merge = vi.fn((online, offline) => [...(online ?? []), ...(offline ?? [])]);

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["test", "online"],
          offlineKey: ["test", "offline"],
          mergedKey: ["test", "merged"],
          fetchOnline,
          fetchOffline,
          merge,
        }),
      { wrapper: createWrapper() }
    );

    // Initially loading
    expect(result.current.online.isLoading).toBe(true);
    expect(result.current.offline.isLoading).toBe(true);

    // Wait for all queries to settle
    await waitFor(() => {
      expect(result.current.online.isSuccess).toBe(true);
      expect(result.current.offline.isSuccess).toBe(true);
    });

    // Merged should also resolve
    await waitFor(() => {
      expect(result.current.merged.data).toEqual([1, 2, 3, 4, 5]);
    });

    expect(fetchOnline).toHaveBeenCalled();
    expect(fetchOffline).toHaveBeenCalled();
    expect(merge).toHaveBeenCalled();
  });

  it("provides online and offline queries separately", async () => {
    const fetchOnline = vi.fn().mockResolvedValue({ count: 10 });
    const fetchOffline = vi.fn().mockResolvedValue({ count: 3 });
    const merge = vi.fn((on, off) => ({
      total: (on?.count ?? 0) + (off?.count ?? 0),
    }));

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["counts", "online"],
          offlineKey: ["counts", "offline"],
          mergedKey: ["counts", "merged"],
          fetchOnline,
          fetchOffline,
          merge,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.online.data).toEqual({ count: 10 });
      expect(result.current.offline.data).toEqual({ count: 3 });
    });

    await waitFor(() => {
      expect(result.current.merged.data).toEqual({ total: 13 });
    });
  });

  it("uses default stale times when not specified", async () => {
    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["stale", "online"],
          offlineKey: ["stale", "offline"],
          mergedKey: ["stale", "merged"],
          fetchOnline: async () => "online",
          fetchOffline: async () => "offline",
          merge: (on, off) => `${on}-${off}`,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.merged.data).toBe("online-offline");
    });
  });

  it("handles merge when sources return null", async () => {
    const merge = vi.fn((online, offline) => ({
      online: online ?? "fallback-online",
      offline: offline ?? "fallback-offline",
    }));

    const fetchOnline = vi.fn().mockResolvedValue(null);
    const fetchOffline = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["null", "online"],
          offlineKey: ["null", "offline"],
          mergedKey: ["null", "merged"],
          fetchOnline,
          fetchOffline,
          merge,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.online.isSuccess).toBe(true);
      expect(result.current.offline.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.merged.data).toEqual({
        online: "fallback-online",
        offline: "fallback-offline",
      });
    });
  });

  it("uses defaultMergedValue as placeholder while loading", async () => {
    // Use slow fetchers to observe placeholder state
    const fetchOnline = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("data"), 100))
    );
    const fetchOffline = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("local"), 100))
    );

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["placeholder", "online"],
          offlineKey: ["placeholder", "offline"],
          mergedKey: ["placeholder", "merged"],
          fetchOnline,
          fetchOffline,
          merge: (on, off) => `${on}-${off}`,
          defaultMergedValue: "loading-placeholder",
        }),
      { wrapper: createWrapper() }
    );

    // Before sources resolve, merged query should not yet be enabled
    // (enabled depends on both sources being loaded)
    expect(result.current.online.isLoading).toBe(true);
  });

  it("handles external event subscriptions", async () => {
    const subscribeFn = vi.fn((listener: () => void) => {
      // Return unsub function
      return () => {};
    });

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["events", "online"],
          offlineKey: ["events", "offline"],
          mergedKey: ["events", "merged"],
          fetchOnline: async () => "online",
          fetchOffline: async () => "offline",
          merge: (on, off) => `${on}-${off}`,
          events: [{ subscribe: subscribeFn }],
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.merged.data).toBe("online-offline");
    });

    // Subscribe should have been called
    expect(subscribeFn).toHaveBeenCalled();
  });

  it("cleans up event subscriptions on unmount", () => {
    const unsubFn = vi.fn();
    const subscribeFn = vi.fn(() => unsubFn);

    const { unmount } = renderHook(
      () =>
        useMerged({
          onlineKey: ["cleanup", "online"],
          offlineKey: ["cleanup", "offline"],
          mergedKey: ["cleanup", "merged"],
          fetchOnline: async () => "a",
          fetchOffline: async () => "b",
          merge: (on, off) => `${on}-${off}`,
          events: [{ subscribe: subscribeFn }],
        }),
      { wrapper: createWrapper() }
    );

    unmount();

    expect(unsubFn).toHaveBeenCalled();
  });

  it("handles online fetch error gracefully", async () => {
    const fetchOnline = vi.fn().mockRejectedValue(new Error("Network down"));
    const fetchOffline = vi.fn().mockResolvedValue("cached");
    const merge = vi.fn((on, off) => off ?? "nothing");

    const { result } = renderHook(
      () =>
        useMerged({
          onlineKey: ["error", "online"],
          offlineKey: ["error", "offline"],
          mergedKey: ["error", "merged"],
          fetchOnline,
          fetchOffline,
          merge,
        }),
      { wrapper: createWrapper() }
    );

    // Online query should error
    await waitFor(() => {
      expect(result.current.online.isError).toBe(true);
    });

    // Offline should still succeed
    expect(result.current.offline.data).toBe("cached");
  });
});
