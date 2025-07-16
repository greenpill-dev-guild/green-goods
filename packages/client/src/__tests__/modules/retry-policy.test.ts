import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the retry policy module since it doesn't exist yet
interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  jitter: boolean;
}

interface RetryState {
  attempts: number;
  lastAttempt: number;
  nextAttempt: number;
  backoffDelay: number;
}

class RetryManager {
  private retryStates = new Map<string, RetryState>();

  constructor(
    private policy: RetryPolicy = {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 10000,
      jitter: false,
    }
  ) {}

  shouldRetry(workId: string): boolean {
    const state = this.getRetryState(workId);

    if (state.attempts >= this.policy.maxAttempts) {
      return false;
    }

    if (Date.now() < state.nextAttempt) {
      return false;
    }

    return true;
  }

  recordAttempt(workId: string, success: boolean): void {
    const state = this.getRetryState(workId);

    if (success) {
      this.retryStates.delete(workId);
      return;
    }

    state.attempts++;
    state.lastAttempt = Date.now();

    let delay = Math.min(
      this.policy.baseDelay * Math.pow(this.policy.backoffMultiplier, state.attempts - 1),
      this.policy.maxDelay
    );

    if (this.policy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    state.backoffDelay = delay;
    state.nextAttempt = Date.now() + delay;

    this.retryStates.set(workId, state);
  }

  getRetryState(workId: string): RetryState {
    if (!this.retryStates.has(workId)) {
      this.retryStates.set(workId, {
        attempts: 0,
        lastAttempt: 0,
        nextAttempt: 0,
        backoffDelay: 0,
      });
    }
    return this.retryStates.get(workId)!;
  }

  getTimeUntilNextRetry(workId: string): number {
    const state = this.getRetryState(workId);
    return Math.max(0, state.nextAttempt - Date.now());
  }

  reset(workId: string): void {
    this.retryStates.delete(workId);
  }

  resetAll(): void {
    this.retryStates.clear();
  }

  getAllPendingRetries(): Array<{ workId: string; retryIn: number }> {
    const pending: Array<{ workId: string; retryIn: number }> = [];

    for (const [workId, state] of this.retryStates) {
      const retryIn = this.getTimeUntilNextRetry(workId);
      if (retryIn > 0) {
        pending.push({ workId, retryIn });
      }
    }

    return pending.sort((a, b) => a.retryIn - b.retryIn);
  }
}

describe("RetryManager", () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 10000,
      jitter: false, // Disable for predictable testing
    });
  });

  describe("shouldRetry", () => {
    it("should allow retry for new work", () => {
      expect(retryManager.shouldRetry("work-1")).toBe(true);
    });

    it("should not allow retry after max attempts", () => {
      const workId = "work-1";

      // Record 3 failed attempts
      retryManager.recordAttempt(workId, false);
      retryManager.recordAttempt(workId, false);
      retryManager.recordAttempt(workId, false);

      expect(retryManager.shouldRetry(workId)).toBe(false);
    });

    it("should not allow retry before backoff period", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);

      // Should not allow immediate retry
      expect(retryManager.shouldRetry(workId)).toBe(false);
    });
  });

  describe("recordAttempt", () => {
    it("should clear retry state on success", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);
      expect(retryManager.getRetryState(workId).attempts).toBe(1);

      retryManager.recordAttempt(workId, true);
      expect(retryManager.getRetryState(workId).attempts).toBe(0);
    });

    it("should increment attempts on failure", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);
      expect(retryManager.getRetryState(workId).attempts).toBe(1);

      retryManager.recordAttempt(workId, false);
      expect(retryManager.getRetryState(workId).attempts).toBe(2);
    });

    it("should calculate exponential backoff", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);
      let state = retryManager.getRetryState(workId);
      expect(state.backoffDelay).toBe(1000); // 1000 * 2^0

      retryManager.recordAttempt(workId, false);
      state = retryManager.getRetryState(workId);
      expect(state.backoffDelay).toBe(2000); // 1000 * 2^1

      retryManager.recordAttempt(workId, false);
      state = retryManager.getRetryState(workId);
      expect(state.backoffDelay).toBe(4000); // 1000 * 2^2
    });

    it("should respect max delay", () => {
      const retryManagerWithHighMultiplier = new RetryManager({
        maxAttempts: 10,
        baseDelay: 5000,
        backoffMultiplier: 3,
        maxDelay: 8000,
        jitter: false,
      });

      const workId = "work-1";
      retryManagerWithHighMultiplier.recordAttempt(workId, false);
      retryManagerWithHighMultiplier.recordAttempt(workId, false);

      const state = retryManagerWithHighMultiplier.getRetryState(workId);
      expect(state.backoffDelay).toBe(8000); // Capped at maxDelay
    });
  });

  describe("getTimeUntilNextRetry", () => {
    it("should return correct time until next retry", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);

      const timeUntilRetry = retryManager.getTimeUntilNextRetry(workId);
      expect(timeUntilRetry).toBeGreaterThan(0);
      expect(timeUntilRetry).toBeLessThanOrEqual(1000);
    });

    it("should return 0 when retry time has passed", () => {
      const workId = "work-1";

      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      const mockNow = vi.fn();
      Date.now = mockNow;

      const baseTime = 1000000;
      mockNow.mockReturnValue(baseTime);

      retryManager.recordAttempt(workId, false);

      // Fast forward time
      mockNow.mockReturnValue(baseTime + 2000);

      expect(retryManager.getTimeUntilNextRetry(workId)).toBe(0);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe("getAllPendingRetries", () => {
    it("should return sorted pending retries", () => {
      const originalNow = Date.now;
      const mockNow = vi.fn();
      Date.now = mockNow;

      const baseTime = 1000000;
      mockNow.mockReturnValue(baseTime);

      retryManager.recordAttempt("work-1", false); // 1s delay
      retryManager.recordAttempt("work-2", false); // 1s delay
      retryManager.recordAttempt("work-2", false); // 2s delay

      const pending = retryManager.getAllPendingRetries();
      expect(pending).toHaveLength(2);
      expect(pending[0].workId).toBe("work-1");
      expect(pending[1].workId).toBe("work-2");
      expect(pending[0].retryIn).toBeLessThan(pending[1].retryIn);

      Date.now = originalNow;
    });

    it("should return empty array when no retries pending", () => {
      const pending = retryManager.getAllPendingRetries();
      expect(pending).toHaveLength(0);
    });
  });

  describe("reset operations", () => {
    it("should reset specific work retry state", () => {
      const workId = "work-1";

      retryManager.recordAttempt(workId, false);
      expect(retryManager.getRetryState(workId).attempts).toBe(1);

      retryManager.reset(workId);
      expect(retryManager.getRetryState(workId).attempts).toBe(0);
    });

    it("should reset all retry states", () => {
      retryManager.recordAttempt("work-1", false);
      retryManager.recordAttempt("work-2", false);

      expect(retryManager.getRetryState("work-1").attempts).toBe(1);
      expect(retryManager.getRetryState("work-2").attempts).toBe(1);

      retryManager.resetAll();
      expect(retryManager.getRetryState("work-1").attempts).toBe(0);
      expect(retryManager.getRetryState("work-2").attempts).toBe(0);
    });
  });

  describe("with jitter enabled", () => {
    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
        jitter: true,
      });
    });

    it("should apply jitter to delay calculation", () => {
      const workId = "work-1";

      // Mock Math.random for predictable jitter
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5); // 50% jitter

      retryManager.recordAttempt(workId, false);
      const delay = retryManager.getRetryState(workId).backoffDelay;

      // With 50% jitter, delay should be 750ms (0.5 + 0.5 * 0.5 = 0.75)
      expect(delay).toBe(750);

      Math.random = originalRandom;
    });

    it("should vary jitter across multiple attempts", () => {
      const workId = "work-1";

      // Mock different random values
      const originalRandom = Math.random;
      const mockRandom = vi.fn();
      Math.random = mockRandom;

      mockRandom.mockReturnValueOnce(0.2); // 60% of base delay
      retryManager.recordAttempt(workId, false);
      const delay1 = retryManager.getRetryState(workId).backoffDelay;

      mockRandom.mockReturnValueOnce(0.8); // 90% of base delay
      retryManager.recordAttempt(workId, false);
      const delay2 = retryManager.getRetryState(workId).backoffDelay;

      expect(delay1).not.toBe(delay2);
      expect(delay1).toBe(600); // 1000 * (0.5 + 0.5 * 0.2)
      expect(delay2).toBe(1800); // 2000 * (0.5 + 0.5 * 0.8)

      Math.random = originalRandom;
    });
  });

  describe("edge cases", () => {
    it("should handle zero delay gracefully", () => {
      const zeroDelayManager = new RetryManager({
        maxAttempts: 3,
        baseDelay: 0,
        backoffMultiplier: 2,
        maxDelay: 10000,
        jitter: false,
      });

      const workId = "work-1";
      zeroDelayManager.recordAttempt(workId, false);

      expect(zeroDelayManager.shouldRetry(workId)).toBe(true);
      expect(zeroDelayManager.getTimeUntilNextRetry(workId)).toBe(0);
    });

    it("should handle very large multipliers", () => {
      const largeMultiplierManager = new RetryManager({
        maxAttempts: 5,
        baseDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 5000,
        jitter: false,
      });

      const workId = "work-1";
      largeMultiplierManager.recordAttempt(workId, false);
      largeMultiplierManager.recordAttempt(workId, false);

      const state = largeMultiplierManager.getRetryState(workId);
      expect(state.backoffDelay).toBe(5000); // Capped at maxDelay
    });

    it("should handle concurrent operations on different work items", () => {
      const workIds = ["work-1", "work-2", "work-3"];

      // Record failures for all work items
      workIds.forEach((id) => retryManager.recordAttempt(id, false));

      // Each should have independent retry state
      workIds.forEach((id) => {
        const state = retryManager.getRetryState(id);
        expect(state.attempts).toBe(1);
        expect(state.backoffDelay).toBe(1000);
      });

      // Success on one shouldn't affect others
      retryManager.recordAttempt("work-2", true);

      expect(retryManager.getRetryState("work-1").attempts).toBe(1);
      expect(retryManager.getRetryState("work-2").attempts).toBe(0);
      expect(retryManager.getRetryState("work-3").attempts).toBe(1);
    });
  });
});
