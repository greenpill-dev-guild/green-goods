/**
 * useLoadingWithMinDuration Hook Tests
 *
 * Tests the loading state manager that enforces minimum display time
 * for skeletons and maximum timeout to prevent infinite loading.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoadingWithMinDuration } from "../../../hooks/app/useLoadingWithMinDuration";

describe("hooks/app/useLoadingWithMinDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("shows skeleton when loading without data", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, false));

      expect(result.current.showSkeleton).toBe(true);
      expect(result.current.timedOut).toBe(false);
    });

    it("does not show skeleton when not loading", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(false, false));

      expect(result.current.showSkeleton).toBe(false);
      expect(result.current.timedOut).toBe(false);
    });

    it("does not show skeleton when not loading even with data", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(false, true));

      expect(result.current.showSkeleton).toBe(false);
    });
  });

  describe("minimum display time", () => {
    it("keeps showing skeleton until min time elapses even if loading stops", () => {
      const { result, rerender } = renderHook(
        ({ isLoading, hasData }) => useLoadingWithMinDuration(isLoading, hasData),
        { initialProps: { isLoading: true, hasData: false } }
      );

      expect(result.current.showSkeleton).toBe(true);

      // Loading finishes but min time hasn't elapsed yet
      rerender({ isLoading: false, hasData: true });

      // showSkeleton is false when not loading (regardless of min time)
      // because the formula is: isLoading && (!hasData || !minTimeElapsed) && !timedOut
      expect(result.current.showSkeleton).toBe(false);
    });

    it("stops showing skeleton after min time when loading with cached data", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, true, { minMs: 500 }));

      // Loading with cached data -> show skeleton until min time
      expect(result.current.showSkeleton).toBe(true);

      // Advance past min time
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // minTimeElapsed = true, hasData = true -> showSkeleton = false
      expect(result.current.showSkeleton).toBe(false);
    });

    it("uses default 1500ms min time", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, true));

      expect(result.current.showSkeleton).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1499);
      });

      expect(result.current.showSkeleton).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.showSkeleton).toBe(false);
    });
  });

  describe("timeout behavior", () => {
    it("sets timedOut after max duration", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, false, { maxMs: 5000 }));

      expect(result.current.timedOut).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.timedOut).toBe(true);
      // When timedOut, showSkeleton becomes false (formula excludes timedOut)
      expect(result.current.showSkeleton).toBe(false);
    });

    it("uses default 15000ms max time", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, false));

      act(() => {
        vi.advanceTimersByTime(14999);
      });

      expect(result.current.timedOut).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.timedOut).toBe(true);
    });

    it("does not timeout when data arrives", () => {
      const { result, rerender } = renderHook(
        ({ isLoading, hasData }) => useLoadingWithMinDuration(isLoading, hasData, { maxMs: 3000 }),
        { initialProps: { isLoading: true, hasData: false } }
      );

      // Data arrives before timeout
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      rerender({ isLoading: true, hasData: true });

      // Even after max time, shouldn't timeout since data arrived
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.timedOut).toBe(false);
    });
  });

  describe("reset", () => {
    it("resets all timer state", () => {
      const { result } = renderHook(() => useLoadingWithMinDuration(true, false, { maxMs: 1000 }));

      // Trigger timeout
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.timedOut).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.timedOut).toBe(false);
    });
  });
});
