import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOffline } from "@/hooks/useOffline";
import type { FlushResult } from "@/modules/job-queue/sync-manager";

// Mock the job queue module
vi.mock("@/modules/job-queue", () => ({
  jobQueue: {
    getPendingCount: vi.fn(),
    getJobs: vi.fn(),
    flush: vi.fn(),
    startPeriodicSync: vi.fn(),
    stopPeriodicSync: vi.fn(),
  },
}));

// Import mocked modules
import { jobQueue } from "@/modules/job-queue";

const mockJobQueue = vi.mocked(jobQueue);

// Test data factories
const createMockJob = (overrides = {}) => ({
  id: `job-${Date.now()}-${Math.random()}`,
  kind: "work",
  payload: {
    title: "Test Work",
    actionUID: 1,
    gardenAddress: "0xgarden123",
    feedback: "Test feedback",
    plantCount: 5,
    plantSelection: ["tree"],
  },
  createdAt: Date.now(),
  synced: false,
  lastError: undefined,
  attempts: 0,
  ...overrides,
});

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

describe("useOffline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset navigator.onLine to true
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    // Setup default mock implementations
    mockJobQueue.getPendingCount.mockResolvedValue(0);
    mockJobQueue.getJobs.mockResolvedValue([]);
    mockJobQueue.flush.mockResolvedValue({ processed: 0, failed: 0, skipped: 0 });
    mockJobQueue.startPeriodicSync.mockImplementation(() => {});
    mockJobQueue.stopPeriodicSync.mockImplementation(() => {});
  });

  describe("Initial State", () => {
    it("should initialize with online status from navigator", async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("idle");
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.pendingWork).toEqual([]);
    });

    it("should initialize with offline status when navigator is offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.syncStatus).toBe("idle");
    });

    it("should start periodic sync on mount", () => {
      renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      expect(mockJobQueue.startPeriodicSync).toHaveBeenCalled();
    });
  });

  describe("Pending Data Fetching", () => {
    it("should fetch pending count from job queue", async () => {
      mockJobQueue.getPendingCount.mockResolvedValue(5);

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(5);
      });

      expect(mockJobQueue.getPendingCount).toHaveBeenCalled();
    });

    it("should fetch pending work items", async () => {
      const mockJobs = [createMockJob({ id: "job-1" }), createMockJob({ id: "job-2" })];
      mockJobQueue.getJobs.mockResolvedValue(mockJobs);

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingWork).toHaveLength(2);
      });

      expect(mockJobQueue.getJobs).toHaveBeenCalledWith({ synced: false });
    });

    it("should handle pending count fetch errors gracefully", async () => {
      mockJobQueue.getPendingCount.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Should still return default value
      expect(result.current.pendingCount).toBe(0);
    });

    it("should handle pending work fetch errors gracefully", async () => {
      mockJobQueue.getJobs.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Should still return default value
      expect(result.current.pendingWork).toEqual([]);
    });
  });

  describe("Online/Offline Event Handling", () => {
    it("should handle online event and trigger sync", async () => {
      const { result } = renderHook(() => useOffline());

      // Set up flush to be async
      let flushResolve: (result: FlushResult) => void;
      const flushPromise = new Promise<FlushResult>((resolve) => {
        flushResolve = resolve;
      });

      mockJobQueue.flush.mockImplementation(() => flushPromise);
      mockJobQueue.getPendingCount.mockResolvedValue(5);

      // Initially offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Go online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("syncing");

      // Resolve flush to complete sync
      await act(async () => {
        flushResolve!({ processed: 3, failed: 0, skipped: 1 });
        await flushPromise;
      });

      // Wait for sync to complete
      await waitFor(() => {
        expect(result.current.syncStatus).toBe("idle");
      });

      expect(mockJobQueue.flush).toHaveBeenCalled();
    });

    it("should handle offline event", async () => {
      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Start online
      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      await act(async () => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOnline).toBe(false);
      // Sync status should remain unchanged when going offline
      expect(result.current.syncStatus).toBe("idle");
    });

    it("should handle sync errors during online event", async () => {
      const { result } = renderHook(() => useOffline());

      const error = new Error("Sync failed");
      mockJobQueue.flush.mockRejectedValue(error);

      // Go online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("syncing");

      // Wait for error state
      await waitFor(() => {
        expect(result.current.syncStatus).toBe("error");
      });
    });
  });

  describe("Refetch Functionality", () => {
    it("should provide refetch function that updates both queries", async () => {
      mockJobQueue.getPendingCount.mockResolvedValue(3);
      mockJobQueue.getJobs.mockResolvedValue([createMockJob()]);

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.pendingCount).toBe(3);
      });

      // Change mock return values
      mockJobQueue.getPendingCount.mockResolvedValue(5);
      mockJobQueue.getJobs.mockResolvedValue([createMockJob(), createMockJob()]);

      // Trigger refetch
      await act(async () => {
        result.current.refetch();
      });

      // Wait for updated values
      await waitFor(() => {
        expect(result.current.pendingCount).toBe(5);
        expect(result.current.pendingWork).toHaveLength(2);
      });
    });
  });

  describe("Cleanup", () => {
    it("should cleanup event listeners and stop sync on unmount", () => {
      const { unmount } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Verify setup was called
      expect(mockJobQueue.startPeriodicSync).toHaveBeenCalled();

      // Add event listeners spy
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      unmount();

      // Verify cleanup
      expect(mockJobQueue.stopPeriodicSync).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("Periodic Refetch", () => {
    it("should refetch pending count periodically", async () => {
      vi.useFakeTimers();

      mockJobQueue.getPendingCount.mockResolvedValue(2);

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Wait for initial call
      await waitFor(() => {
        expect(mockJobQueue.getPendingCount).toHaveBeenCalledTimes(1);
      });

      // Reset mock to track new calls
      mockJobQueue.getPendingCount.mockClear();
      mockJobQueue.getPendingCount.mockResolvedValue(3);

      // Fast-forward 5 seconds (refetchInterval)
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve(); // Flush promises
      });

      // Should be called again
      await waitFor(() => {
        expect(mockJobQueue.getPendingCount).toHaveBeenCalledTimes(1);
      });

      expect(result.current.pendingCount).toBe(3);

      vi.useRealTimers();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete offline to online workflow", async () => {
      const mockJobs = [createMockJob({ id: "pending-job" })];
      mockJobQueue.getPendingCount.mockResolvedValue(1);
      mockJobQueue.getJobs.mockResolvedValue(mockJobs);

      // Start offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOffline(), {
        wrapper: createWrapper(),
      });

      // Verify offline state
      expect(result.current.isOnline).toBe(false);

      // Wait for pending work to load
      await waitFor(() => {
        expect(result.current.pendingCount).toBe(1);
        expect(result.current.pendingWork).toHaveLength(1);
      });

      // Setup for going online
      mockJobQueue.flush.mockResolvedValue({ processed: 1, failed: 0, skipped: 0 });

      // Mock updated values that will be used after sync
      mockJobQueue.getPendingCount.mockResolvedValue(0);
      mockJobQueue.getJobs.mockResolvedValue([]);

      // Simulate coming online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      // Should be syncing
      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("syncing");

      // Wait for sync completion
      await waitFor(
        () => {
          expect(result.current.syncStatus).toBe("idle");
        },
        { timeout: 10000 }
      );

      expect(mockJobQueue.flush).toHaveBeenCalled();

      // Verify data was updated after sync
      await waitFor(() => {
        expect(result.current.pendingCount).toBe(0);
        expect(result.current.pendingWork).toHaveLength(0);
      });
    });
  });
});
