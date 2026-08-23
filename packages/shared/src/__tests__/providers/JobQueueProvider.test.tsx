/**
 * @vitest-environment jsdom
 *
 * JobQueueProvider Tests
 *
 * Tests for the job queue context provider and its hooks.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSharedQueryClient } = vi.hoisted(() => ({
  mockSharedQueryClient: {
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
  },
}));

// Mock auth hooks - these will be configured in beforeEach
vi.mock("../../hooks/auth/useAuth", () => ({
  useAuth: vi.fn(() => ({ authMode: "passkey", walletAddress: null })),
}));

vi.mock("../../hooks/auth/useUser", () => ({
  useUser: vi.fn(() => ({
    smartAccountAddress: "0xSmartAccount",
    eoa: null,
  })),
}));

// Mock useTransactionSender to avoid wagmi provider dependency
const mockTransactionSender = {
  sendContractCall: vi.fn().mockResolvedValue({ hash: "0xabc123", sponsored: true }),
  supportsSponsorship: true,
  supportsBatching: false,
  authMode: "passkey" as const,
};

vi.mock("../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: vi.fn(() => mockTransactionSender),
}));

// Mock primary address hook
vi.mock("../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: vi.fn(() => "0xSmartAccount"),
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
  queryClient: mockSharedQueryClient,
}));

vi.mock("../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/blockchain")>()),
  DEFAULT_CHAIN_ID: 11155111,
}));

import { queueToasts } from "../../components/toast";
import { queryKeys } from "../../config/query-keys";
import { useAuth } from "../../hooks/auth/useAuth";
import { usePrimaryAddress } from "../../hooks/auth/usePrimaryAddress";
import { useUser } from "../../hooks/auth/useUser";
import { useTransactionSender } from "../../hooks/blockchain/useTransactionSender";
import { createFakeJobQueueHandle } from "../test-utils/job-queue-fakes";
import type { JobQueueHandle } from "../../modules/job-queue";
import type { QueueEvent } from "@green-goods/shared/types";
import {
  JobQueueProvider,
  useJobQueue,
  useQueueFlush,
  useQueueStats,
} from "../../providers/JobQueue";

// Type helpers for mocked functions
const mockJobQueue = vi.mocked(createFakeJobQueueHandle());
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseUser = useUser as ReturnType<typeof vi.fn>;
const mockUsePrimaryAddress = usePrimaryAddress as ReturnType<typeof vi.fn>;
const mockUseTransactionSender = useTransactionSender as ReturnType<typeof vi.fn>;

describe("providers/JobQueueProvider", () => {
  let queryClient: QueryClient;

  const createWrapper = (queue: JobQueueHandle = mockJobQueue) => {
    return ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JobQueueProvider, { queue, children })
      );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    // Reset mock implementations
    mockUseAuth.mockReturnValue({ authMode: "passkey", walletAddress: null });
    mockUseUser.mockReturnValue({
      smartAccountAddress: "0xSmartAccount",
      eoa: null,
    });
    mockUseTransactionSender.mockReturnValue(mockTransactionSender);
    mockUsePrimaryAddress.mockReturnValue("0xSmartAccount");
    mockJobQueue.getStats.mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useJobQueue", () => {
    it("uses an injected queue handle", async () => {
      const injectedQueue = {
        ...mockJobQueue,
        getStats: vi.fn().mockResolvedValue({ total: 4, pending: 3, failed: 1, synced: 0 }),
      };

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(injectedQueue),
      });

      await waitFor(() => {
        expect(result.current.stats).toEqual({ total: 4, pending: 3, failed: 1, synced: 0 });
      });
      expect(injectedQueue.getStats).toHaveBeenCalledWith("0xSmartAccount");
    });

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

    it("flush calls jobQueue.flush with smart account client and userAddress", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 2, failed: 0, skipped: 0 });

      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current();
      });

      expect(mockJobQueue.flush).toHaveBeenCalledWith({
        transactionSender: mockTransactionSender,
        userAddress: "0xSmartAccount",
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

    it("invalidates recipient-scoped approval reads when an approval job completes", async () => {
      let subscribedHandler: ((event: QueueEvent) => void) | undefined;
      mockJobQueue.subscribe.mockImplementation((handler: (event: QueueEvent) => void) => {
        subscribedHandler = handler;
        return vi.fn();
      });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await act(async () => {
        subscribedHandler?.({
          type: "job_completed",
          jobId: "approval-job-1",
          txHash: "0xabc",
          job: {
            id: "approval-job-1",
            kind: "approval",
            chainId: 11155111,
            payload: {
              actionUID: 1,
              workUID: "work-1",
              gardenAddress: "0xgarden",
              gardenerAddress: "0xgardener",
              approved: true,
              confidence: 1,
              verificationMethod: 1,
            },
            createdAt: Date.now(),
            attempts: 0,
            synced: true,
            userAddress: "0xuser",
          },
        });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSharedQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.approvals.all,
        });
      });
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
      mockUseAuth.mockReturnValue({ authMode: "wallet", walletAddress: "0xWallet123" });
      mockUseUser.mockReturnValue({
        smartAccountAddress: null,
        eoa: { address: "0xWallet123" },
      });
      mockUsePrimaryAddress.mockReturnValue("0xWallet123");
      mockUseTransactionSender.mockReturnValue(null);

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockJobQueue.getStats).toHaveBeenCalled();
      });

      // Flush should not be called for wallet mode
      expect(mockJobQueue.flush).not.toHaveBeenCalled();
    });

    it("surfaces auto-flush failures through lastEvent and queue sync error toast", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockUseAuth.mockReturnValue({ authMode: "passkey" });
      mockJobQueue.flush.mockRejectedValueOnce(new Error("Queue flush exploded"));

      const { result } = renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(queueToasts.syncError).toHaveBeenCalled();
      });

      expect(result.current.lastEvent).toEqual({
        type: "job_failed",
        jobId: "queue-flush",
        error: "Queue flush exploded",
      });
      expect(result.current.isProcessing).toBe(false);
    });
  });
});
