import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSmartLoading, useAsyncOperation } from "@/hooks/useSmartLoading";

// Mock performance.now
const mockPerformanceNow = vi.fn();
vi.stubGlobal("performance", { now: mockPerformanceNow });

// Mock timers
vi.useFakeTimers();

describe("useSmartLoading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useSmartLoading());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.showSkeleton).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.shouldShowContent).toBe(true);
  });

  it("should start loading with debounce", async () => {
    const { result } = renderHook(() => useSmartLoading({ debounceTime: 100 }));

    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isDebouncing).toBe(true);
    expect(result.current.isLoading).toBe(false);

    // Fast-forward past debounce time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("should show skeleton after specified time", async () => {
    const { result } = renderHook(() =>
      useSmartLoading({
        debounceTime: 100,
        showSkeletonAfter: 200,
      })
    );

    act(() => {
      result.current.startLoading();
    });

    // Fast-forward past debounce time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.showSkeleton).toBe(false);

    // Fast-forward past skeleton time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.showSkeleton).toBe(true);
  });

  it("should respect minimum loading time", async () => {
    mockPerformanceNow
      .mockReturnValueOnce(0) // startLoading call
      .mockReturnValueOnce(200); // stopLoading call (200ms elapsed)

    const { result } = renderHook(() =>
      useSmartLoading({
        debounceTime: 0,
        minLoadingTime: 500,
      })
    );

    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopLoading();
    });

    // Should still be loading due to minimum time
    expect(result.current.isLoading).toBe(true);

    // Fast-forward remaining time (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should stop loading immediately if still debouncing", () => {
    const { result } = renderHook(() => useSmartLoading({ debounceTime: 100 }));

    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isDebouncing).toBe(true);

    act(() => {
      result.current.stopLoading();
    });

    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle multiple start/stop calls correctly", () => {
    const { result } = renderHook(() => useSmartLoading({ debounceTime: 100 }));

    // Start loading
    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isDebouncing).toBe(true);

    // Start again (should clear previous timeout)
    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isDebouncing).toBe(true);

    // Advance time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isLoading).toBe(true);
  });
});

describe("useAsyncOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it("should handle successful async operation", async () => {
    const { result } = renderHook(() => useAsyncOperation());

    const mockOperation = vi.fn().mockResolvedValue("success");

    let operationPromise: Promise<any>;
    act(() => {
      operationPromise = result.current.execute(mockOperation);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      const resultValue = await operationPromise;
      expect(resultValue).toBe("success");
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe("success");
    expect(result.current.hasData).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it("should handle async operation errors", async () => {
    const { result } = renderHook(() => useAsyncOperation());

    const error = new Error("Operation failed");
    const mockOperation = vi.fn().mockRejectedValue(error);

    let operationPromise: Promise<any>;
    act(() => {
      operationPromise = result.current.execute(mockOperation);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      try {
        await operationPromise;
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
    expect(result.current.hasError).toBe(true);
    expect(result.current.hasData).toBe(false);
  });

  it("should reset state correctly", () => {
    const { result } = renderHook(() => useAsyncOperation());

    // Set some initial state
    act(() => {
      result.current.execute(vi.fn().mockResolvedValue("test"));
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasData).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("should handle non-Error rejections", async () => {
    const { result } = renderHook(() => useAsyncOperation());

    const mockOperation = vi.fn().mockRejectedValue("string error");

    let operationPromise: Promise<any>;
    act(() => {
      operationPromise = result.current.execute(mockOperation);
    });

    await act(async () => {
      try {
        await operationPromise;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe("An error occurred");
      }
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
