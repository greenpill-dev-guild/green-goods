import { describe, it, expect, vi } from "vitest";

// Use real idb with fake-indexeddb provided in setupTests

import { jobQueueDB } from "../../modules/job-queue";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

describe("modules/job-queue/db", () => {
  it("adds and retrieves a job, manages images URLs", async () => {
    // fake-indexeddb is already installed via setupTests
    // Polyfill URL.createObjectURL if missing
    if (!global.URL.createObjectURL) {
      (global.URL as any).createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
      (global.URL as any).revokeObjectURL = vi.fn();
    }

    const id = await jobQueueDB.addJob({
      kind: "work",
      payload: { media: [new File(["x"], "x.jpg", { type: "image/jpeg" })] },
      meta: { chainId: 84532 },
      chainId: 84532,
      userAddress: TEST_USER_ADDRESS,
    } as any);

    expect(typeof id).toBe("string");
    const job = await jobQueueDB.getJob(id);
    expect(job?.kind).toBe("work");
    expect(job?.userAddress).toBe(TEST_USER_ADDRESS);

    const images = await jobQueueDB.getImagesForJob(id);
    expect(images.length).toBe(1);

    await jobQueueDB.deleteJob(id);
    const after = await jobQueueDB.getJob(id);
    expect(after).toBeUndefined();
  });
});
