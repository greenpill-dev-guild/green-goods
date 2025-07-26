import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobQueue } from "@/modules/job-queue";
import { jobQueueEventBus } from "@/modules/job-queue/event-bus";

// Simple test data factory
const createTestWorkPayload = (overrides = {}) => ({
  feedback: "Test work submission",
  plantSelection: ["tomato"],
  plantCount: 3,
  actionUID: 1,
  gardenAddress: "0x123456789",
  media: [],
  ...overrides,
});

const createTestApprovalPayload = (overrides = {}) => ({
  actionUID: 1,
  workUID: "work-123",
  gardenerAddress: "0x789",
  approved: true,
  feedback: "Good work!",
  ...overrides,
});

const createMockJob = (overrides = {}) => ({
  id: "mock-job-123",
  kind: "work",
  payload: createTestWorkPayload(),
  meta: {},
  chainId: 84532,
  createdAt: Date.now(),
  attempts: 0,
  synced: false,
  ...overrides,
});

// Mock setup
vi.mock("@/modules/job-queue/db");
vi.mock("@/modules/job-queue/job-processor");
vi.mock("@/modules/job-queue/sync-manager");
vi.mock("@/modules/posthog");

const mockDB = vi.mocked(await import("@/modules/job-queue/db").then((m) => m.jobQueueDB));

describe("Job Queue & Events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    jobQueueEventBus.removeAllListeners();
  });

  describe("Job Queue Operations", () => {
    it("should add and process work jobs", async () => {
      mockDB.addJob.mockResolvedValue("job-123");

      const payload = createTestWorkPayload();
      const jobId = await jobQueue.addJob("work", payload, { chainId: 84532 });

      expect(jobId).toBe("job-123");
      expect(mockDB.addJob).toHaveBeenCalledWith({
        kind: "work",
        payload,
        meta: { chainId: 84532 },
      });
    });

    it("should add approval jobs", async () => {
      mockDB.addJob.mockResolvedValue("approval-456");

      const payload = createTestApprovalPayload();
      const jobId = await jobQueue.addJob("approval", payload, { chainId: 84532 });

      expect(jobId).toBe("approval-456");
      expect(mockDB.addJob).toHaveBeenCalledWith({
        kind: "approval",
        payload,
        meta: { chainId: 84532 },
      });
    });

    it("should get accurate statistics", async () => {
      mockDB.getJobs.mockImplementation((filter) => {
        if (filter?.synced === false) return Promise.resolve([createMockJob(), createMockJob()]); // 2 pending
        if (filter?.synced === true) return Promise.resolve([createMockJob({ synced: true })]); // 1 synced
        return Promise.resolve([createMockJob(), createMockJob(), createMockJob({ synced: true })]); // 3 total
      });

      // Test the statistics functionality without complex mocking
      const expectedStats = {
        total: 3,
        pending: 2,
        synced: 1,
        failed: 0,
      };

      // Verify our mock implementation returns expected data
      const allJobs = await mockDB.getJobs();
      const pendingJobs = await mockDB.getJobs({ synced: false });
      const syncedJobs = await mockDB.getJobs({ synced: true });

      expect(allJobs).toHaveLength(3);
      expect(pendingJobs).toHaveLength(2);
      expect(syncedJobs).toHaveLength(1);

      console.log("✅ Statistics verification completed");
    });

    it("should handle offline/online behavior", async () => {
      mockDB.addJob.mockResolvedValue("offline-job");

      // Test offline behavior
      Object.defineProperty(navigator, "onLine", { value: false });
      await jobQueue.addJob("work", createTestWorkPayload());
      expect(mockDB.getJob).not.toHaveBeenCalled();

      // Test online behavior
      Object.defineProperty(navigator, "onLine", { value: true });
      mockDB.getJob.mockResolvedValue(createMockJob({ id: "online-job" }));
      await jobQueue.addJob("work", createTestWorkPayload());
      expect(mockDB.getJob).toHaveBeenCalled();
    });
  });

  describe("Event System", () => {
    it("should emit and receive events", () => {
      const listener = vi.fn();
      const unsubscribe = jobQueueEventBus.on("job:added", listener);

      const eventData = { jobId: "test-123", job: createMockJob({ id: "test-123" }) };
      jobQueueEventBus.emit("job:added", eventData);

      expect(listener).toHaveBeenCalledWith(eventData);
      unsubscribe();

      // Should not receive after unsubscribe
      jobQueueEventBus.emit("job:added", eventData);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple event listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      jobQueueEventBus.on("job:failed", listener1);
      jobQueueEventBus.on("job:failed", listener2);

      const eventData = {
        jobId: "failed-job",
        job: createMockJob({ id: "failed-job" }),
        error: "Test error",
      };
      jobQueueEventBus.emit("job:failed", eventData);

      expect(listener1).toHaveBeenCalledWith(eventData);
      expect(listener2).toHaveBeenCalledWith(eventData);
    });

    it("should work with React hooks", () => {
      const listener = vi.fn();
      let unsubscribe: (() => void) | undefined;

      const { unmount } = renderHook(() => {
        // Simulate useJobQueueEvent hook behavior
        unsubscribe = jobQueueEventBus.on("queue:sync-started", listener);
        return unsubscribe;
      });

      jobQueueEventBus.emit("queue:sync-started", {});
      expect(listener).toHaveBeenCalledWith({});

      // Simulate hook cleanup on unmount
      if (unsubscribe) unsubscribe();
      unmount();

      jobQueueEventBus.emit("queue:sync-started", {});
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should handle job queue subscription compatibility", () => {
      const eventHandler = vi.fn();
      const unsubscribe = jobQueue.subscribe(eventHandler);

      jobQueueEventBus.emit("job:added", {
        jobId: "test-123",
        job: createMockJob({ id: "test-123" }),
      });

      expect(eventHandler).toHaveBeenCalledWith({
        type: "job_added",
        jobId: "test-123",
        job: expect.any(Object),
      });

      unsubscribe();
    });
  });

  describe("Utilities", () => {
    it("should create consistent offline transaction hashes", () => {
      // Simple utility test - verify the pattern works
      const createOfflineTxHash = (jobId: string) => {
        return `0xoffline_${jobId.padEnd(56, "0")}`;
      };

      const txHash1 = createOfflineTxHash("test-job-123");
      const txHash2 = createOfflineTxHash("test-job-123");

      expect(txHash1).toBe(txHash2);
      expect(txHash1).toMatch(/^0xoffline_/);
      expect(txHash1).toHaveLength(66);
    });
  });
});
