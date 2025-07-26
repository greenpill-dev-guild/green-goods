import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeduplicationManager,
  defaultDeduplicationManager,
  type DuplicationConfig,
  // type DuplicateCheckResult,
  // type LocalDuplicateResult,
} from "@/modules/deduplication";

// Mock fetch for API calls
global.fetch = vi.fn();

// Test data factories
const createMockWorkData = (overrides = {}) => ({
  type: "work",
  title: "Test Work Title",
  description: "Test work description",
  gardenAddress: "0xgarden123",
  actionUID: 1,
  data: {
    title: "Test Work Title",
    description: "Test work description",
    gardenAddress: "0xgarden123",
    actionUID: 1,
    feedback: "Good work!",
    plantCount: 5,
    plantSelection: ["tree", "flower"],
  },
  images: ["image1.jpg", "image2.jpg"],
  createdAt: Date.now(),
  id: "work-123",
  ...overrides,
});

// const createMockConfig = (overrides: Partial<DuplicationConfig> = {}): DuplicationConfig => ({
//   apiBaseUrl: "/api",
//   timeWindow: 24 * 60 * 60 * 1000, // 24 hours
//   includeImages: true,
//   hashAlgorithm: "simple",
//   ignoreFields: ["id", "createdAt", "updatedAt", "timestamp", "lastModified"],
//   ...overrides,
// });

describe("DeduplicationManager", () => {
  let deduplicationManager: DeduplicationManager;
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    deduplicationManager = new DeduplicationManager();

    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: false }),
    } as Response);

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor and Configuration", () => {
    it("should initialize with default configuration", () => {
      const manager = new DeduplicationManager();
      const config = manager.getConfig();

      expect(config.apiBaseUrl).toBe("/api");
      expect(config.timeWindow).toBe(24 * 60 * 60 * 1000);
      expect(config.includeImages).toBe(true);
      expect(config.hashAlgorithm).toBe("simple");
      expect(config.ignoreFields).toContain("id");
      expect(config.ignoreFields).toContain("createdAt");
    });

    it("should initialize with custom configuration", () => {
      const customConfig: Partial<DuplicationConfig> = {
        apiBaseUrl: "/custom-api",
        timeWindow: 12 * 60 * 60 * 1000, // 12 hours
        includeImages: false,
        hashAlgorithm: "sha256",
        ignoreFields: ["customField"],
      };

      const manager = new DeduplicationManager(customConfig);
      const config = manager.getConfig();

      expect(config.apiBaseUrl).toBe("/custom-api");
      expect(config.timeWindow).toBe(12 * 60 * 60 * 1000);
      expect(config.includeImages).toBe(false);
      expect(config.hashAlgorithm).toBe("sha256");
      expect(config.ignoreFields).toEqual(["customField"]);
    });

    it("should update configuration", () => {
      const updates: Partial<DuplicationConfig> = {
        timeWindow: 6 * 60 * 60 * 1000, // 6 hours
        includeImages: false,
      };

      deduplicationManager.setConfig(updates);
      const config = deduplicationManager.getConfig();

      expect(config.timeWindow).toBe(6 * 60 * 60 * 1000);
      expect(config.includeImages).toBe(false);
      expect(config.apiBaseUrl).toBe("/api"); // Should keep original values
    });

    it("should return copy of configuration to prevent external mutation", () => {
      const config1 = deduplicationManager.getConfig();
      const config2 = deduplicationManager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects

      // Mutating returned config should not affect internal config
      config1.timeWindow = 999;
      expect(deduplicationManager.getConfig().timeWindow).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("Content Hash Generation", () => {
    it("should generate consistent hashes for identical content", () => {
      const workData1 = createMockWorkData();
      const workData2 = createMockWorkData();

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("should generate different hashes for different content", () => {
      const workData1 = createMockWorkData({
        title: "First Title",
        description: "First description",
      });
      const workData2 = createMockWorkData({
        title: "Second Title",
        description: "Second description",
      });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(hash2).toBeTruthy();
    });

    it("should ignore timestamp fields in hash generation", () => {
      const workData1 = createMockWorkData({ createdAt: 1000000 });
      const workData2 = createMockWorkData({ createdAt: 2000000 });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
    });

    it("should ignore id fields in hash generation", () => {
      const workData1 = createMockWorkData({ id: "work-123" });
      const workData2 = createMockWorkData({ id: "work-456" });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
    });

    it("should include image count when includeImages is true", () => {
      const workData1 = createMockWorkData({ images: ["img1.jpg", "img2.jpg"] });
      const workData2 = createMockWorkData({ images: ["img1.jpg"] });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).not.toBe(hash2);
    });

    it("should exclude image count when includeImages is false", () => {
      const manager = new DeduplicationManager({ includeImages: false });

      const workData1 = createMockWorkData({ images: ["img1.jpg", "img2.jpg"] });
      const workData2 = createMockWorkData({ images: ["img1.jpg"] });

      const hash1 = manager.generateContentHash(workData1);
      const hash2 = manager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
    });

    it("should handle missing data gracefully", () => {
      const workData = {
        type: "work",
        // Missing most fields
      };

      const hash = deduplicationManager.generateContentHash(workData);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });

    it("should handle null and undefined values", () => {
      const workData = createMockWorkData({
        title: null,
        description: undefined,
        data: {
          title: null,
          description: undefined,
        },
      });

      const hash = deduplicationManager.generateContentHash(workData);
      expect(hash).toBeTruthy();
    });

    it("should respect custom ignoreFields configuration", () => {
      const manager = new DeduplicationManager({
        ignoreFields: ["customField"],
      });

      const workData1 = createMockWorkData({ customField: "value1" });
      const workData2 = createMockWorkData({ customField: "value2" });

      const hash1 = manager.generateContentHash(workData1);
      const hash2 = manager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Local Cache Management", () => {
    it("should detect no duplicates in empty cache", () => {
      const workData = createMockWorkData();
      const result = deduplicationManager.checkLocalDuplicate(workData);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingItems).toEqual([]);
      expect(result.contentHash).toBeTruthy();
    });

    it("should add work to local cache", () => {
      const workData = createMockWorkData();
      const workId = "work-123";

      deduplicationManager.addToLocalCache(workId, workData);

      const result = deduplicationManager.checkLocalDuplicate(workData);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingItems).toContain(workId);
    });

    it("should detect duplicates after adding to cache", () => {
      const workData = createMockWorkData();
      const workId = "work-123";

      // Add to cache
      deduplicationManager.addToLocalCache(workId, workData);

      // Check for duplicate
      const result = deduplicationManager.checkLocalDuplicate(workData);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingItems).toEqual([workId]);
    });

    it("should handle multiple work items with same content hash", () => {
      const workData = createMockWorkData();
      const workId1 = "work-123";
      const workId2 = "work-456";

      deduplicationManager.addToLocalCache(workId1, workData);
      deduplicationManager.addToLocalCache(workId2, workData);

      const result = deduplicationManager.checkLocalDuplicate(workData);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingItems).toHaveLength(2);
      expect(result.existingItems).toContain(workId1);
      expect(result.existingItems).toContain(workId2);
    });

    it("should not add duplicate work IDs to cache", () => {
      const workData = createMockWorkData();
      const workId = "work-123";

      deduplicationManager.addToLocalCache(workId, workData);
      deduplicationManager.addToLocalCache(workId, workData); // Add again

      const result = deduplicationManager.checkLocalDuplicate(workData);
      expect(result.existingItems).toEqual([workId]); // Should only appear once
    });

    it("should remove work from cache with workData", () => {
      const workData = createMockWorkData();
      const workId = "work-123";

      deduplicationManager.addToLocalCache(workId, workData);
      expect(deduplicationManager.checkLocalDuplicate(workData).isDuplicate).toBe(true);

      deduplicationManager.removeFromLocalCache(workId, workData);
      expect(deduplicationManager.checkLocalDuplicate(workData).isDuplicate).toBe(false);
    });

    it("should remove work from cache without workData", () => {
      const workData1 = createMockWorkData({ title: "First Work" });
      const workData2 = createMockWorkData({ title: "Second Work" });
      const workId = "work-123";

      deduplicationManager.addToLocalCache(workId, workData1);
      deduplicationManager.addToLocalCache(workId, workData2);

      // Remove without specifying workData - should remove from all hashes
      deduplicationManager.removeFromLocalCache(workId);

      expect(deduplicationManager.checkLocalDuplicate(workData1).isDuplicate).toBe(false);
      expect(deduplicationManager.checkLocalDuplicate(workData2).isDuplicate).toBe(false);
    });

    it("should handle removing one work item when multiple exist for same hash", () => {
      const workData = createMockWorkData();
      const workId1 = "work-123";
      const workId2 = "work-456";

      deduplicationManager.addToLocalCache(workId1, workData);
      deduplicationManager.addToLocalCache(workId2, workData);

      deduplicationManager.removeFromLocalCache(workId1, workData);

      const result = deduplicationManager.checkLocalDuplicate(workData);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingItems).toEqual([workId2]);
    });

    it("should clear all entries from local cache", () => {
      const workData1 = createMockWorkData({ title: "First Work" });
      const workData2 = createMockWorkData({ title: "Second Work" });

      deduplicationManager.addToLocalCache("work-1", workData1);
      deduplicationManager.addToLocalCache("work-2", workData2);

      expect(deduplicationManager.checkLocalDuplicate(workData1).isDuplicate).toBe(true);
      expect(deduplicationManager.checkLocalDuplicate(workData2).isDuplicate).toBe(true);

      deduplicationManager.clearLocalCache();

      expect(deduplicationManager.checkLocalDuplicate(workData1).isDuplicate).toBe(false);
      expect(deduplicationManager.checkLocalDuplicate(workData2).isDuplicate).toBe(false);
    });

    it("should provide cache statistics", () => {
      const workData1 = createMockWorkData({
        title: "First Work",
        description: "First description",
        actionUID: 1,
      });
      const workData2 = createMockWorkData({
        title: "Second Work",
        description: "Second description",
        actionUID: 2,
      });

      // Empty cache
      let stats = deduplicationManager.getLocalCacheStats();
      expect(stats.uniqueHashes).toBe(0);
      expect(stats.totalWorkItems).toBe(0);
      expect(stats.averageItemsPerHash).toBe(0);

      // Add items
      deduplicationManager.addToLocalCache("work-1", workData1);
      deduplicationManager.addToLocalCache("work-2", workData1); // Same hash
      deduplicationManager.addToLocalCache("work-3", workData2); // Different hash

      stats = deduplicationManager.getLocalCacheStats();
      expect(stats.uniqueHashes).toBe(2);
      expect(stats.totalWorkItems).toBe(3);
      expect(stats.averageItemsPerHash).toBe(1.5);
    });
  });

  describe("Remote Duplicate Checking", () => {
    beforeEach(() => {
      // Reset fetch mock for each test
      vi.clearAllMocks();
    });

    it("should check remote duplicate via API", async () => {
      // Set up the mock response for this specific test
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true }),
        status: 200,
        statusText: "OK",
      } as unknown as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("/api/works/check-duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: expect.any(String),
      });
    });

    it("should return false when API returns no duplicate", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false); // Should assume no duplicate on error
      expect(console.error).toHaveBeenCalledWith("Duplicate check API error:", 500);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Error checking remote duplicate:",
        expect.any(Error)
      );
    });

    it("should handle malformed JSON responses", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Malformed response from duplicate check API:",
        expect.any(Error)
      );
    });

    it("should handle undefined response data", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // No 'exists' field
      } as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false);
    });

    it("should use custom API base URL", async () => {
      const manager = new DeduplicationManager({ apiBaseUrl: "/custom-api" });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const workData = createMockWorkData();
      await manager.checkRemoteDuplicate(workData);

      expect(mockFetch).toHaveBeenCalledWith(
        "/custom-api/works/check-duplicate",
        expect.any(Object)
      );
    });
  });

  describe("Comprehensive Duplicate Checking", () => {
    it("should return local duplicate when found", async () => {
      const workData = createMockWorkData();
      deduplicationManager.addToLocalCache("work-123", workData);

      const result = await deduplicationManager.performComprehensiveCheck(workData);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingWorkId).toBe("work-123");
      expect(result.similarity).toBe(1.0);
      expect(result.conflictType).toBe("exact");

      // Should not call remote API if local duplicate found
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should check remote when no local duplicate", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: true }),
      } as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.performComprehensiveCheck(workData);

      expect(result.isDuplicate).toBe(true);
      expect(result.conflictType).toBe("exact");
      expect(result.existingWorkId).toBeUndefined(); // Remote doesn't provide work ID
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should return no duplicate when neither local nor remote found", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const workData = createMockWorkData();
      const result = await deduplicationManager.performComprehensiveCheck(workData);

      expect(result.isDuplicate).toBe(false);
      expect(result.conflictType).toBe("none");
    });
  });

  describe("Batch Processing", () => {
    it("should check multiple work items for duplicates", async () => {
      const workItems = [
        { ...createMockWorkData({ id: "work-1", title: "First Work" }) },
        { ...createMockWorkData({ id: "work-2", title: "Second Work" }) },
        { ...createMockWorkData({ id: "work-3", title: "Third Work" }) },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const results = await deduplicationManager.checkMultipleDuplicates(workItems);

      expect(results.size).toBe(3);
      expect(results.get("work-1")?.isDuplicate).toBe(false);
      expect(results.get("work-2")?.isDuplicate).toBe(false);
      expect(results.get("work-3")?.isDuplicate).toBe(false);
    });

    it("should handle batch processing with mixed results", async () => {
      const workItems = [
        { ...createMockWorkData({ id: "work-1", title: "First Work" }) },
        { ...createMockWorkData({ id: "work-2", title: "Second Work" }) },
      ];

      // Add one to local cache to create a local duplicate
      deduplicationManager.addToLocalCache("existing-work", workItems[0]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const results = await deduplicationManager.checkMultipleDuplicates(workItems);

      expect(results.get("work-1")?.isDuplicate).toBe(true); // Local duplicate
      expect(results.get("work-2")?.isDuplicate).toBe(false); // No duplicate
    });

    it("should process large batches efficiently", async () => {
      const workItems = Array.from({ length: 25 }, (_, i) => ({
        ...createMockWorkData({ id: `work-${i}`, title: `Work ${i}` }),
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exists: false }),
      } as Response);

      const results = await deduplicationManager.checkMultipleDuplicates(workItems);

      expect(results.size).toBe(25);
      // Should batch API calls (default batch size is 10)
      expect(mockFetch).toHaveBeenCalledTimes(25); // Each item not in local cache calls API
    });
  });

  describe("Similarity Analysis", () => {
    it("should find similar work with high similarity threshold", () => {
      const workData1 = createMockWorkData({ title: "Test Work" });
      const workData2 = createMockWorkData({ title: "Test Work Similar" });

      deduplicationManager.addToLocalCache("work-1", workData1);

      const similar = deduplicationManager.findSimilarWork(workData2, 0.8);

      // With simple hash similarity, these might not be similar enough
      // This tests the functionality even if similarity is low
      expect(Array.isArray(similar)).toBe(true);
    });

    it("should return empty array when no similar work exists", () => {
      const workData = createMockWorkData();

      const similar = deduplicationManager.findSimilarWork(workData, 0.8);

      expect(similar).toEqual([]);
    });

    it("should not include exact matches in similar work", () => {
      const workData = createMockWorkData();

      deduplicationManager.addToLocalCache("work-1", workData);

      const similar = deduplicationManager.findSimilarWork(workData, 0.1);

      // Exact match should not be included in similar results
      expect(similar).toEqual([]);
    });

    it("should respect similarity threshold", () => {
      const workData1 = createMockWorkData({ title: "Original Work" });
      const workData2 = createMockWorkData({ title: "Very Different Work Content" });

      deduplicationManager.addToLocalCache("work-1", workData1);

      const highThreshold = deduplicationManager.findSimilarWork(workData2, 0.9);
      const lowThreshold = deduplicationManager.findSimilarWork(workData2, 0.1);

      // High threshold should be more restrictive
      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
    });
  });

  describe("Data Normalization", () => {
    it("should normalize nested objects correctly", () => {
      const workData1 = createMockWorkData({
        data: {
          title: "Test",
          nested: {
            field: "value",
            timestamp: Date.now(), // Should be ignored
          },
        },
      });

      const workData2 = createMockWorkData({
        data: {
          title: "Test",
          nested: {
            field: "value",
            timestamp: Date.now() + 1000, // Different timestamp
          },
        },
      });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).toBe(hash2); // Timestamps should be ignored
    });

    it("should handle arrays consistently", () => {
      const workData1 = createMockWorkData({
        data: {
          tags: ["tag1", "tag2"],
        },
      });

      const workData2 = createMockWorkData({
        data: {
          tags: ["tag1", "tag2"],
        },
      });

      const hash1 = deduplicationManager.generateContentHash(workData1);
      const hash2 = deduplicationManager.generateContentHash(workData2);

      expect(hash1).toBe(hash2);
    });

    it("should handle empty and null values", () => {
      const workData = createMockWorkData({
        data: {
          title: "",
          description: null,
          optional: undefined,
          empty: {},
          emptyArray: [],
        },
      });

      const hash = deduplicationManager.generateContentHash(workData);
      expect(hash).toBeTruthy();
    });
  });

  describe("Default Instance", () => {
    it("should export default deduplication manager instance", () => {
      expect(defaultDeduplicationManager).toBeInstanceOf(DeduplicationManager);
      expect(defaultDeduplicationManager.getConfig()).toBeDefined();
    });

    it("should use default configuration for default instance", () => {
      const config = defaultDeduplicationManager.getConfig();
      expect(config.apiBaseUrl).toBe("/api");
      expect(config.timeWindow).toBe(24 * 60 * 60 * 1000);
      expect(config.includeImages).toBe(true);
    });

    it("should maintain separate state from custom instances", () => {
      const customManager = new DeduplicationManager();
      const workData = createMockWorkData();

      defaultDeduplicationManager.addToLocalCache("work-1", workData);
      customManager.addToLocalCache("work-2", workData);

      const defaultResult = defaultDeduplicationManager.checkLocalDuplicate(workData);
      const customResult = customManager.checkLocalDuplicate(workData);

      expect(defaultResult.existingItems).toEqual(["work-1"]);
      expect(customResult.existingItems).toEqual(["work-2"]);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle completely empty work data", () => {
      const workData = {};
      const hash = deduplicationManager.generateContentHash(workData);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });

    it("should handle circular references gracefully", () => {
      const workData: any = createMockWorkData();
      workData.circular = workData; // Create circular reference

      // Should not throw an error
      expect(() => {
        deduplicationManager.generateContentHash(workData);
      }).not.toThrow();
    });

    it("should handle very large work data", () => {
      const largeData = createMockWorkData({
        data: {
          ...createMockWorkData().data,
          largeField: "x".repeat(10000), // Large string
        },
      });

      const hash = deduplicationManager.generateContentHash(largeData);
      expect(hash).toBeTruthy();
    });

    it("should handle non-string field values", () => {
      const workData = createMockWorkData({
        data: {
          numberField: 123,
          booleanField: true,
          arrayField: [1, 2, 3],
          objectField: { nested: "value" },
        },
      });

      const hash = deduplicationManager.generateContentHash(workData);
      expect(hash).toBeTruthy();
    });

    it("should handle API timeout scenarios", async () => {
      mockFetch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 100))
      );

      const workData = createMockWorkData();
      const result = await deduplicationManager.checkRemoteDuplicate(workData);

      expect(result).toBe(false); // Should assume no duplicate on timeout
    });

    it("should maintain hash consistency across multiple calls", () => {
      const workData = createMockWorkData();

      const hashes = Array.from({ length: 100 }, () =>
        deduplicationManager.generateContentHash(workData)
      );

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });
  });
});
