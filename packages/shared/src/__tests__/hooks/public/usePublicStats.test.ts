/**
 * usePublicStats Hook Tests
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
const mockGetGardeners = vi.fn();
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: (...args: unknown[]) => mockGetGardens(...args),
  getGardeners: (...args: unknown[]) => mockGetGardeners(...args),
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

import { usePublicStats } from "../../../hooks/public/usePublicStats";

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

describe("usePublicStats", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetGardeners.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
  });

  it("returns aggregated counts across gardens, gardeners, works, assessments", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden A" }),
      createMockGarden({ id: "0xOtherG12345678901234567890123456789012345", name: "Garden B" }),
    ]);
    mockGetGardeners.mockResolvedValue([
      { id: MOCK_ADDRESSES.gardener, registeredAt: 1, account: MOCK_ADDRESSES.gardener },
      { id: MOCK_ADDRESSES.user, registeredAt: 1, account: MOCK_ADDRESSES.user },
      { id: MOCK_ADDRESSES.smartAccount, registeredAt: 1, account: MOCK_ADDRESSES.smartAccount },
    ]);
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "w-1" }),
      createMockWork({ id: "w-2" }),
      createMockWork({ id: "w-3" }),
    ]);
    mockGetGardenAssessments.mockResolvedValue([
      {
        id: "a-1",
        authorAddress: MOCK_ADDRESSES.operator,
        gardenAddress: MOCK_ADDRESSES.garden,
        title: "",
        description: "",
        assessmentConfigCID: "",
        domain: 1,
        startDate: null,
        endDate: null,
        location: "",
        createdAt: 1,
      },
    ]);

    const { result } = renderHook(() => usePublicStats(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const stats = result.current.data;
    expect(stats?.gardenCount).toBe(2);
    expect(stats?.contributorCount).toBe(3);
    expect(stats?.fieldNoteCount).toBe(3);
    expect(stats?.attestationCount).toBe(1);
  });

  it("documents indexer gaps via undefined oracle-derived metrics", async () => {
    mockGetGardens.mockResolvedValue([]);
    mockGetGardeners.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicStats(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const stats = result.current.data;
    // The external visual handoff's "Carbon Sequestered", "Water Retention", "Species
    // Planted", and "SQ FT" metrics rely on IoT/oracle data that isn't in the
    // Envio core indexer. The hook surfaces the gap explicitly so pages can
    // render placeholder copy.
    expect(stats?.carbonSequesteredTons).toBeUndefined();
    expect(stats?.waterRetentionPercent).toBeUndefined();
    expect(stats?.speciesPlanted).toBeUndefined();
    expect(stats?.areaRegeneratingSqFt).toBeUndefined();
  });

  it("treats one source failure as soft — other counts still return", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" }),
    ]);
    mockGetGardeners.mockResolvedValue([
      { id: MOCK_ADDRESSES.gardener, registeredAt: 1, account: MOCK_ADDRESSES.gardener },
    ]);
    mockGetWorks.mockRejectedValue(new Error("EAS down"));
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHook(() => usePublicStats(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const stats = result.current.data;
    expect(stats?.gardenCount).toBe(1);
    expect(stats?.contributorCount).toBe(1);
    expect(stats?.fieldNoteCount).toBe(0);
  });
});
