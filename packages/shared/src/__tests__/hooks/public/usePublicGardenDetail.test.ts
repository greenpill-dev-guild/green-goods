/**
 * usePublicGardenDetail Hook Tests
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
const mockGetGardenAssessments = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { usePublicGardenDetail } from "../../../hooks/public/usePublicGardenDetail";

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

describe("usePublicGardenDetail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
  });

  it("does not fetch when no slug or address is provided", async () => {
    const { result } = renderHook(() => usePublicGardenDetail(undefined), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(mockGetGardens).not.toHaveBeenCalled();
  });

  it("resolves a garden by lowercased address", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Riparian Restoration",
    });

    mockGetGardens.mockResolvedValue([garden]);

    const { result } = renderHook(() => usePublicGardenDetail(MOCK_ADDRESSES.garden), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.garden.id).toBe(garden.id);
    expect(result.current.data?.garden.name).toBe("Riparian Restoration");
  });

  it("resolves a garden by slug derived from name", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Pacific Northwest Conservatory",
    });

    mockGetGardens.mockResolvedValue([garden]);

    const { result } = renderHook(() => usePublicGardenDetail("pacific-northwest-conservatory"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.garden.id).toBe(garden.id);
  });

  it("returns null garden when no match is found", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Other" }),
    ]);

    const { result } = renderHook(() => usePublicGardenDetail("nonexistent-slug"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.garden).toBeNull();
  });

  it("aggregates field notes, contributors, and assessment count for the matched garden", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Riparian Restoration",
    });
    const otherGarden = createMockGarden({
      id: "0xOther1234567890abcdef1234567890abcdef1234",
      name: "Forest Garden",
    });

    const work1 = createMockWork({
      id: "work-1",
      gardenAddress: garden.id as `0x${string}`,
      gardenerAddress: MOCK_ADDRESSES.gardener as `0x${string}`,
      createdAt: 1_700_000_000,
    });
    const work2 = createMockWork({
      id: "work-2",
      gardenAddress: garden.id as `0x${string}`,
      gardenerAddress: MOCK_ADDRESSES.user as `0x${string}`,
      createdAt: 1_700_001_000,
    });
    const offGardenWork = createMockWork({
      id: "work-other",
      gardenAddress: otherGarden.id as `0x${string}`,
    });

    mockGetGardens.mockResolvedValue([garden, otherGarden]);
    // The real `getWorks` filters by recipient on the server side; emulate
    // that here so the hook only sees works for the matched garden.
    const all = [offGardenWork, work1, work2];
    mockGetWorks.mockImplementation(async (gardenAddress: string | string[]) => {
      const targets = Array.isArray(gardenAddress) ? gardenAddress : [gardenAddress];
      const set = new Set(targets.map((a) => a.toLowerCase()));
      return all.filter((w) => set.has(w.gardenAddress.toLowerCase()));
    });
    mockGetGardenAssessments.mockResolvedValue([
      {
        id: "assess-1",
        authorAddress: MOCK_ADDRESSES.operator,
        gardenAddress: garden.id,
        title: "Q1 Assessment",
        description: "",
        assessmentConfigCID: "",
        domain: 1,
        startDate: null,
        endDate: null,
        location: "",
        createdAt: 1_700_002_000,
      },
    ]);

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.fieldNotes).toHaveLength(2);
    // Most recent first
    expect(data?.fieldNotes[0]?.id).toBe("work-2");
    expect(data?.contributors).toHaveLength(2);
    expect(data?.assessmentCount).toBe(1);
  });

  it("respects fieldNotesLimit option", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);

    const works = Array.from({ length: 12 }, (_, i) =>
      createMockWork({
        id: `work-${i}`,
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000 + i,
      })
    );
    mockGetWorks.mockResolvedValue(works);

    const { result } = renderHook(() => usePublicGardenDetail(garden.id, { fieldNotesLimit: 5 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.fieldNotes).toHaveLength(5);
  });

  it("propagates garden indexer fetch failure", async () => {
    mockGetGardens.mockRejectedValue(new Error("Indexer down"));

    const { result } = renderHook(() => usePublicGardenDetail(MOCK_ADDRESSES.garden), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Indexer down");
  });
});
