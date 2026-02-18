/**
 * useTimeout & useDelayedInvalidation Hook Tests
 * @vitest-environment jsdom
 *
 * Tests timer management, automatic cleanup on unmount,
 * and the delayed invalidation pattern.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeout, useDelayedInvalidation } from "../../../hooks/utils/useTimeout";

describe("useTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ------------------------------------------
  // Basic set/clear
  // ------------------------------------------

  describe("set", () => {
    it("executes callback after specified delay", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(callback, 1000);
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback).toHaveBeenCalledOnce();
    });

    it("returns a cancel function", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useTimeout());

      let cancel: () => void;
      act(() => {
        cancel = result.current.set(callback, 1000);
      });

      act(() => {
        cancel();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("clears previous timeout when setting a new one", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(callback1, 1000);
      });

      act(() => {
        result.current.set(callback2, 1000);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe("clear", () => {
    it("prevents callback from executing", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(callback, 1000);
      });

      act(() => {
        result.current.clear();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("is safe to call when no timeout is pending", () => {
      const { result } = renderHook(() => useTimeout());

      // Should not throw
      act(() => {
        result.current.clear();
      });
    });
  });

  // ------------------------------------------
  // isPending
  // ------------------------------------------

  describe("isPending", () => {
    it("returns false when no timeout is scheduled", () => {
      const { result } = renderHook(() => useTimeout());
      expect(result.current.isPending()).toBe(false);
    });

    it("returns true when a timeout is scheduled", () => {
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(() => {}, 1000);
      });

      expect(result.current.isPending()).toBe(true);
    });

    it("returns false after timeout fires", () => {
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(() => {}, 1000);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isPending()).toBe(false);
    });

    it("returns false after clear is called", () => {
      const { result } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(() => {}, 1000);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.isPending()).toBe(false);
    });
  });

  // ------------------------------------------
  // Unmount cleanup
  // ------------------------------------------

  describe("unmount cleanup", () => {
    it("clears timeout on unmount", () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(callback, 5000);
      });

      unmount();

      vi.advanceTimersByTime(10000);
      expect(callback).not.toHaveBeenCalled();
    });

    it("does not execute callback after unmount", () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useTimeout());

      act(() => {
        result.current.set(callback, 100);
      });

      unmount();

      vi.advanceTimersByTime(200);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// useDelayedInvalidation
// ============================================

describe("useDelayedInvalidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls invalidate after default delay (5000ms)", () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useDelayedInvalidation(invalidate));

    act(() => {
      result.current.start();
    });

    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("calls invalidate after custom delay", () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useDelayedInvalidation(invalidate, 2000));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("cancel prevents invalidation", () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useDelayedInvalidation(invalidate, 1000));

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.cancel();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("isPending reflects scheduled state", () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useDelayedInvalidation(invalidate, 1000));

    expect(result.current.isPending()).toBe(false);

    act(() => {
      result.current.start();
    });

    expect(result.current.isPending()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isPending()).toBe(false);
  });

  it("uses latest invalidate function (ref pattern)", () => {
    const invalidate1 = vi.fn();
    const invalidate2 = vi.fn();

    const { result, rerender } = renderHook(({ fn }) => useDelayedInvalidation(fn, 1000), {
      initialProps: { fn: invalidate1 },
    });

    act(() => {
      result.current.start();
    });

    // Re-render with new invalidate function before timer fires
    rerender({ fn: invalidate2 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should call the latest function, not the original
    expect(invalidate1).not.toHaveBeenCalled();
    expect(invalidate2).toHaveBeenCalledOnce();
  });

  it("cleans up on unmount", () => {
    const invalidate = vi.fn();
    const { result, unmount } = renderHook(() => useDelayedInvalidation(invalidate, 1000));

    act(() => {
      result.current.start();
    });

    unmount();

    vi.advanceTimersByTime(2000);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
