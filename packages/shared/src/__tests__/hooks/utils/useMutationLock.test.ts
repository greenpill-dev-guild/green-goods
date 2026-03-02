/**
 * useMutationLock Hook Tests
 *
 * Verifies that the mutation lock prevents double-submit by:
 * 1. Allowing the first invocation to proceed
 * 2. Reusing the in-flight promise on a second concurrent invocation
 * 3. Releasing the lock after the first completes (success or error)
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutationLock } from "../../../hooks/utils/useMutationLock";

describe("hooks/utils/useMutationLock", () => {
  it("allows a single invocation to proceed and return its result", async () => {
    const { result } = renderHook(() => useMutationLock());

    const fn = vi.fn().mockResolvedValue("result");
    const guarded = result.current.guard(fn);

    let value: string | undefined;
    await act(async () => {
      value = await guarded("arg1", "arg2");
    });

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    expect(value).toBe("result");
  });

  it("reuses in-flight promise on rapid double invocation", async () => {
    const { result } = renderHook(() => useMutationLock());

    // Create a slow function that we can control
    let resolveFirst!: (value: string) => void;
    const slowFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        })
    );

    const guarded = result.current.guard(slowFn);

    // Start first invocation (don't await — it's still in-flight)
    let firstResult: Promise<string>;
    act(() => {
      firstResult = guarded();
    });

    // Second invocation should reuse the first promise
    const secondResultPromise = guarded();

    // The slow function should only have been called once
    expect(slowFn).toHaveBeenCalledOnce();

    // Resolve the first to clean up
    await act(async () => {
      resolveFirst("done");
      await expect(firstResult!).resolves.toBe("done");
      await expect(secondResultPromise).resolves.toBe("done");
    });
  });

  it("releases the lock after successful completion, allowing a subsequent call", async () => {
    const { result } = renderHook(() => useMutationLock());

    const fn = vi.fn().mockResolvedValue("ok");
    const guarded = result.current.guard(fn);

    // First call
    await act(async () => {
      await guarded();
    });

    // Second call should work fine (lock released)
    await act(async () => {
      await guarded();
    });

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the lock even when the function throws", async () => {
    const { result } = renderHook(() => useMutationLock());

    const error = new Error("Transaction reverted");
    const fn = vi.fn().mockRejectedValue(error);
    const guarded = result.current.guard(fn);

    // First call fails
    await act(async () => {
      await expect(guarded()).rejects.toThrow("Transaction reverted");
    });

    // Lock should be released — next call should proceed
    const fn2 = vi.fn().mockResolvedValue("recovered");
    const guarded2 = result.current.guard(fn2);

    await act(async () => {
      const value = await guarded2();
      expect(value).toBe("recovered");
    });

    expect(fn2).toHaveBeenCalledOnce();
  });

  it("isLocked returns correct state during mutation lifecycle", async () => {
    const { result } = renderHook(() => useMutationLock());

    expect(result.current.isLocked()).toBe(false);

    let resolveFirst!: (value: string) => void;
    const slowFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const guarded = result.current.guard(slowFn);

    // Start in-flight
    let firstResult: Promise<string>;
    act(() => {
      firstResult = guarded();
    });

    expect(result.current.isLocked()).toBe(true);

    // Resolve
    await act(async () => {
      resolveFirst("done");
      await firstResult!;
    });

    expect(result.current.isLocked()).toBe(false);
  });
});
