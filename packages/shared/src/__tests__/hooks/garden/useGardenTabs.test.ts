/**
 * useGardenTabs Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests tab switching, scroll position tracking, and ref management for garden view tabs, and
 * which of the garden's gated entry points an account has (`useGardenAccess`), which the
 * garden's own page and Home's About section both read (PWA Home step 10, eval A5).
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GardenTab, useGardenAccess, useGardenTabs } from "../../../hooks/garden/useGardenTabs";
import type { Address, Garden } from "../../../types/domain";
import { createMockGarden } from "../../test-utils/mock-factories";

const ME = "0xa11ce00000000000000000000000000000000001" as Address;
const GARDEN = "0x6a7de00000000000000000000000000000000aaa" as Address;

// The roster predicates run for real on the garden's record; the reads are the edges.
const edges = vi.hoisted(() => ({
  account: null as string | null,
  vaults: [] as unknown[],
  vaultReads: [] as Array<[string | undefined, { enabled?: boolean } | undefined]>,
  deposits: [] as Array<{ shares: bigint }>,
  depositReads: [] as Array<[string | undefined, { userAddress?: string; enabled?: boolean }]>,
  evaluatorOnChain: false,
  roleReads: [] as Array<
    [string | null | undefined, string | null | undefined, string | undefined]
  >,
  strategies: [] as unknown[],
  strategyReads: [] as Array<[string | undefined, { enabled?: boolean } | undefined]>,
  governanceEnabled: false,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: edges.account }),
}));
vi.mock("../../../hooks/vault/useGardenVaults", () => ({
  useGardenVaults: (garden?: string, options?: { enabled?: boolean }) => {
    edges.vaultReads.push([garden, options]);
    return { vaults: edges.vaults };
  },
}));
vi.mock("../../../hooks/vault/useVaultDeposits", () => ({
  useVaultDeposits: (
    garden?: string,
    options: { userAddress?: string; enabled?: boolean } = {}
  ) => {
    edges.depositReads.push([garden, options]);
    return { deposits: options.enabled === false ? [] : edges.deposits };
  },
}));
vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (garden?: string | null, account?: string | null, role?: string) => {
    edges.roleReads.push([garden, account, role]);
    return { hasRole: Boolean(garden && account) && edges.evaluatorOnChain };
  },
}));
vi.mock("../../../hooks/conviction/useConvictionStrategies", () => ({
  useConvictionStrategies: (garden?: string, options?: { enabled?: boolean }) => {
    edges.strategyReads.push([garden, options]);
    return { strategies: options?.enabled === false ? [] : edges.strategies };
  },
}));
vi.mock("../../../config/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/app")>()),
  get GOVERNANCE_ENABLED() {
    return edges.governanceEnabled;
  },
}));

describe("useGardenAccess", () => {
  const garden = (
    roles: Partial<Pick<Garden, "gardeners" | "stewards" | "owners" | "evaluators">>
  ) =>
    createMockGarden({
      id: GARDEN,
      gardeners: [],
      stewards: [],
      owners: [],
      evaluators: [],
      ...roles,
    });
  const access = (record: Garden) => renderHook(() => useGardenAccess(record)).result.current;

  beforeEach(() => {
    edges.account = ME;
    edges.vaults = [{}];
    edges.vaultReads = [];
    edges.deposits = [];
    edges.depositReads = [];
    edges.evaluatorOnChain = false;
    edges.roleReads = [];
    edges.strategies = [];
    edges.strategyReads = [];
    edges.governanceEnabled = false;
  });

  it.each([
    [
      "a gardener",
      { gardeners: [ME] },
      { canReview: false, canManageRequests: false, showEndowment: false },
    ],
    [
      "a steward",
      { stewards: [ME] },
      { canReview: true, canManageRequests: true, showEndowment: true },
    ],
    [
      "an owner, who answers requests but does not review",
      { owners: [ME] },
      { canReview: false, canManageRequests: true, showEndowment: false },
    ],
  ] as const)("answers for %s from the garden's record", (_who, roles, expected) => {
    expect(access(garden(roles))).toMatchObject({
      ...expected,
      hasEndowmentDeposits: false,
      showGovernance: false,
    });
  });

  it("reviews for an evaluator the chain confirms, asked with this garden and this account", () => {
    edges.evaluatorOnChain = true;
    const result = access(garden({ gardeners: [ME] }));

    expect(result).toMatchObject({
      canReview: true,
      canManageRequests: false,
      showEndowment: true,
    });
    expect(edges.roleReads.at(-1)).toEqual([GARDEN, ME, "evaluator"]);
  });

  it("shows Endowment to a depositor who holds no role, named as the depositor they are", () => {
    edges.deposits = [{ shares: 5n }];
    const result = access(garden({}));

    expect(result).toMatchObject({
      canReview: false,
      canManageRequests: false,
      hasEndowmentDeposits: true,
      showEndowment: true,
    });
    // The account's own deposits are read for the account, in this garden.
    expect(edges.depositReads.at(-1)).toEqual([GARDEN, { userAddress: ME, enabled: true }]);
  });

  it("shows Endowment to no one while the garden has no vault, a steward included", () => {
    edges.vaults = [];
    edges.deposits = [{ shares: 5n }];
    expect(access(garden({ stewards: [ME] }))).toMatchObject({
      showEndowment: false,
      hasEndowmentDeposits: true,
    });
  });

  it("keeps Governance out while its flag is off, and reads no strategies for it", () => {
    edges.strategies = [{ id: "strategy" }];
    expect(access(garden({ stewards: [ME] })).showGovernance).toBe(false);
    expect(edges.strategyReads.at(-1)?.[1]).toMatchObject({ enabled: false });
  });

  it("shows Governance to a reviewer once the flag is on and a strategy is configured", () => {
    edges.governanceEnabled = true;
    edges.strategies = [{ id: "strategy" }];
    expect(access(garden({ stewards: [ME] })).showGovernance).toBe(true);
    expect(access(garden({ gardeners: [ME] })).showGovernance).toBe(false);
    edges.strategies = [];
    expect(access(garden({ stewards: [ME] })).showGovernance).toBe(false);
  });

  it("gives a signed-out reader nothing, and reads no deposits for them", () => {
    edges.account = null;
    edges.deposits = [{ shares: 5n }];
    expect(access(garden({ stewards: [ME] }))).toEqual({
      canReview: false,
      canManageRequests: false,
      hasEndowmentDeposits: false,
      showEndowment: false,
      showGovernance: false,
    });
    expect(edges.depositReads.at(-1)?.[1]).toMatchObject({ enabled: false });
  });
});

describe("useGardenTabs", () => {
  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts with Work tab active", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(result.current.activeTab).toBe(GardenTab.Work);
    });

    it("initializes scroll positions to 0 for all tabs", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(0);
      expect(result.current.scrollPositions[GardenTab.Insights]).toBe(0);
      expect(result.current.scrollPositions[GardenTab.Gardeners]).toBe(0);
    });

    it("provides refs for all three tabs", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current.tabRefs[GardenTab.Work]).toBeDefined();
      expect(result.current.tabRefs[GardenTab.Insights]).toBeDefined();
      expect(result.current.tabRefs[GardenTab.Gardeners]).toBeDefined();
    });
  });

  // ------------------------------------------
  // Tab switching
  // ------------------------------------------

  describe("tab switching", () => {
    it("switches to Insights tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Insights);
      });

      expect(result.current.activeTab).toBe(GardenTab.Insights);
    });

    it("switches to Gardeners tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Gardeners);
      });

      expect(result.current.activeTab).toBe(GardenTab.Gardeners);
    });

    it("can switch back to Work tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Insights);
      });

      act(() => {
        result.current.setActiveTab(GardenTab.Work);
      });

      expect(result.current.activeTab).toBe(GardenTab.Work);
    });
  });

  // ------------------------------------------
  // Scroll position tracking
  // ------------------------------------------

  describe("scroll position tracking", () => {
    it("updates scroll position on handleScroll", () => {
      const { result } = renderHook(() => useGardenTabs());

      const scrollHandler = result.current.handleScroll(GardenTab.Work);

      act(() => {
        scrollHandler({
          currentTarget: { scrollTop: 150 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(150);
    });

    it("tracks scroll positions per tab independently", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.handleScroll(GardenTab.Work)({
          currentTarget: { scrollTop: 100 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      act(() => {
        result.current.handleScroll(GardenTab.Insights)({
          currentTarget: { scrollTop: 200 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(100);
      expect(result.current.scrollPositions[GardenTab.Insights]).toBe(200);
      expect(result.current.scrollPositions[GardenTab.Gardeners]).toBe(0);
    });
  });

  // ------------------------------------------
  // API surface
  // ------------------------------------------

  describe("API surface", () => {
    it("returns all expected properties", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current).toHaveProperty("activeTab");
      expect(result.current).toHaveProperty("setActiveTab");
      expect(result.current).toHaveProperty("scrollPositions");
      expect(result.current).toHaveProperty("tabRefs");
      expect(result.current).toHaveProperty("handleScroll");
      expect(result.current).toHaveProperty("restoreScrollPosition");
    });

    it("handleScroll returns a function", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(typeof result.current.handleScroll(GardenTab.Work)).toBe("function");
    });

    it("restoreScrollPosition is a function", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(typeof result.current.restoreScrollPosition).toBe("function");
    });
  });

  // ------------------------------------------
  // GardenTab enum
  // ------------------------------------------

  describe("GardenTab enum", () => {
    it("has expected values", () => {
      expect(GardenTab.Work).toBe("work");
      expect(GardenTab.Insights).toBe("insights");
      expect(GardenTab.Gardeners).toBe("gardeners");
    });
  });
});
