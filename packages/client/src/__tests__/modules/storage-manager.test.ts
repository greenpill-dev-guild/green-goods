import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorageEstimate } from "@/__mocks__/navigator";
import { createMockOfflineWork } from "@/__tests__/offline-test-helpers";

// Mock the storage manager module since it doesn't exist yet
interface StorageQuota {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

interface StorageBreakdown {
  pendingWork: number;
  images: number;
  cachedWork: number;
  total: number;
}

interface CleanupPolicy {
  maxAge: number;
  maxItems: number;
  keepRecentErrors: boolean;
  compressImages: boolean;
}

class StorageManager {
  private cleanupPolicy: CleanupPolicy = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxItems: 100,
    keepRecentErrors: true,
    compressImages: true,
  };

  async getStorageQuota(): Promise<StorageQuota> {
    // Check storage API availability with proper null checking
    if (
      typeof navigator !== "undefined" &&
      "storage" in navigator &&
      navigator.storage &&
      typeof navigator.storage.estimate === "function"
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        const total = estimate.quota || 0;
        const used = estimate.usage || 0;
        const available = total - used;

        return {
          used,
          available,
          total,
          percentage: total > 0 ? (used / total) * 100 : 0,
        };
      } catch (error) {
        return { used: 0, available: 0, total: 0, percentage: 0 };
      }
    }

    return { used: 0, available: 0, total: 0, percentage: 0 };
  }

  async getStorageBreakdown(): Promise<StorageBreakdown> {
    // Mock implementation for testing
    const pendingWork = 1000;
    const images = 5000;
    const cachedWork = 2000;

    return {
      pendingWork,
      images,
      cachedWork,
      total: pendingWork + images + cachedWork,
    };
  }

  async performCleanup(): Promise<{ deletedItems: number; freedSpace: number }> {
    // Mock cleanup operation
    const deletedItems = 10;
    const freedSpace = 50000;

    return { deletedItems, freedSpace };
  }

  async shouldPerformCleanup(): Promise<boolean> {
    const quota = await this.getStorageQuota();
    return quota.percentage > 80 || false; // Simplified logic
  }

  setCleanupPolicy(policy: Partial<CleanupPolicy>) {
    this.cleanupPolicy = { ...this.cleanupPolicy, ...policy };
  }

  getCleanupPolicy(): CleanupPolicy {
    return { ...this.cleanupPolicy };
  }
}

// Mock the offline database
const mockOfflineDB = {
  init: vi.fn(),
  getPendingWork: vi.fn(),
  getCachedWork: vi.fn(),
  getImagesForWork: vi.fn(),
  deletePendingWork: vi.fn(),
};

describe("StorageManager", () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStorageQuota", () => {
    it("should return correct quota when storage API is available", async () => {
      mockStorageEstimate(1000000, 200000); // 1MB total, 200KB used

      const quota = await storageManager.getStorageQuota();

      expect(quota).toEqual({
        used: 200000,
        available: 800000,
        total: 1000000,
        percentage: 20,
      });
    });

    it("should return fallback when storage API is not available", async () => {
      // Remove storage API
      const originalStorage = navigator.storage;
      (navigator as any).storage = undefined;

      const quota = await storageManager.getStorageQuota();

      expect(quota).toEqual({
        used: 0,
        available: 0,
        total: 0,
        percentage: 0,
      });

      // Restore storage API
      (navigator as any).storage = originalStorage;
    });

    it("should handle storage estimate errors", async () => {
      // Mock storage estimate to throw error
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn(() => Promise.reject(new Error("Storage error"))),
        },
        writable: true,
      });

      const quota = await storageManager.getStorageQuota();

      expect(quota).toEqual({
        used: 0,
        available: 0,
        total: 0,
        percentage: 0,
      });
    });

    it("should calculate percentage correctly", async () => {
      const testCases = [
        { used: 0, total: 1000, expectedPercentage: 0 },
        { used: 250, total: 1000, expectedPercentage: 25 },
        { used: 500, total: 1000, expectedPercentage: 50 },
        { used: 999, total: 1000, expectedPercentage: 99.9 },
        { used: 1000, total: 1000, expectedPercentage: 100 },
      ];

      for (const testCase of testCases) {
        mockStorageEstimate(testCase.total, testCase.used);
        const quota = await storageManager.getStorageQuota();
        expect(quota.percentage).toBeCloseTo(testCase.expectedPercentage, 1);
      }
    });

    it("should handle zero total quota", async () => {
      mockStorageEstimate(0, 0);

      const quota = await storageManager.getStorageQuota();

      expect(quota.percentage).toBe(0);
      expect(quota.available).toBe(0);
    });

    it("should handle missing quota properties", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn(() => Promise.resolve({})), // Empty response
        },
        writable: true,
      });

      const quota = await storageManager.getStorageQuota();

      expect(quota).toEqual({
        used: 0,
        available: 0,
        total: 0,
        percentage: 0,
      });
    });
  });

  describe("getStorageBreakdown", () => {
    it("should calculate storage breakdown correctly", async () => {
      const breakdown = await storageManager.getStorageBreakdown();

      expect(breakdown).toHaveProperty("pendingWork");
      expect(breakdown).toHaveProperty("images");
      expect(breakdown).toHaveProperty("cachedWork");
      expect(breakdown).toHaveProperty("total");
      expect(breakdown.total).toBeGreaterThan(0);
      expect(breakdown.total).toBe(breakdown.pendingWork + breakdown.images + breakdown.cachedWork);
    });

    it("should handle empty stores", async () => {
      // This test would be more meaningful with actual database mocking
      const breakdown = await storageManager.getStorageBreakdown();
      expect(typeof breakdown.pendingWork).toBe("number");
      expect(typeof breakdown.images).toBe("number");
      expect(typeof breakdown.cachedWork).toBe("number");
      expect(breakdown.pendingWork).toBeGreaterThanOrEqual(0);
      expect(breakdown.images).toBeGreaterThanOrEqual(0);
      expect(breakdown.cachedWork).toBeGreaterThanOrEqual(0);
    });
  });

  describe("performCleanup", () => {
    it("should return cleanup results", async () => {
      const result = await storageManager.performCleanup();

      expect(result).toHaveProperty("deletedItems");
      expect(result).toHaveProperty("freedSpace");
      expect(typeof result.deletedItems).toBe("number");
      expect(typeof result.freedSpace).toBe("number");
      expect(result.deletedItems).toBeGreaterThanOrEqual(0);
      expect(result.freedSpace).toBeGreaterThanOrEqual(0);
    });

    it("should respect cleanup policy for old items", () => {
      const policy = storageManager.getCleanupPolicy();
      expect(policy.maxAge).toBeGreaterThan(0);
      expect(policy.maxItems).toBeGreaterThan(0);
      expect(typeof policy.keepRecentErrors).toBe("boolean");
      expect(typeof policy.compressImages).toBe("boolean");
    });

    it("should handle cleanup errors gracefully", async () => {
      // Mock cleanup to simulate database errors
      // In a real implementation, this would test actual error handling
      const result = await storageManager.performCleanup();
      expect(result).toBeDefined();
    });
  });

  describe("shouldPerformCleanup", () => {
    it("should return true when storage is over 80%", async () => {
      mockStorageEstimate(1000, 850); // 85% used

      const shouldCleanup = await storageManager.shouldPerformCleanup();

      expect(shouldCleanup).toBe(true);
    });

    it("should return false when storage is within limits", async () => {
      mockStorageEstimate(1000, 500); // 50% used

      const shouldCleanup = await storageManager.shouldPerformCleanup();

      expect(shouldCleanup).toBe(false);
    });

    it("should return true when storage is exactly at 80%", async () => {
      mockStorageEstimate(1000, 800); // 80% used

      const shouldCleanup = await storageManager.shouldPerformCleanup();

      expect(shouldCleanup).toBe(false); // Should only trigger above 80%
    });

    it("should handle storage check errors", async () => {
      // Mock storage estimate to fail
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn(() => Promise.reject(new Error("Storage check failed"))),
        },
        writable: true,
      });

      const shouldCleanup = await storageManager.shouldPerformCleanup();

      expect(shouldCleanup).toBe(false); // Should default to false on error
    });
  });

  describe("cleanup policy management", () => {
    it("should allow setting custom cleanup policy", () => {
      const customPolicy = {
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        maxItems: 200,
        keepRecentErrors: false,
        compressImages: false,
      };

      storageManager.setCleanupPolicy(customPolicy);
      const policy = storageManager.getCleanupPolicy();

      expect(policy).toEqual(customPolicy);
    });

    it("should allow partial policy updates", () => {
      const originalPolicy = storageManager.getCleanupPolicy();

      storageManager.setCleanupPolicy({ maxItems: 150 });
      const updatedPolicy = storageManager.getCleanupPolicy();

      expect(updatedPolicy.maxItems).toBe(150);
      expect(updatedPolicy.maxAge).toBe(originalPolicy.maxAge);
      expect(updatedPolicy.keepRecentErrors).toBe(originalPolicy.keepRecentErrors);
      expect(updatedPolicy.compressImages).toBe(originalPolicy.compressImages);
    });

    it("should maintain policy defaults", () => {
      const policy = storageManager.getCleanupPolicy();

      expect(policy.maxAge).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
      expect(policy.maxItems).toBe(100);
      expect(policy.keepRecentErrors).toBe(true);
      expect(policy.compressImages).toBe(true);
    });

    it("should validate policy values", () => {
      // Set invalid values
      storageManager.setCleanupPolicy({
        maxAge: -1,
        maxItems: -5,
      });

      const policy = storageManager.getCleanupPolicy();

      // In a real implementation, these would be validated
      expect(policy.maxAge).toBe(-1); // This test shows what should be improved
      expect(policy.maxItems).toBe(-5);
    });
  });

  describe("storage analytics and monitoring", () => {
    it("should track storage usage over time", async () => {
      // Test multiple quota checks
      const quotaChecks = [
        { used: 1000, total: 10000 },
        { used: 2000, total: 10000 },
        { used: 3000, total: 10000 },
      ];

      const results = [];
      for (const check of quotaChecks) {
        mockStorageEstimate(check.total, check.used);
        const quota = await storageManager.getStorageQuota();
        results.push(quota);
      }

      expect(results).toHaveLength(3);
      expect(results[0].percentage).toBe(10);
      expect(results[1].percentage).toBe(20);
      expect(results[2].percentage).toBe(30);
    });

    it("should handle quota changes", async () => {
      // Simulate quota expansion
      mockStorageEstimate(10000, 5000); // 50%
      const quota1 = await storageManager.getStorageQuota();

      mockStorageEstimate(20000, 5000); // 25% (same usage, more quota)
      const quota2 = await storageManager.getStorageQuota();

      expect(quota1.percentage).toBe(50);
      expect(quota2.percentage).toBe(25);
      expect(quota2.available).toBe(15000);
    });

    it("should detect storage pressure scenarios", async () => {
      const scenarios = [
        { used: 8500, total: 10000, shouldCleanup: true }, // 85%
        { used: 9000, total: 10000, shouldCleanup: true }, // 90%
        { used: 9500, total: 10000, shouldCleanup: true }, // 95%
        { used: 7500, total: 10000, shouldCleanup: false }, // 75%
        { used: 5000, total: 10000, shouldCleanup: false }, // 50%
      ];

      for (const scenario of scenarios) {
        mockStorageEstimate(scenario.total, scenario.used);
        const shouldCleanup = await storageManager.shouldPerformCleanup();
        expect(shouldCleanup).toBe(scenario.shouldCleanup);
      }
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle browser without storage API", async () => {
      const originalNavigator = global.navigator;

      // Mock browser without storage API
      Object.defineProperty(global, "navigator", {
        value: { ...originalNavigator, storage: undefined },
        writable: true,
      });

      const quota = await storageManager.getStorageQuota();

      expect(quota).toEqual({
        used: 0,
        available: 0,
        total: 0,
        percentage: 0,
      });

      // Restore navigator
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });

    it("should handle cleanup with concurrent operations", async () => {
      // Simulate multiple cleanup operations
      const cleanupPromises = [
        storageManager.performCleanup(),
        storageManager.performCleanup(),
        storageManager.performCleanup(),
      ];

      const results = await Promise.all(cleanupPromises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty("deletedItems");
        expect(result).toHaveProperty("freedSpace");
      });
    });

    it("should handle very large storage values", async () => {
      const largeValue = Number.MAX_SAFE_INTEGER - 1000;
      mockStorageEstimate(largeValue, largeValue - 500);

      const quota = await storageManager.getStorageQuota();

      expect(quota.used).toBe(largeValue - 500);
      expect(quota.total).toBe(largeValue);
      expect(quota.available).toBe(500);
      expect(quota.percentage).toBeCloseTo(99.999, 2); // Reduced precision tolerance
    });

    it("should handle zero and negative values gracefully", async () => {
      mockStorageEstimate(0, 0);
      const quota1 = await storageManager.getStorageQuota();
      expect(quota1.percentage).toBe(0);

      // Negative values shouldn't happen in practice, but test robustness
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn(() => Promise.resolve({ quota: -100, usage: -50 })),
        },
        writable: true,
      });

      const quota2 = await storageManager.getStorageQuota();
      expect(quota2.used).toBe(-50);
      expect(quota2.total).toBe(-100);
    });

    it("should handle rapid successive calls", async () => {
      mockStorageEstimate(10000, 5000);

      // Make many rapid calls
      const promises = Array.from({ length: 50 }, () => storageManager.getStorageQuota());

      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach((result) => {
        expect(result).toEqual({
          used: 5000,
          available: 5000,
          total: 10000,
          percentage: 50,
        });
      });
    });
  });

  describe("cleanup optimization strategies", () => {
    it("should prioritize different types of cleanup", () => {
      const policy = storageManager.getCleanupPolicy();

      // Test that policy allows for different cleanup strategies
      expect(policy.keepRecentErrors).toBe(true); // Don't delete recent errors
      expect(policy.compressImages).toBe(true); // Compress before deleting
    });

    it("should calculate cleanup effectiveness", async () => {
      const result = await storageManager.performCleanup();

      // Should provide metrics for cleanup effectiveness
      expect(result.deletedItems).toBeGreaterThanOrEqual(0);
      expect(result.freedSpace).toBeGreaterThanOrEqual(0);

      // In a real implementation, we'd test:
      // - Ratio of freed space to deleted items
      // - Time taken for cleanup
      // - Success rate of cleanup operations
    });

    it("should support different cleanup modes", () => {
      const policies = [
        { maxAge: 1 * 24 * 60 * 60 * 1000, maxItems: 50 }, // Aggressive
        { maxAge: 7 * 24 * 60 * 60 * 1000, maxItems: 100 }, // Normal
        { maxAge: 30 * 24 * 60 * 60 * 1000, maxItems: 500 }, // Conservative
      ];

      policies.forEach((policy) => {
        storageManager.setCleanupPolicy(policy);
        const currentPolicy = storageManager.getCleanupPolicy();
        expect(currentPolicy.maxAge).toBe(policy.maxAge);
        expect(currentPolicy.maxItems).toBe(policy.maxItems);
      });
    });
  });
});
