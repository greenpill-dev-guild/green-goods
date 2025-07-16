import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeduplicationManager } from "@/modules/deduplication";
import { createMockOfflineWork, mockFetch, mockFetchError } from "@/__tests__/offline-test-helpers";

describe("DeduplicationManager", () => {
  let deduplicationManager: DeduplicationManager;

  beforeEach(() => {
    deduplicationManager = new DeduplicationManager();
    vi.clearAllMocks();
  });

  describe("generateContentHash", () => {
    it("should generate consistent hash for identical content", () => {
      const work1 = createMockOfflineWork({
        data: { title: "Test Work", description: "Test" },
      });
      const work2 = createMockOfflineWork({
        data: { title: "Test Work", description: "Test" },
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different content", () => {
      const work1 = createMockOfflineWork({
        data: { title: "Test Work 1" },
      });
      const work2 = createMockOfflineWork({
        data: { title: "Test Work 2" },
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).not.toBe(hash2);
    });

    it("should ignore timestamp fields in hash calculation", () => {
      const work1 = createMockOfflineWork({
        data: {
          title: "Test Work",
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
      });
      const work2 = createMockOfflineWork({
        data: {
          title: "Test Work",
          timestamp: Date.now() + 1000,
          createdAt: Date.now() + 1000,
        },
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });

    it("should include image count in hash", () => {
      const work1 = createMockOfflineWork({
        images: [new File([], "test1.jpg")],
      });
      const work2 = createMockOfflineWork({
        images: [new File([], "test1.jpg"), new File([], "test2.jpg")],
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle missing images gracefully", () => {
      const work1 = createMockOfflineWork({
        images: undefined,
      });
      const work2 = createMockOfflineWork({
        images: [],
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });

    it("should handle different work types", () => {
      const work1 = createMockOfflineWork({
        type: "work",
        data: { title: "Test" },
      });
      const work2 = createMockOfflineWork({
        type: "approval",
        data: { title: "Test" },
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle complex nested data structures", () => {
      const complexData = {
        title: "Complex Work",
        metadata: {
          tags: ["tag1", "tag2"],
          settings: {
            priority: "high",
            category: "testing",
          },
        },
        coordinates: { lat: 40.7128, lng: -74.006 },
      };

      const work1 = createMockOfflineWork({ data: complexData });
      const work2 = createMockOfflineWork({ data: { ...complexData } });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("checkRemoteDuplicate", () => {
    it("should return true when duplicate exists remotely", async () => {
      mockFetch({ exists: true });

      const work = createMockOfflineWork();
      const isDuplicate = await deduplicationManager.checkRemoteDuplicate(work);

      expect(isDuplicate).toBe(true);
      expect(fetch).toHaveBeenCalledWith("/api/works/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentHash: deduplicationManager.generateContentHash(work),
          type: work.type,
          data: work.data,
          timeWindow: 24 * 60 * 60 * 1000,
        }),
      });
    });

    it("should return false when no duplicate exists", async () => {
      mockFetch({ exists: false });

      const work = createMockOfflineWork();
      const isDuplicate = await deduplicationManager.checkRemoteDuplicate(work);

      expect(isDuplicate).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
      mockFetch({}, false); // Failed response

      const work = createMockOfflineWork();
      const isDuplicate = await deduplicationManager.checkRemoteDuplicate(work);

      expect(isDuplicate).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      mockFetchError(new Error("Network error"));

      const work = createMockOfflineWork();
      const isDuplicate = await deduplicationManager.checkRemoteDuplicate(work);

      expect(isDuplicate).toBe(false);
    });

    it("should handle malformed response gracefully", async () => {
      mockFetch("invalid json");

      const work = createMockOfflineWork();
      const isDuplicate = await deduplicationManager.checkRemoteDuplicate(work);

      expect(isDuplicate).toBe(false);
    });

    it("should include correct time window in request", async () => {
      mockFetch({ exists: false });

      const work = createMockOfflineWork();
      await deduplicationManager.checkRemoteDuplicate(work);

      const call = (fetch as any).mock.calls[0];
      const requestBody = JSON.parse(call[1].body);

      expect(requestBody.timeWindow).toBe(24 * 60 * 60 * 1000);
    });

    it("should handle different work types in API call", async () => {
      mockFetch({ exists: false });

      const workSubmission = createMockOfflineWork({ type: "work" });
      const workApproval = createMockOfflineWork({ type: "approval" });

      await deduplicationManager.checkRemoteDuplicate(workSubmission);
      await deduplicationManager.checkRemoteDuplicate(workApproval);

      expect(fetch).toHaveBeenCalledTimes(2);

      const calls = (fetch as any).mock.calls;
      const request1 = JSON.parse(calls[0][1].body);
      const request2 = JSON.parse(calls[1][1].body);

      expect(request1.type).toBe("work");
      expect(request2.type).toBe("approval");
    });
  });

  describe("normalizeData", () => {
    it("should remove timestamp fields", () => {
      const data = {
        title: "Test",
        timestamp: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        description: "Test description",
      };

      const normalized = deduplicationManager["normalizeData"](data);

      expect(normalized).toEqual({
        title: "Test",
        description: "Test description",
      });
    });

    it("should handle non-object data", () => {
      expect(deduplicationManager["normalizeData"]("string")).toBe("string");
      expect(deduplicationManager["normalizeData"](123)).toBe(123);
      expect(deduplicationManager["normalizeData"](null)).toBe(null);
      expect(deduplicationManager["normalizeData"](undefined)).toBe(undefined);
    });

    it("should handle arrays", () => {
      const arrayData = ["item1", "item2", "item3"];
      const normalized = deduplicationManager["normalizeData"](arrayData);

      expect(normalized).toEqual(arrayData);
    });

    it("should preserve nested objects while removing timestamps", () => {
      const data = {
        title: "Test",
        metadata: {
          tags: ["tag1", "tag2"],
          timestamp: Date.now(), // This should be removed
          settings: {
            priority: "high",
            createdAt: Date.now(), // This should be removed
          },
        },
        description: "Test description",
      };

      const normalized = deduplicationManager["normalizeData"](data);

      expect(normalized).toEqual({
        title: "Test",
        metadata: {
          tags: ["tag1", "tag2"],
          settings: {
            priority: "high",
          },
        },
        description: "Test description",
      });
    });

    it("should handle objects with prototype properties", () => {
      function TestClass(this: any, title: string) {
        this.title = title;
        this.timestamp = Date.now();
      }
      TestClass.prototype.method = function () {
        return "test";
      };

      const data = new (TestClass as any)("Test Title");
      const normalized = deduplicationManager["normalizeData"](data);

      expect(normalized).toEqual({
        title: "Test Title",
      });
      expect(normalized).not.toHaveProperty("method");
    });

    it("should handle deeply nested timestamp fields", () => {
      const data = {
        level1: {
          level2: {
            level3: {
              timestamp: Date.now(),
              value: "deep value",
            },
            createdAt: Date.now(),
          },
          updatedAt: Date.now(),
        },
        topLevel: "value",
      };

      const normalized = deduplicationManager["normalizeData"](data);

      expect(normalized).toEqual({
        level1: {
          level2: {
            level3: {
              value: "deep value",
            },
          },
        },
        topLevel: "value",
      });
    });
  });

  describe("edge cases and performance", () => {
    it("should handle very large data objects", () => {
      const largeData = {
        title: "Large Work",
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
        })),
      };

      const work = createMockOfflineWork({ data: largeData });

      expect(() => {
        deduplicationManager.generateContentHash(work);
      }).not.toThrow();
    });

    it("should handle circular references gracefully", () => {
      const circularData: any = {
        title: "Circular Work",
      };
      circularData.self = circularData;

      const work = createMockOfflineWork({ data: circularData });

      expect(() => {
        const hash = deduplicationManager.generateContentHash(work);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe("string");
        expect(hash.length).toBeGreaterThan(0);
      }).not.toThrow(); // Our implementation handles circular references gracefully
    });

    it("should handle unicode characters in content", () => {
      const unicodeData = {
        title: "测试工作 🚀",
        description: "émojis and spëcial chars ñoël",
        tags: ["🏷️", "标签", "тег"],
      };

      const work1 = createMockOfflineWork({ data: unicodeData });
      const work2 = createMockOfflineWork({ data: { ...unicodeData } });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });

    it("should handle empty and null values consistently", () => {
      const variations = [
        { title: "", description: null },
        { title: "", description: undefined },
        { title: "", description: "" },
        { description: null },
        { description: undefined },
        { description: "" },
        {},
      ];

      const hashes = variations.map((data) => {
        const work = createMockOfflineWork({ data });
        return deduplicationManager.generateContentHash(work);
      });

      // Each should produce a consistent hash
      variations.forEach((data, index) => {
        const work1 = createMockOfflineWork({ data });
        const work2 = createMockOfflineWork({ data: { ...data } });

        const hash1 = deduplicationManager.generateContentHash(work1);
        const hash2 = deduplicationManager.generateContentHash(work2);

        expect(hash1).toBe(hash2);
      });
    });

    it("should be deterministic across multiple calls", () => {
      const work = createMockOfflineWork({
        data: {
          title: "Deterministic Test",
          value: 42,
          timestamp: Date.now(),
        },
      });

      const hashes = Array.from({ length: 10 }, () =>
        deduplicationManager.generateContentHash(work)
      );

      // All hashes should be identical
      hashes.forEach((hash) => {
        expect(hash).toBe(hashes[0]);
      });
    });
  });

  describe("integration scenarios", () => {
    it("should correctly identify identical work created at different times", () => {
      const baseData = {
        title: "Garden Maintenance",
        description: "Weekly garden maintenance work",
        actionUID: 1,
        gardenAddress: "0x123...",
      };

      const work1 = createMockOfflineWork({
        data: { ...baseData, timestamp: Date.now() - 1000 },
        timestamp: Date.now() - 1000,
      });

      const work2 = createMockOfflineWork({
        data: { ...baseData, timestamp: Date.now() },
        timestamp: Date.now(),
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });

    it("should differentiate between work and approval with same content", () => {
      const sameContent = {
        title: "Same Content",
        description: "This content is the same",
      };

      const work = createMockOfflineWork({
        type: "work",
        data: sameContent,
      });

      const approval = createMockOfflineWork({
        type: "approval",
        data: sameContent,
      });

      const workHash = deduplicationManager.generateContentHash(work);
      const approvalHash = deduplicationManager.generateContentHash(approval);

      expect(workHash).not.toBe(approvalHash);
    });

    it("should handle realistic work submission data", () => {
      const realisticWorkData = {
        title: "Community Garden Watering",
        description: "Watered all plants in the community garden section A",
        actionUID: 42,
        gardenAddress: "0x742d35Cc6634C0532925a3b8D84EA5C2",
        location: {
          lat: 40.7128,
          lng: -74.006,
          accuracy: 5,
        },
        evidence: {
          photos: ["before.jpg", "after.jpg"],
          timeSpent: 45,
          conditions: "sunny, 75°F",
        },
        metadata: {
          deviceId: "mobile-123",
          appVersion: "1.2.3",
          submissionSource: "offline",
        },
      };

      const work1 = createMockOfflineWork({
        data: { ...realisticWorkData, timestamp: Date.now() - 5000 },
        images: [new File([], "before.jpg"), new File([], "after.jpg")],
      });

      const work2 = createMockOfflineWork({
        data: { ...realisticWorkData, timestamp: Date.now() },
        images: [new File([], "before.jpg"), new File([], "after.jpg")],
      });

      const hash1 = deduplicationManager.generateContentHash(work1);
      const hash2 = deduplicationManager.generateContentHash(work2);

      expect(hash1).toBe(hash2);
    });
  });
});
