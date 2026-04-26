/**
 * usePublicFieldNotes Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockGarden, createMockWork, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockGetGardens = vi.fn();
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: (...args: unknown[]) => mockGetGardens(...args),
}));

const mockGetWorks = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { usePublicFieldNotes } from "../../../hooks/public/usePublicFieldNotes";

// ============================================
// Helpers
// ============================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("usePublicFieldNotes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
  });

  it("returns empty page when no works exist", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" }),
    ]);
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicFieldNotes(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.fieldNotes).toEqual([]);
    expect(result.current.data?.hasMore).toBe(false);
  });

  it("fetches works for all gardens when no gardenAddress filter is provided", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden A" });
    const otherGarden = createMockGarden({
      id: "0xOther1234567890abcdef1234567890abcdef1234",
      name: "Garden B",
    });

    mockGetGardens.mockResolvedValue([garden, otherGarden]);
    mockGetWorks.mockImplementation(async (gardens: string[] | string | undefined) => {
      // Hook should pass an array of all garden IDs when gardenAddress is undefined
      if (!Array.isArray(gardens)) return [];
      return [
        createMockWork({
          id: "w-a",
          gardenAddress: garden.id as `0x${string}`,
          createdAt: 1_700_000_000,
        }),
        createMockWork({
          id: "w-b",
          gardenAddress: otherGarden.id as `0x${string}`,
          createdAt: 1_700_000_500,
        }),
      ];
    });

    const { result } = renderHook(() => usePublicFieldNotes(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetWorks).toHaveBeenCalled();
    expect(result.current.data?.fieldNotes).toHaveLength(2);
  });

  it("filters by garden address when provided", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([
      createMockWork({
        id: "w-1",
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000,
      }),
    ]);

    const { result } = renderHook(() => usePublicFieldNotes({ gardenAddress: garden.id }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The eas getWorks helper accepts a single address — hook should forward it
    expect(mockGetWorks).toHaveBeenCalledWith(garden.id, expect.anything());
    expect(result.current.data?.fieldNotes).toHaveLength(1);
  });

  it("paginates results using limit and cursor", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);

    // 25 works in descending createdAt — hook should sort newest-first then page
    const works = Array.from({ length: 25 }, (_, i) =>
      createMockWork({
        id: `work-${i}`,
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000 + i,
      })
    );
    mockGetWorks.mockResolvedValue(works);

    const { result } = renderHook(() => usePublicFieldNotes({ limit: 10 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const page = result.current.data;
    expect(page?.fieldNotes).toHaveLength(10);
    // Newest first: work-24 → work-15
    expect(page?.fieldNotes[0]?.id).toBe("work-24");
    expect(page?.hasMore).toBe(true);
    expect(typeof page?.nextCursor).toBe("number");
  });

  it("respects cursor offset for subsequent pages", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);

    const works = Array.from({ length: 25 }, (_, i) =>
      createMockWork({
        id: `work-${i}`,
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000 + i,
      })
    );
    mockGetWorks.mockResolvedValue(works);

    const { result } = renderHook(() => usePublicFieldNotes({ limit: 10, cursor: 10 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const page = result.current.data;
    expect(page?.fieldNotes).toHaveLength(10);
    // Skipping the first 10 of the sorted-desc list
    expect(page?.fieldNotes[0]?.id).toBe("work-14");
  });

  it("propagates EAS fetch errors so the page can render an error state", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS down"));

    const { result } = renderHook(() => usePublicFieldNotes(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("EAS down");
  });
});
