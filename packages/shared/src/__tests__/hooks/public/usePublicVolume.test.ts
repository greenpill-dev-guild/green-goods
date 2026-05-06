/**
 * usePublicVolume Hook Tests
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

import {
  SEASON_ONE_VOLUME_ID,
  SEASON_ONE_WINDOW,
  usePublicVolume,
} from "../../../hooks/public/usePublicVolume";

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

describe("usePublicVolume", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
  });

  it("exposes a stable Season One window the page layer can render", () => {
    expect(SEASON_ONE_VOLUME_ID).toBe(1);
    expect(typeof SEASON_ONE_WINDOW.startSeconds).toBe("number");
    expect(SEASON_ONE_WINDOW.endSeconds).toBeNull();
    expect(SEASON_ONE_WINDOW.label).toBe("Season One: Onboarding & Cultivation");
  });

  it("returns null when an unknown volume is requested", async () => {
    const { result } = renderHook(() => usePublicVolume(999), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it("aggregates gardens active within the volume window", async () => {
    const inWindowGarden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Active Garden",
    });
    const stillBornGarden = createMockGarden({
      id: "0xQuiet000000000000000000000000000000000000",
      name: "Quiet Garden",
    });

    mockGetGardens.mockResolvedValue([inWindowGarden, stillBornGarden]);

    const inWindowSeconds = SEASON_ONE_WINDOW.startSeconds + 1_000;
    const beforeWindowSeconds = SEASON_ONE_WINDOW.startSeconds - 86_400;

    mockGetWorks.mockResolvedValue([
      createMockWork({
        id: "w-in",
        gardenAddress: inWindowGarden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.gardener as `0x${string}`,
        createdAt: inWindowSeconds,
      }),
      createMockWork({
        id: "w-before",
        gardenAddress: stillBornGarden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.user as `0x${string}`,
        createdAt: beforeWindowSeconds,
      }),
    ]);
    mockGetGardenAssessments.mockResolvedValue([
      {
        id: "a-1",
        authorAddress: MOCK_ADDRESSES.operator,
        gardenAddress: inWindowGarden.id,
        title: "Q1",
        description: "",
        assessmentConfigCID: "",
        domain: 1,
        startDate: null,
        endDate: null,
        location: "",
        createdAt: inWindowSeconds,
      },
    ]);

    const { result } = renderHook(() => usePublicVolume(SEASON_ONE_VOLUME_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.id).toBe(SEASON_ONE_VOLUME_ID);
    expect(data?.activeGardens.map((g) => g.address)).toEqual([inWindowGarden.id]);
    expect(data?.actionCount).toBe(1);
    expect(data?.attestationCount).toBe(1);
    expect(data?.contributorCount).toBe(1);
  });

  it("returns zero counts when EAS is unreachable but volume metadata still resolves", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Resilient",
    });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS unavailable"));
    mockGetGardenAssessments.mockRejectedValue(new Error("EAS unavailable"));

    const { result } = renderHook(() => usePublicVolume(SEASON_ONE_VOLUME_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.id).toBe(SEASON_ONE_VOLUME_ID);
    expect(data?.actionCount).toBe(0);
    expect(data?.attestationCount).toBe(0);
    expect(data?.activeGardens).toEqual([]);
  });
});
