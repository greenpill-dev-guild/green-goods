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

// Stable across renders, as react-intl's own shape is, so the provider's toasts
// stay referentially stable and its effects do not resubscribe on every render.
const intl = vi.hoisted(() => ({
  formatMessage: ({ defaultMessage, id }: { id: string; defaultMessage?: string }) =>
    defaultMessage ?? id,
}));
vi.mock("react-intl", () => ({ useIntl: () => intl }));

// The provider builds its toasts through createQueueToasts, so the spies live
// behind that call rather than on the module's unlocalized export.
const queueToasts = vi.hoisted(() => ({
  jobCompleted: vi.fn(),
  jobFailed: vi.fn(),
  syncSuccess: vi.fn(),
  syncError: vi.fn(),
  retryFailed: vi.fn(),
  stillQueued: vi.fn(),
  queueClear: vi.fn(),
}));
vi.mock("../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
  createQueueToasts: vi.fn(() => queueToasts),
}));

vi.mock("../../config/react-query", () => ({
  queryClient: mockSharedQueryClient,
}));

vi.mock("../../hooks/work/useQueueConfirmationSync", () => ({
  useQueueConfirmationSync: vi.fn(),
}));
vi.mock("../../hooks/work/useWorkUploadPreparation", () => ({
  useWorkUploadPreparation: vi.fn(),
}));
const scheduleUploadPreparation = vi.hoisted(() => vi.fn());
vi.mock("../../modules/work/upload-preparation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/work/upload-preparation")>()),
  scheduleUploadPreparation,
}));

vi.mock("../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/blockchain")>()),
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { useQueueConfirmationSync } from "../../hooks/work/useQueueConfirmationSync";
import { COMMITMENT_JOB_KINDS } from "../../modules/commitment-pooling/job-types";
import { queryKeys } from "../../config/query-keys";
import { useAuth } from "../../hooks/auth/useAuth";
import { usePrimaryAddress } from "../../hooks/auth/usePrimaryAddress";
import { useUser } from "../../hooks/auth/useUser";
import { useTransactionSender } from "../../hooks/blockchain/useTransactionSender";
import { connectivityStore } from "../../stores/connectivity";
import { createFakeJobQueueHandle } from "../test-utils/job-queue-fakes";
import type { JobQueueHandle } from "../../modules/job-queue";
import type { Job, QueueEvent } from "@green-goods/shared/types";
import { JobQueueProvider, useJobQueue, useQueueStats } from "../../providers/JobQueue";

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

  beforeEach(async () => {
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
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await connectivityStore.check();
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

    it("stops showing work as sending once it goes back to waiting, whatever it waits for", async () => {
      const subscribedHandlers = new Set<(event: QueueEvent) => void>();
      mockJobQueue.subscribe.mockImplementation((handler: (event: QueueEvent) => void) => {
        subscribedHandlers.add(handler);
        return () => {
          subscribedHandlers.delete(handler);
        };
      });
      const work = {
        id: "work-job-1",
        kind: "work",
        chainId: 11155111,
        payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", title: "Weeding" },
        createdAt: Date.now(),
        attempts: 0,
        synced: false,
        userAddress: "0xuser",
      } as Job;
      const { result } = renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      for (const waitingReason of ["send-intent-expired", "photo-conversion-pending"]) {
        await act(async () => {
          subscribedHandlers.forEach((handler) =>
            handler({ type: "job_processing", jobId: work.id, job: work })
          );
        });
        await waitFor(() => expect(result.current.isProcessing).toBe(true));
        await act(async () => {
          subscribedHandlers.forEach((handler) =>
            handler({
              type: "job_added",
              jobId: work.id,
              job: { ...work, meta: { waitingForDependency: true, waitingReason } },
            })
          );
        });
        await waitFor(() => expect(result.current.isProcessing).toBe(false));
      }
    });

    it("invalidates recipient-scoped approval reads when an approval job completes", async () => {
      const subscribedHandlers = new Set<(event: QueueEvent) => void>();
      mockJobQueue.subscribe.mockImplementation((handler: (event: QueueEvent) => void) => {
        subscribedHandlers.add(handler);
        return () => {
          subscribedHandlers.delete(handler);
        };
      });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await act(async () => {
        subscribedHandlers.forEach((handler) =>
          handler({
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
          })
        );
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
    it("auto-sends only a passkey's commitment acts; work and decisions wait for Upload all", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockUseAuth.mockReturnValue({ authMode: "passkey" });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockJobQueue.flush).toHaveBeenCalledWith(
          expect.objectContaining({ kinds: COMMITMENT_JOB_KINDS })
        );
      });
      const [context] = mockJobQueue.flush.mock.calls[0];
      expect(context.kinds).not.toContain("work");
      expect(context.kinds).not.toContain("approval");
    });

    it("keeps sending everything for an embedded wallet, which has no Upload all batch", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockUseAuth.mockReturnValue({ authMode: "embedded" });

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => expect(mockJobQueue.flush).toHaveBeenCalled());
      expect(mockJobQueue.flush.mock.calls[0][0]).not.toHaveProperty("kinds");
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

    it("waits for canonical online recovery before auto-flushing", async () => {
      const queue = createFakeJobQueueHandle();
      queue.getStats = vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      await connectivityStore.check();
      expect(connectivityStore.getStatusSnapshot().state).toBe("offline");

      renderHook(() => useJobQueue(), { wrapper: createWrapper(queue) });
      await waitFor(() => expect(queue.getStats).toHaveBeenCalled());
      expect(queue.flush).not.toHaveBeenCalled();

      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await act(() => connectivityStore.check());

      await waitFor(() => expect(queue.flush).toHaveBeenCalledTimes(1));
    });

    it("never auto-flushes on a connection that is online but unconfirmed", async () => {
      const queue = createFakeJobQueueHandle();
      queue.getStats = vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
      const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
      try {
        renderHook(() => useJobQueue(), { wrapper: createWrapper(queue) });
        await waitFor(() => expect(queue.getStats).toHaveBeenCalled());
        await act(() => connectivityStore.check());
        expect(queue.flush).not.toHaveBeenCalled();

        confirmed.mockReturnValue(true);
        await act(() => connectivityStore.check());
        await waitFor(() => expect(queue.flush).toHaveBeenCalledTimes(1));
      } finally {
        confirmed.mockRestore();
      }
    });

    it("confirms the connection before a background sync request flushes", async () => {
      const queue = createFakeJobQueueHandle();
      queue.getStats = vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
      let requestSync: (() => void) | undefined;
      vi.mocked(queue.onBackgroundSyncRequested).mockImplementation((listener) => {
        requestSync = listener;
        return () => undefined;
      });
      const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
      const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
      try {
        renderHook(() => useJobQueue(), { wrapper: createWrapper(queue) });
        await waitFor(() => expect(requestSync).toBeDefined());
        await act(async () => requestSync?.());
        expect(confirm).toHaveBeenCalled();
        expect(queue.flush).not.toHaveBeenCalled();
      } finally {
        confirmed.mockRestore();
        confirm.mockRestore();
      }
    });

    it("wakes preparation on a background sync request, for a wallet too, and sends nothing", async () => {
      mockUseAuth.mockReturnValue({ authMode: "wallet" });
      const queue = createFakeJobQueueHandle();
      queue.getStats = vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 });
      let requestSync: (() => void) | undefined;
      vi.mocked(queue.onBackgroundSyncRequested).mockImplementation((listener) => {
        requestSync = listener;
        return () => undefined;
      });

      renderHook(() => useJobQueue(), { wrapper: createWrapper(queue) });
      await waitFor(() => expect(requestSync).toBeDefined());
      scheduleUploadPreparation.mockClear();
      await act(async () => requestSync?.());

      expect(scheduleUploadPreparation).toHaveBeenCalledOnce();
      expect(queue.flush).not.toHaveBeenCalled();
    });

    it("surfaces auto-flush failures through lastEvent and queue sync error toast", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      mockUseAuth.mockReturnValue({ authMode: "passkey" });
      mockJobQueue.flush.mockRejectedValueOnce(new Error("Queue flush exploded"));

      const { result } = renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(queueToasts.syncError).toHaveBeenCalled();
      });

      // A whole batch failed here and the next connectivity event retries it,
      // so this site keeps the batch wording the explicit retry cannot use.
      expect(queueToasts.retryFailed).not.toHaveBeenCalled();
      expect(result.current.lastEvent).toEqual({
        type: "job_failed",
        jobId: "queue-flush",
        error: "Queue flush exploded",
      });
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe("retrying one job", () => {
    const renderWithQueue = (processed: Awaited<ReturnType<JobQueueHandle["processJob"]>>) => {
      const queue = createFakeJobQueueHandle();
      queue.getStats = vi.fn().mockResolvedValue({ total: 1, pending: 1, failed: 1, synced: 0 });
      vi.mocked(queue.processJob).mockResolvedValue(processed);
      return { queue, ...renderHook(() => useJobQueue(), { wrapper: createWrapper(queue) }) };
    };

    it("sends only the job the person chose, as their own tap", async () => {
      // No automatic flush may run beside it in this test.
      const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
      try {
        const { queue, result } = renderWithQueue({ success: true, txHash: "0xabc" });

        await act(async () => result.current.retryAndSend("commitment-job-1"));

        expect(queue.retryJob).toHaveBeenCalledWith("commitment-job-1");
        expect(queue.processJob).toHaveBeenCalledWith("commitment-job-1", {
          transactionSender: mockTransactionSender,
          explicit: true,
        });
        expect(queue.flush).not.toHaveBeenCalled();
        expect(queueToasts.syncSuccess).toHaveBeenCalledWith(1);
      } finally {
        confirmed.mockRestore();
      }
    });

    it("names the one act when an explicit retry gives up, and never the whole batch", async () => {
      const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
      try {
        const { result } = renderWithQueue({
          success: false,
          error: "Max retries (3) exceeded",
        });

        await act(async () => result.current.retryAndSend("commitment-job-1"));

        expect(queueToasts.retryFailed).toHaveBeenCalledOnce();
        expect(queueToasts.syncError).not.toHaveBeenCalled();
      } finally {
        confirmed.mockRestore();
      }
    });

    it("says the job is still queued when it cannot be sent now", async () => {
      const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
      try {
        const { result } = renderWithQueue({
          success: false,
          error: "connection-unconfirmed",
          skipped: true,
        });

        await act(async () => result.current.retryAndSend("commitment-job-1"));

        expect(queueToasts.stillQueued).toHaveBeenCalledOnce();
        expect(queueToasts.syncError).not.toHaveBeenCalled();
      } finally {
        confirmed.mockRestore();
      }
    });
  });

  describe("queue confirmation wiring", () => {
    it("hands the confirmation pass its queue, sender, and address, and never flushes for a wallet", async () => {
      mockUseAuth.mockReturnValue({
        authMode: "wallet",
        walletAddress: "0xWallet123",
        externalWalletConnected: true,
      });
      mockUsePrimaryAddress.mockReturnValue("0xWallet123");

      renderHook(() => useJobQueue(), { wrapper: createWrapper() });
      await waitFor(() => {
        expect(mockJobQueue.getStats).toHaveBeenCalled();
      });

      expect(useQueueConfirmationSync).toHaveBeenCalledWith({
        queue: mockJobQueue,
        sender: mockTransactionSender,
        userAddress: "0xWallet123",
        refreshStats: expect.any(Function),
      });
      expect(mockJobQueue.flush).not.toHaveBeenCalled();
    });
  });
});
