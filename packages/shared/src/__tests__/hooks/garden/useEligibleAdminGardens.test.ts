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

describe("hooks/garden/useEligibleAdminGardens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePrimaryAddress.mockReturnValue(ADDR_USER);
    mockUseCurrentChain.mockReturnValue(11155111);
    mockUseGardens.mockReturnValue({ data: [], isFetched: true });
    mockUseRole.mockReturnValue({ role: "user" });
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
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens.map((garden) => garden.id)).toEqual([
      "garden-evaluator",
      "garden-operator",
      "garden-owner",
    ]);
  });

  it("prefers the persisted garden when it is still eligible", () => {
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-b", "Beta Garden", { operators: [ADDR_USER] }),
        makeGarden("garden-a", "Alpha Garden", { evaluators: [ADDR_USER] }),
      ],
      isFetched: true,
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

  it("falls back to the alphabetical first eligible garden and reports create permission", () => {
    mockUseRole.mockReturnValue({ role: "operator" });
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-z", "Zeta Garden", { operators: [ADDR_USER] }),
        makeGarden("garden-a", "Alpha Garden", { evaluators: [ADDR_USER] }),
      ],
      isFetched: true,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.resolvedDefaultGarden?.id).toBe("garden-a");
    expect(result.current.canCreateGarden).toBe(true);
    expect(result.current.scopeKey).toBe("11155111:0x1111111111111111111111111111111111111111");
  });

  it("returns no eligible gardens when the auth context has no primary address", () => {
    mockUsePrimaryAddress.mockReturnValue(null);
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { operators: [ADDR_USER] })],
      isFetched: true,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toEqual([]);
    expect(result.current.scopeKey).toBeNull();
  });
});
