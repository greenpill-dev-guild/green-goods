/**
 * useGardenAssessments Tests
 *
 * Tests the TanStack Query wrapper for fetching garden assessments from EAS.
 * Covers enabled/disabled states, query key construction, explicit chainId parameter,
 * and loading behavior.
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

const V2_UID = "0x22";
const V3_UID = "0x33";
const mockGetEASConfig = vi.fn((_chainId?: number | string) => ({
  ASSESSMENT: { uid: V2_UID, schema: "" },
  ASSESSMENT_V3: { uid: V3_UID, schema: "" },
}));
vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getEASConfig: (chainId?: number) => mockGetEASConfig(chainId),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  isZeroBytes32: (value: string) => /^0x0*$/.test(value),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

vi.mock("../../../config/query-keys/constants", () => ({
  STALE_TIME_MEDIUM: 300000,
}));

vi.mock("../../../config/query-keys/garden", () => ({
  assessmentsKeys: {
    byGardenBase: (addr: string, chainId: number) => [
      "greengoods",
      "assessments",
      "byGarden",
      addr,
      chainId,
    ],
  },
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

  it("passes correct query key with garden address and default chain ID", () => {
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

    // Both registered schemas: v3 first, then the still-readable v2 record.
    expect(mockGetGardenAssessments).toHaveBeenNthCalledWith(1, GARDEN_ADDRESS, 11155111, V3_UID);
    expect(mockGetGardenAssessments).toHaveBeenNthCalledWith(2, GARDEN_ADDRESS, 11155111, V2_UID);
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

  it("uses explicit chainId when provided", () => {
    useGardenAssessments(GARDEN_ADDRESS, 42161);

    const options = mockUseQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual([
      "greengoods",
      "assessments",
      "byGarden",
      GARDEN_ADDRESS,
      42161,
    ]);
  });

  it("queryFn uses explicit chainId for data fetching", async () => {
    mockGetGardenAssessments.mockResolvedValue([]);
    useGardenAssessments(GARDEN_ADDRESS, 42161);

    const options = mockUseQuery.mock.calls[0][0];
    await options.queryFn();

    expect(mockGetGardenAssessments).toHaveBeenCalledWith(GARDEN_ADDRESS, 42161, V3_UID);
    expect(mockGetGardenAssessments).toHaveBeenCalledWith(GARDEN_ADDRESS, 42161, V2_UID);
  });

  it("defaults to DEFAULT_CHAIN_ID when chainId is not provided", () => {
    useGardenAssessments(GARDEN_ADDRESS);

    const options = mockUseQuery.mock.calls[0][0];
    // DEFAULT_CHAIN_ID is mocked as 11155111
    expect(options.queryKey).toEqual([
      "greengoods",
      "assessments",
      "byGarden",
      GARDEN_ADDRESS,
      11155111,
    ]);
  });
});
