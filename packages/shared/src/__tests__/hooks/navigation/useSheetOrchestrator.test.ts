/**
 * useSheetOrchestrator Tests
 * @vitest-environment jsdom
 *
 * Tests the navigation-aware hook that wraps useSheetOrchestratorStore.
 * Validates: open/close passthrough, onNavigateAway save/close timing,
 * and onNavigateArrive restore without auto-open.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSheetCloseAnimationMs,
  useSheetOrchestrator,
} from "../../../hooks/navigation/useSheetOrchestrator";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";

describe("hooks/navigation/useSheetOrchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useSheetOrchestratorStore.setState({
        viewStates: {},
        activeSheet: null,
        activeContentId: null,
      });
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // openSheet / closeSheet passthrough
  // =========================================================================

  it("openSheet updates store state", () => {
    const { result } = renderHook(() => useSheetOrchestrator());

    act(() => {
      result.current.openSheet("right", "detail-panel");
    });

    expect(result.current.activeSheet).toBe("right");
    expect(result.current.activeContentId).toBe("detail-panel");
  });

  it("closeSheet resets store state", () => {
    const { result } = renderHook(() => useSheetOrchestrator());

    act(() => {
      result.current.openSheet("left", "panel");
    });
    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.activeSheet).toBeNull();
    expect(result.current.activeContentId).toBeNull();
  });

  // =========================================================================
  // onNavigateAway
  // =========================================================================

  it("onNavigateAway saves state, closes sheet, and waits for the motion token", async () => {
    const { result } = renderHook(() => useSheetOrchestrator());

    act(() => {
      result.current.openSheet("left", "garden-form");
    });

    let resolved = false;
    let promise: Promise<void>;

    act(() => {
      promise = result.current.onNavigateAway("/gardens").then(() => {
        resolved = true;
      });
    });

    // State should be saved
    const saved = useSheetOrchestratorStore.getState().viewStates["/gardens"];
    expect(saved).toBeDefined();
    expect(saved!.sheetOpen).toBe("left");
    expect(saved!.sheetContentId).toBe("garden-form");

    // Sheet should be closed immediately
    expect(useSheetOrchestratorStore.getState().activeSheet).toBeNull();

    // Promise should NOT be resolved yet (waiting for sheet close motion)
    expect(resolved).toBe(false);

    // Advance past the fallback close duration used when CSS tokens are unavailable in jsdom.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await promise!;
    });

    expect(resolved).toBe(true);
  });

  it("onNavigateAway resolves immediately when no sheet is open", async () => {
    const { result } = renderHook(() => useSheetOrchestrator());

    let resolved = false;
    act(() => {
      void result.current.onNavigateAway("/empty").then(() => {
        resolved = true;
      });
    });

    // Should still save (null state)
    const saved = useSheetOrchestratorStore.getState().viewStates["/empty"];
    expect(saved).toBeDefined();
    expect(saved!.sheetOpen).toBeNull();

    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBe(true);
  });

  it("uses zero close delay when reduced motion is requested", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    expect(getSheetCloseAnimationMs()).toBe(0);

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  // =========================================================================
  // onNavigateArrive
  // =========================================================================

  it("onNavigateArrive returns saved state without auto-opening", () => {
    // Pre-populate saved state
    act(() => {
      useSheetOrchestratorStore.getState().openSheet("right", "work-detail");
    });
    act(() => {
      useSheetOrchestratorStore.getState().saveViewState("/hub");
    });
    act(() => {
      useSheetOrchestratorStore.getState().closeSheet();
    });

    const { result } = renderHook(() => useSheetOrchestrator());

    let restored: ReturnType<typeof result.current.onNavigateArrive>;
    act(() => {
      restored = result.current.onNavigateArrive("/hub");
    });

    // Should return saved state
    expect(restored!).not.toBeNull();
    expect(restored!.sheetOpen).toBe("right");
    expect(restored!.sheetContentId).toBe("work-detail");

    // Should NOT auto-open the sheet
    expect(result.current.activeSheet).toBeNull();
  });

  it("onNavigateArrive returns null for unknown path", () => {
    const { result } = renderHook(() => useSheetOrchestrator());

    let restored: ReturnType<typeof result.current.onNavigateArrive>;
    act(() => {
      restored = result.current.onNavigateArrive("/never-visited");
    });

    expect(restored!).toBeNull();
  });
});
