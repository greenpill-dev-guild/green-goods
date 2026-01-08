/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ensure fake-indexeddb is loaded before job-queue module
import "fake-indexeddb/auto";

// Mock modules that pull in problematic dependencies (@walletconnect -> uint8arrays)
vi.mock("../../config/appkit", () => ({
  wagmiConfig: {},
  appKit: null,
}));

vi.mock("@wagmi/core", () => ({
  getPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
  })),
}));

vi.mock("../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("../../modules/work/passkey-submission", () => ({
  submitWorkWithPasskey: vi.fn(async () => "0xtestwork"),
  submitApprovalWithPasskey: vi.fn(async () => "0xtestapproval"),
}));

import { jobQueue, jobQueueDB } from "../../modules/job-queue";
import {
  submitWorkWithPasskey,
  submitApprovalWithPasskey,
} from "../../modules/work/passkey-submission";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

describe("modules/job-queue", () => {
  beforeEach(() => {
    try {
      Object.defineProperty(globalThis.navigator, "onLine", {
        configurable: true,
        value: true,
        writable: true,
      });
    } catch {
      (globalThis.navigator as any).onLine = true;
    }
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const jobs = await jobQueue.getJobs(TEST_USER_ADDRESS);
    for (const job of jobs) {
      await jobQueueDB.deleteJob(job.id);
    }
  });

  it("processes a queued work job during flush when client is available", async () => {
    const file = new File(["content"], "work.jpg", { type: "image/jpeg" });
    const jobId = await jobQueue.addJob(
      "work",
      {
        title: "Test",
        actionUID: 42,
        gardenAddress: "0x123",
        feedback: "ok",
        plantSelection: ["Rose"],
        plantCount: 1,
        media: [file],
      },
      TEST_USER_ADDRESS,
      { chainId: 84532 }
    );

    expect(jobId).toBeDefined();

    const smartAccountClient = {
      account: { address: "0xabc" },
    } as any;

    const result = await jobQueue.flush({ smartAccountClient, userAddress: TEST_USER_ADDRESS });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(submitWorkWithPasskey).toHaveBeenCalledTimes(1);
    const stats = await jobQueue.getStats(TEST_USER_ADDRESS);
    expect(stats.pending).toBe(0);
  });

  it("skips processing when smart account client is missing", async () => {
    await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: "0xwork",
        approved: true,
        gardenerAddress: "0xgardener",
      },
      TEST_USER_ADDRESS,
      { chainId: 84532 }
    );

    const result = await jobQueue.flush({
      smartAccountClient: null,
      userAddress: TEST_USER_ADDRESS,
    });

    expect(result.processed).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
    expect(submitApprovalWithPasskey).not.toHaveBeenCalled();
  });

  it("marks jobs as failed when underlying submission throws", async () => {
    (submitWorkWithPasskey as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom")
    );

    await jobQueue.addJob(
      "work",
      {
        title: "Test",
        actionUID: 99,
        gardenAddress: "0x123",
        feedback: "ok",
        plantSelection: ["Rose"],
        plantCount: 1,
        media: [new File(["content"], "x.jpg", { type: "image/jpeg" })],
      },
      TEST_USER_ADDRESS,
      { chainId: 84532 }
    );

    const smartAccountClient = {
      account: { address: "0xabc" },
    } as any;

    const result = await jobQueue.flush({ smartAccountClient, userAddress: TEST_USER_ADDRESS });

    expect(result.failed).toBe(1);
    expect(submitWorkWithPasskey).toHaveBeenCalled();
    const jobs = await jobQueue.getJobs(TEST_USER_ADDRESS);
    expect(jobs[0]?.lastError).toContain("boom");
  });
});
