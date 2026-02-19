/**
 * useAsyncEffect & useAsyncSetup Hook Tests
 * @vitest-environment jsdom
 *
 * Tests async effect execution, isMounted guards, AbortSignal,
 * error handling callbacks, and cleanup on unmount.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the logger to avoid console output
vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { useAsyncEffect, useAsyncSetup } from "../../../hooks/utils/useAsyncEffect";

// ============================================
// useAsyncEffect
// ============================================

describe("useAsyncEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("execution", () => {
    it("executes the async effect on mount", async () => {
      const effect = vi.fn().mockResolvedValue(undefined);

      renderHook(() => useAsyncEffect(effect, []));

      await vi.runAllTimersAsync();
      expect(effect).toHaveBeenCalledOnce();
    });

    it("provides context with isMounted and signal", async () => {
      let receivedContext: any;

      renderHook(() =>
        useAsyncEffect(async (ctx) => {
          receivedContext = ctx;
        }, [])
      );

      await vi.runAllTimersAsync();

      expect(receivedContext).toBeDefined();
      expect(typeof receivedContext.isMounted).toBe("function");
      expect(receivedContext.signal).toBeInstanceOf(AbortSignal);
    });

    it("isMounted returns true while mounted", async () => {
      let mountedDuringEffect = false;

      renderHook(() =>
        useAsyncEffect(async ({ isMounted }) => {
          mountedDuringEffect = isMounted();
        }, [])
      );

      await vi.runAllTimersAsync();
      expect(mountedDuringEffect).toBe(true);
    });
  });

  // ------------------------------------------
  // Unmount behavior
  // ------------------------------------------

  describe("unmount", () => {
    it("isMounted returns false after unmount", async () => {
      let checkMounted: (() => boolean) | undefined;

      const { unmount } = renderHook(() =>
        useAsyncEffect(async ({ isMounted }) => {
          checkMounted = isMounted;
          // Simulate slow async work
          await new Promise((r) => setTimeout(r, 100));
        }, [])
      );

      unmount();
      await vi.runAllTimersAsync();

      expect(checkMounted?.()).toBe(false);
    });

    it("signal is aborted on unmount", async () => {
      let capturedSignal: AbortSignal | undefined;

      const { unmount } = renderHook(() =>
        useAsyncEffect(async ({ signal }) => {
          capturedSignal = signal;
          await new Promise((r) => setTimeout(r, 100));
        }, [])
      );

      expect(capturedSignal?.aborted).toBe(false);

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });

    it("calls onCleanup callback on unmount", async () => {
      const onCleanup = vi.fn();

      const { unmount } = renderHook(() => useAsyncEffect(async () => {}, [], { onCleanup }));

      await vi.runAllTimersAsync();

      unmount();
      expect(onCleanup).toHaveBeenCalledOnce();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("calls onError callback when effect throws", async () => {
      const onError = vi.fn();
      const testError = new Error("Async failed");

      renderHook(() =>
        useAsyncEffect(
          async () => {
            throw testError;
          },
          [],
          { onError }
        )
      );

      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it("calls onCancel (not onError) when error occurs after abort", async () => {
      const onError = vi.fn();
      const onCancel = vi.fn();

      const { unmount } = renderHook(() =>
        useAsyncEffect(
          async () => {
            // Simulate work that will be interrupted
            await new Promise((r) => setTimeout(r, 100));
            throw new Error("Post-abort error");
          },
          [],
          { onError, onCancel }
        )
      );

      // Unmount before the async work completes
      unmount();
      await vi.runAllTimersAsync();

      // onCancel should be called, not onError, because we aborted
      expect(onCancel).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Dependency changes
  // ------------------------------------------

  describe("dependency changes", () => {
    it("re-runs effect when dependencies change", async () => {
      const effect = vi.fn().mockResolvedValue(undefined);

      const { rerender } = renderHook(({ dep }) => useAsyncEffect(effect, [dep]), {
        initialProps: { dep: 1 },
      });

      await vi.runAllTimersAsync();
      expect(effect).toHaveBeenCalledTimes(1);

      rerender({ dep: 2 });
      await vi.runAllTimersAsync();

      expect(effect).toHaveBeenCalledTimes(2);
    });

    it("aborts previous signal when dependencies change", async () => {
      const signals: AbortSignal[] = [];

      const { rerender } = renderHook(
        ({ dep }) =>
          useAsyncEffect(
            async ({ signal }) => {
              signals.push(signal);
            },
            [dep]
          ),
        { initialProps: { dep: 1 } }
      );

      await vi.runAllTimersAsync();
      rerender({ dep: 2 });
      await vi.runAllTimersAsync();

      // First signal should be aborted when deps changed
      expect(signals[0].aborted).toBe(true);
      // Second signal should still be active
      expect(signals[1].aborted).toBe(false);
    });
  });
});

// ============================================
// useAsyncSetup
// ============================================

describe("useAsyncSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes setup function on mount", async () => {
    const setup = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useAsyncSetup(setup, []));

    await vi.runAllTimersAsync();
    expect(setup).toHaveBeenCalledOnce();
  });

  it("provides AbortSignal to setup function", async () => {
    let receivedSignal: AbortSignal | undefined;

    renderHook(() =>
      useAsyncSetup(async (signal) => {
        receivedSignal = signal;
      }, [])
    );

    await vi.runAllTimersAsync();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it("runs cleanup function returned by setup", async () => {
    const cleanup = vi.fn();

    const { unmount } = renderHook(() =>
      useAsyncSetup(async () => {
        return cleanup;
      }, [])
    );

    await vi.runAllTimersAsync();

    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("calls onError callback when setup throws", async () => {
    const onError = vi.fn();
    const testError = new Error("Setup failed");

    renderHook(() =>
      useAsyncSetup(
        async () => {
          throw testError;
        },
        [],
        { onError }
      )
    );

    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it("does not call onError when aborted", async () => {
    const onError = vi.fn();

    const { unmount } = renderHook(() =>
      useAsyncSetup(
        async () => {
          await new Promise((r) => setTimeout(r, 1000));
          throw new Error("Should not report");
        },
        [],
        { onError }
      )
    );

    unmount();
    await vi.runAllTimersAsync();

    expect(onError).not.toHaveBeenCalled();
  });

  it("runs previous cleanup before new setup on dep change", async () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    let callCount = 0;

    const { rerender } = renderHook(
      ({ dep }) =>
        useAsyncSetup(async () => {
          callCount++;
          return callCount === 1 ? cleanup1 : cleanup2;
        }, [dep]),
      { initialProps: { dep: 1 } }
    );

    await vi.runAllTimersAsync();
    expect(callCount).toBe(1);

    rerender({ dep: 2 });
    await vi.runAllTimersAsync();

    // First cleanup should have been called when deps changed
    expect(cleanup1).toHaveBeenCalled();
  });
});
