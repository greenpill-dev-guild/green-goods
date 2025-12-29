import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatJobError,
  submitApprovalToQueue,
  submitWorkToQueue,
  validateWorkDraft,
  validateWorkSubmissionContext,
} from "../../modules/work/work-submission";
import { jobQueue } from "../../modules/job-queue";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

// Helper to create mock files
function createMockFile(name: string, size: number = 1024): File {
  const content = new Array(size).fill("a").join("");
  return new File([content], name, { type: "image/jpeg" });
}

describe("modules/work-submission", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(jobQueue, "addJob").mockResolvedValue("job-1");
  });

  it("validates drafts and returns errors", () => {
    const errors = validateWorkDraft({ feedback: "" } as any, null, null, []);
    expect(errors.length).toBeGreaterThan(0);
  });

  describe("validateWorkSubmissionContext with minRequired", () => {
    it("passes when images meet default minRequired of 1", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [createMockFile("img1.jpg")]);
      expect(errors).toEqual([]);
    });

    it("fails when images below default minRequired of 1", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, []);
      expect(errors).toContain("At least one image is required");
    });

    it("passes when images meet custom minRequired of 2", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg")],
        { minRequired: 2 }
      );
      expect(errors).toEqual([]);
    });

    it("fails when images below custom minRequired of 2", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [createMockFile("img1.jpg")], {
        minRequired: 2,
      });
      expect(errors).toContain("At least 2 images are required");
    });

    it("passes when minRequired is 0 (not required)", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [], { minRequired: 0 });
      expect(errors).toEqual([]);
    });

    it("passes when images exceed minRequired of 3", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [
          createMockFile("img1.jpg"),
          createMockFile("img2.jpg"),
          createMockFile("img3.jpg"),
          createMockFile("img4.jpg"),
        ],
        { minRequired: 3 }
      );
      expect(errors).toEqual([]);
    });

    it("fails for minRequired of 5 with only 3 images", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg"), createMockFile("img3.jpg")],
        { minRequired: 5 }
      );
      expect(errors).toContain("At least 5 images are required");
    });

    it("still validates garden and actionUID with any minRequired", () => {
      const errors = validateWorkSubmissionContext(
        null,
        null,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg")],
        { minRequired: 2 }
      );
      expect(errors).toContain("Garden must be selected");
      expect(errors).toContain("Action must be selected");
    });
  });

  it("submits work to queue and returns offline tx hash", async () => {
    const draft = { feedback: "ok" } as any;
    const tx = await submitWorkToQueue(
      draft,
      "0x123",
      1,
      [{ id: "84532-1", title: "Act" }] as any,
      84532,
      [],
      TEST_USER_ADDRESS
    );
    expect(tx.txHash.startsWith("0xoffline_")).toBe(true);
    expect(jobQueue.addJob).toHaveBeenCalled();
  });

  it("queues approval jobs", async () => {
    const result = await submitApprovalToQueue(
      {
        workUID: "0xwork",
        actionUID: 1,
        approved: true,
      },
      { gardenerAddress: "0xabc" } as any,
      84532,
      TEST_USER_ADDRESS
    );
    expect(result.jobId).toBe("job-1");
    expect(result.txHash.startsWith("0xoffline_")).toBe(true);
  });

  it("formats job errors", () => {
    expect(formatJobError("permission denied").toLowerCase()).toContain("permission");
    expect(formatJobError("unknown")).toBe("unknown");
  });
});
