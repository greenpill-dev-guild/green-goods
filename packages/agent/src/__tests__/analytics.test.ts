/**
 * Analytics Service Tests
 *
 * Tests for PostHog analytics integration.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  Analytics,
  ANALYTICS_EVENTS,
  hashPlatformId,
  createTimer,
  getAnalytics,
  shutdownAnalytics,
} from "../services/analytics";
import { NoOpAnalytics } from "../ports/analytics";

// ============================================================================
// ANALYTICS CLASS TESTS
// ============================================================================

describe("Analytics", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Reset singleton
    shutdownAnalytics();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await shutdownAnalytics();
  });

  describe("initialization", () => {
    it("creates disabled instance when no API key provided", () => {
      delete process.env.POSTHOG_AGENT_KEY;
      const analytics = new Analytics({ enabled: true });

      expect(analytics.isEnabled()).toBe(false);
    });

    it("creates disabled instance in development by default", () => {
      process.env.NODE_ENV = "development";
      const analytics = new Analytics({ apiKey: "test-key" });

      expect(analytics.isEnabled()).toBe(false);
    });

    it("creates enabled instance with API key in production", () => {
      process.env.NODE_ENV = "production";
      const analytics = new Analytics({ apiKey: "test-key", enabled: true });

      expect(analytics.isEnabled()).toBe(true);
    });

    it("respects explicit enabled flag", () => {
      const analytics = new Analytics({ apiKey: "test-key", enabled: true });

      expect(analytics.isEnabled()).toBe(true);
    });

    it("respects explicit disabled flag", () => {
      const analytics = new Analytics({ apiKey: "test-key", enabled: false });

      expect(analytics.isEnabled()).toBe(false);
    });
  });

  describe("tracking methods", () => {
    let analytics: Analytics;

    beforeEach(() => {
      // Create enabled analytics for testing (won't actually send events without real key)
      analytics = new Analytics({ apiKey: "test-key", enabled: true });
    });

    afterEach(async () => {
      await analytics.shutdown();
    });

    it("track() does not throw when enabled", () => {
      expect(() => {
        analytics.track("test_event", {
          distinctId: "user-123",
          properties: { foo: "bar" },
        });
      }).not.toThrow();
    });

    it("trackCommand() captures command event", () => {
      expect(() => {
        analytics.trackCommand("user-123", "start", { platform: "telegram" });
      }).not.toThrow();
    });

    it("trackCommandFailed() captures failure event", () => {
      expect(() => {
        analytics.trackCommandFailed("user-123", "join", "Invalid address");
      }).not.toThrow();
    });

    it("trackMessage() captures message event", () => {
      expect(() => {
        analytics.trackMessage("user-123", "text", { length: 100 });
      }).not.toThrow();
    });

    it("trackWorkSubmitted() captures work submission", () => {
      expect(() => {
        analytics.trackWorkSubmitted("user-123", { gardenId: "garden-1" });
      }).not.toThrow();
    });

    it("trackWorkConfirmed() captures work confirmation", () => {
      expect(() => {
        analytics.trackWorkConfirmed("user-123", { workId: "work-1" });
      }).not.toThrow();
    });

    it("trackWorkApproved() captures approval", () => {
      expect(() => {
        analytics.trackWorkApproved("operator-1", { workId: "work-1" });
      }).not.toThrow();
    });

    it("trackWorkRejected() captures rejection", () => {
      expect(() => {
        analytics.trackWorkRejected("operator-1", { workId: "work-1", reason: "test" });
      }).not.toThrow();
    });

    it("trackGardenJoined() captures garden join", () => {
      expect(() => {
        analytics.trackGardenJoined("user-123", "0x1234", { role: "gardener" });
      }).not.toThrow();
    });

    it("trackUserCreated() captures user creation and identifies", () => {
      expect(() => {
        analytics.trackUserCreated("user-123", { platform: "telegram" });
      }).not.toThrow();
    });

    it("trackRateLimited() captures rate limit event", () => {
      expect(() => {
        analytics.trackRateLimited("user-123", "submission", { remaining: 0 });
      }).not.toThrow();
    });

    it("trackError() captures error with message", () => {
      expect(() => {
        analytics.trackError("user-123", "Something went wrong", { handler: "start" });
      }).not.toThrow();
    });

    it("trackError() captures Error object with stack", () => {
      expect(() => {
        analytics.trackError("user-123", new Error("Test error"), { handler: "join" });
      }).not.toThrow();
    });

    it("trackPerformance() captures metrics", () => {
      expect(() => {
        analytics.trackPerformance("user-123", {
          latencyMs: 150,
          handler: "start",
          rateLimited: false,
          hasError: false,
        });
      }).not.toThrow();
    });

    it("identify() does not throw", () => {
      expect(() => {
        analytics.identify("user-123", { platform: "telegram", role: "gardener" });
      }).not.toThrow();
    });
  });

  describe("disabled analytics", () => {
    let analytics: Analytics;

    beforeEach(() => {
      analytics = new Analytics({ enabled: false });
    });

    it("track() is no-op when disabled", () => {
      expect(() => {
        analytics.track("test_event", { distinctId: "user-123" });
      }).not.toThrow();
    });

    it("identify() is no-op when disabled", () => {
      expect(() => {
        analytics.identify("user-123", { foo: "bar" });
      }).not.toThrow();
    });

    it("all convenience methods are no-op when disabled", () => {
      expect(() => {
        analytics.trackCommand("user-123", "start");
        analytics.trackMessage("user-123", "text");
        analytics.trackWorkSubmitted("user-123");
        analytics.trackError("user-123", "error");
        analytics.trackPerformance("user-123", { latencyMs: 100 });
      }).not.toThrow();
    });
  });

  describe("lifecycle", () => {
    it("flush() completes without error", async () => {
      const analytics = new Analytics({ apiKey: "test-key", enabled: true });
      await expect(analytics.flush()).resolves.toBeUndefined();
      await analytics.shutdown();
    });

    it("shutdown() completes without error", async () => {
      const analytics = new Analytics({ apiKey: "test-key", enabled: true });
      await expect(analytics.shutdown()).resolves.toBeUndefined();
    });

    it("shutdown() is idempotent", async () => {
      const analytics = new Analytics({ apiKey: "test-key", enabled: true });
      await analytics.shutdown();
      await expect(analytics.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("getStats()", () => {
    it("returns stats object", () => {
      const analytics = new Analytics({ enabled: false });
      const stats = analytics.getStats();

      expect(stats).toHaveProperty("enabled");
      expect(stats).toHaveProperty("pending");
      expect(stats.enabled).toBe(false);
      expect(typeof stats.pending).toBe("number");
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe("Analytics singleton", () => {
  beforeEach(async () => {
    await shutdownAnalytics();
  });

  afterEach(async () => {
    await shutdownAnalytics();
  });

  it("getAnalytics() returns same instance", () => {
    const instance1 = getAnalytics({ enabled: false });
    const instance2 = getAnalytics({ enabled: false });

    expect(instance1).toBe(instance2);
  });

  it("shutdownAnalytics() resets singleton", async () => {
    const instance1 = getAnalytics({ enabled: false });
    await shutdownAnalytics();
    const instance2 = getAnalytics({ enabled: false });

    expect(instance1).not.toBe(instance2);
  });

  it("getAnalytics() accepts config on first call", () => {
    const instance = getAnalytics({ enabled: false });

    expect(instance.isEnabled()).toBe(false);
  });
});

// ============================================================================
// NO-OP ANALYTICS TESTS
// ============================================================================

describe("NoOpAnalytics", () => {
  let noOp: NoOpAnalytics;

  beforeEach(() => {
    noOp = new NoOpAnalytics();
  });

  it("isEnabled() returns false", () => {
    expect(noOp.isEnabled()).toBe(false);
  });

  it("all methods are no-op", async () => {
    // These should all complete without error
    noOp.track("event", { distinctId: "user" });
    noOp.identify("user");
    noOp.trackCommand("user", "start");
    noOp.trackCommandFailed("user", "start", "error");
    noOp.trackMessage("user", "text");
    noOp.trackWorkSubmitted("user");
    noOp.trackWorkConfirmed("user");
    noOp.trackWorkApproved("user");
    noOp.trackWorkRejected("user");
    noOp.trackGardenJoined("user", "0x123");
    noOp.trackUserCreated("user");
    noOp.trackRateLimited("user", "message");
    noOp.trackError("user", "error");
    noOp.trackPerformance("user", { latencyMs: 100 });
    await noOp.flush();
    await noOp.shutdown();

    expect(true).toBe(true);
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe("hashPlatformId", () => {
  it("returns consistent hash for same input", () => {
    const hash1 = hashPlatformId("telegram", "123456");
    const hash2 = hashPlatformId("telegram", "123456");

    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different platform", () => {
    const hashTelegram = hashPlatformId("telegram", "123456");
    const hashDiscord = hashPlatformId("discord", "123456");

    expect(hashTelegram).not.toBe(hashDiscord);
  });

  it("returns different hash for different platformId", () => {
    const hash1 = hashPlatformId("telegram", "123456");
    const hash2 = hashPlatformId("telegram", "654321");

    expect(hash1).not.toBe(hash2);
  });

  it("includes platform prefix", () => {
    const hash = hashPlatformId("telegram", "123456");

    expect(hash.startsWith("telegram_")).toBe(true);
  });

  it("returns alphanumeric hash", () => {
    const hash = hashPlatformId("telegram", "123456");

    expect(/^telegram_[a-f0-9]+$/.test(hash)).toBe(true);
  });
});

describe("createTimer", () => {
  it("measures elapsed time", async () => {
    const timer = createTimer();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));

    const metrics = timer.stop("test_handler");

    expect(metrics.latencyMs).toBeGreaterThanOrEqual(40);
    expect(metrics.latencyMs).toBeLessThan(200);
  });

  it("includes handler name in metrics", () => {
    const timer = createTimer();
    const metrics = timer.stop("my_handler");

    expect(metrics.handler).toBe("my_handler");
  });

  it("returns integer latency", () => {
    const timer = createTimer();
    const metrics = timer.stop();

    expect(Number.isInteger(metrics.latencyMs)).toBe(true);
  });

  it("can be stopped without handler name", () => {
    const timer = createTimer();
    const metrics = timer.stop();

    expect(metrics.handler).toBeUndefined();
    expect(metrics.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// ANALYTICS EVENTS TESTS
// ============================================================================

describe("ANALYTICS_EVENTS", () => {
  it("contains all expected event types", () => {
    expect(ANALYTICS_EVENTS).toHaveProperty("USER_CREATED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WALLET_CREATED");
    expect(ANALYTICS_EVENTS).toHaveProperty("COMMAND_EXECUTED");
    expect(ANALYTICS_EVENTS).toHaveProperty("COMMAND_FAILED");
    expect(ANALYTICS_EVENTS).toHaveProperty("MESSAGE_RECEIVED");
    expect(ANALYTICS_EVENTS).toHaveProperty("MESSAGE_PROCESSED");
    expect(ANALYTICS_EVENTS).toHaveProperty("VOICE_TRANSCRIBED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WORK_SUBMITTED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WORK_CONFIRMED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WORK_CANCELLED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WORK_APPROVED");
    expect(ANALYTICS_EVENTS).toHaveProperty("WORK_REJECTED");
    expect(ANALYTICS_EVENTS).toHaveProperty("GARDEN_JOINED");
    expect(ANALYTICS_EVENTS).toHaveProperty("RATE_LIMITED");
    expect(ANALYTICS_EVENTS).toHaveProperty("ERROR_OCCURRED");
    expect(ANALYTICS_EVENTS).toHaveProperty("PERFORMANCE_MEASURED");
  });

  it("has unique event names", () => {
    const values = Object.values(ANALYTICS_EVENTS);
    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(values.length);
  });

  it("uses snake_case event names", () => {
    for (const eventName of Object.values(ANALYTICS_EVENTS)) {
      expect(/^[a-z]+(_[a-z]+)*$/.test(eventName)).toBe(true);
    }
  });
});
