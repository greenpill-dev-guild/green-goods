/**
 * useMyWorks Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the user works query hook including online fetching,
 * offline merging, deduplication, time filtering, and pagination.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_ADDRESSES, createMockWork } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockGetWorksByGardener = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorksByGardener: (...args: unknown[]) => mockGetWorksByGardener(...args),
}));

const mockFetchOfflineWorks = vi.fn();
vi.mock("../../../utils/work/offline", () => ({
  fetchOfflineWorks: (...args: unknown[]) => mockFetchOfflineWorks(...args),
}));

const mockDeduplicateById = vi.fn((works: any[]) => works);
const mockMergeAndDeduplicateByClientId = vi.fn((online: any[], offline: any[]) => [
  ...online,
  ...offline,
]);
vi.mock("../../../utils/work/deduplication", () => ({
  deduplicateById: (...args: unknown[]) => mockDeduplicateById(...args),
  mergeAndDeduplicateByClientId: (...args: unknown[]) => mockMergeAndDeduplicateByClientId(...args),
}));

const mockFilterByTimeRange = vi.fn((works: any[]) => works);
const mockSortByCreatedAt = vi.fn((works: any[]) =>
  [...works].sort((a: any, b: any) => b.createdAt - a.createdAt)
);
vi.mock("../../../utils/time", () => ({
  filterByTimeRange: (...args: unknown[]) => mockFilterByTimeRange(...args),
  sortByCreatedAt: (...args: unknown[]) => mockSortByCreatedAt(...args),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

let mockUser: { id: string; address: string } | null = {
  id: MOCK_ADDRESSES.user,
  address: MOCK_ADDRESSES.user,
};

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    user: mockUser,
  }),
}));

import { useMyWorks, useMyOnlineWorks } from "../../../hooks/work/useMyWorks";

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

// ============================================
// Tests
// ============================================

describe("useMyWorks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockUser = { id: MOCK_ADDRESSES.user, address: MOCK_ADDRESSES.user };
    mockGetWorksByGardener.mockResolvedValue([]);
    mockFetchOfflineWorks.mockResolvedValue([]);
  });

  // ------------------------------------------
  // Basic fetching
  // ------------------------------------------

  describe("basic fetching", () => {
    it("fetches works for the current user", async () => {
      const works = [
        createMockWork({ id: "work-1", createdAt: Date.now() }),
        createMockWork({ id: "work-2", createdAt: Date.now() - 1000 }),
      ];
      mockGetWorksByGardener.mockResolvedValue(works);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetWorksByGardener).toHaveBeenCalledWith(MOCK_ADDRESSES.user, 11155111);
      expect(result.current.data).toHaveLength(2);
    });

    it("returns empty array when no works exist", async () => {
      mockGetWorksByGardener.mockResolvedValue([]);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it("does not fetch when user is not authenticated", async () => {
      mockUser = null;

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      // Query should be disabled
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(mockGetWorksByGardener).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Deduplication
  // ------------------------------------------

  describe("deduplication", () => {
    it("deduplicates online works by ID", async () => {
      const works = [
        createMockWork({ id: "work-1" }),
        createMockWork({ id: "work-1" }), // Duplicate
      ];
      mockGetWorksByGardener.mockResolvedValue(works);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDeduplicateById).toHaveBeenCalledWith(works);
    });
  });

  // ------------------------------------------
  // Offline merging
  // ------------------------------------------

  describe("offline merging", () => {
    it("does not fetch offline works by default", async () => {
      mockGetWorksByGardener.mockResolvedValue([]);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchOfflineWorks).not.toHaveBeenCalled();
    });

    it("merges offline works when includeOffline is true", async () => {
      const onlineWorks = [createMockWork({ id: "online-1" })];
      const offlineWorks = [createMockWork({ id: "offline-1" })];

      mockGetWorksByGardener.mockResolvedValue(onlineWorks);
      mockFetchOfflineWorks.mockResolvedValue(offlineWorks);
      mockDeduplicateById.mockReturnValue(onlineWorks);
      mockMergeAndDeduplicateByClientId.mockReturnValue([...onlineWorks, ...offlineWorks]);

      const { result } = renderHook(() => useMyWorks({ includeOffline: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetchOfflineWorks).toHaveBeenCalledWith(MOCK_ADDRESSES.user);
      expect(mockMergeAndDeduplicateByClientId).toHaveBeenCalledWith(onlineWorks, offlineWorks);
    });
  });

  // ------------------------------------------
  // Time filtering
  // ------------------------------------------

  describe("time filtering", () => {
    it("does not filter by time when timeFilter is not provided", async () => {
      mockGetWorksByGardener.mockResolvedValue([createMockWork()]);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFilterByTimeRange).not.toHaveBeenCalled();
    });

    it("filters by time range when timeFilter is provided", async () => {
      const works = [createMockWork()];
      mockGetWorksByGardener.mockResolvedValue(works);
      mockDeduplicateById.mockReturnValue(works);

      const { result } = renderHook(() => useMyWorks({ timeFilter: "week" as any }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFilterByTimeRange).toHaveBeenCalledWith(works, "week");
    });
  });

  // ------------------------------------------
  // Sorting and limiting
  // ------------------------------------------

  describe("sorting and limiting", () => {
    it("sorts works by creation time (newest first)", async () => {
      const works = [
        createMockWork({ id: "old", createdAt: 1000 }),
        createMockWork({ id: "new", createdAt: 2000 }),
      ];
      mockGetWorksByGardener.mockResolvedValue(works);
      mockDeduplicateById.mockReturnValue(works);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSortByCreatedAt).toHaveBeenCalled();
    });

    it("limits results to 50 by default", async () => {
      const manyWorks = Array.from({ length: 60 }, (_, i) =>
        createMockWork({ id: `work-${i}`, createdAt: Date.now() - i })
      );
      mockGetWorksByGardener.mockResolvedValue(manyWorks);
      mockDeduplicateById.mockReturnValue(manyWorks);
      mockSortByCreatedAt.mockReturnValue(manyWorks);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(50);
    });

    it("respects custom limit", async () => {
      const works = Array.from({ length: 20 }, (_, i) =>
        createMockWork({ id: `work-${i}`, createdAt: Date.now() - i })
      );
      mockGetWorksByGardener.mockResolvedValue(works);
      mockDeduplicateById.mockReturnValue(works);
      mockSortByCreatedAt.mockReturnValue(works);

      const { result } = renderHook(() => useMyWorks({ limit: 5 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(5);
    });
  });

  // ------------------------------------------
  // Custom chain ID
  // ------------------------------------------

  describe("chain configuration", () => {
    it("uses DEFAULT_CHAIN_ID by default", async () => {
      mockGetWorksByGardener.mockResolvedValue([]);

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetWorksByGardener).toHaveBeenCalledWith(MOCK_ADDRESSES.user, 11155111);
    });

    it("uses custom chain ID when provided", async () => {
      mockGetWorksByGardener.mockResolvedValue([]);

      const { result } = renderHook(() => useMyWorks({ chainId: 42161 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetWorksByGardener).toHaveBeenCalledWith(MOCK_ADDRESSES.user, 42161);
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("propagates query errors", async () => {
      mockGetWorksByGardener.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useMyWorks(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Network error");
    });
  });
});

// ------------------------------------------
// useMyOnlineWorks convenience wrapper
// ------------------------------------------

describe("useMyOnlineWorks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockUser = { id: MOCK_ADDRESSES.user, address: MOCK_ADDRESSES.user };
    mockGetWorksByGardener.mockResolvedValue([]);
    mockFetchOfflineWorks.mockResolvedValue([]);
  });

  it("never fetches offline works", async () => {
    mockGetWorksByGardener.mockResolvedValue([]);

    const { result } = renderHook(() => useMyOnlineWorks(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetchOfflineWorks).not.toHaveBeenCalled();
  });

  it("passes through other options", async () => {
    mockGetWorksByGardener.mockResolvedValue([]);

    const { result } = renderHook(() => useMyOnlineWorks({ chainId: 42220 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetWorksByGardener).toHaveBeenCalledWith(MOCK_ADDRESSES.user, 42220);
  });

  function createQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  }

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };
  }
});
