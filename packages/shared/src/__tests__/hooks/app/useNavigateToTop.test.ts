/**
 * useNavigateToTop Hook Tests
 *
 * Tests the navigation helper that scrolls to top before navigating,
 * with view transition support.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

import { useNavigateToTop } from "../../../hooks/app/useNavigateToTop";

describe("hooks/app/useNavigateToTop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup app-scroll element
    const scrollEl = document.createElement("div");
    scrollEl.id = "app-scroll";
    scrollEl.scrollTop = 500;
    document.body.appendChild(scrollEl);
  });

  afterEach(() => {
    const el = document.getElementById("app-scroll");
    if (el) el.remove();
  });

  it("returns a navigation function", () => {
    const { result } = renderHook(() => useNavigateToTop());

    expect(typeof result.current).toBe("function");
  });

  it("scrolls app-scroll element to top before navigating", () => {
    const { result } = renderHook(() => useNavigateToTop());

    const scrollEl = document.getElementById("app-scroll")!;
    scrollEl.scrollTop = 500;

    act(() => {
      result.current("/garden");
    });

    expect(scrollEl.scrollTop).toBe(0);
    expect(mockNavigate).toHaveBeenCalledWith("/garden", {
      viewTransition: true,
    });
  });

  it("falls back to window.scrollTo when app-scroll element not found", () => {
    // Remove app-scroll
    document.getElementById("app-scroll")?.remove();

    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const { result } = renderHook(() => useNavigateToTop());

    act(() => {
      result.current("/home");
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(mockNavigate).toHaveBeenCalledWith("/home", {
      viewTransition: true,
    });

    scrollToSpy.mockRestore();
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
