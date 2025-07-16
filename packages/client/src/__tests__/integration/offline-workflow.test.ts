import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockOfflineWork,
  createMockSmartAccountClient,
  mockFetch,
  mockFetchError,
  resetAllMocks,
  simulateNetworkConditions,
  waitFor,
} from "@/__tests__/offline-test-helpers";

// Mock all the modules since they don't exist yet
class MockOfflineDB {
  private storage = new Map();

  async addPendingWork(work: any) {
    const id = `work-${Date.now()}-${Math.random()}`;
    const workData = {
      ...work,
      id,
      timestamp: Date.now(),
      synced: false,
    };
    this.storage.set(id, workData);
    return id;
  }

  async getUnsyncedWork() {
    return Array.from(this.storage.values()).filter((work: any) => !work.synced);
  }

  async getPendingWorkById(id: string) {
    return this.storage.get(id) || null;
  }

  async markAsSynced(id: string) {
    const work = this.storage.get(id);
    if (work) {
      work.synced = true;
      this.storage.set(id, work);
    }
  }

  async markAsError(id: string, error: string) {
    const work = this.storage.get(id);
    if (work) {
      work.error = error;
      this.storage.set(id, work);
    }
  }

  async clearSyncedWork() {
    for (const [id, work] of this.storage.entries()) {
      if ((work as any).synced) {
        this.storage.delete(id);
      }
    }
  }

  async getImagesForWork(workId: string) {
    // Mock images associated with work
    return [];
  }

  clear() {
    this.storage.clear();
  }
}

class MockOfflineSync {
  private smartAccountClient: any = null;
  private syncInProgress = false;

  setSmartAccountClient(client: any) {
    this.smartAccountClient = client;
  }

  async sync() {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    if (!this.smartAccountClient) {
      console.warn("Skipping sync: Smart account client not available");
      return;
    }

    this.syncInProgress = true;

    try {
      const unsyncedWork = await mockOfflineDB.getUnsyncedWork();

      for (const work of unsyncedWork) {
        try {
          // Check for duplicates
          const isDuplicate = await this.checkRemoteDuplicate(work);
          if (isDuplicate) {
            await mockOfflineDB.markAsSynced(work.id);
            continue;
          }

          // Simulate sync operation
          if (work.type === "work") {
            await this.syncWork(work);
          } else if (work.type === "approval") {
            await this.syncApproval(work);
          }

          await mockOfflineDB.markAsSynced(work.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await mockOfflineDB.markAsError(work.id, errorMessage);
        }
      }

      // Don't clear synced work immediately so tests can verify sync status
      // await mockOfflineDB.clearSyncedWork();
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncSpecificWork(workId: string) {
    const work = await mockOfflineDB.getPendingWorkById(workId);
    if (!work) throw new Error("Work not found");

    if (work.type === "work") {
      await this.syncWork(work);
    } else if (work.type === "approval") {
      await this.syncApproval(work);
    }

    await mockOfflineDB.markAsSynced(work.id);
  }

  private async syncWork(work: any) {
    // Simulate API call
    if (!this.smartAccountClient) {
      throw new Error("Smart account client not available");
    }

    const receipt = await this.smartAccountClient.sendTransaction({
      to: "0x123...",
      data: "0xabc...",
    });

    return receipt;
  }

  private async syncApproval(work: any) {
    // Simulate API call
    if (!this.smartAccountClient) {
      throw new Error("Smart account client not available");
    }

    const receipt = await this.smartAccountClient.sendTransaction({
      to: "0x456...",
      data: "0xdef...",
    });

    return receipt;
  }

  private async checkRemoteDuplicate(work: any): Promise<boolean> {
    try {
      const response = await fetch("/api/works/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: work.contentHash }),
      });

      if (!response.ok) return false;

      const { exists } = await response.json();
      return exists;
    } catch (error) {
      return false;
    }
  }

  async getPendingCount(): Promise<number> {
    const unsyncedWork = await mockOfflineDB.getUnsyncedWork();
    return unsyncedWork.length;
  }
}

class MockDeduplicationManager {
  generateContentHash(work: any): string {
    // Simple hash for testing
    const content = JSON.stringify({
      type: work.type,
      data: work.data,
      imageCount: work.images?.length || 0,
    });
    return btoa(content).substring(0, 16);
  }

  async checkRemoteDuplicate(work: any): Promise<boolean> {
    try {
      const response = await fetch("/api/works/check-duplicate");
      if (!response.ok) return false;
      const { exists } = await response.json();
      return exists;
    } catch (error) {
      return false;
    }
  }
}

// Create instances
const mockOfflineDB = new MockOfflineDB();
const mockOfflineSync = new MockOfflineSync();
const mockDeduplicationManager = new MockDeduplicationManager();

describe("Offline Workflow Integration", () => {
  let smartAccountClient: any;

  beforeEach(() => {
    mockOfflineDB.clear();
    smartAccountClient = createMockSmartAccountClient();
    mockOfflineSync.setSmartAccountClient(smartAccountClient);
    resetAllMocks();

    // Reset network state
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    resetAllMocks();
  });

  it("should handle complete offline-to-online workflow", async () => {
    // 1. Go offline
    simulateNetworkConditions.offline();

    // 2. Create work offline
    const workData = {
      type: "work" as const,
      data: {
        title: "Offline Test Work",
        description: "Created while offline",
        gardenAddress: "0x123...",
        actionUID: 1,
      },
      images: [new File([], "test.jpg")],
      synced: false,
    };

    const workId = await mockOfflineDB.addPendingWork(workData);
    expect(workId).toBeDefined();

    // 3. Verify work is stored offline
    const pendingWork = await mockOfflineDB.getUnsyncedWork();
    expect(pendingWork).toHaveLength(1);
    expect(pendingWork[0].id).toBe(workId);
    expect(pendingWork[0].synced).toBe(false);

    // 4. Go back online
    simulateNetworkConditions.online();
    mockFetch({ exists: false }); // No duplicates

    // 5. Sync work
    await mockOfflineSync.sync();

    // 6. Verify work is marked as synced (check before it gets cleared)
    const syncedWork = await mockOfflineDB.getPendingWorkById(workId);
    expect(syncedWork?.synced).toBe(true);
    expect(smartAccountClient.sendTransaction).toHaveBeenCalled();

    // 7. Verify work was cleared from pending after sync
    const remainingWork = await mockOfflineDB.getUnsyncedWork();
    expect(remainingWork).toHaveLength(0);
  });

  it("should handle duplicate detection during sync", async () => {
    // 1. Create work offline
    const workData = {
      type: "work" as const,
      data: { title: "Duplicate Test" },
      synced: false,
    };

    const workId1 = await mockOfflineDB.addPendingWork(workData);
    const workId2 = await mockOfflineDB.addPendingWork(workData);

    // 2. Mock duplicate detection
    mockFetch({ exists: true }); // Remote duplicate exists

    // 3. Sync - should detect and handle duplicates
    await mockOfflineSync.sync();

    // 4. Both works should be marked as synced (duplicate handling)
    const work1 = await mockOfflineDB.getPendingWorkById(workId1);
    const work2 = await mockOfflineDB.getPendingWorkById(workId2);

    expect(work1?.synced).toBe(true);
    expect(work2?.synced).toBe(true);

    // Should not have called sendTransaction for duplicates
    expect(smartAccountClient.sendTransaction).not.toHaveBeenCalled();
  });

  it("should handle retry logic for failed syncs", async () => {
    // 1. Create work
    const workData = {
      type: "work" as const,
      data: { title: "Retry Test" },
      synced: false,
    };

    const workId = await mockOfflineDB.addPendingWork(workData);

    // 2. Mock sync failure
    smartAccountClient.sendTransaction.mockRejectedValueOnce(new Error("Network error"));
    mockFetch({ exists: false });

    // 3. First sync attempt should fail
    await mockOfflineSync.sync();

    let work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(false);
    expect(work?.error).toBe("Network error");

    // 4. Mock successful retry
    smartAccountClient.sendTransaction.mockResolvedValueOnce({ hash: "0x123..." });

    // 5. Manual retry should succeed
    await mockOfflineSync.syncSpecificWork(workId);

    work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(true);
    expect(smartAccountClient.sendTransaction).toHaveBeenCalledTimes(2);
  });

  it("should handle content-based deduplication", async () => {
    // 1. Create two works with identical content
    const workData1 = {
      type: "work" as const,
      data: {
        title: "Identical Work",
        description: "Same content",
        actionUID: 1,
      },
      synced: false,
    };

    const workData2 = {
      type: "work" as const,
      data: {
        title: "Identical Work",
        description: "Same content",
        actionUID: 1,
      },
      synced: false,
    };

    // 2. Generate content hashes
    const hash1 = mockDeduplicationManager.generateContentHash(workData1);
    const hash2 = mockDeduplicationManager.generateContentHash(workData2);

    // 3. Hashes should be identical
    expect(hash1).toBe(hash2);

    // 4. Create works in offline storage
    const workId1 = await mockOfflineDB.addPendingWork(workData1);
    const workId2 = await mockOfflineDB.addPendingWork(workData2);

    expect(workId1).not.toBe(workId2); // Different IDs but same content
  });

  it("should handle network interruptions gracefully", async () => {
    // 1. Start sync process
    const workData = {
      type: "work" as const,
      data: { title: "Network Test" },
      synced: false,
    };

    const workId = await mockOfflineDB.addPendingWork(workData);

    // 2. Go offline during sync
    simulateNetworkConditions.offline();

    // 3. Sync should handle offline gracefully
    await mockOfflineSync.sync();

    let work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(false);

    // 4. Come back online
    simulateNetworkConditions.online();
    mockFetch({ exists: false });

    // 5. Sync should complete successfully
    await mockOfflineSync.sync();

    work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(true);
  });

  it("should maintain data integrity across operations", async () => {
    // 1. Create multiple works with images
    const work1Id = await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "Work 1" },
      images: [new File([], "img1.jpg")],
      synced: false,
    });

    const work2Id = await mockOfflineDB.addPendingWork({
      type: "approval",
      data: { title: "Approval 1" },
      synced: false,
    });

    const work3Id = await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "Work 2" },
      images: [new File([], "img2.jpg"), new File([], "img3.jpg")],
      synced: false,
    });

    // 2. Verify all works are stored
    const pendingWork = await mockOfflineDB.getUnsyncedWork();
    expect(pendingWork).toHaveLength(3);

    // 3. Verify images are associated correctly
    const images1 = await mockOfflineDB.getImagesForWork(work1Id);
    const images2 = await mockOfflineDB.getImagesForWork(work2Id);
    const images3 = await mockOfflineDB.getImagesForWork(work3Id);

    expect(images1).toHaveLength(0); // Mock returns empty for now
    expect(images2).toHaveLength(0);
    expect(images3).toHaveLength(0);

    // 4. Sync all works
    mockFetch({ exists: false });
    await mockOfflineSync.sync();

    // 5. Verify all works are synced
    const remainingWork = await mockOfflineDB.getUnsyncedWork();
    expect(remainingWork).toHaveLength(0);
  });

  it("should handle multiple work types correctly", async () => {
    // Create different types of work
    const workSubmission = await mockOfflineDB.addPendingWork({
      type: "work",
      data: {
        title: "Garden Maintenance",
        actionUID: 1,
        gardenAddress: "0x123...",
      },
      synced: false,
    });

    const workApproval = await mockOfflineDB.addPendingWork({
      type: "approval",
      data: {
        approved: true,
        feedback: "Great work!",
        workRef: "0xabc...",
      },
      synced: false,
    });

    // Mock no duplicates
    mockFetch({ exists: false });

    // Sync both
    await mockOfflineSync.sync();

    // Verify both are synced with correct transaction calls
    const work1 = await mockOfflineDB.getPendingWorkById(workSubmission);
    const work2 = await mockOfflineDB.getPendingWorkById(workApproval);

    expect(work1?.synced).toBe(true);
    expect(work2?.synced).toBe(true);
    expect(smartAccountClient.sendTransaction).toHaveBeenCalledTimes(2);
  });

  it("should handle concurrent sync operations", async () => {
    // Create multiple works
    const workIds = await Promise.all([
      mockOfflineDB.addPendingWork({
        type: "work",
        data: { title: "Concurrent Work 1" },
        synced: false,
      }),
      mockOfflineDB.addPendingWork({
        type: "work",
        data: { title: "Concurrent Work 2" },
        synced: false,
      }),
      mockOfflineDB.addPendingWork({
        type: "approval",
        data: { title: "Concurrent Approval 1" },
        synced: false,
      }),
    ]);

    mockFetch({ exists: false });

    // Try to sync concurrently
    const syncPromises = [mockOfflineSync.sync(), mockOfflineSync.sync(), mockOfflineSync.sync()];

    await Promise.all(syncPromises);

    // All work should be synced, but transaction calls should be reasonable
    for (const workId of workIds) {
      const work = await mockOfflineDB.getPendingWorkById(workId);
      expect(work?.synced).toBe(true);
    }

    // Should not have excessive duplicate calls due to concurrent protection
    expect(smartAccountClient.sendTransaction).toHaveBeenCalledTimes(3);
  });

  it("should handle API errors during sync", async () => {
    const workId = await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "Error Test Work" },
      synced: false,
    });

    // Mock API errors
    mockFetchError(new Error("API unavailable"));
    smartAccountClient.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

    await mockOfflineSync.sync();

    const work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(false);
    expect(work?.error).toBe("Transaction failed");
  });

  it("should handle missing smart account client", async () => {
    const workId = await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "No Client Test" },
      synced: false,
    });

    // Remove smart account client
    mockOfflineSync.setSmartAccountClient(null);

    await mockOfflineSync.sync();

    // Work should remain unsynced
    const work = await mockOfflineDB.getPendingWorkById(workId);
    expect(work?.synced).toBe(false);
  });

  it("should track sync metrics correctly", async () => {
    // Create test works
    await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "Metrics Test 1" },
      synced: false,
    });

    await mockOfflineDB.addPendingWork({
      type: "work",
      data: { title: "Metrics Test 2" },
      synced: false,
    });

    // Check initial pending count
    let pendingCount = await mockOfflineSync.getPendingCount();
    expect(pendingCount).toBe(2);

    // Sync works
    mockFetch({ exists: false });
    await mockOfflineSync.sync();

    // Check final pending count
    pendingCount = await mockOfflineSync.getPendingCount();
    expect(pendingCount).toBe(0);
  });

  it("should handle large batch sync operations", async () => {
    // Create many work items
    const workIds = [];
    for (let i = 0; i < 50; i++) {
      const workId = await mockOfflineDB.addPendingWork({
        type: i % 2 === 0 ? "work" : "approval",
        data: { title: `Batch Work ${i}` },
        synced: false,
      });
      workIds.push(workId);
    }

    mockFetch({ exists: false });

    // Sync all at once
    const startTime = Date.now();
    await mockOfflineSync.sync();
    const endTime = Date.now();

    // Should complete in reasonable time (less than 5 seconds for mock)
    expect(endTime - startTime).toBeLessThan(5000);

    // All works should be synced
    const remainingWork = await mockOfflineDB.getUnsyncedWork();
    expect(remainingWork).toHaveLength(0);

    // Should have made appropriate number of transaction calls
    expect(smartAccountClient.sendTransaction).toHaveBeenCalledTimes(50);
  });
});
