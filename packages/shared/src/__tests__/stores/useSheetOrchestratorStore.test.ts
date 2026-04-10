/**
 * useSheetOrchestratorStore Tests
 * @vitest-environment jsdom
 *
 * Tests the Zustand store for sheet orchestration with sessionStorage persistence.
 * Sheets persist their state across view navigation — when a user navigates away
 * from a view with an open sheet, the state is saved and restored on return.
 */

import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SHEET_STATE_STORAGE_KEY,
  useSheetOrchestratorStore,
} from "../../stores/useSheetOrchestratorStore";
import type { ViewSheetState } from "../../stores/useSheetOrchestratorStore";

describe("stores/useSheetOrchestratorStore", () => {
  beforeEach(() => {
    act(() => {
      useSheetOrchestratorStore.setState({
        viewStates: {},
        activeSheet: null,
        activeContentId: null,
      });
    });
    sessionStorage.clear();
  });

  // =========================================================================
  // openSheet / closeSheet
  // =========================================================================

  it("openSheet sets activeSheet and activeContentId", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("left", "create-action");
    });

    const state = useSheetOrchestratorStore.getState();
    expect(state.activeSheet).toBe("left");
    expect(state.activeContentId).toBe("create-action");
  });

  it("closeSheet resets activeSheet and activeContentId to null", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "work-detail");
    });
    act(() => {
      useSheetOrchestratorStore.getState().closeSheet();
    });

    const state = useSheetOrchestratorStore.getState();
    expect(state.activeSheet).toBeNull();
    expect(state.activeContentId).toBeNull();
  });

  it("openSheet overwrites previous active sheet", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("left", "content-a");
    });
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "content-b");
    });

    const state = useSheetOrchestratorStore.getState();
    expect(state.activeSheet).toBe("right");
    expect(state.activeContentId).toBe("content-b");
  });

  // =========================================================================
  // saveViewState / restoreViewState
  // =========================================================================

  it("saveViewState snapshots current active state into viewStates[path]", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("left", "create-garden");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/gardens");
    });

    const saved = useSheetOrchestratorStore.getState().viewStates["/gardens"];
    expect(saved).toBeDefined();
    expect(saved!.sheetOpen).toBe("left");
    expect(saved!.sheetContentId).toBe("create-garden");
  });

  it("saveViewState snapshots null state when no sheet is open", () => {
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/empty");
    });

    const saved = useSheetOrchestratorStore.getState().viewStates["/empty"];
    expect(saved).toBeDefined();
    expect(saved!.sheetOpen).toBeNull();
    expect(saved!.sheetContentId).toBeNull();
  });

  it("restoreViewState returns saved state for known path", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "member-list");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/members");
    });

    const restored = useSheetOrchestratorStore.getState().restoreViewState("/members");
    expect(restored).not.toBeNull();
    expect(restored!.sheetOpen).toBe("right");
    expect(restored!.sheetContentId).toBe("member-list");
  });

  it("restoreViewState returns null for unknown path", () => {
    const restored = useSheetOrchestratorStore.getState().restoreViewState("/nonexistent");
    expect(restored).toBeNull();
  });

  // =========================================================================
  // setFormState
  // =========================================================================

  it("setFormState creates viewState entry if not present", () => {
    act(() => {
      useSheetOrchestratorStore
        .getState()
        .setFormState("/gardens/new", { name: "My Garden", step: 2 });
    });

    const saved = useSheetOrchestratorStore.getState().viewStates["/gardens/new"];
    expect(saved).toBeDefined();
    expect(saved!.formState).toEqual({ name: "My Garden", step: 2 });
  });

  it("setFormState merges into existing viewState", () => {
    // Set up existing state
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("left", "form-x");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/form");
    });
    act(() => {
      useSheetOrchestratorStore.getState().setFormState("/form", { field1: "value1" });
    });

    const saved = useSheetOrchestratorStore.getState().viewStates["/form"];
    expect(saved!.sheetOpen).toBe("left");
    expect(saved!.formState).toEqual({ field1: "value1" });
  });

  // =========================================================================
  // setScrollPosition
  // =========================================================================

  it("setScrollPosition saves scroll for path", () => {
    act(() => {
      useSheetOrchestratorStore.getState().setScrollPosition("/work", 350);
    });

    const saved = useSheetOrchestratorStore.getState().viewStates["/work"];
    expect(saved).toBeDefined();
    expect(saved!.scrollPosition).toBe(350);
  });

  // =========================================================================
  // clearViewState
  // =========================================================================

  it("clearViewState removes entry for given path", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("left", "something");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/to-clear");
    });
    act(() => {
      useSheetOrchestratorStore.getState().clearViewState("/to-clear");
    });

    const restored = useSheetOrchestratorStore.getState().restoreViewState("/to-clear");
    expect(restored).toBeNull();
  });

  it("clearViewState is safe for nonexistent path", () => {
    expect(() => {
      act(() => {
        useSheetOrchestratorStore.getState().clearViewState("/does-not-exist");
      });
    }).not.toThrow();
  });

  // =========================================================================
  // sessionStorage persistence
  // =========================================================================

  it("persists viewStates to sessionStorage", () => {
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "detail");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/persisted-path");
    });

    // Manually check that sessionStorage has data
    const persisted = JSON.stringify({
      state: { viewStates: useSheetOrchestratorStore.getState().viewStates },
      version: 0,
    });
    sessionStorage.setItem(SHEET_STATE_STORAGE_KEY, persisted);

    const raw = sessionStorage.getItem(SHEET_STATE_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    const savedView = parsed.state.viewStates["/persisted-path"] as ViewSheetState;
    expect(savedView.sheetOpen).toBe("right");
    expect(savedView.sheetContentId).toBe("detail");
  });

  // =========================================================================
  // Independent path states
  // =========================================================================

  it("manages independent states for different paths", () => {
    const store = useSheetOrchestratorStore.getState();

    act(() => {
      store.openSheet("left", "garden-create");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/gardens");
    });

    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "work-detail");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/work");
    });

    const gardensState = useSheetOrchestratorStore.getState().restoreViewState("/gardens");
    const workState = useSheetOrchestratorStore.getState().restoreViewState("/work");

    expect(gardensState!.sheetOpen).toBe("left");
    expect(gardensState!.sheetContentId).toBe("garden-create");
    expect(workState!.sheetOpen).toBe("right");
    expect(workState!.sheetContentId).toBe("work-detail");
  });
});
