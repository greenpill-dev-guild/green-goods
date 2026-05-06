/**
 * usePublicGardens Hook Tests
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

import { usePublicGardens } from "../../../hooks/public/usePublicGardens";

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

describe("usePublicGardens", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
  });

  it("returns empty list when no gardens exist", async () => {
    mockGetGardens.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("refetches a fresh cached empty list on mount so public pages recover when the indexer has gardens", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Recovered Garden",
      location: "Austin, TX",
    });

    queryClient.setQueryData(["greengoods", "public", "gardens", 11155111], []);
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual([]);

    await waitFor(() => {
      expect(result.current.data?.map((item) => item.name)).toEqual(["Recovered Garden"]);
    });
    expect(mockGetGardens).toHaveBeenCalledTimes(1);
  });

  it("excludes uninitialized placeholder gardens", async () => {
    const realGarden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Real Garden",
    });
    const placeholderGarden = createMockGarden({
      id: "0xPlaceholderGarden0000000000000000000000",
      name: "",
      location: "",
    });

    mockGetGardens.mockResolvedValue([realGarden, placeholderGarden]);
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data ?? [];
    expect(data).toHaveLength(1);
    expect(data[0]?.name).toBe("Real Garden");
  });

  it("derives slug from garden name when present and falls back to address", async () => {
    const namedGarden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Pacific Northwest Conservatory",
    });
    const unnamedGarden = createMockGarden({
      id: "0xAbcdef1234567890abcdef1234567890abcdef12",
      name: "",
    });

    mockGetGardens.mockResolvedValue([namedGarden, unnamedGarden]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data ?? [];
    expect(data[0]?.slug).toBe("pacific-northwest-conservatory");
    // Falls back to lowercased address when name is empty
    expect(data[1]?.slug).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("computes contributor count and last activity from EAS works", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Riparian Restoration",
    });
    const otherGarden = createMockGarden({
      id: "0xOther1234567890abcdef1234567890abcdef1234",
      name: "Forest Garden",
    });

    mockGetGardens.mockResolvedValue([garden, otherGarden]);
    // Two works in `garden` from the same gardener + 1 from another → 2 unique contributors
    mockGetWorks.mockResolvedValue([
      createMockWork({
        gardenAddress: garden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.gardener as `0x${string}`,
        createdAt: 1_700_000_000,
      }),
      createMockWork({
        gardenAddress: garden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.gardener as `0x${string}`,
        createdAt: 1_700_000_500,
      }),
      createMockWork({
        gardenAddress: garden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.user as `0x${string}`,
        createdAt: 1_700_001_000,
      }),
      createMockWork({
        gardenAddress: otherGarden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.user as `0x${string}`,
        createdAt: 1_699_999_999,
      }),
    ]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data ?? [];
    const target = data.find((g) => g.address === garden.id);
    expect(target?.actionCount).toBe(3);
    expect(target?.contributorCount).toBe(2);
    // EAS createdAt is in seconds; lastActivityAt should expose seconds value of the most recent work
    expect(target?.lastActivityAt).toBe(1_700_001_000);
  });

  it("falls back to garden createdAt when no works exist", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Quiet Garden",
      createdAt: 1_650_000_000_000, // ms
    });

    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data ?? [];
    expect(data[0]?.actionCount).toBe(0);
    expect(data[0]?.contributorCount).toBe(0);
    // Garden createdAt in domain is ms; hook normalizes to seconds for parity with works
    expect(data[0]?.lastActivityAt).toBe(Math.floor(1_650_000_000_000 / 1000));
  });

  it("treats EAS query failure as soft — gardens still render with zero stats", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Resilient Garden",
    });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS unavailable"));

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data ?? [];
    expect(data).toHaveLength(1);
    expect(data[0]?.actionCount).toBe(0);
    expect(data[0]?.contributorCount).toBe(0);
  });

  it("propagates indexer (garden) fetch errors", async () => {
    mockGetGardens.mockRejectedValue(new Error("Indexer down"));

    const { result } = renderHook(() => usePublicGardens(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Indexer down");
  });
});
