/**
 * usePublicStats Hook Tests
 * @vitest-environment happy-dom
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveEveryWork,
  createMockGarden,
  createMockWork,
  createMockWorkApproval,
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

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { usePublicStats } from "../../../hooks/public/usePublicStats";

// ============================================
// Helpers
// ============================================

function assessment(id: string, gardenAddress: string) {
  return {
    id,
    authorAddress: MOCK_ADDRESSES.steward,
    gardenAddress,
    title: "",
    description: "",
    assessmentConfigCID: "",
    domain: 1,
    startDate: null,
    endDate: null,
    location: "",
    createdAt: 1,
  };
}

// ============================================
// Tests
// ============================================

describe("usePublicStats", () => {
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

  it("returns aggregated counts across gardens, gardeners, works, assessments", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({
        id: MOCK_ADDRESSES.garden,
        name: "Garden A",
        gardeners: [MOCK_ADDRESSES.gardener, MOCK_ADDRESSES.user],
      }),
      createMockGarden({
        id: "0xOtherG12345678901234567890123456789012345",
        name: "Garden B",
        gardeners: [MOCK_ADDRESSES.user, MOCK_ADDRESSES.smartAccount],
      }),
    ]);
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "w-1" }),
      createMockWork({ id: "w-2" }),
      createMockWork({ id: "w-3" }),
    ]);
    mockGetGardenAssessments.mockResolvedValue([assessment("a-1", MOCK_ADDRESSES.garden)]);

    const { result } = renderHookWithQueryClient(() => usePublicStats(), {
      queryClient,
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

  it("leaves unlisted gardens and unapproved work out of every count", async () => {
    // Curated off the public lists in config/garden-visibility.
    const communityGarden = "0xf401f34378384713222d1d21f63359cc4E8a858a";
    mockGetGardens.mockResolvedValue([
      createMockGarden({
        id: MOCK_ADDRESSES.garden,
        name: "Pilot Garden",
        gardeners: [MOCK_ADDRESSES.gardener],
      }),
      createMockGarden({
        id: communityGarden,
        name: "Green Goods Community Garden",
        gardeners: [MOCK_ADDRESSES.user, MOCK_ADDRESSES.smartAccount],
      }),
    ]);
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "approved" }),
      createMockWork({ id: "pending" }),
      createMockWork({ id: "practice", gardenAddress: communityGarden }),
    ]);
    mockReadWorkApprovalsForWorks.mockImplementation(async (workUIDs: string[]) => ({
      approvals: workUIDs
        .filter((workUID) => workUID !== "pending")
        .map((workUID) => createMockWorkApproval({ id: `a-${workUID}`, workUID })),
      failedWorkUIDs: [],
    }));
    mockGetGardenAssessments.mockResolvedValue([
      assessment("a-pilot", MOCK_ADDRESSES.garden),
      assessment("a-community", communityGarden),
    ]);

    const { result } = renderHookWithQueryClient(() => usePublicStats(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      gardenCount: 1,
      contributorCount: 1,
      fieldNoteCount: 1,
      attestationCount: 1,
    });
  });

  it("documents indexer gaps via undefined oracle-derived metrics", async () => {
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => usePublicStats(), {
      queryClient,
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
    mockGetWorks.mockRejectedValue(new Error("EAS down"));
    mockGetGardenAssessments.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => usePublicStats(), {
      queryClient,
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
