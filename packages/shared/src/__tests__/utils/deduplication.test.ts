/**
 * Work Deduplication Utilities Tests
 *
 * Tests for deduplicateById, extractClientWorkId, and mergeAndDeduplicateByClientId.
 */

import { describe, expect, it } from "vitest";

import {
  deduplicateById,
  extractClientWorkId,
  mergeAndDeduplicateByClientId,
} from "../../utils/work/deduplication";

describe("utils/work/deduplication", () => {
  describe("deduplicateById", () => {
    it("removes duplicate items by id, keeping first occurrence", () => {
      const items = [
        { id: "a", value: 1 },
        { id: "b", value: 2 },
        { id: "a", value: 3 }, // duplicate
        { id: "c", value: 4 },
        { id: "b", value: 5 }, // duplicate
      ];

      const result = deduplicateById(items);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { id: "a", value: 1 },
        { id: "b", value: 2 },
        { id: "c", value: 4 },
      ]);
    });

    it("returns empty array for empty input", () => {
      expect(deduplicateById([])).toEqual([]);
    });

    it("returns same array when no duplicates", () => {
      const items = [
        { id: "x", data: "foo" },
        { id: "y", data: "bar" },
      ];

      const result = deduplicateById(items);

      expect(result).toHaveLength(2);
      expect(result).toEqual(items);
    });

    it("handles single item", () => {
      const items = [{ id: "only", name: "test" }];
      expect(deduplicateById(items)).toEqual(items);
    });
  });

  describe("extractClientWorkId", () => {
    it("extracts clientWorkId from valid JSON metadata", () => {
      const metadata = JSON.stringify({ clientWorkId: "work-123", other: "data" });
      expect(extractClientWorkId(metadata)).toBe("work-123");
    });

    it("returns null for null metadata", () => {
      expect(extractClientWorkId(null)).toBeNull();
    });

    it("returns null for undefined metadata", () => {
      expect(extractClientWorkId(undefined)).toBeNull();
    });

    it("returns null for empty string metadata", () => {
      expect(extractClientWorkId("")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(extractClientWorkId("not json")).toBeNull();
    });

    it("returns null when clientWorkId is missing from JSON", () => {
      const metadata = JSON.stringify({ someOther: "field" });
      expect(extractClientWorkId(metadata)).toBeNull();
    });

    it("returns null when clientWorkId is empty string", () => {
      const metadata = JSON.stringify({ clientWorkId: "" });
      expect(extractClientWorkId(metadata)).toBeNull();
    });

    it("returns null when clientWorkId is null in JSON", () => {
      const metadata = JSON.stringify({ clientWorkId: null });
      expect(extractClientWorkId(metadata)).toBeNull();
    });
  });

  describe("mergeAndDeduplicateByClientId", () => {
    const createWork = (
      id: string,
      createdAt: number,
      clientWorkId?: string
    ): { id: string; metadata?: string; createdAt: number } => ({
      id,
      metadata: clientWorkId ? JSON.stringify({ clientWorkId }) : undefined,
      createdAt,
    });

    it("merges online and offline works without duplicates", () => {
      const onlineWorks = [createWork("online-1", 1000, "client-1")];
      const offlineWorks = [createWork("offline-1", 900, "client-2")];

      const result = mergeAndDeduplicateByClientId(onlineWorks, offlineWorks);

      expect(result).toHaveLength(2);
      expect(result.map((w) => w.id)).toContain("online-1");
      expect(result.map((w) => w.id)).toContain("offline-1");
    });

    it("filters out offline works that match online clientWorkId", () => {
      const onlineWorks = [createWork("online-1", 1000, "client-shared")];
      const offlineWorks = [createWork("offline-1", 900, "client-shared")]; // same clientWorkId

      const result = mergeAndDeduplicateByClientId(onlineWorks, offlineWorks);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("online-1");
    });

    it("keeps offline works without clientWorkId", () => {
      const onlineWorks = [createWork("online-1", 1000, "client-1")];
      const offlineWorks = [createWork("offline-1", 900)]; // no clientWorkId

      const result = mergeAndDeduplicateByClientId(onlineWorks, offlineWorks);

      expect(result).toHaveLength(2);
      expect(result.map((w) => w.id)).toContain("offline-1");
    });

    it("sorts results by createdAt descending (newest first)", () => {
      const onlineWorks = [
        createWork("online-1", 500, "client-1"),
        createWork("online-2", 1000, "client-2"),
      ];
      const offlineWorks = [
        createWork("offline-1", 750, "client-3"),
        createWork("offline-2", 250, "client-4"),
      ];

      const result = mergeAndDeduplicateByClientId(onlineWorks, offlineWorks);

      expect(result.map((w) => w.createdAt)).toEqual([1000, 750, 500, 250]);
    });

    it("handles empty online works", () => {
      const offlineWorks = [createWork("offline-1", 1000, "client-1")];

      const result = mergeAndDeduplicateByClientId([], offlineWorks);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("offline-1");
    });

    it("handles empty offline works", () => {
      const onlineWorks = [createWork("online-1", 1000, "client-1")];

      const result = mergeAndDeduplicateByClientId(onlineWorks, []);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("online-1");
    });

    it("handles both empty arrays", () => {
      const result = mergeAndDeduplicateByClientId([], []);
      expect(result).toEqual([]);
    });

    it("filters multiple offline works matching online clientWorkIds", () => {
      const onlineWorks = [
        createWork("online-1", 1000, "client-a"),
        createWork("online-2", 900, "client-b"),
      ];
      const offlineWorks = [
        createWork("offline-1", 800, "client-a"), // matches online-1
        createWork("offline-2", 700, "client-b"), // matches online-2
        createWork("offline-3", 600, "client-c"), // unique
      ];

      const result = mergeAndDeduplicateByClientId(onlineWorks, offlineWorks);

      expect(result).toHaveLength(3);
      expect(result.map((w) => w.id)).toEqual(["online-1", "online-2", "offline-3"]);
    });
  });
});
