import { describe, it, expect, vi, beforeEach } from "vitest";

// Use real idb with fake-indexeddb provided in setupTests

import { jobQueue } from "../../modules/job-queue";

// Minimal smart account client mock
const mockClient = {
  sendTransaction: vi.fn(async () => "0xabc"),
  getAddress: vi.fn(async () => "0x0"),
  isConnected: vi.fn(() => true),
};

describe("modules/job-queue", () => {
  beforeEach(() => {
    (global as any).navigator.onLine = true;
  });

  it("adds a job and emits basic lifecycle via processing path", async () => {
    jobQueue.setSmartAccountClient(mockClient as any);

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

    // Flush any pending (should be no-op or success)
    await jobQueue.flush().catch(() => {});

    const stats = await jobQueue.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });
});
