/**
 * useFilteredGardens Tests
 *
 * Tests garden filtering by scope (all/mine), sorting (name/recent),
 * member counting, and filter state computation.
 */

import { describe, expect, it } from "vitest";
import {
  type GardenFiltersState,
  useFilteredGardens,
} from "../../../hooks/garden/useFilteredGardens";
import { Domain, type Garden } from "../../../types";

// ============================================
// Test Helpers
// ============================================

const USER_ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER_ADDRESS = "0x2222222222222222222222222222222222222222";

function createGarden(overrides: Partial<Garden> = {}): Garden {
  return {
    id: "garden-1",
    name: "Test Garden",
    description: "A test garden",
    address: "0xGarden1",
    tokenId: "1",
    bannerImage: "",
    logo: "",
    location: "",
    gardeners: [],
    stewards: [],
    owners: [],
    evaluators: [],
    actions: [],
    createdAt: 1000,
    ...overrides,
  } as Garden;
}

function defaultFilters(overrides: Partial<GardenFiltersState> = {}): GardenFiltersState {
  return {
    scope: "all",
    sort: "name",
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("useFilteredGardens", () => {
  // ------------------------------------------
  // Scope: all
  // ------------------------------------------

  describe("scope: all", () => {
    it("returns all gardens when scope is all", () => {
      const gardens = [
        createGarden({ id: "g1", name: "Garden A" }),
        createGarden({ id: "g2", name: "Garden B" }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters(), null);

      expect(result.filteredGardens).toHaveLength(2);
    });

    it("returns empty array when no gardens", () => {
      const result = useFilteredGardens([], defaultFilters(), null);

      expect(result.filteredGardens).toHaveLength(0);
    });
  });

  // ------------------------------------------
  // Scope: mine
  // ------------------------------------------

  describe("scope: mine", () => {
    it("filters to user's gardens only", () => {
      const gardens = [
        createGarden({
          id: "g1",
          name: "My Garden",
          gardeners: [USER_ADDRESS] as any[],
        }),
        createGarden({
          id: "g2",
          name: "Other Garden",
          gardeners: [OTHER_ADDRESS] as any[],
        }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ scope: "mine" }), USER_ADDRESS);

      expect(result.filteredGardens).toHaveLength(1);
      expect(result.filteredGardens[0].id).toBe("g1");
    });

    it("includes gardens where user is steward", () => {
      const gardens = [
        createGarden({
          id: "g1",
          name: "Operated Garden",
          stewards: [USER_ADDRESS] as any[],
        }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ scope: "mine" }), USER_ADDRESS);

      expect(result.filteredGardens).toHaveLength(1);
    });

    it("returns empty when user is null and scope is mine", () => {
      const gardens = [createGarden({ id: "g1" })];

      const result = useFilteredGardens(gardens, defaultFilters({ scope: "mine" }), null);

      expect(result.filteredGardens).toHaveLength(0);
    });

    it("returns empty when user has no gardens", () => {
      const gardens = [
        createGarden({
          id: "g1",
          gardeners: [OTHER_ADDRESS] as any[],
        }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ scope: "mine" }), USER_ADDRESS);

      expect(result.filteredGardens).toHaveLength(0);
    });
  });

  // ------------------------------------------
  // Sort
  // ------------------------------------------

  describe("sort", () => {
    it("sorts by name alphabetically", () => {
      const gardens = [
        createGarden({ id: "g1", name: "Zebra" }),
        createGarden({ id: "g2", name: "Apple" }),
        createGarden({ id: "g3", name: "Mango" }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ sort: "name" }), null);

      expect(result.filteredGardens.map((g) => g.name)).toEqual(["Apple", "Mango", "Zebra"]);
    });

    it("sorts by recent (newest first)", () => {
      const gardens = [
        createGarden({ id: "g1", name: "Old", createdAt: 100 }),
        createGarden({ id: "g2", name: "Newest", createdAt: 300 }),
        createGarden({ id: "g3", name: "Middle", createdAt: 200 }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ sort: "recent" }), null);

      expect(result.filteredGardens.map((g) => g.name)).toEqual(["Newest", "Middle", "Old"]);
    });

    it("handles gardens with undefined createdAt in recent sort", () => {
      const gardens = [
        createGarden({ id: "g1", name: "With Date", createdAt: 200 }),
        createGarden({ id: "g2", name: "No Date", createdAt: undefined }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ sort: "recent" }), null);

      expect(result.filteredGardens[0].name).toBe("With Date");
    });

    it("handles gardens with empty names in name sort", () => {
      const gardens = [
        createGarden({ id: "g1", name: "" }),
        createGarden({ id: "g2", name: "Alpha" }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters({ sort: "name" }), null);

      // Empty string sorts before "Alpha"
      expect(result.filteredGardens[0].name).toBe("");
      expect(result.filteredGardens[1].name).toBe("Alpha");
    });
  });

  // ------------------------------------------
  // myGardensCount
  // ------------------------------------------

  describe("myGardensCount", () => {
    it("counts gardens where user is member", () => {
      const gardens = [
        createGarden({
          id: "g1",
          gardeners: [USER_ADDRESS] as any[],
        }),
        createGarden({
          id: "g2",
          stewards: [USER_ADDRESS] as any[],
        }),
        createGarden({ id: "g3" }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters(), USER_ADDRESS);

      expect(result.myGardensCount).toBe(2);
    });

    it("returns 0 when user is null", () => {
      const gardens = [createGarden({ id: "g1" })];

      const result = useFilteredGardens(gardens, defaultFilters(), null);

      expect(result.myGardensCount).toBe(0);
    });

    it("returns 0 when user is not in any garden", () => {
      const gardens = [
        createGarden({
          id: "g1",
          gardeners: [OTHER_ADDRESS] as any[],
        }),
      ];

      const result = useFilteredGardens(gardens, defaultFilters(), USER_ADDRESS);

      expect(result.myGardensCount).toBe(0);
    });
  });

  // ------------------------------------------
  // Filter state
  // ------------------------------------------

  describe("filter state", () => {
    it("isFilterActive false with default filters", () => {
      const result = useFilteredGardens([], defaultFilters(), null);

      expect(result.isFilterActive).toBe(false);
      expect(result.activeFilterCount).toBe(0);
    });

    it("isFilterActive true with scope filter", () => {
      const result = useFilteredGardens([], defaultFilters({ scope: "mine" }), null);

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("isFilterActive true with sort filter", () => {
      const result = useFilteredGardens([], defaultFilters({ sort: "recent" }), null);

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("activeFilterCount 2 with both scope and sort filters", () => {
      const result = useFilteredGardens(
        [],
        defaultFilters({ scope: "mine", sort: "recent" }),
        null
      );

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(2);
    });
  });

  // ------------------------------------------
  // Combined filter + sort
  // ------------------------------------------

  describe("combined filter and sort", () => {
    it("filters to mine then sorts by name", () => {
      const gardens = [
        createGarden({
          id: "g1",
          name: "Zebra Garden",
          gardeners: [USER_ADDRESS] as any[],
        }),
        createGarden({
          id: "g2",
          name: "Apple Garden",
          gardeners: [USER_ADDRESS] as any[],
        }),
        createGarden({
          id: "g3",
          name: "AAA Other",
          gardeners: [OTHER_ADDRESS] as any[],
        }),
      ];

      const result = useFilteredGardens(gardens, { scope: "mine", sort: "name" }, USER_ADDRESS);

      expect(result.filteredGardens).toHaveLength(2);
      expect(result.filteredGardens[0].name).toBe("Apple Garden");
      expect(result.filteredGardens[1].name).toBe("Zebra Garden");
    });
  });

  // ------------------------------------------
  // Domains (DL-028 round: Filter Gardens at full)
  // ------------------------------------------

  describe("domains", () => {
    const solar = createGarden({ id: "solar", name: "Sun", domainMask: 1 << Domain.SOLAR });
    const agroEdu = createGarden({
      id: "agro-edu",
      name: "Grove",
      domainMask: (1 << Domain.AGRO) | (1 << Domain.EDU),
    });
    const untagged = createGarden({ id: "untagged", name: "Plot", domainMask: 0 });
    const gardens = [solar, agroEdu, untagged];

    it("keeps every garden when no domain is chosen", () => {
      const result = useFilteredGardens(gardens, defaultFilters({ domains: [] }), null);
      expect(result.filteredGardens).toHaveLength(3);
      expect(result.isFilterActive).toBe(false);
    });

    it("keeps gardens carrying any of the chosen domains", () => {
      const result = useFilteredGardens(
        gardens,
        defaultFilters({ domains: [Domain.EDU, Domain.SOLAR] }),
        null
      );
      expect(result.filteredGardens.map((garden) => garden.id)).toEqual(["agro-edu", "solar"]);
      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("drops untagged gardens once a domain is chosen and counts it with the other filters", () => {
      const result = useFilteredGardens(
        gardens,
        defaultFilters({ domains: [Domain.WASTE], sort: "recent", scope: "mine" }),
        null
      );
      expect(result.filteredGardens).toHaveLength(0);
      expect(result.activeFilterCount).toBe(3);
    });
  });
});
