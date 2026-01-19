import { describe, it, expect, bench } from "vitest";
import {
  encryptPrivateKey,
  decryptPrivateKey,
  generateSecurePrivateKey,
} from "../../src/services/crypto";
import { RateLimiter } from "../../src/services/rate-limiter";
import { parseWorkText } from "../../src/services/ai";

describe("Performance Benchmarks", () => {
  describe("Crypto Operations", () => {
    const testKey = "0x" + "a".repeat(64);

    bench("encrypt private key", () => {
      encryptPrivateKey(testKey);
    });

    bench("decrypt private key", () => {
      const encrypted = encryptPrivateKey(testKey);
      decryptPrivateKey(encrypted);
    });

    bench("generate secure private key", () => {
      generateSecurePrivateKey();
    });

    it("should encrypt keys under 10ms", () => {
      const start = performance.now();
      encryptPrivateKey(testKey);
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
    });
  });

  describe("Rate Limiting", () => {
    bench("rate limit check", () => {
      const limiter = new RateLimiter();
      limiter.check("user-123", "message");
    });

    bench("rate limit with cleanup", () => {
      const limiter = new RateLimiter();
      for (let i = 0; i < 100; i++) {
        limiter.check(`user-${i}`, "message");
      }
      limiter.cleanup();
    });

    it("should handle 1000 concurrent users efficiently", () => {
      const limiter = new RateLimiter();
      const start = performance.now();

      // Simulate 1000 users
      for (let i = 0; i < 1000; i++) {
        limiter.check(`user-${i}`, "message");
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Under 100ms
    });
  });

  describe("AI Processing", () => {
    const sampleTexts = [
      "I watered 10 plants today",
      "Planted 5 new tomato seedlings and removed weeds from the garden bed",
      "Did maintenance work including pruning roses, fertilizing vegetables, and installing new irrigation",
    ];

    bench("parse simple work text", () => {
      parseWork(sampleTexts[0]);
    });

    bench("parse complex work text", () => {
      parseWork(sampleTexts[2]);
    });

    it("should parse work descriptions under 50ms", async () => {
      const start = performance.now();
      await parseWork(sampleTexts[1]);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
    });
  });

  describe("Database Operations", () => {
    bench("user creation with encryption", async () => {
      const userData = {
        platform: "telegram" as const,
        platformId: `perf-user-${Date.now()}`,
        privateKey: "0x" + "b".repeat(64),
        address: "0x" + "1".repeat(40),
        role: "gardener" as const,
      };

      await createUser(userData);
    });

    bench("user lookup by platform ID", async () => {
      await getUserByPlatformId("telegram", "existing-user");
    });

    bench("session update", async () => {
      const sessionData = {
        platformId: "session-user",
        step: "confirming_work",
        data: { actions: [], metadata: {} },
      };

      await updateSession(sessionData);
    });
  });

  describe("Memory Usage", () => {
    it("should not leak memory during extended operation", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        const key = "0x" + i.toString(16).padStart(64, "0");
        const encrypted = encryptPrivateKey(key);
        decryptPrivateKey(encrypted);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be less than 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
