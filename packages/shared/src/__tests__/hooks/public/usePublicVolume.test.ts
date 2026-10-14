/**
 * usePublicVolume Hook Tests
 * @vitest-environment happy-dom
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveEveryWork,
  createMockGarden,
  createMockWork,
  MOCK_ADDRESSES,
} from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// ============================================
// Mocks
// ============================================

const mockGetGardens = vi.fn();
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: (...args: unknown[]) => mockGetGardens(...args),
}));

const mockGetWorks = vi.fn();
const mockGetGardenAssessments = vi.fn();
const mockReadWorkApprovalsForWorks = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
  readWorkApprovalsForWorks: (...args: unknown[]) => mockReadWorkApprovalsForWorks(...args),
}));

vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
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

// ============================================
// Tests
// ============================================

describe("usePublicVolume", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
    mockReadWorkApprovalsForWorks.mockImplementation(async (workUIDs: string[]) =>
      approveEveryWork(workUIDs)
    );
  });

  it("exposes a stable Season One window the page layer can render", () => {
    expect(SEASON_ONE_VOLUME_ID).toBe(1);
    expect(typeof SEASON_ONE_WINDOW.startSeconds).toBe("number");
    expect(SEASON_ONE_WINDOW.endSeconds).toBeNull();
    expect(SEASON_ONE_WINDOW.label).toBe("Season One: Onboarding & Cultivation");
  });

  it("returns null when an unknown volume is requested", async () => {
    const { result } = renderHookWithQueryClient(() => usePublicVolume(999), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it("aggregates listed gardens' approved activity within the volume window", async () => {
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
      // Awaiting review: in the window, but not public.
      createMockWork({
        id: "w-pending",
        gardenAddress: stillBornGarden.id as `0x${string}`,
        gardenerAddress: MOCK_ADDRESSES.smartAccount as `0x${string}`,
        createdAt: inWindowSeconds,
      }),
    ]);
    mockReadWorkApprovalsForWorks.mockResolvedValue(approveEveryWork(["w-in", "w-before"]));
    const assessment = {
      id: "a-1",
      authorAddress: MOCK_ADDRESSES.steward,
      gardenAddress: inWindowGarden.id,
      title: "Q1",
      description: "",
      assessmentConfigCID: "",
      domain: 1,
      startDate: null,
      endDate: null,
      location: "",
      createdAt: inWindowSeconds,
    };
    mockGetGardenAssessments.mockResolvedValue([
      assessment,
      // Green Goods Community Garden, which config/garden-visibility keeps off the lists.
      { ...assessment, id: "a-2", gardenAddress: "0xf401f34378384713222d1d21f63359cc4E8a858a" },
    ]);

    const { result } = renderHookWithQueryClient(() => usePublicVolume(SEASON_ONE_VOLUME_ID), {
      queryClient,
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
    expect(data?.partialData).toBe(false);
  });

  it("returns zero counts when EAS is unreachable but volume metadata still resolves", async () => {
    const garden = createMockGarden({
      id: MOCK_ADDRESSES.garden,
      name: "Resilient",
    });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS unavailable"));
    mockGetGardenAssessments.mockRejectedValue(new Error("EAS unavailable"));

    const { result } = renderHookWithQueryClient(() => usePublicVolume(SEASON_ONE_VOLUME_ID), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.id).toBe(SEASON_ONE_VOLUME_ID);
    expect(data?.actionCount).toBe(0);
    expect(data?.attestationCount).toBe(0);
    expect(data?.activeGardens).toEqual([]);
    // The zeros are unknowns, and the volume says so.
    expect(data?.partialData).toBe(true);
  });
});
