import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatJobError,
  submitApprovalToQueue,
  submitWorkToQueue,
  validateWorkDraft,
} from "../../modules/work/work-submission";
import { jobQueue } from "../../modules/job-queue";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

describe("modules/work-submission", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(jobQueue, "addJob").mockResolvedValue("job-1");
  });

  it("validates drafts and returns errors", () => {
    const errors = validateWorkDraft({ feedback: "" } as any, null, null, []);
    expect(errors.length).toBeGreaterThan(0);
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
