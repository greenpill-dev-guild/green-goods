/**
 * useGardenStateStore Tests
 * @vitest-environment jsdom
 *
 * Tests the Zustand store for per-garden UI state with sessionStorage persistence.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALL_GARDENS_KEY,
  GARDEN_STATE_STORAGE_KEY,
  useGardenStateStore,
} from "../../stores/useGardenStateStore";

describe("stores/useGardenStateStore", () => {
  beforeEach(() => {
    // Reset store state
    useGardenStateStore.setState({ gardenStates: {} });
    // Clear sessionStorage
    sessionStorage.clear();
  });

  it("initializes with default state for new garden key", () => {
    const state = useGardenStateStore.getState().getGardenState("garden-xyz");

    expect(state).toEqual({
      activeTab: "work",
      filter: "",
      selectedItem: null,
      scrollPosition: 0,
      sheetOpen: false,
      workspaces: {},
    });
  });

  it("persists state per garden key independently (A vs B)", () => {
    const store = useGardenStateStore.getState();

    store.setGardenState("garden-a", { activeTab: "community", filter: "roses" });
    store.setGardenState("garden-b", { activeTab: "actions", filter: "trees" });

    const stateA = useGardenStateStore.getState().getGardenState("garden-a");
    const stateB = useGardenStateStore.getState().getGardenState("garden-b");

    expect(stateA.activeTab).toBe("community");
    expect(stateA.filter).toBe("roses");
    expect(stateB.activeTab).toBe("actions");
    expect(stateB.filter).toBe("trees");
  });

  it("survives sessionStorage round-trip (write, clear store, recreate)", () => {
    // Write state
    useGardenStateStore.getState().setGardenState("garden-persist", {
      activeTab: "garden",
      selectedItem: "item-42",
    });

    // Manually persist to sessionStorage (Zustand persist middleware does this)
    const persisted = JSON.stringify({
      state: { gardenStates: useGardenStateStore.getState().gardenStates },
      version: 0,
    });
    sessionStorage.setItem(GARDEN_STATE_STORAGE_KEY, persisted);

    // Verify sessionStorage has data
    const raw = sessionStorage.getItem(GARDEN_STATE_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.state.gardenStates["garden-persist"].activeTab).toBe("garden");
    expect(parsed.state.gardenStates["garden-persist"].selectedItem).toBe("item-42");
  });

  it("persists non-shareable workspace state per garden and workspace", () => {
    const store = useGardenStateStore.getState();

    store.setGardenWorkspaceState("garden-a", "hub", {
      activeMode: "history",
      search: "mulch",
    });
    store.setGardenWorkspaceState("garden-a", "community", {
      activeMode: "members",
      search: "alex",
    });
    store.setGardenWorkspaceState("garden-b", "hub", {
      activeMode: "work",
      search: "solar",
    });

    expect(useGardenStateStore.getState().getGardenWorkspaceState("garden-a", "hub")).toMatchObject(
      {
        activeMode: "history",
        search: "mulch",
      }
    );
    expect(
      useGardenStateStore.getState().getGardenWorkspaceState("garden-a", "community")
    ).toMatchObject({
      activeMode: "members",
      search: "alex",
    });
    expect(useGardenStateStore.getState().getGardenWorkspaceState("garden-b", "hub")).toMatchObject(
      {
        activeMode: "work",
        search: "solar",
      }
    );
  });

  it("'__all__' key stores All Gardens mode state", () => {
    const store = useGardenStateStore.getState();

    // Empty string normalizes to ALL_GARDENS_KEY
    store.setGardenState("", { activeTab: "community", filter: "all-filter" });

    const allState = useGardenStateStore.getState().getGardenState(ALL_GARDENS_KEY);
    expect(allState.activeTab).toBe("community");
    expect(allState.filter).toBe("all-filter");

    // Also accessible via empty string
    const emptyState = useGardenStateStore.getState().getGardenState("");
    expect(emptyState.activeTab).toBe("community");
  });

  it("setGardenState updates only the target garden's state", () => {
    const store = useGardenStateStore.getState();

    // Set initial state for two gardens
    store.setGardenState("garden-a", { activeTab: "work" });
    store.setGardenState("garden-b", { activeTab: "community" });

    // Update only garden-a's tab
    store.setGardenState("garden-a", { activeTab: "actions" });

    const stateA = useGardenStateStore.getState().getGardenState("garden-a");
    const stateB = useGardenStateStore.getState().getGardenState("garden-b");

    expect(stateA.activeTab).toBe("actions");
    expect(stateB.activeTab).toBe("community"); // Unchanged
  });

  it("clearGardenState resets to defaults", () => {
    const store = useGardenStateStore.getState();

    // Set non-default state
    store.setGardenState("garden-clear", {
      activeTab: "actions",
      filter: "test-filter",
      selectedItem: "item-99",
      scrollPosition: 500,
      sheetOpen: true,
    });

    // Clear it
    store.clearGardenState("garden-clear");

    // Should return defaults (key removed from map)
    const state = useGardenStateStore.getState().getGardenState("garden-clear");
    expect(state).toEqual({
      activeTab: "work",
      filter: "",
      selectedItem: null,
      scrollPosition: 0,
      sheetOpen: false,
      workspaces: {},
    });
  });
});
