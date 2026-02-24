/**
 * Tests for smart polling with early exit
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create hoisted mocks
const { mockQueryData, mockInvalidateQueries, mockGetQueryData, mockLoggerWarn } = vi.hoisted(
  () => {
    const data = new Map<string, unknown[]>();
    const invalidate = vi.fn();
    const getData = vi.fn((key: unknown[]) => {
      const keyStr = JSON.stringify(key);
      return data.get(keyStr) || [];
    });
    const logWarn = vi.fn();
    return {
      mockQueryData: data,
      mockInvalidateQueries: invalidate,
      mockGetQueryData: getData,
      mockLoggerWarn: logWarn,
    };
  }
);

// Mock react-query
vi.mock("../../config/react-query", () => ({
  queryClient: {
    getQueryData: mockGetQueryData,
    invalidateQueries: mockInvalidateQueries,
  },
}));

vi.mock("../../utils/debug", () => ({
  debugLog: vi.fn(),
}));

vi.mock("../../modules/app/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { pollQueriesAfterTransaction } from "../../utils/blockchain/polling";

describe("smart polling with early exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockQueryData.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should use default faster delays (immediate first, then exponential backoff)", async () => {
    const onAttempt = vi.fn();
    const queryKey = ["test", "query"] as const;

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey],
      onAttempt,
    });

    // Default: initialDelayMs=0, baseDelay=500, maxDelay=4000
    // Attempt 1: immediate (0ms)
    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledWith(1, 0);

    // Attempt 2: 500ms (baseDelay)
    await vi.advanceTimersByTimeAsync(500);
    expect(onAttempt).toHaveBeenCalledWith(2, 500);

    // Attempt 3: 1000ms (baseDelay * 2)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(3, 1000);

    // Attempt 4: 2000ms (baseDelay * 4)
    await vi.advanceTimersByTimeAsync(2000);
    expect(onAttempt).toHaveBeenCalledWith(4, 2000);

    await promise;
  });

  it("should exit early when data count increases", async () => {
    const onAttempt = vi.fn();
    const onDataChange = vi.fn();
    const queryKey = ["works", "online", "garden1", 11155111];

    // Start with empty data
    mockQueryData.set(JSON.stringify(queryKey), []);

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey],
      onAttempt,
      onDataChange,
      baseDelay: 1000,
      maxDelay: 4000,
      maxAttempts: 4,
    });

    // First attempt is immediate (initialDelayMs=0 by default)
    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledWith(1, 0);

    // Simulate data change (new item added) after first check
    mockQueryData.set(JSON.stringify(queryKey), [{ id: "new-work" }]);

    // Second attempt with baseDelay - should detect change and exit
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(2, 1000);
    expect(onDataChange).toHaveBeenCalled();

    await promise;

    // Should NOT have attempted 3 or 4 (early exit)
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it("should complete all attempts when data does not change", async () => {
    const onAttempt = vi.fn();
    const onDataChange = vi.fn();
    const queryKey = ["works", "online", "garden1", 11155111];

    // Data stays empty throughout
    mockQueryData.set(JSON.stringify(queryKey), []);

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey],
      onAttempt,
      onDataChange,
      baseDelay: 1000,
      maxDelay: 4000,
      maxAttempts: 4,
    });

    // Run through all delays (immediate first, then exponential backoff)
    await vi.advanceTimersByTimeAsync(0); // Attempt 1 (immediate)
    await vi.advanceTimersByTimeAsync(1000); // Attempt 2 (baseDelay)
    await vi.advanceTimersByTimeAsync(2000); // Attempt 3 (baseDelay * 2)
    await vi.advanceTimersByTimeAsync(4000); // Attempt 4 (baseDelay * 4, capped at maxDelay)

    await promise;

    // Should complete all 4 attempts
    expect(onAttempt).toHaveBeenCalledTimes(4);
    // Should NOT call onDataChange (data didn't change)
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("should invalidate queries on each attempt", async () => {
    const queryKey1 = ["works", "online", "garden1", 11155111];
    const queryKey2 = ["works", "merged", "garden1", 11155111];

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey1, queryKey2],
      maxAttempts: 2,
      baseDelay: 100,
      maxDelay: 200,
    });

    // Attempt 1 is immediate (0ms), Attempt 2 is baseDelay (100ms)
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);

    await promise;

    // Should invalidate both queries on each attempt
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(4); // 2 queries × 2 attempts
  });

  it("should respect custom baseDelay and maxDelay", async () => {
    const onAttempt = vi.fn();
    const queryKey = ["test"] as const;

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey],
      onAttempt,
      baseDelay: 500, // Custom base
      maxDelay: 1000, // Custom max
      maxAttempts: 3,
    });

    // Attempt 1: immediate (0ms - default initialDelayMs)
    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledWith(1, 0);

    // Attempt 2: 500ms (baseDelay)
    await vi.advanceTimersByTimeAsync(500);
    expect(onAttempt).toHaveBeenCalledWith(2, 500);

    // Attempt 3: 1000ms (baseDelay * 2, capped at maxDelay)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(3, 1000);

    await promise;
  });

  it("should skip polling when no query keys provided", async () => {
    await pollQueriesAfterTransaction({
      queryKeys: [],
    });

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[Polling] No query keys provided, skipping polling"
    );
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
