/**
 * useEligibleAdminGardens Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
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

const mockGetNetworkConfig = vi.fn();
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getNetworkConfig: (chainId: number) => mockGetNetworkConfig(chainId),
}));

const mockUseGardenRecord = vi.fn();
vi.mock("../../../hooks/garden/useGardenRecord", () => ({
  useGardenRecord: (...args: unknown[]) => mockUseGardenRecord(...args),
}));

const mockGetGarden = vi.fn();
vi.mock("../../../modules/data/indexer-garden", () => ({
  getGarden: (...args: unknown[]) => mockGetGarden(...args),
}));

import { useEligibleAdminGardens } from "../../../hooks/garden/useEligibleAdminGardens";
import { createTestQueryClient } from "../../test-utils/query-client";

const ADDR_USER = "0x1111111111111111111111111111111111111111";

function makeGarden(
  id: string,
  name: string,
  overrides: Partial<{
    stewards: string[];
    owners: string[];
    evaluators: string[];
  }> = {}
) {
  return {
    id,
    name,
    stewards: [] as string[],
    owners: [] as string[],
    evaluators: [] as string[],
    ...overrides,
  };
}

function defaultRole() {
  return {
    role: "user" as const,
    stewardGardens: [] as Array<{ id: string; name: string }>,
    loading: false,
    gardensError: false,
  };
}

describe("hooks/garden/useEligibleAdminGardens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePrimaryAddress.mockReturnValue(ADDR_USER);
    mockUseCurrentChain.mockReturnValue(11155111);
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });
    mockUseRole.mockReturnValue(defaultRole());
    mockGetNetworkConfig.mockReturnValue({});
    mockUseGardenRecord.mockReturnValue({ data: undefined, isFetched: false });
    mockUseAdminStore.mockImplementation((selector: (state: any) => any) =>
      selector({ lastGardenIdsByScope: {} })
    );
  });

  it("filters gardens to steward, owner, and evaluator memberships", () => {
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-steward", "Steward Garden", { stewards: [ADDR_USER] }),
        makeGarden("garden-owner", "Owner Garden", { owners: [ADDR_USER] }),
        makeGarden("garden-evaluator", "Evaluator Garden", { evaluators: [ADDR_USER] }),
        makeGarden("garden-other", "Other Garden"),
      ],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens.map((garden) => garden.id)).toEqual([
      // Sorted by garden name: Evaluator < Owner < Steward.
      "garden-evaluator",
      "garden-owner",
      "garden-steward",
    ]);
    expect(result.current.hasStaleBaseList).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("prefers the persisted garden when it is still eligible", () => {
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-b", "Beta Garden", { stewards: [ADDR_USER] }),
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

  it("resolves the persisted garden when its id casing differs from the eligible list", () => {
    // Regression guard (PR #543): garden ids are Ethereum addresses. A checksummed
    // persisted id must still match the lowercase eligible-list id. Strict `===`
    // silently dropped the match and snapped the default back to the first garden.
    const ALPHA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const BETA_LOWER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const BETA_CHECKSUMMED = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden(ALPHA, "Alpha Garden", { stewards: [ADDR_USER] }),
        makeGarden(BETA_LOWER, "Beta Garden", { stewards: [ADDR_USER] }),
      ],
      isFetched: true,
      isError: false,
    });
    mockUseAdminStore.mockImplementation((selector: (state: any) => any) =>
      selector({
        lastGardenIdsByScope: {
          "11155111:0x1111111111111111111111111111111111111111": BETA_CHECKSUMMED,
        },
      })
    );

    const { result } = renderHook(() => useEligibleAdminGardens());

    // Without case-insensitive matching this resolves to ALPHA (alphabetical first).
    expect(result.current.resolvedDefaultGarden?.id).toBe(BETA_LOWER);
  });

  it("falls back to the alphabetical first eligible garden and reports create permission for deployers", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "deployer" });
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden("garden-z", "Zeta Garden", { stewards: [ADDR_USER] }),
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

  it("adds the protocol garden for a deployer without a role there, so its campaign jars stay reachable (DL-046)", () => {
    const root = "0xf401f34378384713222d1d21f63359cc4e8a858a";
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "deployer" });
    mockGetNetworkConfig.mockReturnValue({
      rootGarden: { address: "0xF401F34378384713222D1D21F63359CC4E8A858A", tokenId: 0 },
    });
    mockUseGardens.mockReturnValue({
      data: [
        makeGarden(root, "Green Goods Community Garden"),
        makeGarden("garden-z", "Zeta Garden", { stewards: [ADDR_USER] }),
        makeGarden("garden-other", "Other Garden"),
      ],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens.map((garden) => garden.id)).toEqual([root, "garden-z"]);
  });

  it("does not add the protocol garden for anyone but a deployer", () => {
    const root = "0xf401f34378384713222d1d21f63359cc4e8a858a";
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "steward" });
    mockGetNetworkConfig.mockReturnValue({ rootGarden: { address: root, tokenId: 0 } });
    mockUseGardens.mockReturnValue({
      data: [makeGarden(root, "Green Goods Community Garden")],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toEqual([]);
  });

  describe("a chain past the base list's newest 50 gardens (PRD-988)", () => {
    const ROOT = "0xF401F34378384713222D1D21F63359CC4E8A858A";
    const ZETA = makeGarden("garden-z", "Zeta Garden", { stewards: [ADDR_USER] });
    // The newest 50 hold the deployer's own garden but not the chain's first, the protocol garden.
    const listWithoutRoot = { data: [ZETA], isFetched: true, isError: false };

    beforeEach(() => {
      mockUseRole.mockReturnValue({ ...defaultRole(), role: "deployer" });
      mockGetNetworkConfig.mockReturnValue({ rootGarden: { address: ROOT, tokenId: 0 } });
      mockUseGardens.mockReturnValue(listWithoutRoot);
    });

    it("adds the protocol garden from its own indexer record", () => {
      mockUseGardenRecord.mockReturnValue({
        data: makeGarden(ROOT, "Green Goods Community Garden"),
        isFetched: true,
      });

      const { result } = renderHook(() => useEligibleAdminGardens());

      expect(mockUseGardenRecord).toHaveBeenCalledWith(ROOT, { enabled: true });
      expect(result.current.eligibleGardens.map((garden) => garden.name)).toEqual([
        "Green Goods Community Garden",
        "Zeta Garden",
      ]);
      expect(result.current.hasStaleBaseList).toBe(false);
      expect(result.current.isLoaded).toBe(true);
    });

    it("gives today's answer when that record cannot be read", () => {
      mockUseGardenRecord.mockReturnValue({ data: undefined, isError: true, isFetched: true });

      const { result } = renderHook(() => useEligibleAdminGardens());

      expect(result.current.eligibleGardens.map((garden) => garden.id)).toEqual(["garden-z"]);
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoaded).toBe(true);
    });

    it("keeps checking while that record is on its way", () => {
      mockUseGardenRecord.mockReturnValue({ data: undefined, isFetched: false });

      const { result } = renderHook(() => useEligibleAdminGardens());

      expect(result.current.isLoaded).toBe(false);
    });

    it("stays settled after a failed read when the content it lets mount reads the record again", async () => {
      const actual = await vi.importActual<typeof import("../../../hooks/garden/useGardenRecord")>(
        "../../../hooks/garden/useGardenRecord"
      );
      mockUseGardenRecord.mockImplementation(actual.useGardenRecord);
      mockGetGarden.mockRejectedValue(new Error("indexer unavailable"));
      const loaded: boolean[] = [];
      // The admin layout shows its spinner until the answer loads, then mounts
      // content that reads the same answer, and the same record, again.
      const Content = () => {
        useEligibleAdminGardens();
        return null;
      };
      const Layout = () => {
        const { isLoaded } = useEligibleAdminGardens();
        loaded.push(isLoaded);
        return isLoaded ? createElement(Content) : null;
      };
      const queryClient = createTestQueryClient();

      render(createElement(QueryClientProvider, { client: queryClient }, createElement(Layout)));

      await waitFor(() => expect(loaded.at(-1)).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 100));
      // The first read, and one more when the content mounts; never a spinner again.
      expect(mockGetGarden.mock.calls.length).toBeLessThanOrEqual(2);
      expect(loaded.slice(loaded.indexOf(true))).not.toContain(false);
    });

    it.each([
      ["the base list failed", { data: [], isFetched: true, isError: true }, ROOT],
      ["the base list is empty", { data: [], isFetched: true, isError: false }, ROOT],
      ["the root garden is the zero address", listWithoutRoot, `0x${"0".repeat(40)}`],
    ])("does not read it when %s", (_case, baseList, root) => {
      mockGetNetworkConfig.mockReturnValue({ rootGarden: { address: root, tokenId: 0 } });
      mockUseGardens.mockReturnValue(baseList);

      renderHook(() => useEligibleAdminGardens());

      expect(mockUseGardenRecord).not.toHaveBeenCalledWith(expect.anything(), { enabled: true });
    });
  });

  it("does not grant canCreateGarden for steward role (route gate is deployer-only)", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "steward" });
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { stewards: [ADDR_USER] })],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.canCreateGarden).toBe(false);
  });

  it("returns no eligible gardens when the auth context has no primary address", () => {
    mockUsePrimaryAddress.mockReturnValue(null);
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { stewards: [ADDR_USER] })],
      isFetched: true,
      isError: false,
    });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.eligibleGardens).toEqual([]);
    expect(result.current.scopeKey).toBeNull();
  });

  it("merges role-confirmed steward gardens missing from the base list (stale or errored base list)", () => {
    // Symptom: steward account hits 'no garden access' because useGardens returned []
    // (silent indexer error or stale cache) while useRole correctly proved steward status.
    mockUseRole.mockReturnValue({
      ...defaultRole(),
      role: "steward",
      stewardGardens: [{ id: "0xCafeGarden", name: "Cafe Garden" }],
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

  it("does not duplicate when the steward garden is already in the base list", () => {
    mockUseRole.mockReturnValue({
      ...defaultRole(),
      role: "steward",
      stewardGardens: [{ id: "garden-a", name: "Alpha Garden" }],
    });
    mockUseGardens.mockReturnValue({
      data: [makeGarden("garden-a", "Alpha Garden", { stewards: [ADDR_USER] })],
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

  it("surfaces useRole.gardensError so a steward-gardens outage renders an error branch, not no-access", () => {
    // The exact masking this fixes: the base list looks clean (empty, no error)
    // but the address-filtered steward-gardens query failed. Previously that
    // produced isError=false → "No garden access yet" instead of a retry.
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });
    mockUseRole.mockReturnValue({ ...defaultRole(), gardensError: true });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.isError).toBe(true);
  });

  it("preserves the deployer create-garden path during a steward-gardens outage", () => {
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });
    mockUseRole.mockReturnValue({ ...defaultRole(), role: "deployer", gardensError: true });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.canCreateGarden).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("reports isLoaded false while the role query is still loading", () => {
    mockUseRole.mockReturnValue({ ...defaultRole(), loading: true });
    mockUseGardens.mockReturnValue({ data: [], isFetched: true, isError: false });

    const { result } = renderHook(() => useEligibleAdminGardens());

    expect(result.current.isLoaded).toBe(false);
  });
});
