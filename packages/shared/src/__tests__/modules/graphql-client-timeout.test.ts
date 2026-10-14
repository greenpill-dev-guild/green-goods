import { describe, expect, it, vi } from "vitest";
import { GRAPHQL_TIMEOUT_MS, TimeoutError, withTimeout } from "../../modules/data/graphql-client";

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await withTimeout(promise, 1000, "TestOp");
    expect(result).toBe("success");
  });

  it("rejects with TimeoutError when promise exceeds timeout", async () => {
    vi.useFakeTimers();

    // Promise that never resolves
    const neverResolves = new Promise(() => {});
    const timeoutPromise = withTimeout(neverResolves, 100, "SlowOp");

    // Advance time past the timeout
    vi.advanceTimersByTime(150);

    await expect(timeoutPromise).rejects.toThrow(TimeoutError);
    await expect(timeoutPromise).rejects.toThrow("SlowOp timed out after 100ms");

    vi.useRealTimers();
  });

  it("propagates original error when promise rejects before timeout", async () => {
    const originalError = new Error("Original error");
    const promise = Promise.reject(originalError);

    await expect(withTimeout(promise, 1000, "TestOp")).rejects.toThrow(originalError);
  });

  it("uses default timeout when not specified", async () => {
    vi.useFakeTimers();

    const neverResolves = new Promise(() => {});
    const timeoutPromise = withTimeout(neverResolves, undefined, "DefaultTimeoutOp");

    // Advance to default timeout
    vi.advanceTimersByTime(GRAPHQL_TIMEOUT_MS + 100);

    await expect(timeoutPromise).rejects.toThrow(TimeoutError);

    vi.useRealTimers();
  });

  // The pending timer count proves the timeout is cleared. Spying on the global clearTimeout under
  // fake timers left the fake clock's clearTimeout installed for every later file in the worker.
  it("clears timeout when promise resolves", async () => {
    vi.useFakeTimers();

    let resolver: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolver = resolve;
    });

    const timeoutPromise = withTimeout(promise, 1000, "TestOp");
    expect(vi.getTimerCount()).toBe(1);

    // Resolve before timeout
    resolver!("done");

    const result = await timeoutPromise;
    expect(result).toBe("done");
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("clears timeout when promise rejects", async () => {
    vi.useFakeTimers();

    let rejecter: (error: Error) => void;
    const promise = new Promise<string>((_, reject) => {
      rejecter = reject;
    });

    const timeoutPromise = withTimeout(promise, 1000, "TestOp");
    expect(vi.getTimerCount()).toBe(1);

    // Reject before timeout
    rejecter!(new Error("rejected"));

    await expect(timeoutPromise).rejects.toThrow("rejected");
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });
});

describe("TimeoutError", () => {
  it("has correct name and properties", () => {
    const error = new TimeoutError("Test timed out", 5000);

    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("Test timed out");
    expect(error.timeoutMs).toBe(5000);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof TimeoutError).toBe(true);
  });
});

describe("GRAPHQL_TIMEOUT_MS", () => {
  it("is set to 12 seconds", () => {
    expect(GRAPHQL_TIMEOUT_MS).toBe(12_000);
  });
});
