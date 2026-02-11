/**
 * useDebouncedValue Hook Tests
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "../../hooks/utils/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update the value before the delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("a");
  });

  it("updates the value after the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("b");
  });

  it("resets the timer when value changes rapidly", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    );

    // Change to "b" and advance 200ms (not enough)
    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    // Change to "c" — timer resets
    rerender({ value: "c" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Still "a" because 200ms < 300ms from last change
    expect(result.current).toBe("a");

    // Advance remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c");
  });

  it("uses default delay of 300ms", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 1 } }
    );

    rerender({ value: 2 });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });

  it("works with bigint values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 0n } }
    );

    rerender({ value: 1000000000000000000n });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(1000000000000000000n);
  });

  it("cleans up timer on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    unmount();

    // Advancing timers after unmount should not cause errors
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // result.current retains last rendered value
    expect(result.current).toBe("a");
  });

  it("respects custom delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 1000),
      { initialProps: { value: "fast" } }
    );

    rerender({ value: "slow" });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("fast");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("slow");
  });
});
