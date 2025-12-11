/**
 * JobQueueProvider Tests
 *
 * Tests for the job queue context provider and its hooks.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies - use vi.hoisted to ensure mocks are available at hoist time
const { mockJobQueue, mockUseAuth, mockUseUser } = vi.hoisted(() => ({
  mockJobQueue: {
    getStats: vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 }),
    flush: vi.fn().mockResolvedValue({ processed: 0, failed: 0, skipped: 0 }),
    subscribe: vi.fn(() => vi.fn()),
    hasPendingJobs: vi.fn().mockResolvedValue(false),
    getPendingCount: vi.fn().mockResolvedValue(0),
  },
  mockUseAuth: vi.fn(),
  mockUseUser: vi.fn(),
}));

vi.mock("../../modules/job-queue", () => ({
  jobQueue: mockJobQueue,
}));

vi.mock("../../hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../hooks/auth/useUser", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
  queueToasts: {
    jobCompleted: vi.fn(),
    syncSuccess: vi.fn(),
    syncError: vi.fn(),
    stillQueued: vi.fn(),
    queueClear: vi.fn(),
  },
}));

vi.mock("../../config/react-query", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
  },
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

import {
  JobQueueProvider,
  useJobQueue,
  useQueueStats,
  useQueueFlush,
} from "../../providers/JobQueue";
import { queueToasts } from "../../components/toast";

describe("providers/JobQueueProvider", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JobQueueProvider, null, children)
      );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    // Default mock values
    mockUseAuth.mockReturnValue({ authMode: "passkey" });
    mockUseUser.mockReturnValue({
      smartAccountAddress: "0xSmartAccount",
      smartAccountClient: { account: { address: "0xSmartAccount" } },
    });
    mockJobQueue.getStats.mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useJobQueue", () => {
    it("provides initial stats", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.stats).toEqual({ total: 0, pending: 0, failed: 0, synced: 0 });
      });
    });

    it("provides isProcessing state", () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it("provides hasPendingJobs function", async () => {
      mockJobQueue.hasPendingJobs.mockResolvedValue(true);

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const hasPending = await result.current.hasPendingJobs();
      expect(hasPending).toBe(true);
    });

    it("provides getPendingCount function", async () => {
      mockJobQueue.getPendingCount.mockResolvedValue(5);

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const count = await result.current.getPendingCount();
      expect(count).toBe(5);
    });
  });

  describe("useQueueStats", () => {
    it("returns queue stats", async () => {
      mockJobQueue.getStats.mockResolvedValue({ total: 10, pending: 3, failed: 1, synced: 6 });

      const { result } = renderHook(() => useQueueStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current).toEqual({ total: 10, pending: 3, failed: 1, synced: 6 });
      });
    });
  });

  describe("useQueueFlush", () => {
    it("returns flush function", () => {
      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current).toBe("function");
    });

    it("flush calls jobQueue.flush with smart account client", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 2, failed: 0, skipped: 0 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(mockJobQueue.flush).toHaveBeenCalledWith({
        smartAccountClient: expect.objectContaining({ account: { address: "0xSmartAccount" } }),
      });
    });

    it("shows success toast when jobs are processed", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 3, failed: 0, skipped: 0 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(queueToasts.syncSuccess).toHaveBeenCalledWith(3);
    });

    it("shows error toast when jobs fail", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 0, failed: 2, skipped: 0 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(queueToasts.syncError).toHaveBeenCalled();
    });

    it("shows queued toast when jobs are skipped", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 0, failed: 0, skipped: 2 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(queueToasts.stillQueued).toHaveBeenCalled();
    });

    it("shows clear toast when no jobs to process", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 0, failed: 0, skipped: 0 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(queueToasts.queueClear).toHaveBeenCalled();
    });
  });

  describe("event subscription", () => {
    it("subscribes to job queue events on mount", () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      expect(mockJobQueue.subscribe).toHaveBeenCalled();
    });

    it("unsubscribes from events on unmount", () => {
      const mockUnsubscribe = vi.fn();
      mockJobQueue.subscribe.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("auto-flush behavior", () => {
    it("auto-flushes for passkey users when online", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockUseAuth.mockReturnValue({ authMode: "passkey" });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockJobQueue.flush).toHaveBeenCalled();
      });
    });

    it("does not auto-flush for wallet users", async () => {
      mockUseAuth.mockReturnValue({ authMode: "wallet" });
      mockUseUser.mockReturnValue({
        smartAccountAddress: null,
        smartAccountClient: null,
      });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      // Wait a bit to ensure flush wasn't called
      await new Promise((r) => setTimeout(r, 100));

      // Flush should not be called for wallet mode
      expect(mockJobQueue.flush).not.toHaveBeenCalled();
    });
  });
});
