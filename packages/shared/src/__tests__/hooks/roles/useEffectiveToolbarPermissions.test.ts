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
    operators: [] as string[],
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
    isOperator?: boolean;
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
    isOperator = false,
    gardens = [],
  } = overrides;

  mockUseAccount.mockReturnValue({ address });
  mockUseAdminStore.mockImplementation(
    (selector: (state: { selectedGarden: typeof selectedGarden }) => unknown) =>
      selector({ selectedGarden })
  );
  mockUseRole.mockReturnValue({
    isDeployer,
    isOperator,
    loading: roleLoading,
  });
  mockUseEligibleAdminGardens.mockReturnValue({
    eligibleGardens: gardens,
    isLoaded: eligibleGardensLoaded,
    isError: eligibleGardensError,
    hasStaleBaseList,
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

  it("evaluator-only sees only Work (showWork: true, rest false)", () => {
    const gardenA = makeGarden("garden-a", {
      evaluators: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(false);
    expect(result.current.showCommunity).toBe(false);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("operator sees Work + Garden + Community; Actions stays deployer-only", () => {
    const gardenA = makeGarden("garden-a", {
      operators: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    // Operators participate in Community (role management, deposits, payouts).
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("deployer sees all 4 slots including Actions", () => {
    const gardenA = makeGarden("garden-a", {
      operators: [ADDR_USER],
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

  it("multi-garden union: operator in A + evaluator in B -> Work + Garden", () => {
    const gardenA = makeGarden("garden-a", {
      operators: [ADDR_USER],
    });
    const gardenB = makeGarden("garden-b", {
      evaluators: [ADDR_USER],
    });

    setupDefaults({ gardens: [gardenA, gardenB] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    // Union across all gardens: operator in A gives Garden + Community,
    // evaluator in B gives Work.
    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("single-garden scope: operator in A, evaluator in B, scope=B -> Work only", () => {
    const gardenA = makeGarden("garden-a", {
      operators: [ADDR_USER],
    });
    const gardenB = makeGarden("garden-b", {
      evaluators: [ADDR_USER],
    });

    setupDefaults({
      gardens: [gardenA, gardenB],
      selectedGarden: { id: "garden-b" },
    });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    // Scoped to garden B where user is only evaluator: only Work visible
    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(false);
    expect(result.current.showCommunity).toBe(false);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("error state: useGardens errors -> all visible (fail-open)", () => {
    setupDefaults({ eligibleGardensError: true, gardens: [] });

    const { result } = renderHook(() => useEffectiveToolbarPermissions());

    // When gardens data is undefined/null (error), the hook should still
    // produce a result. With no gardens in scope, hasAnyRole=false,
    // so all slots should be false. But the spec says fail-open on error.
    // This test asserts the DESIRED behavior (fail-open on error),
    // which may not match current implementation yet.
    expect(result.current.showWork).toBe(true);
    expect(result.current.showGarden).toBe(true);
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(true);
  });

  it("uses role-confirmed fallback gardens when the base list is stale", () => {
    const recoveredGarden = makeGarden("garden-recovered", {
      operators: [ADDR_USER],
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
    // Recovered garden has user as operator -> Community visible.
    expect(result.current.showCommunity).toBe(true);
    expect(result.current.showActions).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
