/**
 * useFilteredActions Tests
 *
 * Tests action filtering by domain, text search, sorting (default/title/recent),
 * and filter state computation.
 */

import { describe, expect, it } from "vitest";
import {
  useFilteredActions,
  type ActionFiltersState,
} from "../../../hooks/action/useFilteredActions";
import { Domain } from "../../../types";
import type { Action } from "../../../types";

// ============================================
// Test Helpers
// ============================================

function createAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    slug: "test-action",
    title: "Test Action",
    description: "A test action",
    startTime: 1000,
    endTime: 2000,
    capitals: [],
    media: [],
    domain: Domain.SOLAR,
    createdAt: 1000,
    inputs: [],
    ...overrides,
  } as Action;
}

function defaultFilters(overrides: Partial<ActionFiltersState> = {}): ActionFiltersState {
  return {
    sort: "default",
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("useFilteredActions", () => {
  // ------------------------------------------
  // No filters
  // ------------------------------------------

  describe("no filters", () => {
    it("returns all actions with default filters", () => {
      const actions = [createAction({ id: "a1" }), createAction({ id: "a2" })];

      const result = useFilteredActions(actions, defaultFilters());

      expect(result.filteredActions).toHaveLength(2);
    });

    it("returns empty array when no actions", () => {
      const result = useFilteredActions([], defaultFilters());

      expect(result.filteredActions).toHaveLength(0);
    });
  });

  // ------------------------------------------
  // Domain filter
  // ------------------------------------------

  describe("domain filter", () => {
    it("filters by SOLAR domain", () => {
      const actions = [
        createAction({ id: "a1", domain: Domain.SOLAR }),
        createAction({ id: "a2", domain: Domain.AGRO }),
        createAction({ id: "a3", domain: Domain.SOLAR }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ domain: Domain.SOLAR }));

      expect(result.filteredActions).toHaveLength(2);
      expect(result.filteredActions.map((a) => a.id)).toEqual(["a1", "a3"]);
    });

    it("filters by AGRO domain", () => {
      const actions = [
        createAction({ id: "a1", domain: Domain.SOLAR }),
        createAction({ id: "a2", domain: Domain.AGRO }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ domain: Domain.AGRO }));

      expect(result.filteredActions).toHaveLength(1);
      expect(result.filteredActions[0].id).toBe("a2");
    });

    it("returns empty when no actions match domain", () => {
      const actions = [createAction({ id: "a1", domain: Domain.SOLAR })];

      const result = useFilteredActions(actions, defaultFilters({ domain: Domain.EDU }));

      expect(result.filteredActions).toHaveLength(0);
    });

    it("returns all when domain is undefined", () => {
      const actions = [
        createAction({ id: "a1", domain: Domain.SOLAR }),
        createAction({ id: "a2", domain: Domain.AGRO }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ domain: undefined }));

      expect(result.filteredActions).toHaveLength(2);
    });
  });

  // ------------------------------------------
  // Search
  // ------------------------------------------

  describe("search", () => {
    it("filters by title match", () => {
      const actions = [
        createAction({ id: "a1", title: "Plant Trees" }),
        createAction({ id: "a2", title: "Install Panels" }),
        createAction({ id: "a3", title: "Plant Seeds" }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ search: "plant" }));

      expect(result.filteredActions).toHaveLength(2);
      expect(result.filteredActions.map((a) => a.id)).toEqual(["a1", "a3"]);
    });

    it("filters by description match", () => {
      const actions = [
        createAction({ id: "a1", title: "Action A", description: "Solar energy project" }),
        createAction({ id: "a2", title: "Action B", description: "Composting initiative" }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ search: "solar" }));

      expect(result.filteredActions).toHaveLength(1);
      expect(result.filteredActions[0].id).toBe("a1");
    });

    it("is case-insensitive", () => {
      const actions = [createAction({ id: "a1", title: "Solar Panels" })];

      const result = useFilteredActions(actions, defaultFilters({ search: "SOLAR" }));

      expect(result.filteredActions).toHaveLength(1);
    });

    it("returns empty when no match", () => {
      const actions = [createAction({ id: "a1", title: "Plant Trees" })];

      const result = useFilteredActions(actions, defaultFilters({ search: "zzz" }));

      expect(result.filteredActions).toHaveLength(0);
    });

    it("does not filter when search is empty", () => {
      const actions = [createAction({ id: "a1" }), createAction({ id: "a2" })];

      const result = useFilteredActions(actions, defaultFilters({ search: "" }));

      expect(result.filteredActions).toHaveLength(2);
    });

    it("combines with domain filter", () => {
      const actions = [
        createAction({ id: "a1", title: "Solar Farm", domain: Domain.SOLAR }),
        createAction({ id: "a2", title: "Solar School", domain: Domain.EDU }),
        createAction({ id: "a3", title: "Wind Farm", domain: Domain.SOLAR }),
      ];

      const result = useFilteredActions(actions, {
        sort: "default",
        search: "solar",
        domain: Domain.SOLAR,
      });

      expect(result.filteredActions).toHaveLength(1);
      expect(result.filteredActions[0].id).toBe("a1");
    });
  });

  // ------------------------------------------
  // Sort
  // ------------------------------------------

  describe("sort", () => {
    it("preserves original order with default sort", () => {
      const actions = [
        createAction({ id: "a1", title: "Zebra" }),
        createAction({ id: "a2", title: "Apple" }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ sort: "default" }));

      expect(result.filteredActions[0].title).toBe("Zebra");
      expect(result.filteredActions[1].title).toBe("Apple");
    });

    it("sorts by title alphabetically", () => {
      const actions = [
        createAction({ id: "a1", title: "Zebra" }),
        createAction({ id: "a2", title: "Apple" }),
        createAction({ id: "a3", title: "Mango" }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ sort: "title" }));

      expect(result.filteredActions.map((a) => a.title)).toEqual(["Apple", "Mango", "Zebra"]);
    });

    it("sorts by recent (newest first)", () => {
      const actions = [
        createAction({ id: "a1", title: "Old", createdAt: 100 }),
        createAction({ id: "a2", title: "Newest", createdAt: 300 }),
        createAction({ id: "a3", title: "Middle", createdAt: 200 }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ sort: "recent" }));

      expect(result.filteredActions.map((a) => a.title)).toEqual(["Newest", "Middle", "Old"]);
    });

    it("handles actions with empty titles in title sort", () => {
      const actions = [
        createAction({ id: "a1", title: "" }),
        createAction({ id: "a2", title: "Alpha" }),
      ];

      const result = useFilteredActions(actions, defaultFilters({ sort: "title" }));

      expect(result.filteredActions[0].title).toBe("");
      expect(result.filteredActions[1].title).toBe("Alpha");
    });
  });

  // ------------------------------------------
  // Filter state
  // ------------------------------------------

  describe("filter state", () => {
    it("isFilterActive false with default filters", () => {
      const result = useFilteredActions([], defaultFilters());

      expect(result.isFilterActive).toBe(false);
      expect(result.activeFilterCount).toBe(0);
    });

    it("isFilterActive true with domain filter", () => {
      const result = useFilteredActions([], defaultFilters({ domain: Domain.SOLAR }));

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("isFilterActive true with sort filter", () => {
      const result = useFilteredActions([], defaultFilters({ sort: "title" }));

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("isFilterActive true with search", () => {
      const result = useFilteredActions([], defaultFilters({ search: "test" }));

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(1);
    });

    it("activeFilterCount 3 with all filters", () => {
      const result = useFilteredActions([], {
        sort: "title",
        domain: Domain.SOLAR,
        search: "test",
      });

      expect(result.isFilterActive).toBe(true);
      expect(result.activeFilterCount).toBe(3);
    });
  });
});
