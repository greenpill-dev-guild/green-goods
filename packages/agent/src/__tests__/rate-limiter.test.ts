/**
 * Rate Limiter Tests
 *
 * Tests for the sliding window rate limiting implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { RateLimiter, formatRateLimitWait, RATE_LIMITS } from "../services/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe("check()", () => {
    it("allows requests within the limit", () => {
      const userId = 123;

      // Make requests up to the limit
      for (let i = 0; i < RATE_LIMITS.message.maxRequests; i++) {
        const result = limiter.check(userId, "message");
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(RATE_LIMITS.message.maxRequests - i - 1);
      }
    });

    it("blocks requests after limit is exceeded", () => {
      const userId = 123;

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMITS.message.maxRequests; i++) {
        limiter.check(userId, "message");
      }

      // Next request should be blocked
      const result = limiter.check(userId, "message");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toBeDefined();
    });

    it("tracks different users separately", () => {
      const user1 = 123;
      const user2 = 456;

      // Exhaust user1's limit
      for (let i = 0; i < RATE_LIMITS.message.maxRequests; i++) {
        limiter.check(user1, "message");
      }

      // User2 should still be allowed
      const result = limiter.check(user2, "message");
      expect(result.allowed).toBe(true);
    });

    it("tracks different limit types separately", () => {
      const userId = 123;

      // Exhaust message limit
      for (let i = 0; i < RATE_LIMITS.message.maxRequests; i++) {
        limiter.check(userId, "message");
      }

      // Voice limit should still have capacity
      const result = limiter.check(userId, "voice");
      expect(result.allowed).toBe(true);
    });

    it("returns correct limit metadata", () => {
      const userId = 123;
      const result = limiter.check(userId, "submission");

      expect(result.limit).toBe(RATE_LIMITS.submission.maxRequests);
      expect(result.resetIn).toBe(RATE_LIMITS.submission.windowMs);
    });
  });

  describe("peek()", () => {
    it("returns status without consuming a token", () => {
      const userId = 123;

      // Peek should not consume
      const peek1 = limiter.peek(userId, "message");
      const peek2 = limiter.peek(userId, "message");

      expect(peek1.remaining).toBe(peek2.remaining);
      expect(peek1.remaining).toBe(RATE_LIMITS.message.maxRequests);
    });

    it("reflects current usage after check()", () => {
      const userId = 123;

      // Use some tokens
      limiter.check(userId, "message");
      limiter.check(userId, "message");

      // Peek should show reduced remaining
      const peek = limiter.peek(userId, "message");
      expect(peek.remaining).toBe(RATE_LIMITS.message.maxRequests - 2);
    });
  });

  describe("reset()", () => {
    it("resets limit for specific user and type", () => {
      const userId = 123;

      // Exhaust limit
      for (let i = 0; i < RATE_LIMITS.message.maxRequests; i++) {
        limiter.check(userId, "message");
      }

      // Verify blocked
      expect(limiter.check(userId, "message").allowed).toBe(false);

      // Reset
      limiter.reset(userId, "message");

      // Should be allowed again
      expect(limiter.check(userId, "message").allowed).toBe(true);
    });

    it("does not affect other types", () => {
      const userId = 123;

      // Use some tokens from both types
      limiter.check(userId, "message");
      limiter.check(userId, "voice");

      // Reset only message
      limiter.reset(userId, "message");

      // Message should be full, voice should still have usage
      const messagePeek = limiter.peek(userId, "message");
      const voicePeek = limiter.peek(userId, "voice");

      expect(messagePeek.remaining).toBe(RATE_LIMITS.message.maxRequests);
      expect(voicePeek.remaining).toBe(RATE_LIMITS.voice.maxRequests - 1);
    });
  });

  describe("resetAll()", () => {
    it("resets all limits for a user", () => {
      const userId = 123;

      // Use tokens from multiple types
      limiter.check(userId, "message");
      limiter.check(userId, "voice");
      limiter.check(userId, "submission");

      // Reset all
      limiter.resetAll(userId);

      // All should be at full capacity
      expect(limiter.peek(userId, "message").remaining).toBe(RATE_LIMITS.message.maxRequests);
      expect(limiter.peek(userId, "voice").remaining).toBe(RATE_LIMITS.voice.maxRequests);
      expect(limiter.peek(userId, "submission").remaining).toBe(RATE_LIMITS.submission.maxRequests);
    });
  });

  describe("getStats()", () => {
    it("returns correct statistics", () => {
      const stats1 = limiter.getStats();
      expect(stats1.totalEntries).toBe(0);
      expect(stats1.totalTimestamps).toBe(0);

      // Add some usage
      limiter.check(123, "message");
      limiter.check(123, "message");
      limiter.check(456, "voice");

      const stats2 = limiter.getStats();
      expect(stats2.totalEntries).toBe(2); // 2 user:type combinations
      expect(stats2.totalTimestamps).toBe(3); // 3 total requests
    });
  });

  describe("custom config", () => {
    it("allows custom limits via config parameter", () => {
      const userId = 123;

      // Use custom limit of 2 requests
      const result1 = limiter.check(userId, "message", { maxRequests: 2 });
      const result2 = limiter.check(userId, "message", { maxRequests: 2 });
      const result3 = limiter.check(userId, "message", { maxRequests: 2 });

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(false);
    });
  });
});

describe("formatRateLimitWait", () => {
  it("formats seconds correctly", () => {
    expect(formatRateLimitWait(1000)).toBe("1 second");
    expect(formatRateLimitWait(5000)).toBe("5 seconds");
    expect(formatRateLimitWait(30000)).toBe("30 seconds");
  });

  it("formats minutes correctly", () => {
    expect(formatRateLimitWait(60000)).toBe("1 minute");
    expect(formatRateLimitWait(120000)).toBe("2 minutes");
    expect(formatRateLimitWait(300000)).toBe("5 minutes");
  });

  it("rounds up partial seconds/minutes", () => {
    expect(formatRateLimitWait(1500)).toBe("2 seconds");
    expect(formatRateLimitWait(65000)).toBe("2 minutes");
  });
});

describe("RATE_LIMITS configuration", () => {
  it("has all expected limit types", () => {
    expect(RATE_LIMITS).toHaveProperty("message");
    expect(RATE_LIMITS).toHaveProperty("command");
    expect(RATE_LIMITS).toHaveProperty("submission");
    expect(RATE_LIMITS).toHaveProperty("voice");
    expect(RATE_LIMITS).toHaveProperty("approval");
    expect(RATE_LIMITS).toHaveProperty("wallet");
  });

  it("has reasonable limits", () => {
    // Voice should be more restrictive than text
    expect(RATE_LIMITS.voice.maxRequests).toBeLessThan(RATE_LIMITS.message.maxRequests);

    // Operators should have higher approval limits
    expect(RATE_LIMITS.approval.maxRequests).toBeGreaterThan(RATE_LIMITS.submission.maxRequests);
  });

  it("has all required fields for each limit type", () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config).toHaveProperty("maxRequests");
      expect(config).toHaveProperty("windowMs");
      expect(config).toHaveProperty("message");
      expect(typeof config.maxRequests).toBe("number");
      expect(typeof config.windowMs).toBe("number");
      expect(typeof config.message).toBe("string");
    }
  });
});
