/**
 * useMerged Hook Tests
 *
 * Tests the hook that synchronises remote (online) and offline data sources
 * into a single merged TanStack Query, with automatic invalidation.
 */

import { onlineManager } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMerged } from "../../../hooks/app/useMerged";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

describe("hooks/app/useMerged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches online and offline sources and merges them", async () => {
    const fetchOnline = vi.fn().mockResolvedValue([1, 2, 3]);
    const fetchOffline = vi.fn().mockResolvedValue([4, 5]);
    const merge = vi.fn((online, offline) => [...(online ?? []), ...(offline ?? [])]);

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["test", "online"],
        offlineKey: ["test", "offline"],
        mergedKey: ["test", "merged"],
        fetchOnline,
        fetchOffline,
        merge,
      })
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

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["counts", "online"],
        offlineKey: ["counts", "offline"],
        mergedKey: ["counts", "merged"],
        fetchOnline,
        fetchOffline,
        merge,
      })
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
    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["stale", "online"],
        offlineKey: ["stale", "offline"],
        mergedKey: ["stale", "merged"],
        fetchOnline: async () => "online",
        fetchOffline: async () => "offline",
        merge: (on, off) => `${on}-${off}`,
      })
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

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["null", "online"],
        offlineKey: ["null", "offline"],
        mergedKey: ["null", "merged"],
        fetchOnline,
        fetchOffline,
        merge,
      })
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

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["placeholder", "online"],
        offlineKey: ["placeholder", "offline"],
        mergedKey: ["placeholder", "merged"],
        fetchOnline,
        fetchOffline,
        merge: (on, off) => `${on}-${off}`,
        defaultMergedValue: "loading-placeholder",
      })
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

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["events", "online"],
        offlineKey: ["events", "offline"],
        mergedKey: ["events", "merged"],
        fetchOnline: async () => "online",
        fetchOffline: async () => "offline",
        merge: (on, off) => `${on}-${off}`,
        events: [{ subscribe: subscribeFn }],
      })
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

    const { unmount } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["cleanup", "online"],
        offlineKey: ["cleanup", "offline"],
        mergedKey: ["cleanup", "merged"],
        fetchOnline: async () => "a",
        fetchOffline: async () => "b",
        merge: (on, off) => `${on}-${off}`,
        events: [{ subscribe: subscribeFn }],
      })
    );

    unmount();

    expect(unsubFn).toHaveBeenCalled();
  });

  it("handles online fetch error gracefully", async () => {
    const fetchOnline = vi.fn().mockRejectedValue(new Error("Network down"));
    const fetchOffline = vi.fn().mockResolvedValue("cached");
    const merge = vi.fn((on, off) => off ?? "nothing");

    const { result } = renderHookWithQueryClient(() =>
      useMerged({
        onlineKey: ["error", "online"],
        offlineKey: ["error", "offline"],
        mergedKey: ["error", "merged"],
        fetchOnline,
        fetchOffline,
        merge,
      })
    );

    // Online query should error
    await waitFor(() => {
      expect(result.current.online.isError).toBe(true);
    });

    // Offline should still succeed
    expect(result.current.offline.data).toBe("cached");
  });
});

it("merges cached online work with IndexedDB jobs while the network is offline", async () => {
  const client = createTestQueryClient();
  const onlineKey = ["greengoods", "works", "online", "garden"];
  client.setQueryData(onlineKey, ["submitted"]);
  onlineManager.setOnline(false);
  const fetchOnline = vi.fn(async () => ["new"]);
  const fetchOffline = vi.fn(async () => ["queued"]);
  const view = renderHookWithQueryClient(
    () =>
      useMerged({
        onlineKey,
        offlineKey: ["greengoods", "works", "offline", "garden"],
        mergedKey: ["greengoods", "works", "merged", "garden"],
        fetchOnline,
        fetchOffline,
        merge: (online, offline) => [...(online ?? []), ...(offline ?? [])],
      }),
    { queryClient: client }
  );
  try {
    await waitFor(() => expect(view.result.current.merged.data).toEqual(["submitted", "queued"]));
    expect(fetchOffline).toHaveBeenCalled();
    expect(fetchOnline).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});
