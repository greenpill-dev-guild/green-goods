/**
 * useGardenAssessments Tests
 *
 * Tests the TanStack Query wrapper for fetching garden assessments from EAS.
 * Covers enabled/disabled states, query key construction, and loading behavior.
 */

/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks (must be before imports)
// ============================================

const mockGetGardenAssessments = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
}));

const mockSelectedChainId = vi.fn().mockReturnValue(11155111);
vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: any) => any) =>
    selector({ selectedChainId: mockSelectedChainId() }),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

vi.mock("../../../hooks/query-keys", () => ({
  queryKeys: {
    assessments: {
      byGardenBase: (addr: string, chainId: number) => [
        "greengoods",
        "assessments",
        "byGarden",
        addr,
        chainId,
      ],
    },
  },
  STALE_TIME_MEDIUM: 300000,
}));

// ============================================
// Import after mocks
// ============================================

import { useGardenAssessments } from "../../../hooks/assessment/useGardenAssessments";

// ============================================
// Tests
// ============================================

describe("useGardenAssessments", () => {
  const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it("passes correct query key with garden address and chain ID", () => {
    useGardenAssessments(GARDEN_ADDRESS);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["greengoods", "assessments", "byGarden", GARDEN_ADDRESS, 11155111],
      })
    );
  });

  it("sets enabled to true when gardenAddress is provided", () => {
    useGardenAssessments(GARDEN_ADDRESS);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.enabled).toBe(true);
  });

  it("sets enabled to false when gardenAddress is undefined", () => {
    useGardenAssessments(undefined);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.enabled).toBe(false);
  });

  it("queryFn returns empty array when gardenAddress is undefined", async () => {
    useGardenAssessments(undefined);

    const options = mockUseQuery.mock.calls[0][0];
    const result = await options.queryFn();
    expect(result).toEqual([]);
  });

  it("queryFn calls getGardenAssessments with correct args", async () => {
    mockGetGardenAssessments.mockResolvedValue([{ id: "attestation-1" }]);
    useGardenAssessments(GARDEN_ADDRESS);

    const options = mockUseQuery.mock.calls[0][0];
    await options.queryFn();

    expect(mockGetGardenAssessments).toHaveBeenCalledWith(GARDEN_ADDRESS, 11155111);
  });

  it("uses correct staleTime and refetchInterval", () => {
    useGardenAssessments(GARDEN_ADDRESS);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.staleTime).toBe(300000);
    expect(options.refetchInterval).toBe(60_000);
  });

  it("uses empty string for gardenAddress in query key when undefined", () => {
    useGardenAssessments(undefined);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual(["greengoods", "assessments", "byGarden", "", 11155111]);
  });

  it("picks up selectedChainId from admin store", () => {
    mockSelectedChainId.mockReturnValue(42161);
    useGardenAssessments(GARDEN_ADDRESS);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual([
      "greengoods",
      "assessments",
      "byGarden",
      GARDEN_ADDRESS,
      42161,
    ]);
  });
});
