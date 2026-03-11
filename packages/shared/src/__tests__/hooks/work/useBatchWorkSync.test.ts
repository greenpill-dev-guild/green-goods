/**
 * useBatchWorkSync Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the batch work synchronization hook for wallet users.
 * Covers auth mode validation, transaction flow, job cleanup,
 * query invalidation, and error handling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockGetWalletClient = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock("@wagmi/core", () => ({
  getWalletClient: (...args: unknown[]) => mockGetWalletClient(...args),
  waitForTransactionReceipt: (...args: unknown[]) => mockWaitForTransactionReceipt(...args),
}));

const mockGetJobsWithImages = vi.fn();
vi.mock("../../../modules/job-queue", () => ({
  jobQueue: {
    getJobsWithImages: (...args: unknown[]) => mockGetJobsWithImages(...args),
  },
  jobQueueDB: {
    markJobSynced: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn().mockResolvedValue(undefined),
  },
  jobQueueEventBus: {
    emit: vi.fn(),
  },
}));

const mockEncodeWorkData = vi.fn();
vi.mock("../../../utils/eas/encoders", () => ({
  encodeWorkData: (...args: unknown[]) => mockEncodeWorkData(...args),
}));

const mockBuildBatchWorkAttestTx = vi.fn();
vi.mock("../../../utils/eas/transaction-builder", () => ({
  buildBatchWorkAttestTx: (...args: unknown[]) => mockBuildBatchWorkAttestTx(...args),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getEASConfig: () => ({
    address: "0xEAS",
    schemaUID: "0xSchema",
  }),
}));

let mockAuthMode: "wallet" | "passkey" | "embedded" | null = "wallet";
let mockPrimaryAddress: string | null = MOCK_ADDRESSES.user;

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockPrimaryAddress,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: mockAuthMode,
  }),
}));

vi.mock("../../../components/toast", () => ({
  queueToasts: {
    queueClear: vi.fn(),
    syncSuccess: vi.fn(),
    syncError: vi.fn(),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
}));

import { queueToasts } from "../../../components/toast";
import { useBatchWorkSync } from "../../../hooks/work/useBatchWorkSync";
import { jobQueueDB, jobQueueEventBus } from "../../../modules/job-queue";

// ============================================
// Test helpers
// ============================================

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createMockPendingJob(id: string, gardenAddress = MOCK_ADDRESSES.garden) {
  return {
    job: {
      id,
      kind: "work",
      payload: {
        actionUID: 1,
        gardenAddress,
        feedback: "Test work",
        title: "Test Work",
      },
      createdAt: Date.now(),
      attempts: 0,
      synced: false,
      userAddress: MOCK_ADDRESSES.user,
    },
    images: [],
  };
}

// ============================================
// Tests
// ============================================

describe("useBatchWorkSync", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockAuthMode = "wallet";
    mockPrimaryAddress = MOCK_ADDRESSES.user;

    // Default mocks for successful flow
    mockGetJobsWithImages.mockResolvedValue([]);
    mockEncodeWorkData.mockResolvedValue("0xEncodedData");
    mockBuildBatchWorkAttestTx.mockReturnValue({
      to: "0xEAS",
      data: "0xTxData",
      value: 0n,
    });
    mockGetWalletClient.mockResolvedValue({
      account: { address: MOCK_ADDRESSES.user },
      chain: { id: 11155111 },
      sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });
  });

  // ------------------------------------------
  // Auth validation
  // ------------------------------------------

  describe("auth validation", () => {
    it("throws when auth mode is not wallet", async () => {
      mockAuthMode = "passkey";

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch (e) {
          expect((e as Error).message).toContain("only available in wallet mode");
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("throws when primary address is not available", async () => {
      mockPrimaryAddress = null;

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch (e) {
          expect((e as Error).message).toContain("Wallet address not available");
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ------------------------------------------
  // Empty queue
  // ------------------------------------------

  describe("empty queue", () => {
    it("returns count 0 when no pending jobs", async () => {
      mockGetJobsWithImages.mockResolvedValue([]);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => {
        expect(result.current.data?.count).toBe(0);
        expect(result.current.data?.gardens).toEqual([]);
      });
    });

    it("shows queue clear toast on empty queue", async () => {
      mockGetJobsWithImages.mockResolvedValue([]);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(queueToasts.queueClear).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Successful sync
  // ------------------------------------------

  describe("successful sync", () => {
    it("encodes, builds tx, sends, and returns result", async () => {
      const jobs = [createMockPendingJob("job-1"), createMockPendingJob("job-2")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => {
        expect(result.current.data?.count).toBe(2);
        expect(result.current.data?.hash).toBe(MOCK_TX_HASH);
      });
      expect(mockEncodeWorkData).toHaveBeenCalledTimes(2);
      expect(mockBuildBatchWorkAttestTx).toHaveBeenCalledOnce();
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledOnce();
    });

    it("deduplicates garden addresses in result", async () => {
      const jobs = [
        createMockPendingJob("job-1", MOCK_ADDRESSES.garden),
        createMockPendingJob("job-2", MOCK_ADDRESSES.garden),
      ];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => {
        expect(result.current.data?.gardens).toHaveLength(1);
      });
    });

    it("marks jobs as synced and deletes them", async () => {
      const jobs = [createMockPendingJob("job-1")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(jobQueueDB.markJobSynced).toHaveBeenCalledWith("job-1", MOCK_TX_HASH);
      expect(jobQueueDB.deleteJob).toHaveBeenCalledWith("job-1");
    });

    it("emits job:completed and queue:sync-completed events", async () => {
      const jobs = [createMockPendingJob("job-1")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(jobQueueEventBus.emit).toHaveBeenCalledWith(
        "job:completed",
        expect.objectContaining({
          jobId: "job-1",
          txHash: MOCK_TX_HASH,
        })
      );
      expect(jobQueueEventBus.emit).toHaveBeenCalledWith(
        "queue:sync-completed",
        expect.objectContaining({
          result: { processed: 1, failed: 0, skipped: 0 },
        })
      );
    });

    it("shows sync success toast", async () => {
      const jobs = [createMockPendingJob("job-1")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(queueToasts.syncSuccess).toHaveBeenCalledWith(1);
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("throws when wallet client is not connected", async () => {
      mockGetJobsWithImages.mockResolvedValue([createMockPendingJob("job-1")]);
      mockGetWalletClient.mockResolvedValue(null);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch (e) {
          expect((e as Error).message).toContain("Wallet not connected");
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("shows sync error toast on failure", async () => {
      mockGetJobsWithImages.mockResolvedValue([createMockPendingJob("job-1")]);
      mockGetWalletClient.mockRejectedValue(new Error("Connection failed"));

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch {
          // Expected
        }
      });

      expect(queueToasts.syncError).toHaveBeenCalled();
    });

    it("continues marking/deleting remaining jobs even if one fails", async () => {
      const jobs = [createMockPendingJob("job-1"), createMockPendingJob("job-2")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // First markJobSynced fails, second succeeds
      (jobQueueDB.markJobSynced as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      // Both jobs should still be processed
      expect(jobQueueDB.markJobSynced).toHaveBeenCalledTimes(2);
      expect(jobQueueDB.deleteJob).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------
  // Query invalidation
  // ------------------------------------------

  describe("query invalidation", () => {
    it("invalidates queue and work queries on success", async () => {
      const jobs = [createMockPendingJob("job-1")];
      mockGetJobsWithImages.mockResolvedValue(jobs);

      const mockWalletClient = {
        account: { address: MOCK_ADDRESSES.user },
        chain: { id: 11155111 },
        sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      };
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useBatchWorkSync(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      // Should have invalidated multiple query keys
      expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

      invalidateSpy.mockRestore();
    });
  });
});
