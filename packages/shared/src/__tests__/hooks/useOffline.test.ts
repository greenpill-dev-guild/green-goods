/**
 * useOffline Hook Tests
 *
 * Tests for offline detection, sync status, and queue metrics.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies - use vi.hoisted to ensure mocks are available at hoist time
const { mockFlush, mockJobQueueEventBus } = vi.hoisted(() => ({
  mockFlush: vi.fn(),
  mockJobQueueEventBus: {
    on: vi.fn(() => vi.fn()),
  },
}));

vi.mock("../../modules/job-queue/event-bus", () => ({
  jobQueueEventBus: mockJobQueueEventBus,
  useJobQueueEvents: vi.fn(),
}));

vi.mock("../../providers/JobQueue", () => ({
  useQueueFlush: () => mockFlush,
}));

vi.mock("../work/useWorks", () => ({
  usePendingWorksCount: () => ({ data: 0 }),
  useQueueStatistics: () => ({ data: { pending: 0, failed: 0 } }),
}));

import { useOffline } from "../../hooks/app/useOffline";

describe("hooks/app/useOffline", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Set initial online state
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("initial state", () => {
    it("returns online status based on navigator.onLine", () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("idle");
    });

    it("returns offline when navigator.onLine is false", () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe("online/offline events", () => {
    it("updates to offline when offline event fires", async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(true);

      act(() => {
        Object.defineProperty(navigator, "onLine", { value: false });
        window.dispatchEvent(new Event("offline"));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });

    it("updates to online when online event fires", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(false);

      act(() => {
        Object.defineProperty(navigator, "onLine", { value: true });
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
        expect(result.current.syncStatus).toBe("syncing");
      });
    });
  });

  describe("sync status", () => {
    it("sets sync status to syncing when coming online", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      act(() => {
        Object.defineProperty(navigator, "onLine", { value: true });
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.syncStatus).toBe("syncing");
      });
    });
  });

  describe("queue event subscription", () => {
    it("subscribes to queue:sync-completed event", () => {
      renderHook(() => useOffline(), { wrapper: createWrapper() });

      expect(mockJobQueueEventBus.on).toHaveBeenCalledWith(
        "queue:sync-completed",
        expect.any(Function)
      );
    });

    it("unsubscribes on unmount", () => {
      const mockUnsubscribe = vi.fn();
      mockJobQueueEventBus.on.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("refetch function", () => {
    it("exposes flush function for manual sync", () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.refetch).toBe(mockFlush);
    });
  });

  describe("pending counts", () => {
    it("returns pending count from query", () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.pendingCount).toBe(0);
    });

    it("returns empty pending work array (simplified API)", () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.pendingWork).toEqual([]);
    });
  });
});
