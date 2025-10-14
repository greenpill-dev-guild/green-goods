import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  submitWorkToQueue,
  validateWorkDraft,
  formatJobError,
} from "../../modules/work/work-submission";
import { jobQueue } from "../../modules/job-queue";

vi.mock("../../modules/job-queue", async () => {
  const mod = await import("../../modules/job-queue");
  return {
    ...mod,
    jobQueue: {
      addJob: vi.fn(async () => "job-1"),
      setSmartAccountClient: vi.fn(),
      flush: vi.fn(async () => ({ processed: 0, failed: 0, skipped: 0 })),
      getStats: vi.fn(async () => ({ total: 0, pending: 0, failed: 0, synced: 0 })),
    },
  };
});

describe("modules/work-submission", () => {
  beforeEach(() => {
    (jobQueue.addJob as any).mockClear?.();
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
      []
    );
    expect(tx.startsWith("0xoffline_")).toBe(true);
    expect(jobQueue.addJob).toHaveBeenCalled();
  });

  it("formats job errors", () => {
    expect(formatJobError("permission denied").toLowerCase()).toContain("permission");
    expect(formatJobError("unknown")).toBe("unknown");
  });
});
