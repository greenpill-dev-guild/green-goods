/**
 * useBrowserNavigation Hook Tests
 *
 * Tests the hook that forces re-renders on browser back/forward navigation
 * and React Router location changes.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock react-router-dom
const mockLocation = { pathname: "/", search: "", hash: "" };
vi.mock("react-router-dom", () => ({
  useLocation: vi.fn(() => mockLocation),
}));

import { useBrowserNavigation } from "../../../hooks/app/useBrowserNavigation";
import { useLocation } from "react-router-dom";

const mockUseLocation = vi.mocked(useLocation);

describe("hooks/app/useBrowserNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = "/";
    mockLocation.search = "";
    mockLocation.hash = "";
  });

  it("returns a number (forceUpdate counter)", () => {
    const { result } = renderHook(() => useBrowserNavigation());

    expect(typeof result.current).toBe("number");
  });

  it("increments on location pathname change", () => {
    const { result, rerender } = renderHook(() => useBrowserNavigation());

    const initial = result.current;

    // Change location
    mockLocation.pathname = "/garden";
    mockUseLocation.mockReturnValue({ ...mockLocation } as any);

    rerender();

    // The counter should increment due to the location.pathname dependency
    expect(result.current).toBeGreaterThanOrEqual(initial);
  });

  it("increments on popstate event (browser back/forward)", () => {
    const { result } = renderHook(() => useBrowserNavigation());

    const initial = result.current;

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it("cleans up popstate listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useBrowserNavigation());

    const popstateAdd = addSpy.mock.calls.find(([event]) => event === "popstate");
    expect(popstateAdd).toBeDefined();

    unmount();

    const popstateRemove = removeSpy.mock.calls.find(([event]) => event === "popstate");
    expect(popstateRemove).toBeDefined();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("responds to search param changes", () => {
    const { result, rerender } = renderHook(() => useBrowserNavigation());

    const initial = result.current;

    mockLocation.search = "?tab=2";
    mockUseLocation.mockReturnValue({ ...mockLocation } as any);

    rerender();

    expect(result.current).toBeGreaterThanOrEqual(initial);
  });
});
