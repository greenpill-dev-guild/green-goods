/**
 * useUrlFilters Hook Tests
 *
 * Tests the hook that manages filter state in URL search params,
 * providing a drop-in replacement for useState-based filter patterns.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock URLSearchParams used by the hook via react-router-dom
let mockParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();

vi.mock("react-router-dom", () => ({
  useSearchParams: vi.fn(() => [mockParams, mockSetSearchParams]),
}));

import { useUrlFilters } from "../../../hooks/app/useUrlFilters";

const DEFAULTS = { scope: "all", sort: "default" } as const;

describe("hooks/app/useUrlFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = new URLSearchParams();
    mockSetSearchParams.mockImplementation((updater: unknown) => {
      if (typeof updater === "function") {
        mockParams = updater(mockParams);
      }
    });
  });

  it("returns defaults when URL has no params", () => {
    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    expect(result.current.filters).toEqual({ scope: "all", sort: "default" });
  });

  it("reads values from URL search params", () => {
    mockParams = new URLSearchParams("scope=mine&sort=name");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    expect(result.current.filters).toEqual({ scope: "mine", sort: "name" });
  });

  it("ignores URL params not in defaults", () => {
    mockParams = new URLSearchParams("scope=mine&unrelated=foo");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    expect(result.current.filters).toEqual({ scope: "mine", sort: "default" });
  });

  it("setFilter updates a single param via setSearchParams", () => {
    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.setFilter("scope", "mine");
    });

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    // The updater should have been called and set scope=mine
    expect(mockParams.get("scope")).toBe("mine");
  });

  it("setFilter removes param when value equals default", () => {
    mockParams = new URLSearchParams("scope=mine");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.setFilter("scope", "all");
    });

    expect(mockParams.has("scope")).toBe(false);
  });

  it("setFilter removes param when value is undefined", () => {
    mockParams = new URLSearchParams("scope=mine");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.setFilter("scope", undefined);
    });

    expect(mockParams.has("scope")).toBe(false);
  });

  it("setFilter removes param when value is empty string", () => {
    mockParams = new URLSearchParams("scope=mine");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.setFilter("scope", "");
    });

    expect(mockParams.has("scope")).toBe(false);
  });

  it("resetFilters removes all filter params", () => {
    mockParams = new URLSearchParams("scope=mine&sort=name");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.resetFilters();
    });

    expect(mockParams.has("scope")).toBe(false);
    expect(mockParams.has("sort")).toBe(false);
  });

  it("resetFilters preserves non-filter params", () => {
    mockParams = new URLSearchParams("scope=mine&tab=details");

    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.resetFilters();
    });

    expect(mockParams.has("scope")).toBe(false);
    expect(mockParams.get("tab")).toBe("details");
  });

  it("uses parser to transform raw URL values", () => {
    mockParams = new URLSearchParams("domain=2");

    const parsers = {
      domain: (raw: string) => {
        const num = Number(raw);
        return Number.isNaN(num) ? undefined : String(num);
      },
    };

    const defaults = { domain: undefined as string | undefined, sort: "default" };

    const { result } = renderHook(() => useUrlFilters(defaults, parsers));

    expect(result.current.filters.domain).toBe("2");
  });

  it("parser returning undefined falls back to default", () => {
    mockParams = new URLSearchParams("domain=invalid");

    const parsers = {
      domain: (raw: string) => {
        const num = Number(raw);
        return Number.isNaN(num) ? undefined : String(num);
      },
    };

    const defaults = { domain: undefined as string | undefined, sort: "default" };

    const { result } = renderHook(() => useUrlFilters(defaults, parsers));

    expect(result.current.filters.domain).toBeUndefined();
  });

  it("setSearchParams is called with replace: true", () => {
    const { result } = renderHook(() => useUrlFilters(DEFAULTS));

    act(() => {
      result.current.setFilter("scope", "mine");
    });

    // Second argument should be { replace: true }
    expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });
  });
});
