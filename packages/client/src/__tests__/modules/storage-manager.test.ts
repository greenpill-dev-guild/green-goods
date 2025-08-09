import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CleanupPolicy,
  defaultStorageManager,
  StorageManager,
  // type CleanupResult,
  // type StorageAnalytics,
  // type StorageQuota,
  // type StorageBreakdown,
} from "@/modules/storage-manager";

// Mock browser APIs
const mockNavigatorStorage = {
  estimate: vi.fn(),
};

const mockCaches = {
  keys: vi.fn(),
  delete: vi.fn(),
};

// Setup global mocks
Object.defineProperty(global, "navigator", {
  value: {
    storage: mockNavigatorStorage,
  },
  writable: true,
});

Object.defineProperty(global, "window", {
  value: {
    caches: mockCaches,
  },
  writable: true,
});

Object.defineProperty(global, "caches", {
  value: mockCaches,
  writable: true,
});

// Test data factories
const createMockStorageEstimate = (overrides = {}) => ({
  usage: 50 * 1024 * 1024, // 50MB
  quota: 100 * 1024 * 1024, // 100MB
  ...overrides,
});

// const createMockCleanupPolicy = (overrides: Partial<CleanupPolicy> = {}): CleanupPolicy => ({
//   maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
//   maxItems: 1000,
//   thresholdPercentage: 80,
//   priorityOrder: ["old_completed", "failed_items", "large_images", "cache"],
//   ...overrides,
// });

describe("StorageManager", () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    storageManager = new StorageManager();

    // Setup default mock implementations
    mockNavigatorStorage.estimate.mockResolvedValue(createMockStorageEstimate());
    mockCaches.keys.mockResolvedValue(["cache-v1", "cache-v2"]);
    mockCaches.delete.mockResolvedValue(true);

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor and Policy Management", () => {
    it("should initialize with default policy", () => {
      const manager = new StorageManager();
      const policy = manager.getCleanupPolicy();

      expect(policy.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
      expect(policy.maxItems).toBe(1000);
      expect(policy.thresholdPercentage).toBe(80);
      expect(policy.priorityOrder).toEqual([
        "old_completed",
        "failed_items",
        "large_images",
        "cache",
      ]);
    });

    it("should initialize with custom policy", () => {
      const customPolicy: Partial<CleanupPolicy> = {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        thresholdPercentage: 90,
        priorityOrder: ["cache", "large_images"],
      };

      const manager = new StorageManager(customPolicy);
      const policy = manager.getCleanupPolicy();

      expect(policy.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
      expect(policy.thresholdPercentage).toBe(90);
      expect(policy.priorityOrder).toEqual(["cache", "large_images"]);
      expect(policy.maxItems).toBe(1000); // Should keep default for unspecified values
    });

    it("should update cleanup policy", () => {
      const updates: Partial<CleanupPolicy> = {
        thresholdPercentage: 70,
        maxItems: 500,
      };

      storageManager.setCleanupPolicy(updates);
      const policy = storageManager.getCleanupPolicy();

      expect(policy.thresholdPercentage).toBe(70);
      expect(policy.maxItems).toBe(500);
      expect(policy.maxAge).toBe(30 * 24 * 60 * 60 * 1000); // Should keep original values
    });

    it("should return copy of policy to prevent external mutation", () => {
      const policy1 = storageManager.getCleanupPolicy();
      const policy2 = storageManager.getCleanupPolicy();

      expect(policy1).toEqual(policy2);
      expect(policy1).not.toBe(policy2); // Different objects

      // Mutating returned policy should not affect internal policy
      policy1.thresholdPercentage = 999;
      expect(storageManager.getCleanupPolicy().thresholdPercentage).toBe(80);
    });
  });

  describe("Storage Quota Management", () => {
    it("should get storage quota from navigator.storage", async () => {
      const mockEstimate = createMockStorageEstimate({
        usage: 60 * 1024 * 1024, // 60MB
        quota: 120 * 1024 * 1024, // 120MB
      });
      mockNavigatorStorage.estimate.mockResolvedValue(mockEstimate);

      const quota = await storageManager.getStorageQuota();

      expect(quota.used).toBe(60 * 1024 * 1024);
      expect(quota.total).toBe(120 * 1024 * 1024);
      expect(quota.available).toBe(60 * 1024 * 1024);
      expect(quota.percentage).toBe(50);
    });

    it("should handle missing quota in estimate", async () => {
      mockNavigatorStorage.estimate.mockResolvedValue({
        usage: 30 * 1024 * 1024,
        // quota is undefined
      });

      const quota = await storageManager.getStorageQuota();

      expect(quota.used).toBe(30 * 1024 * 1024);
      expect(quota.total).toBe(0);
      expect(quota.available).toBe(-30 * 1024 * 1024);
      expect(quota.percentage).toBe(0);
    });

    it("should handle storage estimate errors", async () => {
      mockNavigatorStorage.estimate.mockRejectedValue(new Error("Storage access denied"));

      const quota = await storageManager.getStorageQuota();

      // Should return fallback values
      expect(quota.used).toBe(0);
      expect(quota.total).toBe(1024 * 1024 * 1024); // 1GB default
      expect(quota.available).toBe(1024 * 1024 * 1024);
      expect(quota.percentage).toBe(0);
    });

    it("should handle missing navigator.storage API", async () => {
      // Temporarily remove storage API
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
      });

      const quota = await storageManager.getStorageQuota();

      // Should return fallback values
      expect(quota.used).toBe(0);
      expect(quota.total).toBe(1024 * 1024 * 1024);
      expect(quota.percentage).toBe(0);

      // Restore navigator for other tests
      Object.defineProperty(global, "navigator", {
        value: { storage: mockNavigatorStorage },
        writable: true,
      });
    });

    it("should handle missing estimate function", async () => {
      Object.defineProperty(global, "navigator", {
        value: { storage: {} },
        writable: true,
      });

      const quota = await storageManager.getStorageQuota();

      expect(quota.total).toBe(1024 * 1024 * 1024);

      // Restore navigator
      Object.defineProperty(global, "navigator", {
        value: { storage: mockNavigatorStorage },
        writable: true,
      });
    });
  });

  describe("Storage Breakdown Analysis", () => {
    it("should calculate storage breakdown by category", async () => {
      const breakdown = await storageManager.getStorageBreakdown();

      expect(breakdown.workItems).toBe(500000); // 500KB (from mock)
      expect(breakdown.images).toBe(2000000); // 2MB (from mock)
      expect(breakdown.cache).toBe(1000000); // 1MB (from mock)
      expect(breakdown.metadata).toBe(100000); // 100KB (from mock)
      expect(breakdown.total).toBe(3600000); // Sum of all categories
    });

    it("should handle breakdown calculation errors", async () => {
      // Mock one of the private methods to throw an error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Create a manager and spy on a private method indirectly by breaking the calculation
      vi.spyOn(storageManager as any, "calculateWorkItemsSize").mockRejectedValue(
        new Error("Database error")
      );

      const breakdown = await storageManager.getStorageBreakdown();

      // Should return fallback values when error occurs
      expect(breakdown.workItems).toBe(0);
      expect(breakdown.images).toBe(0);
      expect(breakdown.cache).toBe(0);
      expect(breakdown.metadata).toBe(0);
      expect(breakdown.total).toBe(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error calculating storage breakdown:",
        expect.any(Error)
      );
    });
  });

  describe("Cleanup Assessment", () => {
    it("should recommend cleanup when percentage threshold exceeded", async () => {
      mockNavigatorStorage.estimate.mockResolvedValue(
        createMockStorageEstimate({
          usage: 85 * 1024 * 1024, // 85MB
          quota: 100 * 1024 * 1024, // 100MB (85% usage)
        })
      );

      const shouldCleanup = await storageManager.shouldPerformCleanup();
      expect(shouldCleanup).toBe(true);
    });

    it("should not recommend cleanup when usage is below threshold", async () => {
      // Create a storage manager with specific policy to avoid time-based cleanup
      const customStorageManager = new StorageManager({
        thresholdPercentage: 80,
        maxItems: 10000,
      });

      // Set up storage API mock
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 70 * 1024 * 1024, // 70MB
            quota: 100 * 1024 * 1024, // 100MB (70% usage)
          }),
        },
        writable: true,
      });

      const shouldCleanup = await customStorageManager.shouldPerformCleanup();
      expect(shouldCleanup).toBe(false);
    });

    it("should recommend cleanup when time interval exceeded", async () => {
      // Set last cleanup to more than 24 hours ago
      (storageManager as any).lastCleanup = Date.now() - 25 * 60 * 60 * 1000;

      // Mock low storage usage
      mockNavigatorStorage.estimate.mockResolvedValue(
        createMockStorageEstimate({
          usage: 30 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        })
      );

      const shouldCleanup = await storageManager.shouldPerformCleanup();
      expect(shouldCleanup).toBe(true);
    });

    it("should recommend cleanup when item count is high", async () => {
      // Mock high storage usage to simulate many items
      const highUsageBreakdown = 15000000; // 15MB which would estimate to ~1500 items
      vi.spyOn(storageManager as any, "calculateWorkItemsSize").mockResolvedValue(
        highUsageBreakdown
      );

      storageManager.setCleanupPolicy({ maxItems: 1000 });

      const shouldCleanup = await storageManager.shouldPerformCleanup();
      expect(shouldCleanup).toBe(true);
    });
  });

  describe("Cleanup Operations", () => {
    it("should perform cleanup and return results", async () => {
      // Set high storage usage to trigger cleanup
      mockNavigatorStorage.estimate.mockResolvedValue(
        createMockStorageEstimate({
          usage: 90 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        })
      );

      const result = await storageManager.performCleanup();

      expect(result.itemsRemoved).toBeGreaterThan(0);
      expect(result.spaceFreed).toBeGreaterThan(0);
      expect(result.categories).toBeDefined();
      expect(storageManager.getLastCleanupTime()).toBeGreaterThan(0);
    });

    it("should prevent concurrent cleanup operations", async () => {
      // Start first cleanup
      const firstCleanup = storageManager.performCleanup();

      // Try to start second cleanup
      await expect(storageManager.performCleanup()).rejects.toThrow("Cleanup already in progress");

      // Wait for first cleanup to complete
      await firstCleanup;

      // Should be able to start cleanup again
      expect(storageManager.isCleanupInProgress()).toBe(false);
    });

    it("should cleanup old completed items", async () => {
      // const cutoffTime = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      storageManager.setCleanupPolicy({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        priorityOrder: ["old_completed"],
      });

      const result = await storageManager.performCleanup();

      expect(result.categories.old_completed).toBeDefined();
      expect(result.categories.old_completed.items).toBe(5); // From mock implementation
      expect(result.categories.old_completed.space).toBe(50000);
    });

    it("should cleanup cache when available", async () => {
      storageManager.setCleanupPolicy({
        priorityOrder: ["cache"],
      });

      const result = await storageManager.performCleanup();

      expect(result.categories.cache).toBeDefined();
      expect(result.categories.cache.items).toBe(2); // Number of cache entries
      expect(result.categories.cache.space).toBe(200000); // Estimated space freed
    });

    it("should handle cache cleanup when caches API not available", async () => {
      // Remove caches API
      Object.defineProperty(global, "window", {
        value: {},
        writable: true,
      });
      delete (global as any).caches;

      storageManager.setCleanupPolicy({
        priorityOrder: ["cache"],
      });

      const result = await storageManager.performCleanup();

      expect(result.categories.cache.items).toBe(0);
      expect(result.categories.cache.space).toBe(0);

      // Restore caches API
      Object.defineProperty(global, "window", {
        value: { caches: mockCaches },
        writable: true,
      });
      Object.defineProperty(global, "caches", {
        value: mockCaches,
        writable: true,
      });
    });

    it("should stop cleanup early when threshold is met", async () => {
      // Start with high usage
      mockNavigatorStorage.estimate
        .mockResolvedValueOnce(
          createMockStorageEstimate({
            usage: 90 * 1024 * 1024,
            quota: 100 * 1024 * 1024,
          })
        )
        // After first cleanup category, return low usage
        .mockResolvedValue(
          createMockStorageEstimate({
            usage: 70 * 1024 * 1024,
            quota: 100 * 1024 * 1024,
          })
        );

      storageManager.setCleanupPolicy({
        priorityOrder: ["old_completed", "failed_items", "large_images", "cache"],
        thresholdPercentage: 80,
      });

      const result = await storageManager.performCleanup();

      // Should have only processed first category before stopping
      expect(result.categories.old_completed).toBeDefined();
      expect(result.categories.failed_items).toBeUndefined();
    });

    it("should handle cleanup errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock cache deletion to fail
      mockCaches.delete.mockRejectedValue(new Error("Cache deletion failed"));

      storageManager.setCleanupPolicy({
        priorityOrder: ["cache"],
      });

      const result = await storageManager.performCleanup();

      // Should still complete but with zero results for failed category
      expect(result.categories.cache.items).toBe(0);
      expect(result.categories.cache.space).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith("Error cleaning up cache:", expect.any(Error));
    });

    it("should reset cleanup state even if error occurs", async () => {
      // Force an error in cleanup
      vi.spyOn(storageManager as any, "cleanupCategory").mockRejectedValue(
        new Error("Cleanup error")
      );

      await expect(storageManager.performCleanup()).rejects.toThrow("Cleanup error");

      // Should not be in cleanup state anymore
      expect(storageManager.isCleanupInProgress()).toBe(false);
    });
  });

  describe("Analytics Generation", () => {
    it("should generate comprehensive analytics", async () => {
      mockNavigatorStorage.estimate.mockResolvedValue(
        createMockStorageEstimate({
          usage: 85 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        })
      );

      const analytics = await storageManager.getAnalytics();

      expect(analytics.quota).toBeDefined();
      expect(analytics.quota.percentage).toBe(85);
      expect(analytics.breakdown).toBeDefined();
      expect(analytics.needsCleanup).toBe(true);
      expect(analytics.recommendedActions).toBeInstanceOf(Array);
    });

    it("should provide recommendations based on storage state", async () => {
      // Test critical storage level
      mockNavigatorStorage.estimate.mockResolvedValue(
        createMockStorageEstimate({
          usage: 95 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        })
      );

      const analytics = await storageManager.getAnalytics();

      expect(analytics.recommendedActions).toContain(
        "Immediate cleanup required - storage critically low"
      );
    });

    it("should recommend image optimization when images dominate storage", async () => {
      // Mock high image usage
      vi.spyOn(storageManager as any, "calculateImagesSize").mockResolvedValue(2500000); // 2.5MB
      vi.spyOn(storageManager as any, "calculateWorkItemsSize").mockResolvedValue(100000); // 0.1MB
      vi.spyOn(storageManager as any, "calculateCacheSize").mockResolvedValue(100000); // 0.1MB
      vi.spyOn(storageManager as any, "calculateMetadataSize").mockResolvedValue(100000); // 0.1MB

      const analytics = await storageManager.getAnalytics();

      expect(analytics.recommendedActions).toContain(
        "Consider optimizing or reducing image quality"
      );
    });

    it("should recommend cache clearing when cache is large", async () => {
      // Mock high cache usage
      vi.spyOn(storageManager as any, "calculateCacheSize").mockResolvedValue(1500000); // 1.5MB
      vi.spyOn(storageManager as any, "calculateWorkItemsSize").mockResolvedValue(500000); // 0.5MB
      vi.spyOn(storageManager as any, "calculateImagesSize").mockResolvedValue(500000); // 0.5MB
      vi.spyOn(storageManager as any, "calculateMetadataSize").mockResolvedValue(100000); // 0.1MB

      const analytics = await storageManager.getAnalytics();

      expect(analytics.recommendedActions).toContain("Clear browser cache to free space");
    });
  });

  describe("State Management", () => {
    it("should track cleanup state correctly", () => {
      expect(storageManager.isCleanupInProgress()).toBe(false);
      expect(storageManager.getLastCleanupTime()).toBe(0);
    });

    it("should update last cleanup time after successful cleanup", async () => {
      const beforeTime = Date.now();
      await storageManager.performCleanup();
      const afterTime = Date.now();

      const lastCleanupTime = storageManager.getLastCleanupTime();
      expect(lastCleanupTime).toBeGreaterThanOrEqual(beforeTime);
      expect(lastCleanupTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("Default Instance", () => {
    it("should export default storage manager instance", () => {
      expect(defaultStorageManager).toBeInstanceOf(StorageManager);
      expect(defaultStorageManager.getCleanupPolicy()).toBeDefined();
    });

    it("should use default policy for default instance", () => {
      const policy = defaultStorageManager.getCleanupPolicy();
      expect(policy.thresholdPercentage).toBe(80);
      expect(policy.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle undefined navigator gracefully", async () => {
      // Temporarily remove navigator
      const originalNavigator = global.navigator;
      delete (global as any).navigator;

      const quota = await storageManager.getStorageQuota();

      expect(quota.total).toBe(1024 * 1024 * 1024); // Fallback value

      // Restore navigator
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });

    it("should handle unknown cleanup categories gracefully", async () => {
      storageManager.setCleanupPolicy({
        priorityOrder: ["unknown_category" as any],
      });

      const result = await storageManager.performCleanup();

      expect(result.categories.unknown_category).toEqual({ items: 0, space: 0 });
    });

    it("should handle multiple rapid cleanup attempts", async () => {
      const promises = [
        storageManager.performCleanup(),
        storageManager.performCleanup().catch((e) => e),
        storageManager.performCleanup().catch((e) => e),
      ];

      const results = await Promise.all(promises);

      // First should succeed
      expect(results[0]).toHaveProperty("itemsRemoved");

      // Others should fail
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBeInstanceOf(Error);
    });
  });
});
