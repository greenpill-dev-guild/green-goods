/**
 * @vitest-environment jsdom
 */

/**
 * usePageView Hook Test Suite
 *
 * Tests the SPA pageview tracking hook that fires page_view events
 * when the route changes.
 */

import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Mock PostHog track function
const mockTrack = vi.fn();
vi.mock("../../modules/app/posthog", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

import { usePageView } from "../../hooks/analytics/usePageView";

// Wrapper component that provides router context
function createWrapper(initialEntries: string[] = ["/"]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

// Helper hook to test navigation
function useTestPageView(options: Parameters<typeof usePageView>[0]) {
  usePageView(options);
  const navigate = useNavigate();
  return { navigate };
}

describe("usePageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.referrer
    Object.defineProperty(document, "referrer", {
      value: "https://google.com",
      configurable: true,
    });
  });

  it("should track initial pageview by default", () => {
    renderHook(() => usePageView({ app: "client" }), {
      wrapper: createWrapper(["/home"]),
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("page_view", {
      app: "client",
      path: "/home",
      search: undefined,
      hash: undefined,
      referrer: "https://google.com",
      is_initial: true,
    });
  });

  it("should not track initial pageview when trackInitial is false", () => {
    renderHook(() => usePageView({ app: "client", trackInitial: false }), {
      wrapper: createWrapper(["/home"]),
    });

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("should track pageview on route change", () => {
    const { result } = renderHook(() => useTestPageView({ app: "client" }), {
      wrapper: createWrapper(["/home"]),
    });

    // Clear initial pageview
    vi.clearAllMocks();

    // Navigate to a new page
    act(() => {
      result.current.navigate("/garden");
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("page_view", {
      app: "client",
      path: "/garden",
      search: undefined,
      hash: undefined,
      referrer: undefined, // Not initial, so no referrer
      is_initial: false,
    });
  });

  it("should exclude specified paths", () => {
    const { result } = renderHook(
      () => useTestPageView({ app: "client", excludePaths: ["/api", "/health"] }),
      {
        wrapper: createWrapper(["/home"]),
      }
    );

    // Clear initial pageview
    vi.clearAllMocks();

    // Navigate to excluded path
    act(() => {
      result.current.navigate("/api/users");
    });

    expect(mockTrack).not.toHaveBeenCalled();

    // Navigate to non-excluded path
    act(() => {
      result.current.navigate("/profile");
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({ path: "/profile" })
    );
  });

  it("should include search params (sanitized)", () => {
    renderHook(() => usePageView({ app: "client" }), {
      wrapper: createWrapper(["/search?q=test&page=1"]),
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({
        path: "/search",
        search: "?q=test&page=1",
      })
    );
  });

  it("should redact sensitive search params", () => {
    renderHook(() => usePageView({ app: "client" }), {
      wrapper: createWrapper(["/callback?token=secret123&state=abc&code=xyz"]),
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({
        path: "/callback",
        // URLSearchParams encodes brackets
        search: "?token=%5BREDACTED%5D&state=%5BREDACTED%5D&code=%5BREDACTED%5D",
      })
    );
  });

  it("should include hash when present", () => {
    renderHook(() => usePageView({ app: "client" }), {
      wrapper: createWrapper(["/docs#section-1"]),
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({
        path: "/docs",
        hash: "#section-1",
      })
    );
  });

  it("should use correct app identifier for admin", () => {
    renderHook(() => usePageView({ app: "admin" }), {
      wrapper: createWrapper(["/dashboard"]),
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({
        app: "admin",
        path: "/dashboard",
      })
    );
  });

  it("should not fire duplicate events for same path", () => {
    const { result } = renderHook(() => useTestPageView({ app: "client" }), {
      wrapper: createWrapper(["/home"]),
    });

    // Clear initial
    vi.clearAllMocks();

    // Navigate to same path (shouldn't happen in practice, but test the guard)
    act(() => {
      result.current.navigate("/home");
    });

    // Should not fire because path hasn't changed
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("should track multiple navigations correctly", () => {
    const { result } = renderHook(() => useTestPageView({ app: "client" }), {
      wrapper: createWrapper(["/home"]),
    });

    // Clear initial
    vi.clearAllMocks();

    // Navigate through multiple pages
    act(() => {
      result.current.navigate("/garden");
    });
    act(() => {
      result.current.navigate("/profile");
    });
    act(() => {
      result.current.navigate("/garden/123");
    });

    expect(mockTrack).toHaveBeenCalledTimes(3);

    const calls = mockTrack.mock.calls.map((call) => call[1].path);
    expect(calls).toEqual(["/garden", "/profile", "/garden/123"]);
  });
});
