import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatJobError,
  getSubmissionStatusText,
  submitApprovalToQueue,
  submitWorkToQueue,
  validateApprovalDraft,
  validateWorkDraft,
} from "@/modules/work-submission";

vi.mock("@/modules/job-queue", () => ({
  jobQueue: {
    addJob: vi.fn(),
  },
  createOfflineTxHash: vi.fn(
    (jobId: string) => `0xoffline_${jobId.replace(/-/g, "").substring(0, 56).padStart(56, "0")}`
  ),
}));

const mockJobQueue = vi.mocked(await import("@/modules/job-queue").then((m) => m.jobQueue));

// Simple test data helpers
const createWorkDraft = (overrides = {}) => ({
  actionUID: 1,
  title: "Test Work",
  plantSelection: ["tomato"],
  plantCount: 5,
  feedback: "Great garden work!",
  media: [],
  ...overrides,
});

const createApprovalDraft = (overrides = {}) => ({
  actionUID: 1,
  workUID: "work-123",
  approved: true,
  feedback: "Good work!",
  ...overrides,
});

const createTestActions = () => [
  {
    id: 1,
    title: "Plant Seeds",
    description: "Plant seeds in the garden",
    inputs: [],
    mediaInfo: { title: "", description: "", maxImageCount: 5 },
    details: { title: "", description: "", feedbackPlaceholder: "" },
    review: { title: "", description: "" },
  } as any,
];

const createTestWork = () => ({
  id: "work-123",
  title: "Test Work",
  actionUID: 1,
  gardenerAddress: "0x456",
  gardenAddress: "0x123",
  feedback: "Original feedback",
  metadata: "{}",
  media: [],
  createdAt: Date.now(),
  status: "pending" as const,
});

describe("Work Submission Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Submission Functions", () => {
    it("should submit work to queue successfully", async () => {
      mockJobQueue.addJob.mockResolvedValue("job-123");

      const draft = createWorkDraft();
      const images = [new File(["test"], "test.jpg")];

      const result = await submitWorkToQueue(draft, "0x123", 1, createTestActions(), 84532, images);

      expect(result).toMatch(/^0xoffline_/);
      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        "work",
        expect.objectContaining({
          ...draft,
          gardenAddress: "0x123",
          media: images,
          title: expect.stringMatching(
            /^Plant Seeds - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          ),
        }),
        { chainId: 84532 }
      );
    });

    it("should submit approval to queue successfully", async () => {
      mockJobQueue.addJob.mockResolvedValue("approval-789");

      const draft = createApprovalDraft();
      const work = createTestWork();

      const result = await submitApprovalToQueue(draft, work, 84532);

      expect(result).toMatch(/^0xoffline_/);
      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        "approval",
        expect.objectContaining({
          ...draft,
          gardenerAddress: "0x456",
        }),
        { chainId: 84532 }
      );
    });

    it("should handle submission errors", async () => {
      // Test work submission errors
      await expect(
        submitWorkToQueue(createWorkDraft(), "", 1, createTestActions(), 84532, [])
      ).rejects.toThrow("Garden address is required");

      await expect(
        submitWorkToQueue(
          createWorkDraft(),
          "0x123",
          "invalid" as any,
          createTestActions(),
          84532,
          []
        )
      ).rejects.toThrow("Action UID must be a number");

      // Test approval submission errors
      await expect(
        submitApprovalToQueue({ ...createApprovalDraft(), workUID: "" }, createTestWork(), 84532)
      ).rejects.toThrow("Work UID is required");

      await expect(submitApprovalToQueue(createApprovalDraft(), undefined, 84532)).rejects.toThrow(
        "Work not found"
      );
    });

    it("should handle unknown actions gracefully", async () => {
      mockJobQueue.addJob.mockResolvedValue("job-456");

      const result = await submitWorkToQueue(
        createWorkDraft(),
        "0x123",
        999, // Unknown action
        createTestActions(),
        84532,
        []
      );

      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        "work",
        expect.objectContaining({
          title: expect.stringContaining("Unknown Action"),
        }),
        expect.any(Object)
      );

      expect(result).toMatch(/^0xoffline_/);
    });
  });

  describe("Validation Functions", () => {
    it("should validate work drafts correctly", () => {
      const validDraft = createWorkDraft();
      const images = [new File(["test"], "test.jpg")];

      // Valid draft should have no errors
      expect(validateWorkDraft(validDraft, "0x123", 1, images)).toHaveLength(0);

      // Test various validation errors
      expect(validateWorkDraft(validDraft, null, 1, images)).toContain("Garden must be selected");
      expect(validateWorkDraft(validDraft, "0x123", null, images)).toContain(
        "Action must be selected"
      );
      expect(validateWorkDraft({ ...validDraft, feedback: "" }, "0x123", 1, images)).toContain(
        "Feedback is required"
      );
      expect(validateWorkDraft({ ...validDraft, plantCount: 0 }, "0x123", 1, images)).toContain(
        "Plant count must be greater than 0"
      );
      expect(validateWorkDraft(validDraft, "0x123", 1, [])).toContain(
        "At least one image is required"
      );

      // Test file size validation
      const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.jpg");
      expect(validateWorkDraft(validDraft, "0x123", 1, [largeFile])).toContain(
        "1 image(s) exceed 10MB limit"
      );
    });

    it("should validate approval drafts correctly", () => {
      const validDraft = createApprovalDraft();

      // Valid draft should have no errors
      expect(validateApprovalDraft(validDraft)).toHaveLength(0);

      // Test validation errors
      expect(validateApprovalDraft({ ...validDraft, workUID: "" })).toContain(
        "Work UID is required"
      );
      expect(validateApprovalDraft({ ...validDraft, actionUID: "invalid" as any })).toContain(
        "Action UID is required"
      );
      expect(validateApprovalDraft({ ...validDraft, approved: "yes" as any })).toContain(
        "Approval decision is required"
      );
      expect(validateApprovalDraft({ ...validDraft, feedback: "" })).toContain(
        "Feedback cannot be empty if provided"
      );

      // Undefined feedback should be allowed
      expect(validateApprovalDraft({ ...validDraft, feedback: undefined })).toHaveLength(0);
    });
  });

  describe("Status and Error Utilities", () => {
    it("should format submission status text correctly", () => {
      expect(getSubmissionStatusText(false, "idle")).toBe("Saving offline...");
      expect(getSubmissionStatusText(true, "syncing")).toBe("Syncing...");
      expect(getSubmissionStatusText(true, "error")).toBe("Sync failed");
      expect(getSubmissionStatusText(true, "idle")).toBe("Saving...");
    });

    it("should format job errors for users", () => {
      expect(formatJobError("gardener permission denied")).toBe(
        "You don't have permission to submit work to this garden"
      );
      expect(formatJobError("Network connection failed")).toBe(
        "Network connection error - your work is saved offline"
      );
      expect(formatJobError("Storage quota exceeded")).toBe(
        "Storage quota exceeded - please free up space"
      );
      expect(formatJobError("UNAUTHORIZED ACCESS")).toBe(
        "You're not authorized to perform this action"
      );
      expect(formatJobError("Unknown error")).toBe("Unknown error");
    });
  });
});
