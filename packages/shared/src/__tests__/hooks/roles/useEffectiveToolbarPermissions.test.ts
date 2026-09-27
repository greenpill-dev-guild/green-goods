/**
 * useEffectiveToolbarPermissions Hook Tests
 * @vitest-environment jsdom
 *
 * RED phase — these tests define the evaluation contract for Phase 1b
 * route consolidation. They assert role-scoped toolbar visibility that
 * extends the current hook's behavior.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUseAccount = vi.fn();
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

const mockUseRole = vi.fn();
vi.mock("../../../hooks/gardener/useRole", () => ({
  useRole: () => mockUseRole(),
}));

const mockUseEligibleAdminGardens = vi.fn();
vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => mockUseEligibleAdminGardens(),
}));

const mockUseAdminGardenContext = vi.fn();
vi.mock("../../../hooks/garden/useAdminGardenContext", () => ({
  useAdminGardenContext: () => mockUseAdminGardenContext(),
}));

const mockUseAdminStore = vi.fn();
vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: unknown) => unknown) => mockUseAdminStore(selector),
}));

vi.mock("../../../utils/blockchain/address", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/blockchain/address")>();
  return actual;
});

import { useEffectiveToolbarPermissions } from "../../../hooks/roles/useEffectiveToolbarPermissions";

// ── Helpers ────────────────────────────────────────────────────────────────

const ADDR_USER = "0x1111111111111111111111111111111111111111";
const ADDR_OTHER = "0x2222222222222222222222222222222222222222";

function makeGarden(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Garden ${id}`,
    stewards: [] as string[],
    gardeners: [] as string[],
    owners: [] as string[],
    evaluators: [] as string[],
    funders: [] as string[],
    communities: [] as string[],
    ...overrides,
  };
}

function setupDefaults(
  overrides: {
    address?: string;
    selectedGarden?: { id: string } | null;
    roleLoading?: boolean;
    eligibleGardensLoaded?: boolean;
    eligibleGardensError?: boolean;
    hasStaleBaseList?: boolean;
    isDeployer?: boolean;
    isSteward?: boolean;
    gardens?: ReturnType<typeof makeGarden>[];
  } = {}
) {
  const {
    address = ADDR_USER,
    selectedGarden = null,
    roleLoading = false,
    eligibleGardensLoaded = true,
    eligibleGardensError = false,
    hasStaleBaseList = false,
    isDeployer = false,
    isSteward = false,
    gardens = [],
  } = overrides;

  mockUseAccount.mockReturnValue({ address });
  mockUseAdminStore.mockImplementation(
    (selector: (state: { selectedGarden: typeof selectedGarden }) => unknown) =>
      selector({ selectedGarden })
  );
  mockUseRole.mockReturnValue({
    isDeployer,
    isSteward,
    loading: roleLoading,
  });
  mockUseEligibleAdminGardens.mockReturnValue({
    eligibleGardens: gardens,
    isLoaded: eligibleGardensLoaded,
    isError: eligibleGardensError,
    hasStaleBaseList,
  });
  mockUseAdminGardenContext.mockReturnValue({
    activeGarden: selectedGarden,
    activeGardenId: selectedGarden?.id ?? null,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useEffectiveToolbarPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all slots visible while loading (fail-open)", () => {
    setupDefaults({ roleLoading: true });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current).toEqual({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: true,
    });
  });

  it("evaluator, gardener, and community member sees Hub and Garden, not Community", () => {
    const gardenA = makeGarden("garden-a", {
      evaluators: [ADDR_USER],
      gardeners: [ADDR_USER],
      communities: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(false);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("steward sees Work + Garden + Community; Actions stays deployer-only", () => {
    const gardenA = makeGarden("garden-a", {
      stewards: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    // Stewards participate in Community (role management, deposits, payouts).
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("deployer sees all 4 slots including Actions", () => {
    const gardenA = makeGarden("garden-a", {
      stewards: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA], isDeployer: true });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("owner sees Community but still not Actions", () => {
    const gardenA = makeGarden("garden-a", {
      owners: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("multi-garden union: steward in A + evaluator in B -> Work + Garden", () => {
    const gardenA = makeGarden("garden-a", {
      stewards: [ADDR_USER],
    });
    const gardenB = makeGarden("garden-b", {
      evaluators: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA, gardenB] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    // Union across all gardens: steward in A gives Garden + Community,
    // evaluator in B gives Work.
    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("single-garden scope: steward in A, evaluator in B, scope=B -> Hub and Garden only", () => {
    const gardenA = makeGarden("garden-a", {
      stewards: [ADDR_USER],
    });
    const gardenB = makeGarden("garden-b", {
      evaluators: [ADDR_USER],
    });

    setupDefaults({
      gardens: [gardenA, gardenB],
      selectedGarden: { id: "garden-b" },
    });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    // Steward authority in A does not grant Community access in B.
    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(false);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports loading until the eligible gardens resolve", () => {
    setupDefaults({ eligibleGardensLoaded: false });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.isLoading).toBe(true);
  });

  // A route guard shows its fallback while isLoading is true, so a terminal
  // state that stayed "loading" would hold the guard on its skeleton forever.
  // Community is the one slot that also authorizes routes, so it stays closed.
  it.each([
    ["the garden list failed with nothing to show", { eligibleGardensError: true, gardens: [] }],
    ["no address is connected", { address: "" }],
  ])("settles without loading, and keeps Community closed, when %s", (_state, overrides) => {
    setupDefaults(overrides);

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current).toEqual({
      showWork: true,
      showGarden: true,
      showCommunity: false,
      showActions: true,
      isLoading: false,
    });
  });

  it("uses role-confirmed fallback gardens when the base list is stale", () => {
    const recoveredGarden = makeGarden("garden-recovered", {
      stewards: [ADDR_USER],
    });

    setupDefaults({
      gardens: [recoveredGarden],
      selectedGarden: { id: "garden-recovered" },
      eligibleGardensError: true,
      hasStaleBaseList: true,
    });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    // Recovered garden has user as steward -> Community visible.
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
