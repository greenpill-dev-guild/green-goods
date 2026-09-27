/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitPresence } from "../../../hooks/utils/useExitPresence";

describe("useExitPresence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps a closed surface mounted for its exit, then lets it leave", () => {
    const { result, rerender } = renderHook(({ open }) => useExitPresence(open, 300), {
      initialProps: { open: false },
    });
    expect(result.current).toBe(false);

    rerender({ open: true });
    expect(result.current).toBe(true);

    rerender({ open: false });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it("stays mounted when it reopens during the exit", () => {
    const readExitMs = vi.fn(() => 300);
    const { result, rerender } = renderHook(({ open }) => useExitPresence(open, readExitMs), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    act(() => vi.advanceTimersByTime(200));
    rerender({ open: true });
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current).toBe(true);
    // The duration is read when a close starts, not on every render.
    expect(readExitMs).toHaveBeenCalledTimes(1);
  });
});
