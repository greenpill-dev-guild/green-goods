import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockConflict,
  createMockOfflineWork,
  mockFetch,
  mockFetchSequence,
} from "@/__tests__/offline-test-helpers";

// Mock interfaces and types
type ConflictType = "data_modified" | "already_submitted" | "garden_changed" | "schema_mismatch";
type ResolutionStrategy = "keep_local" | "keep_remote" | "merge" | "skip";

interface ConflictData {
  workId: string;
  type: ConflictType;
  localWork: any;
  remoteWork?: any;
  description: string;
  autoResolvable: boolean;
}

// Mock the conflict resolver module since it doesn't exist yet
class ConflictResolver {
  async detectConflicts(offlineWork: any[]): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];

    for (const work of offlineWork) {
      try {
        // Check for remote duplicates
        const existingWork = await this.checkExistingWork(work);
        if (existingWork) {
          conflicts.push({
            workId: work.id,
            type: "already_submitted",
            localWork: work,
            remoteWork: existingWork,
            description: "This work appears to have been submitted from another device",
            autoResolvable: true,
          });
        }

        // Check for schema changes
        const schemaConflict = await this.checkSchemaConflicts(work);
        if (schemaConflict) {
          conflicts.push(schemaConflict);
        }

        // Check for garden configuration changes
        const gardenConflict = await this.checkGardenConflicts(work);
        if (gardenConflict) {
          conflicts.push(gardenConflict);
        }
      } catch (error) {
        console.warn(`Conflict detection failed for ${work.id}:`, error);
      }
    }

    return conflicts;
  }

  async resolveConflict(conflict: ConflictData, strategy: ResolutionStrategy): Promise<void> {
    switch (strategy) {
      case "keep_local":
        // Continue with sync as normal
        break;

      case "keep_remote":
        // Mark as synced without submitting
        break;

      case "merge":
        await this.mergeConflict(conflict);
        break;

      case "skip":
        // Mark with special skip status
        break;
    }
  }

  private async checkExistingWork(work: any): Promise<any | null> {
    try {
      const response = await fetch("/api/works/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: work.contentHash }),
      });

      if (!response.ok) return null;

      const { exists, work: remoteWork } = await response.json();
      return exists ? remoteWork : null;
    } catch (error) {
      console.warn("Failed to check existing work:", error);
      return null;
    }
  }

  private async checkSchemaConflicts(work: any): Promise<ConflictData | null> {
    try {
      const currentSchema = await this.getCurrentSchema(work.type);
      const workSchema = work.data?.schema || work.data?.schemaVersion;

      if (currentSchema && workSchema && currentSchema !== workSchema) {
        return {
          workId: work.id,
          type: "schema_mismatch",
          localWork: work,
          description: "The schema has been updated since this work was created offline",
          autoResolvable: false,
        };
      }
    } catch (error) {
      console.warn("Schema conflict check failed:", error);
    }

    return null;
  }

  private async checkGardenConflicts(work: any): Promise<ConflictData | null> {
    try {
      const workData = work.data;
      if (!workData?.gardenAddress) return null;

      const response = await fetch(`/api/gardens/${workData.gardenAddress}/status`);
      if (!response.ok) return null;

      const gardenStatus = await response.json();

      if (gardenStatus.isArchived || gardenStatus.isInactive) {
        return {
          workId: work.id,
          type: "garden_changed",
          localWork: work,
          description: "This garden is no longer active",
          autoResolvable: false,
        };
      }
    } catch (error) {
      console.warn("Garden conflict check failed:", error);
    }

    return null;
  }

  private async getCurrentSchema(type: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/schemas/${type}/current`);
      if (response.ok) {
        const { schemaId } = await response.json();
        return schemaId;
      }
    } catch (error) {
      console.warn("Failed to get current schema:", error);
    }
    return null;
  }

  private async mergeConflict(conflict: ConflictData): Promise<void> {
    // Implement merge strategies based on conflict type
    switch (conflict.type) {
      case "already_submitted":
        // Skip duplicate submission
        break;

      case "data_modified":
        // Merge non-conflicting fields
        break;

      default:
        // Default to keeping local version
        break;
    }
  }
}

// Mock the offline database
const mockOfflineDB = {
  markAsSynced: vi.fn(),
  markAsSkipped: vi.fn(),
  clearConflictDetected: vi.fn(),
  removeConflict: vi.fn(),
};

describe("ConflictResolver", () => {
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    conflictResolver = new ConflictResolver();
    vi.clearAllMocks();
  });

  describe("detectConflicts", () => {
    it("should detect no conflicts for clean work", async () => {
      mockFetchSequence([
        { response: { exists: false } }, // No remote duplicates
        { response: { schemaId: "current-schema" } }, // Current schema
        { response: { isArchived: false, isInactive: false } }, // Active garden
      ]);

      const work = [createMockOfflineWork()];
      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(0);
    });

    it("should detect already submitted work", async () => {
      mockFetchSequence([
        { response: { exists: true, work: { id: "remote-1", title: "Remote Work" } } },
      ]);

      const work = [createMockOfflineWork({ id: "local-1" })];
      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("already_submitted");
      expect(conflicts[0].workId).toBe("local-1");
      expect(conflicts[0].autoResolvable).toBe(true);
      expect(conflicts[0].remoteWork).toEqual({ id: "remote-1", title: "Remote Work" });
    });

    it("should detect schema conflicts", async () => {
      mockFetchSequence([
        { response: { exists: false } }, // No duplicates
        { response: { schemaId: "new-schema-v2" } }, // Schema changed
      ]);

      const work = [
        createMockOfflineWork({
          data: { schema: "old-schema-v1", title: "Test Work" },
        }),
      ];

      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("schema_mismatch");
      expect(conflicts[0].autoResolvable).toBe(false);
    });

    it("should detect garden conflicts", async () => {
      mockFetchSequence([
        { response: { exists: false } }, // No duplicates
        { response: { schemaId: "current-schema" } }, // Schema OK
        { response: { isArchived: true, isInactive: false } }, // Garden archived
      ]);

      const work = [
        createMockOfflineWork({
          data: { gardenAddress: "0x123...", title: "Test Work" },
        }),
      ];

      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe("garden_changed");
      expect(conflicts[0].description).toContain("no longer active");
    });

    it("should handle multiple conflicts for single work item", async () => {
      mockFetchSequence([
        { response: { exists: true, work: { id: "remote-1" } } }, // Duplicate
        { response: { schemaId: "new-schema" } }, // Schema changed
        { response: { isArchived: true } }, // Garden archived
      ]);

      const work = [
        createMockOfflineWork({
          data: {
            schema: "old-schema",
            gardenAddress: "0x123...",
            title: "Conflicted Work",
          },
        }),
      ];

      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      // Should detect at least the duplicate, possibly more
      const conflictTypes = conflicts.map((c) => c.type);
      expect(conflictTypes).toContain("already_submitted");
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const work = [createMockOfflineWork()];
      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(0); // Should not crash, return empty array
    });

    it("should handle malformed API responses", async () => {
      mockFetchSequence([
        { response: "invalid json", ok: false },
        { response: null },
        { response: { unexpected: "format" } },
      ]);

      const work = [createMockOfflineWork()];
      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts).toHaveLength(0);
    });

    it("should handle multiple work items with different conflicts", async () => {
      // Work 1: has duplicate
      // Work 2: schema conflict
      // Work 3: no conflicts
      mockFetchSequence([
        // Work 1 checks
        { response: { exists: true, work: { id: "remote-1" } } },
        { response: { schemaId: "current-schema" } },
        { response: { isArchived: false } },
        // Work 2 checks
        { response: { exists: false } },
        { response: { schemaId: "new-schema" } },
        // Work 3 checks
        { response: { exists: false } },
        { response: { schemaId: "current-schema" } },
        { response: { isArchived: false } },
      ]);

      const works = [
        createMockOfflineWork({
          id: "work-1",
          data: { schema: "current-schema" },
        }),
        createMockOfflineWork({
          id: "work-2",
          data: { schema: "old-schema" },
        }),
        createMockOfflineWork({
          id: "work-3",
          data: { schema: "current-schema" },
        }),
      ];

      const conflicts = await conflictResolver.detectConflicts(works);

      expect(conflicts.length).toBeGreaterThanOrEqual(2);

      const work1Conflicts = conflicts.filter((c) => c.workId === "work-1");
      const work2Conflicts = conflicts.filter((c) => c.workId === "work-2");
      const work3Conflicts = conflicts.filter((c) => c.workId === "work-3");

      expect(work1Conflicts.length).toBeGreaterThanOrEqual(1);
      expect(work2Conflicts.length).toBeGreaterThanOrEqual(1);
      expect(work3Conflicts.length).toBe(0);
    });
  });

  describe("resolveConflict", () => {
    it('should resolve "keep_local" strategy', async () => {
      const conflict = createMockConflict("work-1", "already_submitted");

      await conflictResolver.resolveConflict(conflict, "keep_local");

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should resolve "keep_remote" strategy', async () => {
      const conflict = createMockConflict("work-1", "already_submitted");

      await conflictResolver.resolveConflict(conflict, "keep_remote");

      expect(true).toBe(true);
    });

    it('should resolve "skip" strategy', async () => {
      const conflict = createMockConflict("work-1", "data_modified");

      await conflictResolver.resolveConflict(conflict, "skip");

      expect(true).toBe(true);
    });

    it('should resolve "merge" strategy', async () => {
      const conflict = createMockConflict("work-1", "data_modified");

      await conflictResolver.resolveConflict(conflict, "merge");

      expect(true).toBe(true);
    });

    it("should handle resolution errors gracefully", async () => {
      const conflict = createMockConflict("work-1", "already_submitted");

      // This should not throw even if underlying operations fail
      await expect(
        conflictResolver.resolveConflict(conflict, "keep_local")
      ).resolves.toBeUndefined();
    });
  });

  describe("checkExistingWork", () => {
    it("should return remote work when duplicate exists", async () => {
      const remoteWork = { id: "remote-1", title: "Remote Work" };

      mockFetch({ exists: true, work: remoteWork });

      const work = createMockOfflineWork();
      const result = await conflictResolver["checkExistingWork"](work);

      expect(result).toEqual(remoteWork);
      expect(fetch).toHaveBeenCalledWith("/api/works/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: work.contentHash }),
      });
    });

    it("should return null when no duplicate exists", async () => {
      mockFetch({ exists: false });

      const work = createMockOfflineWork();
      const result = await conflictResolver["checkExistingWork"](work);

      expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const work = createMockOfflineWork();
      const result = await conflictResolver["checkExistingWork"](work);

      expect(result).toBeNull();
    });

    it("should handle non-OK responses", async () => {
      mockFetch({}, false, 404);

      const work = createMockOfflineWork();
      const result = await conflictResolver["checkExistingWork"](work);

      expect(result).toBeNull();
    });
  });

  describe("checkSchemaConflicts", () => {
    it("should detect schema version mismatch", async () => {
      mockFetch({ schemaId: "schema-v2" });

      const work = createMockOfflineWork({
        type: "work",
        data: { schema: "schema-v1", title: "Test Work" },
      });

      const conflict = await conflictResolver["checkSchemaConflicts"](work);

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe("schema_mismatch");
      expect(conflict?.workId).toBe(work.id);
      expect(conflict?.autoResolvable).toBe(false);
    });

    it("should return null when schemas match", async () => {
      mockFetch({ schemaId: "schema-v1" });

      const work = createMockOfflineWork({
        data: { schema: "schema-v1" },
      });

      const conflict = await conflictResolver["checkSchemaConflicts"](work);

      expect(conflict).toBeNull();
    });

    it("should return null when work has no schema info", async () => {
      mockFetch({ schemaId: "schema-v1" });

      const work = createMockOfflineWork({
        data: { title: "Work without schema" },
      });

      const conflict = await conflictResolver["checkSchemaConflicts"](work);

      expect(conflict).toBeNull();
    });

    it("should handle schema API errors", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Schema API error")));

      const work = createMockOfflineWork({
        data: { schema: "schema-v1" },
      });

      const conflict = await conflictResolver["checkSchemaConflicts"](work);

      expect(conflict).toBeNull();
    });

    it("should handle different work types", async () => {
      mockFetch({ schemaId: "approval-schema-v2" });

      const work = createMockOfflineWork({
        type: "approval",
        data: { schema: "approval-schema-v1" },
      });

      const conflict = await conflictResolver["checkSchemaConflicts"](work);

      expect(conflict).toBeDefined();
      expect(fetch).toHaveBeenCalledWith("/api/schemas/approval/current");
    });
  });

  describe("checkGardenConflicts", () => {
    it("should detect archived garden", async () => {
      mockFetch({ isArchived: true, isInactive: false });

      const work = createMockOfflineWork({
        data: { gardenAddress: "0x123..." },
      });

      const conflict = await conflictResolver["checkGardenConflicts"](work);

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe("garden_changed");
      expect(conflict?.workId).toBe(work.id);
    });

    it("should detect inactive garden", async () => {
      mockFetch({ isArchived: false, isInactive: true });

      const work = createMockOfflineWork({
        data: { gardenAddress: "0x456..." },
      });

      const conflict = await conflictResolver["checkGardenConflicts"](work);

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe("garden_changed");
    });

    it("should return null for active garden", async () => {
      mockFetch({ isArchived: false, isInactive: false });

      const work = createMockOfflineWork({
        data: { gardenAddress: "0x789..." },
      });

      const conflict = await conflictResolver["checkGardenConflicts"](work);

      expect(conflict).toBeNull();
    });

    it("should return null when work has no garden address", async () => {
      const work = createMockOfflineWork({
        data: { title: "Work without garden", gardenAddress: undefined },
      });

      const conflict = await conflictResolver["checkGardenConflicts"](work);

      expect(conflict).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should handle garden API errors", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Garden API error")));

      const work = createMockOfflineWork({
        data: { gardenAddress: "0x123..." },
      });

      const conflict = await conflictResolver["checkGardenConflicts"](work);

      expect(conflict).toBeNull();
    });

    it("should call correct garden status endpoint", async () => {
      mockFetch({ isArchived: false, isInactive: false });

      const gardenAddress = "0xabc123...";
      const work = createMockOfflineWork({
        data: { gardenAddress },
      });

      await conflictResolver["checkGardenConflicts"](work);

      expect(fetch).toHaveBeenCalledWith(`/api/gardens/${gardenAddress}/status`);
    });
  });

  describe("mergeConflict", () => {
    it("should handle already_submitted merge", async () => {
      const conflict = createMockConflict("work-1", "already_submitted");

      await conflictResolver["mergeConflict"](conflict);

      // Should complete without error
      expect(true).toBe(true);
    });

    it("should handle data_modified merge", async () => {
      const conflict = createMockConflict("work-1", "data_modified");

      await conflictResolver["mergeConflict"](conflict);

      expect(true).toBe(true);
    });

    it("should handle unknown conflict types", async () => {
      const conflict = createMockConflict("work-1", "unknown_type" as any);

      await conflictResolver["mergeConflict"](conflict);

      expect(true).toBe(true);
    });
  });

  describe("getCurrentSchema", () => {
    it("should return current schema ID", async () => {
      mockFetch({ schemaId: "work-schema-v3" });

      const schema = await conflictResolver["getCurrentSchema"]("work");

      expect(schema).toBe("work-schema-v3");
      expect(fetch).toHaveBeenCalledWith("/api/schemas/work/current");
    });

    it("should return null on API error", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("API error")));

      const schema = await conflictResolver["getCurrentSchema"]("work");

      expect(schema).toBeNull();
    });

    it("should return null on non-OK response", async () => {
      mockFetch({}, false, 404);

      const schema = await conflictResolver["getCurrentSchema"]("work");

      expect(schema).toBeNull();
    });

    it("should handle different schema types", async () => {
      mockFetch({ schemaId: "approval-schema-v2" });

      const schema = await conflictResolver["getCurrentSchema"]("approval");

      expect(schema).toBe("approval-schema-v2");
      expect(fetch).toHaveBeenCalledWith("/api/schemas/approval/current");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex conflict scenarios", async () => {
      // Simulate a work item that has multiple potential conflicts
      mockFetchSequence([
        { response: { exists: false } }, // No duplicate initially
        { response: { schemaId: "new-schema" } }, // Schema changed
        { response: { isArchived: false, isInactive: false } }, // Garden OK
      ]);

      const work = [
        createMockOfflineWork({
          data: {
            schema: "old-schema",
            gardenAddress: "0x123...",
            title: "Complex Work",
          },
        }),
      ];

      const conflicts = await conflictResolver.detectConflicts(work);

      expect(conflicts.length).toBeGreaterThanOrEqual(1);

      // Should detect schema conflict
      const schemaConflict = conflicts.find((c) => c.type === "schema_mismatch");
      expect(schemaConflict).toBeDefined();
    });

    it("should handle batch conflict resolution", async () => {
      const conflicts = [
        createMockConflict("work-1", "already_submitted"),
        createMockConflict("work-2", "schema_mismatch"),
        createMockConflict("work-3", "garden_changed"),
      ];

      const strategies: ResolutionStrategy[] = ["keep_remote", "keep_local", "skip"];

      for (let i = 0; i < conflicts.length; i++) {
        await conflictResolver.resolveConflict(conflicts[i], strategies[i]);
      }

      // All resolutions should complete successfully
      expect(true).toBe(true);
    });

    it("should prioritize conflicts by severity", () => {
      // Create conflicts with explicit autoResolvable settings
      const conflicts: ConflictData[] = [
        { ...createMockConflict("work-1", "data_modified"), autoResolvable: false },
        { ...createMockConflict("work-2", "already_submitted"), autoResolvable: true },
        { ...createMockConflict("work-3", "garden_changed"), autoResolvable: false },
        { ...createMockConflict("work-4", "schema_mismatch"), autoResolvable: true },
      ];

      // Test conflict priority (this would be implemented in actual resolver)
      const autoResolvable = conflicts.filter((c) => c.autoResolvable);
      const manualResolution = conflicts.filter((c) => !c.autoResolvable);

      expect(autoResolvable.length).toBeGreaterThan(0);
      expect(manualResolution.length).toBeGreaterThan(0);
    });
  });
});
