import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobProcessor } from "@/modules/job-queue/job-processor";
import { mediaResourceManager } from "@/modules/job-queue/media-resource-manager";

// Mock dependencies
vi.mock("@/modules/job-queue/db");
vi.mock("@/modules/job-queue/processors/work");
vi.mock("@/modules/job-queue/processors/approval");
vi.mock("@/modules/posthog");

const mockDB = vi.mocked(await import("@/modules/job-queue/db").then((m) => m.jobQueueDB));
const mockWorkProcessor = vi.mocked(
  await import("@/modules/job-queue/processors/work").then((m) => m.workProcessor)
);
const mockApprovalProcessor = vi.mocked(
  await import("@/modules/job-queue/processors/approval").then((m) => m.approvalProcessor)
);

// Mock URL functions
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL = { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL } as any;

// Test data helpers
const createMockJob = (overrides = {}) => ({
  id: "mock-job-123",
  kind: "work",
  payload: {
    feedback: "Test work",
    actionUID: 1,
    gardenAddress: "0x123",
    plantSelection: ["tomato"],
    plantCount: 3,
  },
  meta: {},
  chainId: 84532,
  createdAt: Date.now(),
  attempts: 0,
  synced: false,
  ...overrides,
});

describe("Job Processing & Media", () => {
  let jobProcessor: JobProcessor;
  let mockSmartAccount: any;

  beforeEach(() => {
    vi.clearAllMocks();

    jobProcessor = new JobProcessor();
    mockSmartAccount = {
      sendTransaction: vi.fn().mockResolvedValue("0x123abc"),
      getAddress: vi.fn().mockResolvedValue("0x456def"),
    };
    jobProcessor.setSmartAccountClient(mockSmartAccount);

    mockCreateObjectURL.mockImplementation((file) => `blob:mock-${file.name}`);
    mediaResourceManager.cleanupAll();
  });

  describe("Job Processing", () => {
    it("should process work jobs successfully", async () => {
      const jobId = "work-job-123";
      const mockJob = createMockJob({ id: jobId });

      mockDB.getJob.mockResolvedValue(mockJob);
      mockDB.getImagesForJob.mockResolvedValue([]);
      mockWorkProcessor.encodePayload.mockResolvedValue({
        attestationData: "0x...",
        easConfig: {},
        gardenAddress: "0x123",
        actionTitle: "Test Action",
      } as any);
      mockWorkProcessor.execute.mockResolvedValue("0xtxhash");

      const result = await jobProcessor.processJob(jobId);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xtxhash");
      expect(mockDB.markJobSynced).toHaveBeenCalledWith(jobId, "0xtxhash");
    });

    it("should process approval jobs successfully", async () => {
      const jobId = "approval-job-456";
      const mockJob = createMockJob({
        id: jobId,
        kind: "approval",
        payload: { workUID: "work-123", approved: true },
      });

      mockDB.getJob.mockResolvedValue(mockJob);
      mockApprovalProcessor.encodePayload.mockResolvedValue({
        attestationData: "0x...",
        easConfig: {},
        gardenerAddress: "0x789",
      } as any);
      mockApprovalProcessor.execute.mockResolvedValue("0xapprovaltx");

      const result = await jobProcessor.processJob(jobId);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xapprovaltx");
      expect(mockDB.markJobSynced).toHaveBeenCalledWith(jobId, "0xapprovaltx");
    });

    it("should handle processing errors gracefully", async () => {
      const jobId = "error-job";
      mockDB.getJob.mockResolvedValue(createMockJob({ id: jobId }));
      mockDB.getImagesForJob.mockResolvedValue([]);
      mockWorkProcessor.encodePayload.mockRejectedValue(new Error("Processing failed"));

      const result = await jobProcessor.processJob(jobId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Processing failed");
      expect(mockDB.markJobFailed).toHaveBeenCalledWith(jobId, "Processing failed");
    });

    it("should handle missing jobs and invalid states", async () => {
      // Test job not found
      mockDB.getJob.mockResolvedValue(undefined);
      const result1 = await jobProcessor.processJob("missing-job");
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Job not found or already synced");

      // Test already synced job
      mockDB.getJob.mockResolvedValue(createMockJob({ id: "synced-job", synced: true }));
      const result2 = await jobProcessor.processJob("synced-job");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Job not found or already synced");

      // Test missing smart account
      const processorWithoutClient = new JobProcessor();
      mockDB.getJob.mockResolvedValue(createMockJob({ id: "no-client" }));
      const result3 = await processorWithoutClient.processJob("no-client");
      expect(result3.success).toBe(false);
      expect(result3.error).toBe("Smart account client not available");
    });

    it("should process jobs in batches", async () => {
      const jobs = [
        createMockJob({ id: "job1", attempts: 0 }),
        createMockJob({ id: "job2", attempts: 0 }),
        createMockJob({ id: "job3", attempts: 3 }), // Should skip due to max attempts
      ];

      vi.spyOn(jobProcessor, "processJob")
        .mockResolvedValueOnce({ success: true, txHash: "0x1" })
        .mockResolvedValueOnce({ success: true, txHash: "0x2" });

      const result = await jobProcessor.processBatch(jobs, 2);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("should handle batch processing failures", async () => {
      const jobs = [createMockJob({ id: "batch-fail" })];

      vi.spyOn(jobProcessor, "processJob").mockRejectedValue(new Error("Batch processing failed"));

      const result = await jobProcessor.processBatch(jobs, 1);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  describe("Media Resource Manager", () => {
    it("should create and track URLs", () => {
      const file = new File(["test"], "test.jpg");
      const url = mediaResourceManager.createUrl(file, "job-123");

      expect(url).toBe("blob:mock-test.jpg");
      expect(mockCreateObjectURL).toHaveBeenCalledWith(file);

      const stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(1);
      expect(stats.trackedIds).toBe(1);
    });

    it("should create multiple URLs at once", () => {
      const files = [new File(["test1"], "test1.jpg"), new File(["test2"], "test2.jpg")];

      const urls = mediaResourceManager.createUrls(files, "batch-job");

      expect(urls).toEqual(["blob:mock-test1.jpg", "blob:mock-test2.jpg"]);
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);

      const stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(2);
      expect(stats.trackedIds).toBe(1);
    });

    it("should cleanup URLs by tracking ID", () => {
      const files = [new File(["test1"], "test1.jpg"), new File(["test2"], "test2.jpg")];

      mediaResourceManager.createUrls(files, "cleanup-job");

      let stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(2);

      mediaResourceManager.cleanupUrls("cleanup-job");

      stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(0);
      expect(stats.trackedIds).toBe(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(4);
    });

    it("should cleanup specific URLs", () => {
      const file = new File(["test"], "specific.jpg");
      const url = mediaResourceManager.createUrl(file, "specific-job");

      mediaResourceManager.cleanupUrl(url);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-specific.jpg");

      const stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(0);
    });

    it("should handle cleanup errors gracefully", () => {
      mockRevokeObjectURL.mockImplementation(() => {
        throw new Error("URL already revoked");
      });

      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const file = new File(["test"], "error.jpg");

      mediaResourceManager.createUrl(file, "error-job");
      mediaResourceManager.cleanupUrls("error-job");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to revoke URL:",
        "blob:mock-error.jpg",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should cleanup all URLs", () => {
      const files = [
        new File(["test1"], "test1.jpg"),
        new File(["test2"], "test2.jpg"),
        new File(["test3"], "test3.jpg"),
      ];

      mediaResourceManager.createUrls(files.slice(0, 2), "job-1");
      mediaResourceManager.createUrl(files[2], "job-2");

      let stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(3);
      expect(stats.trackedIds).toBe(2);

      mediaResourceManager.cleanupAll();

      stats = mediaResourceManager.getStats();
      expect(stats.totalUrls).toBe(0);
      expect(stats.trackedIds).toBe(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(4);
    });

    it("should perform stale cleanup", () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const file = new File(["test"], "stale.jpg");

      mediaResourceManager.createUrl(file);
      mediaResourceManager.cleanupStale();

      expect(consoleSpy).toHaveBeenCalledWith("Performing stale URL cleanup");
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-stale.jpg");

      consoleSpy.mockRestore();
    });
  });
});
