/**
 * useGardenDetailData fallback tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

const mockUseGardens = vi.fn();
vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mockUseGardens(),
}));

const mockUseEligibleAdminGardens = vi.fn();
vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => mockUseEligibleAdminGardens(),
}));

const mockUseGardenPermissions = vi.fn();
vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => mockUseGardenPermissions(),
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useDelayedInvalidation: () => ({ start: vi.fn() }),
}));

vi.mock("../../../hooks/assessment/useGardenAssessments", () => ({
  useGardenAssessments: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("../../../hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({
    addGardener: vi.fn(),
    removeGardener: vi.fn(),
    addOperator: vi.fn(),
    removeOperator: vi.fn(),
    addEvaluator: vi.fn(),
    removeEvaluator: vi.fn(),
    addOwner: vi.fn(),
    removeOwner: vi.fn(),
    addFunder: vi.fn(),
    removeFunder: vi.fn(),
    addCommunity: vi.fn(),
    removeCommunity: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/vault/useGardenVaults", () => ({
  useGardenVaults: () => ({ vaults: [], isLoading: false }),
}));

vi.mock("../../../hooks/conviction/useConvictionStrategies", () => ({
  useConvictionStrategies: () => ({ strategies: [] }),
}));

vi.mock("../../../hooks/conviction/useCreateGardenPools", () => ({
  useCreateGardenPools: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../hooks/conviction/useGardenCommunity", () => ({
  useGardenCommunity: () => ({ community: null, isLoading: false }),
}));

vi.mock("../../../hooks/conviction/useGardenPools", () => ({
  useGardenPools: () => ({ pools: [] }),
}));

vi.mock("../../../hooks/yield/useYieldAllocations", () => ({
  useYieldAllocations: () => ({ allocations: [], isLoading: false }),
}));

vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: () => ({
    works: [],
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/hypercerts/useHypercerts", () => ({
  useHypercerts: () => ({ hypercerts: [], isLoading: false }),
}));

import { useGardenDetailData } from "../../../hooks/garden/useGardenDetailData";

const ADDR_USER = "0x1111111111111111111111111111111111111111";

const recoveredGarden = {
  id: "0x2222222222222222222222222222222222222222",
  chainId: 11155111,
  tokenAddress: "0x2222222222222222222222222222222222222222",
  tokenID: 0n,
  name: "Recovered Garden",
  description: "",
  location: "",
  bannerImage: "",
  gardeners: [],
  operators: [ADDR_USER],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  openJoining: false,
  domainMask: 0,
  assessments: [],
  works: [],
  createdAt: 0,
};

describe("useGardenDetailData eligible garden fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: [], isLoading: false, error: null, isError: false });
    mockUseEligibleAdminGardens.mockReturnValue({
      eligibleGardens: [],
      hasStaleBaseList: false,
      isError: false,
    });
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: vi.fn((garden) => garden.operators.includes(ADDR_USER)),
      canReviewGarden: vi.fn(() => false),
      canAddMembers: vi.fn((garden) => garden.operators.includes(ADDR_USER)),
      isOwnerOfGarden: vi.fn(() => false),
    });
  });

  it("uses a role-confirmed eligible garden when the base garden list is stale", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Indexer unavailable"),
      isError: true,
    });
    mockUseEligibleAdminGardens.mockReturnValue({
      eligibleGardens: [recoveredGarden],
      hasStaleBaseList: true,
      isError: true,
    });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.garden).toBe(recoveredGarden);
    expect(result.current.baseGarden).toBeNull();
    expect(result.current.isRecoveredEligibleGarden).toBe(true);
    expect(result.current.hasStaleBaseList).toBe(true);
    expect(result.current.baseListError).toBeInstanceOf(Error);
    expect(result.current.canManage).toBe(true);
  });
});
