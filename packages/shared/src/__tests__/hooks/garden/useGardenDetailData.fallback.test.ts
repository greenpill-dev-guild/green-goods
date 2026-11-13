/**
 * useGardenDetailData fallback tests
 * @vitest-environment happy-dom
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

const assessmentsRead = vi.hoisted(() => ({ refetch: () => {}, isFetching: false }));
vi.mock("../../../hooks/assessment/useGardenAssessments", () => ({
  useGardenAssessments: () => ({ data: [], isLoading: false, error: null, ...assessmentsRead }),
}));

vi.mock("../../../hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({
    addGardener: vi.fn(),
    removeGardener: vi.fn(),
    addSteward: vi.fn(),
    removeSteward: vi.fn(),
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

const mockUseGardenVaults = vi.fn((..._args: unknown[]) => ({ vaults: [], isLoading: false }));
vi.mock("../../../hooks/vault/useGardenVaults", () => ({
  useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
}));

vi.mock("../../../hooks/cookie-jar/useGardenCookieJars", () => ({
  useGardenCookieJars: () => ({ jars: [] }),
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

const mockUseYieldAllocations = vi.fn();
vi.mock("../../../hooks/yield/useYieldAllocations", () => ({
  useYieldAllocations: () => mockUseYieldAllocations(),
}));

const mockUseWorks = vi.fn();
vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: () => mockUseWorks(),
}));

/** The garden's whole queue as a list, and past the read's limit as a floor. */
const LISTED = { lastReviewedAt: 100, waiting: [] };
const FLOOR = { lastReviewedAt: 100, waiting: null, waitingAtLeast: 3, waitingOverWeekAtLeast: 2 };
const mockUseGardenReviewQueue = vi.fn(
  (_gardenId: string, _options: { enabled: boolean }): object | undefined => LISTED
);
vi.mock("../../../hooks/work/useGardenReviewQueue", () => ({
  useGardenReviewQueue: (gardenId: string, options: { enabled: boolean }) =>
    mockUseGardenReviewQueue(gardenId, options),
}));

function defaultWorksResult() {
  return {
    works: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

const mockUseHypercerts = vi.fn((): object => ({ hypercerts: [], isLoading: false }));
vi.mock("../../../hooks/hypercerts/useHypercerts", () => ({
  useHypercerts: () => mockUseHypercerts(),
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
  stewards: [ADDR_USER],
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
    mockUseWorks.mockReturnValue(defaultWorksResult());
    mockUseHypercerts.mockReturnValue({ hypercerts: [], isLoading: false });
    assessmentsRead.refetch = () => {};
    assessmentsRead.isFetching = false;
    mockUseYieldAllocations.mockReturnValue({ allocations: [], isLoading: false });
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: vi.fn((garden) => garden.stewards.includes(ADDR_USER)),
      canReviewGarden: vi.fn(() => false),
      canAddMembers: vi.fn((garden) => garden.stewards.includes(ADDR_USER)),
      canManageStewards: vi.fn(() => false),
      isOwnerOfGarden: vi.fn(() => false),
    });
  });

  it.each([
    { id: recoveredGarden.id, address: recoveredGarden.id, enabled: true },
    { id: "community-garden", address: undefined, enabled: false },
    { id: "0xwrong", address: undefined, enabled: false },
    { id: undefined, address: undefined, enabled: false },
  ])("scopes vault reads safely for route $id", ({ id, address, enabled }) => {
    renderHook(() => useGardenDetailData(id));

    expect(mockUseGardenVaults).toHaveBeenCalledWith(address, { enabled });
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

  it.each([
    ["a first read that failed", { isError: true, data: undefined }, true],
    ["a failed refresh over a read history", { isError: true, data: [] }, false],
    ["a read that found none", { isError: false, data: [] }, false],
  ])("tells %s apart from an empty payout history", (_case, read, unread) => {
    mockUseYieldAllocations.mockReturnValue({ allocations: [], isLoading: false, ...read });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.allocationsUnread).toBe(unread);
  });

  it("exposes a work collection failure separately from garden resolution", () => {
    const worksError = new Error("Work service unavailable");
    mockUseGardens.mockReturnValue({
      data: [recoveredGarden],
      isLoading: false,
      error: null,
      isError: false,
    });
    mockUseWorks.mockReturnValue({
      ...defaultWorksResult(),
      isError: true,
      error: worksError,
    });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.garden).toBe(recoveredGarden);
    expect(result.current.isWorksError).toBe(true);
    expect(result.current.worksError).toBe(worksError);
  });

  // PRD-1087: the Hub's refresh rereads the open tab's list, so each record
  // list's reread and busy state must reach it.
  it("hands on what a refresh of each record list rereads", () => {
    const refetchHypercerts = vi.fn(async () => []);
    assessmentsRead.refetch = vi.fn();
    assessmentsRead.isFetching = true;
    mockUseHypercerts.mockReturnValue({
      hypercerts: [],
      isLoading: false,
      isFetching: true,
      refetch: refetchHypercerts,
    });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.refreshAssessments).toBe(assessmentsRead.refetch);
    expect(result.current.assessmentsFetching).toBe(true);
    expect(result.current.refreshHypercerts).toBe(refetchHypercerts);
    expect(result.current.hypercertsFetching).toBe(true);
  });

  // The Hub reads only what this hook hands it: a list whose next page stops
  // here can never reach older records (PRD-1086).
  it("hands on each list's next page", () => {
    const loadOlderWork = vi.fn();
    const loadOlderHypercerts = vi.fn();
    const refetchWorks = vi.fn();
    const refetchHypercerts = vi.fn(async () => []);
    mockUseWorks.mockReturnValue({
      ...defaultWorksResult(),
      refetch: refetchWorks,
      hasOlderWork: true,
      loadOlderWork,
      isLoadingOlder: false,
      lastSuccessfulRefresh: 1_000,
    });
    mockUseHypercerts.mockReturnValue({
      hypercerts: [],
      isLoading: false,
      hasOlder: true,
      loadOlder: loadOlderHypercerts,
      isLoadingOlder: true,
      listReadAt: 2_000,
      refetch: refetchHypercerts,
    });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.workPages).toEqual({
      hasOlder: true,
      loadOlder: loadOlderWork,
      reread: expect.any(Function),
      isLoadingOlder: false,
      readAt: 1_000,
    });
    expect(result.current.hypercertPages).toEqual({
      hasOlder: true,
      loadOlder: loadOlderHypercerts,
      reread: expect.any(Function),
      isLoadingOlder: true,
      readAt: 2_000,
    });
    // A retry rereads each list at the width it has.
    result.current.workPages.reread();
    result.current.hypercertPages.reread();
    expect(refetchWorks).toHaveBeenCalledTimes(1);
    expect(refetchHypercerts).toHaveBeenCalledTimes(1);
  });

  // Rows left from the last good read cannot show that no review landed since.
  // Past the newest page the garden's whole queue speaks: beside its list the
  // rows add only decisions, but beside a floor their waiting work must be current.
  it.each([
    { name: "a current read", works: {}, complete: true, gardenWide: false },
    { name: "a failed refresh", works: { isError: true }, complete: false, gardenWide: false },
    { name: "a paused refresh", works: { isPaused: true }, complete: false, gardenWide: false },
    {
      name: "unread approvals",
      works: { hasUnknownStatuses: true },
      complete: false,
      gardenWide: false,
    },
    {
      name: "a restored read",
      works: { readThisSession: false },
      complete: false,
      gardenWide: false,
    },
    { name: "older work", works: { hasOlderWork: true }, complete: false, gardenWide: true },
    // A widened read has nothing older to show until it lands: its rows are
    // not the whole history while it runs.
    {
      name: "a page of older work on its way",
      works: { isLoadingOlder: true },
      complete: false,
      gardenWide: true,
    },
    {
      name: "older work and rows a later read left out",
      works: { hasOlderWork: true, hasUnknownStatuses: true },
      complete: false,
      gardenWide: true,
    },
    {
      name: "older work past the read's limit",
      works: { hasOlderWork: true },
      queue: FLOOR,
      complete: false,
      gardenWide: true,
    },
    {
      name: "older work past the read's limit and rows a later read left out",
      works: { hasOlderWork: true, hasUnknownStatuses: true },
      queue: FLOOR,
      complete: false,
      gardenWide: false,
    },
  ])("weighs work after $name: whole $complete, garden-wide $gardenWide", ({
    works,
    queue = LISTED,
    complete,
    gardenWide,
  }) => {
    mockUseGardenReviewQueue.mockReturnValue(queue);
    mockUseGardens.mockReturnValue({
      data: [recoveredGarden],
      isLoading: false,
      error: null,
      isError: false,
    });
    mockUseWorks.mockReturnValue({
      ...defaultWorksResult(),
      isPaused: false,
      hasOlderWork: false,
      isLoadingOlder: false,
      hasUnknownStatuses: false,
      readThisSession: true,
      ...works,
    });

    const { result } = renderHook(() => useGardenDetailData(recoveredGarden.id));

    expect(result.current.worksComplete).toBe(complete);
    expect(result.current.gardenReviewQueue).toBe(gardenWide ? queue : undefined);
    // The garden's whole queue is read only when the page cannot hold it.
    expect(mockUseGardenReviewQueue).toHaveBeenLastCalledWith(recoveredGarden.id, {
      enabled: "hasOlderWork" in works || "isLoadingOlder" in works,
    });
  });
});
