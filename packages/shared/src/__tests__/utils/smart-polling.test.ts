/**
 * Tests for smart polling with early exit
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create hoisted mocks
const { mockQueryData, mockInvalidateQueries, mockGetQueryData } = vi.hoisted(() => {
  const data = new Map<string, unknown[]>();
  const invalidate = vi.fn();
  const getData = vi.fn((key: unknown[]) => {
    const keyStr = JSON.stringify(key);
    return data.get(keyStr) || [];
  });
  return {
    mockQueryData: data,
    mockInvalidateQueries: invalidate,
    mockGetQueryData: getData,
  };
});

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

  it("should use default faster delays (1s, 2s, 4s)", async () => {
    const onAttempt = vi.fn();
    const queryKey = ["test", "query"] as const;

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey],
      onAttempt,
    });

    // Default: baseDelay=1000, maxDelay=4000
    // Attempt 1: 1s
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(1, 1000);

    // Attempt 2: 2s
    await vi.advanceTimersByTimeAsync(2000);
    expect(onAttempt).toHaveBeenCalledWith(2, 2000);

    // Attempt 3: 4s (capped at maxDelay)
    await vi.advanceTimersByTimeAsync(4000);
    expect(onAttempt).toHaveBeenCalledWith(3, 4000);

    // Attempt 4: 4s (capped at maxDelay)
    await vi.advanceTimersByTimeAsync(4000);
    expect(onAttempt).toHaveBeenCalledWith(4, 4000);

    await promise;
  });

  it("should exit early when data count increases", async () => {
    const onAttempt = vi.fn();
    const onDataChange = vi.fn();
    const queryKey = ["works", "online", "garden1", 84532];

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

    // After first delay, simulate new data appearing
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(1, 1000);

    // Simulate data change (new item added)
    mockQueryData.set(JSON.stringify(queryKey), [{ id: "new-work" }]);

    // Second delay - should detect change and exit
    await vi.advanceTimersByTimeAsync(2000);
    expect(onAttempt).toHaveBeenCalledWith(2, 2000);
    expect(onDataChange).toHaveBeenCalled();

    await promise;

    // Should NOT have attempted 3 or 4 (early exit)
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it("should complete all attempts when data does not change", async () => {
    const onAttempt = vi.fn();
    const onDataChange = vi.fn();
    const queryKey = ["works", "online", "garden1", 84532];

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

    // Run through all delays
    await vi.advanceTimersByTimeAsync(1000); // Attempt 1
    await vi.advanceTimersByTimeAsync(2000); // Attempt 2
    await vi.advanceTimersByTimeAsync(4000); // Attempt 3
    await vi.advanceTimersByTimeAsync(4000); // Attempt 4

    await promise;

    // Should complete all 4 attempts
    expect(onAttempt).toHaveBeenCalledTimes(4);
    // Should NOT call onDataChange (data didn't change)
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("should invalidate queries on each attempt", async () => {
    const queryKey1 = ["works", "online", "garden1", 84532];
    const queryKey2 = ["works", "merged", "garden1", 84532];

    const promise = pollQueriesAfterTransaction({
      queryKeys: [queryKey1, queryKey2],
      maxAttempts: 2,
      baseDelay: 100,
      maxDelay: 200,
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

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

    // Attempt 1: 500ms
    await vi.advanceTimersByTimeAsync(500);
    expect(onAttempt).toHaveBeenCalledWith(1, 500);

    // Attempt 2: 1000ms (capped)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(2, 1000);

    // Attempt 3: 1000ms (capped)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledWith(3, 1000);

    await promise;
  });

  it("should skip polling when no query keys provided", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await pollQueriesAfterTransaction({
      queryKeys: [],
    });

    expect(consoleWarn).toHaveBeenCalledWith("[Polling] No query keys provided, skipping polling");
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });
});
