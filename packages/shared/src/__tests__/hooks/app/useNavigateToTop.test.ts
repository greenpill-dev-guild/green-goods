/**
 * useNavigateToTop Hook Tests
 *
 * Tests the navigation helper with view transition support.
 * Scroll reset is handled by useScrollToTop in target views, not here.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

import { useNavigateToTop } from "../../../hooks/app/useNavigateToTop";

describe("hooks/app/useNavigateToTop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a navigation function", () => {
    const { result } = renderHook(() => useNavigateToTop());

    expect(typeof result.current).toBe("function");
  });

  it("navigates without touching scroll (scroll is handled by target view)", () => {
    const { result } = renderHook(() => useNavigateToTop());

    // Setup scroll container to verify it's NOT reset
    const scrollEl = document.createElement("div");
    scrollEl.id = "app-scroll";
    scrollEl.scrollTop = 500;
    document.body.appendChild(scrollEl);

    act(() => {
      result.current("/garden");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/garden", {
      viewTransition: true,
    });

    // Scroll should NOT be reset — that's the target view's responsibility
    expect(scrollEl.scrollTop).toBe(500);

    scrollEl.remove();
  });

  it("enables view transitions by default", () => {
    const { result } = renderHook(() => useNavigateToTop());

    act(() => {
      result.current("/path");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/path", {
      viewTransition: true,
    });
  });

  it("allows disabling view transitions", () => {
    const { result } = renderHook(() => useNavigateToTop());

    act(() => {
      result.current("/path", { viewTransition: false });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/path", {
      viewTransition: false,
    });
  });

  it("passes through additional navigation options", () => {
    const { result } = renderHook(() => useNavigateToTop());

    act(() => {
      result.current("/garden", {
        state: { from: "home" },
        replace: true,
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/garden", {
      state: { from: "home" },
      replace: true,
      viewTransition: true,
    });
  });
});
