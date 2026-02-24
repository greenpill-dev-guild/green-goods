/**
 * useBatchWorkApproval Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the batch work approval mutation hook including auth mode branching,
 * optimistic updates, error rollback, and query invalidation.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockWork,
  createMockWorkApprovalDraft,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
} from "../../test-utils/mock-factories";
import type { Work } from "../../../types/domain";

// ============================================
// Mocks
// ============================================

const mockSubmitBatchDirectly = vi.fn();
const mockSubmitBatchWithPasskey = vi.fn();

vi.mock("../../../modules/work/wallet-submission", () => ({
  submitBatchApprovalsDirectly: (...args: unknown[]) => mockSubmitBatchDirectly(...args),
}));

vi.mock("../../../modules/work/passkey-submission", () => ({
  submitBatchApprovalsWithPasskey: (...args: unknown[]) => mockSubmitBatchWithPasskey(...args),
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseAndFormatError: vi.fn(() => ({
    title: "Error",
    message: "Something went wrong",
    parsed: {
      name: "UnknownError",
      message: "Something went wrong",
      isKnown: false,
      recoverable: false,
    },
  })),
}));

vi.mock("../../../utils/app/haptics", () => ({
  hapticError: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock("../../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Auth mode mock state
let mockAuthMode: "wallet" | "passkey" | null = "wallet";
let mockSmartAccountClient: any = null;

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: mockAuthMode,
    smartAccountClient: mockSmartAccountClient,
  }),
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

import { useBatchWorkApproval } from "../../../hooks/work/useBatchWorkApproval";
import { queryKeys } from "../../../hooks/query-keys";

// ============================================
// Test helpers
// ============================================

const TEST_CHAIN_ID = 11155111;

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

function createBatchItems(count: number, approved = true) {
  return Array.from({ length: count }, (_, i) => ({
    draft: createMockWorkApprovalDraft({
      workUID: `work-${i}`,
      actionUID: i + 1,
      approved,
    }),
    work: createMockWork({
      id: `work-${i}`,
      gardenAddress: MOCK_ADDRESSES.garden,
      gardenerAddress: MOCK_ADDRESSES.gardener,
      actionUID: i + 1,
    }),
  }));
}

// ============================================
// Tests
// ============================================

describe("useBatchWorkApproval", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockAuthMode = "wallet";
    mockSmartAccountClient = null;
    mockSubmitBatchDirectly.mockResolvedValue(MOCK_TX_HASH);
    mockSubmitBatchWithPasskey.mockResolvedValue(MOCK_TX_HASH);
  });

  // ------------------------------------------
  // Input validation
  // ------------------------------------------

  describe("input validation", () => {
    it("throws when submitting empty items array", async () => {
      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync([]);
        } catch (e) {
          expect((e as Error).message).toBe("No items to approve");
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ------------------------------------------
  // Wallet mode
  // ------------------------------------------

  describe("wallet mode", () => {
    beforeEach(() => {
      mockAuthMode = "wallet";
    });

    it("submits batch approvals via wallet submission module", async () => {
      const items = createBatchItems(3);

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(items);
      });

      expect(mockSubmitBatchDirectly).toHaveBeenCalledOnce();
      expect(mockSubmitBatchWithPasskey).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.data?.count).toBe(3);
        expect(result.current.data?.hash).toBe(MOCK_TX_HASH);
      });
    });

    it("maps items to approval format with garden/gardener addresses", async () => {
      const items = createBatchItems(2);

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(items);
      });

      const callArgs = mockSubmitBatchDirectly.mock.calls[0][0];
      expect(callArgs).toHaveLength(2);
      expect(callArgs[0]).toHaveProperty("draft");
      expect(callArgs[0]).toHaveProperty("gardenAddress", MOCK_ADDRESSES.garden);
      expect(callArgs[0]).toHaveProperty("gardenerAddress", MOCK_ADDRESSES.gardener);
    });
  });

  // ------------------------------------------
  // Passkey mode
  // ------------------------------------------

  describe("passkey mode", () => {
    beforeEach(() => {
      mockAuthMode = "passkey";
      mockSmartAccountClient = {
        account: { address: MOCK_ADDRESSES.smartAccount },
        chain: { id: TEST_CHAIN_ID },
        sendTransaction: vi.fn(),
      };
    });

    it("submits batch approvals via passkey submission module", async () => {
      const items = createBatchItems(2);

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(items);
      });

      expect(mockSubmitBatchWithPasskey).toHaveBeenCalledOnce();
      expect(mockSubmitBatchDirectly).not.toHaveBeenCalled();
      expect(result.current.data?.count).toBe(2);
    });

    it("passes smart account client to passkey submission", async () => {
      const items = createBatchItems(1);

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(items);
      });

      const callArgs = mockSubmitBatchWithPasskey.mock.calls[0][0];
      expect(callArgs.client).toBe(mockSmartAccountClient);
      expect(callArgs.chainId).toBe(TEST_CHAIN_ID);
      expect(callArgs.approvals).toHaveLength(1);
    });

    it("throws when smart account client is unavailable", async () => {
      mockSmartAccountClient = null;
      const items = createBatchItems(1);

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(items);
        } catch (e) {
          expect((e as Error).message).toContain("Smart account not available");
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  // ------------------------------------------
  // Optimistic updates
  // ------------------------------------------

  describe("optimistic updates", () => {
    it("optimistically updates work status during mutation", async () => {
      const items = createBatchItems(1, true);
      const gardenAddr = items[0].work.gardenAddress;

      // Seed the cache with existing works
      const existingWorks: Work[] = [
        createMockWork({
          id: "work-0",
          gardenAddress: gardenAddr,
          status: "pending",
        }),
      ];

      queryClient.setQueryData(queryKeys.works.merged(gardenAddr, TEST_CHAIN_ID), existingWorks);

      // Delay resolution so we can observe optimistic state
      let resolveSubmit!: (value: string) => void;
      mockSubmitBatchDirectly.mockReturnValue(
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
      );

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      // Start mutation (don't await)
      const mutationPromise = act(async () => {
        const promise = result.current.mutateAsync(items);
        // Give React time to process onMutate
        await new Promise((r) => setTimeout(r, 10));

        // Check optimistic update applied
        const cached = queryClient.getQueryData<any[]>(
          queryKeys.works.merged(gardenAddr, TEST_CHAIN_ID)
        );

        if (cached) {
          const updatedWork = cached.find((w: any) => w.id === "work-0");
          expect(updatedWork?.status).toBe("approved");
          expect(updatedWork?._isPending).toBe(true);
        }

        // Now resolve
        resolveSubmit(MOCK_TX_HASH);
        return promise;
      });

      await mutationPromise;
    });
  });

  // ------------------------------------------
  // Error handling & rollback
  // ------------------------------------------

  describe("error handling", () => {
    it("rolls back optimistic updates on mutation error", async () => {
      const items = createBatchItems(1, true);
      const gardenAddr = items[0].work.gardenAddress;

      // Seed cache
      const originalWorks: Work[] = [
        createMockWork({
          id: "work-0",
          gardenAddress: gardenAddr,
          status: "pending",
        }),
      ];

      queryClient.setQueryData(queryKeys.works.merged(gardenAddr, TEST_CHAIN_ID), originalWorks);

      queryClient.setQueryData(queryKeys.works.online(gardenAddr, TEST_CHAIN_ID), originalWorks);

      // Make submission fail
      mockSubmitBatchDirectly.mockRejectedValue(new Error("Wallet rejected"));

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(items);
        } catch {
          // Expected
        }
      });

      // Verify rollback: data should be restored to original
      await waitFor(() => {
        const mergedData = queryClient.getQueryData<Work[]>(
          queryKeys.works.merged(gardenAddr, TEST_CHAIN_ID)
        );
        expect(mergedData?.[0]?.status).toBe("pending");
      });
    });

    it("reports error state on mutation failure", async () => {
      mockSubmitBatchDirectly.mockRejectedValue(new Error("Gas estimation failed"));

      const items = createBatchItems(2);
      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(items);
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toBe("Gas estimation failed");
      });
    });
  });

  // ------------------------------------------
  // Query invalidation on success
  // ------------------------------------------

  describe("query invalidation", () => {
    it("invalidates work queries on success", async () => {
      const items = createBatchItems(1);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useBatchWorkApproval(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(items);
      });

      // Should invalidate works.online, works.merged, and workApprovals.all
      const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
      expect(invalidatedKeys).toContainEqual(
        queryKeys.works.online(MOCK_ADDRESSES.garden, TEST_CHAIN_ID)
      );
      expect(invalidatedKeys).toContainEqual(
        queryKeys.works.merged(MOCK_ADDRESSES.garden, TEST_CHAIN_ID)
      );
      expect(invalidatedKeys).toContainEqual(queryKeys.workApprovals.all);

      invalidateSpy.mockRestore();
    });
  });
});
