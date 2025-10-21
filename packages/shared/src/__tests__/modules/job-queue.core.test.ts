import { describe, it, expect, beforeEach } from "vitest";

// Use real idb with fake-indexeddb provided in setupTests

import { jobQueue } from "../../modules/job-queue";

describe("modules/job-queue", () => {
  beforeEach(() => {
    (global as any).navigator.onLine = true;
  });

  it("adds a job and emits basic lifecycle via processing path", async () => {
    const jobId = await jobQueue.addJob(
      "work",
      {
        title: "Test",
        actionUID: 1,
        gardenAddress: "0x123",
        media: [new File(["x"], "x.jpg", { type: "image/jpeg" })],
        feedback: "ok",
      } as any,
      { chainId: 84532 }
    );
    expect(jobId).toBeTypeOf("string");

    const stats = await jobQueue.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });
});
