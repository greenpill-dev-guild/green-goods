/**
 * useEligibleAdminGardens Hook Tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePrimaryAddress = vi.fn();
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockUsePrimaryAddress(),
}));

const mockUseCurrentChain = vi.fn();
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => mockUseCurrentChain(),
}));

const mockUseGardens = vi.fn();
vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mockUseGardens(),
}));

const mockUseRole = vi.fn();
vi.mock("../../../hooks/gardener/useRole", () => ({
  useRole: () => mockUseRole(),
}));

const mockUseAdminStore = vi.fn();
vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: unknown) => unknown) => mockUseAdminStore(selector),
  getAdminGardenScopeKey: (address?: string | null, chainId?: number | null) =>
    address && chainId ? `${chainId}:${address.toLowerCase()}` : null,
}));

import { useEligibleAdminGardens } from "../../../hooks/garden/useEligibleAdminGardens";

const ADDR_USER = "0x1111111111111111111111111111111111111111";

function makeGarden(
  id: string,
  name: string,
  overrides: Partial<{
    operators: string[];
    owners: string[];
    evaluators: string[];
  }> = {}
) {
  return {
    id,
    name,
    operators: [] as string[],
    owners: [] as string[],
    evaluators: [] as string[],
    ...overrides,
  };
}

function defaultRole() {
  return {
    role: "user" as const,
    operatorGardens: [] as Array<{ id: string; name: string }>,
    loading: false,
  };
}

describe("hooks/garden/useEligibleAdminGardens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePrimaryAddress.mockReturnValue(ADDR_USER);
    mockUseCurrentChain.mockReturnValue(11155111);
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });
    mockUseRole.mockReturnValue(defaultRole());
    mockUseAdminStore.mockImplementation((selector: (state: any) => any) =>
      selector({ lastGardenIdsByScope: {} })
    );
  });

  it("filters gardens to operator, owner, and evaluator memberships", () => {
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-operator", "Operator Garden", { operators: [ADDR_USER] }),
        makeGarden("garden-owner", "Owner Garden", { owners: [ADDR_USER] }),
        makeGarden("garden-evaluator", "Evaluator Garden", { evaluators: [ADDR_USER] }),
        makeGarden("garden-other", "Other Garden"),
      ],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens.map((garden) => garden.id)).toEqual([
      "garden-evaluator",
      "garden-operator",
      "garden-owner",
    ]);
    expect(result.current.hasStaleBaseList).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("prefers the persisted garden when it is still eligible", () => {
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-b", "Beta Garden", { operators: [ADDR_USER] }),
        makeGarden("garden-a", "Alpha Garden", { evaluators: [ADDR_USER] }),
      ],
      isFetched: true,
      isError: false,
    });
    mockUseAdminStore.mockImplementation((selector: (state: any) => any) =>
      selector({
        lastGardenIdsByScope: {
          "11155111:0x1111111111111111111111111111111111111111": "garden-b",
        },
      })
    );

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.persistedGardenId).toBe("garden-b");
    expect(result.current.resolvedDefaultGarden?.id).toBe("garden-b");
  });

  it("falls back to the alphabetical first eligible garden and reports create permission for deployers", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "deployer" });
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-z", "Zeta Garden", { operators: [ADDR_USER] }),
        makeGarden("garden-a", "Alpha Garden", { evaluators: [ADDR_USER] }),
      ],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.resolvedDefaultGarden?.id).toBe("garden-a");
    expect(result.current.canCreateGarden).toBe(true);
    expect(result.current.scopeKey).toBe("11155111:0x1111111111111111111111111111111111111111");
  });

  it("does not grant canCreateGarden for operator role (route gate is deployer-only)", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "operator" });
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { operators: [ADDR_USER] })],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.canCreateGarden).toBe(false);
  });

  it("returns no eligible gardens when the auth context has no primary address", () => {
    mockUsePrimaryAddress.mockReturnValue(null);
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { operators: [ADDR_USER] })],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toEqual([]);
    expect(result.current.scopeKey).toBeNull();
  });

  it("merges role-confirmed operator gardens missing from the base list (stale or errored base list)", () => {
    // Symptom: operator account hits 'no garden access' because useGardens returned []
    // (silent indexer error or stale cache) while useRole correctly proved operator status.
    mockUseRole.mockReturnValue({
      ...defaultRole(),
      role: "operator",
      operatorGardens: [{ id: "0xCafeGarden", name: "Cafe Garden" }],
    });
    mockUseGardens.mockReturnValue({
      data: [],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toHaveLength(1);
    expect(result.current.eligibleGardens[0]?.id.toLowerCase()).toBe("0xcafegarden");
    expect(result.current.eligibleGardens[0]?.name).toBe("Cafe Garden");
    expect(result.current.hasStaleBaseList).toBe(true);
  });

  it("does not duplicate when the operator garden is already in the base list", () => {
    mockUseRole.mockReturnValue({
      ...defaultRole(),
      role: "operator",
      operatorGardens: [{ id: "garden-a", name: "Alpha Garden" }],
    });
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { operators: [ADDR_USER] })],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toHaveLength(1);
    expect(result.current.hasStaleBaseList).toBe(false);
  });

  it("surfaces useGardens.isError so callers can render an error branch", () => {
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: true });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.isError).toBe(true);
  });

  it("reports isLoaded false while the role query is still loading", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), loading: true });
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.isLoaded).toBe(false);
  });
});
