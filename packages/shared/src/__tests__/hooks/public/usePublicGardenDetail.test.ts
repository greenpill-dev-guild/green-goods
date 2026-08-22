/**
 * usePublicGardenDetail Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
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

const CONFIGURED_UID = "0x1111111111111111111111111111111111111111111111111111111111111111";
const ZERO_UID = `0x${"0".repeat(64)}`;
const mockEasConfig = vi.fn(() => ({
  WORK: { uid: CONFIGURED_UID },
  ASSESSMENT: { uid: CONFIGURED_UID },
}));
vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getEASConfig: () => mockEasConfig(),
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
    // clearAllMocks drops the factory implementation; both schemas are
    // configured unless a test says otherwise.
    mockEasConfig.mockReturnValue({
      WORK: { uid: CONFIGURED_UID },
      ASSESSMENT: { uid: CONFIGURED_UID },
    });
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

    expect(result.current.data?.garden?.id).toBe(garden.id);
    expect(result.current.data?.garden?.name).toBe("Riparian Restoration");
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

    expect(result.current.data?.garden?.id).toBe(garden.id);
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

  it("returns every field note so callers can page locally", async () => {
    // The query key carries no page size, so a hook-side slice could never be
    // widened without a second fetch. The full set is already in memory here.
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

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.fieldNotes).toHaveLength(12);
    expect(result.current.data?.totalFieldNotes).toBe(12);
  });

  it("reports a failed works read instead of returning a silent empty list", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS unavailable"));
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Still resolves — one source outage must not blank the page — but a
    // consumer can now tell "no notes" from "we could not read the notes".
    expect(result.current.data?.fieldNotes).toHaveLength(0);
    expect(result.current.data?.partialData).toBe(true);
    expect(result.current.data?.unavailableSources).toEqual({
      works: true,
      assessments: false,
    });
  });

  it("marks only the source that failed", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockRejectedValue(new Error("EAS unavailable"));

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.unavailableSources).toEqual({
      works: false,
      assessments: true,
    });
  });

  it("reports an unconfigured schema as unavailable, not as zero", async () => {
    // getWorks/getGardenAssessments return a fulfilled [] when their schema UID
    // is unset on the chain, so allSettled alone cannot tell "none" from "not
    // configured" — and the public page would publish the latter as 0.
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
    mockEasConfig.mockReturnValue({
      WORK: { uid: ZERO_UID },
      ASSESSMENT: { uid: CONFIGURED_UID },
    });

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.partialData).toBe(true);
    expect(result.current.data?.unavailableSources).toEqual({
      works: true,
      assessments: false,
    });
  });

  it("reports no unavailable sources when both reads succeed", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicGardenDetail(garden.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.partialData).toBe(false);
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

  it("clears the previous Garden while a new query key loads", async () => {
    const firstGarden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "First Garden",
    });
    const secondGarden = createMockGarden({
      id: MOCK_ADDRESSES.user,
      name: "Second Garden",
    });
    mockGetGardens.mockResolvedValueOnce([firstGarden, secondGarden]);

    const { result, rerender } = renderHook(({ lookup }) => usePublicGardenDetail(lookup), {
      initialProps: { lookup: firstGarden.id },
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.data?.garden?.name).toBe("First Garden"));

    let resolveSecondRead: (gardens: Array<typeof firstGarden>) => void = () => {};
    mockGetGardens.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondRead = resolve;
        })
    );
    rerender({ lookup: secondGarden.id });

    expect(result.current.data).toBeUndefined();
    act(() => resolveSecondRead([firstGarden, secondGarden]));
    await waitFor(() => expect(result.current.data?.garden?.name).toBe("Second Garden"));
  });
});
