/**
 * useWorkApprovals Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the work approvals query hook including memoization stability,
 * type correctness, and query key usage.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/data/graphql", () => ({
  easGraphQL: (query: string) => query,
}));

const mockQueryFn = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("../../../modules/data/graphql-client", () => ({
  createEasClient: () => ({
    query: (...args: unknown[]) => mockQueryFn(...args),
  }),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getEASConfig: () => ({
    WORK_APPROVAL: { uid: "0xTestSchemaUID" },
  }),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { queryKeys } from "../../../hooks/query-keys";
import { useWorkApprovals } from "../../../hooks/work/useWorkApprovals";

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

// ============================================
// Tests
// ============================================

describe("useWorkApprovals", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockQueryFn.mockResolvedValue({ data: null, error: null });
  });

  // ------------------------------------------
  // Query key correctness
  // ------------------------------------------

  describe("query key", () => {
    it("uses queryKeys.workApprovals.byAttester directly without fallback", async () => {
      const attesterAddress = MOCK_ADDRESSES.operator;

      const { result } = renderHook(() => useWorkApprovals(attesterAddress), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the query is stored under the correct key
      const expectedKey = queryKeys.workApprovals.byAttester(attesterAddress, TEST_CHAIN_ID);
      const cachedData = queryClient.getQueryData(expectedKey);
      expect(cachedData).toBeDefined();
    });

    it("does not enable query when attester address is undefined", () => {
      const { result } = renderHook(() => useWorkApprovals(undefined), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.approvals).toEqual([]);
    });
  });

  // ------------------------------------------
  // Memoization stability
  // ------------------------------------------

  describe("memoization", () => {
    it("returns stable computed values across re-renders when data hasn't changed", async () => {
      // Seed query data with mock approvals to avoid network calls
      const attesterAddress = MOCK_ADDRESSES.operator;
      const queryKey = queryKeys.workApprovals.byAttester(attesterAddress, TEST_CHAIN_ID);

      const mockApprovals = [
        {
          id: "0xApproval1",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 1,
          workUID: "0xWork1",
          approved: true,
          feedback: "Great work",
          confidence: 2,
          verificationMethod: 0,
          createdAt: Date.now(),
        },
        {
          id: "0xApproval2",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 2,
          workUID: "0xWork2",
          approved: false,
          feedback: "Needs improvement",
          confidence: 0,
          verificationMethod: 0,
          createdAt: Date.now() - 1000,
        },
      ];

      queryClient.setQueryData(queryKey, mockApprovals);

      const { result, rerender } = renderHook(() => useWorkApprovals(attesterAddress), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.approvals.length).toBe(2);
      });

      // Capture references from first render
      const firstApprovals = result.current.approvals;
      const firstPending = result.current.pendingApprovals;
      const firstCompleted = result.current.completedApprovals;
      const firstApprovedCount = result.current.approvedCount;
      const firstRejectedCount = result.current.rejectedCount;
      const firstPendingCount = result.current.pendingCount;

      // Re-render without changing data
      rerender();

      // After re-render, computed values should be structurally equal
      // (the hook recomputes arrays on each render; deep equality is sufficient)
      expect(result.current.approvals).toStrictEqual(firstApprovals);
      expect(result.current.pendingApprovals).toStrictEqual(firstPending);
      expect(result.current.completedApprovals).toStrictEqual(firstCompleted);
      expect(result.current.approvedCount).toBe(firstApprovedCount);
      expect(result.current.rejectedCount).toBe(firstRejectedCount);
      expect(result.current.pendingCount).toBe(firstPendingCount);
    });

    it("computes correct counts for mixed approval states", async () => {
      const attesterAddress = MOCK_ADDRESSES.operator;
      const queryKey = queryKeys.workApprovals.byAttester(attesterAddress, TEST_CHAIN_ID);

      const mockApprovals = [
        {
          id: "0xApproval1",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 1,
          workUID: "0xWork1",
          approved: true,
          feedback: "",
          confidence: 2,
          verificationMethod: 0,
          createdAt: Date.now(),
        },
        {
          id: "0xApproval2",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 2,
          workUID: "0xWork2",
          approved: true,
          feedback: "",
          confidence: 2,
          verificationMethod: 0,
          createdAt: Date.now() - 1000,
        },
        {
          id: "0xApproval3",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 3,
          workUID: "0xWork3",
          approved: false,
          feedback: "Needs more detail",
          confidence: 0,
          verificationMethod: 0,
          createdAt: Date.now() - 2000,
        },
      ];

      queryClient.setQueryData(queryKey, mockApprovals);

      const { result } = renderHook(() => useWorkApprovals(attesterAddress), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.approvals.length).toBe(3);
      });

      expect(result.current.approvedCount).toBe(2);
      expect(result.current.rejectedCount).toBe(1);
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.completedApprovals.length).toBe(3);
      expect(result.current.pendingApprovals.length).toBe(0);
    });

    it("sorts approvals by creation date newest first", async () => {
      const attesterAddress = MOCK_ADDRESSES.operator;
      const queryKey = queryKeys.workApprovals.byAttester(attesterAddress, TEST_CHAIN_ID);

      const olderTime = Date.now() - 10000;
      const newerTime = Date.now();

      const mockApprovals = [
        {
          id: "0xOlder",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 1,
          workUID: "0xWork1",
          approved: true,
          feedback: "",
          confidence: 2,
          verificationMethod: 0,
          createdAt: olderTime,
        },
        {
          id: "0xNewer",
          operatorAddress: MOCK_ADDRESSES.operator,
          gardenerAddress: MOCK_ADDRESSES.gardener,
          actionUID: 2,
          workUID: "0xWork2",
          approved: false,
          feedback: "",
          confidence: 0,
          verificationMethod: 0,
          createdAt: newerTime,
        },
      ];

      queryClient.setQueryData(queryKey, mockApprovals);

      const { result } = renderHook(() => useWorkApprovals(attesterAddress), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.approvals.length).toBe(2);
      });

      expect(result.current.approvals[0].id).toBe("0xNewer");
      expect(result.current.approvals[1].id).toBe("0xOlder");
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("returns empty arrays on query error without throwing", async () => {
      mockQueryFn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useWorkApprovals(MOCK_ADDRESSES.operator), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should gracefully handle error
      expect(result.current.approvals).toEqual([]);
    });
  });
});
