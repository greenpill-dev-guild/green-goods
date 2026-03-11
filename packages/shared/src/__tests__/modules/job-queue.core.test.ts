/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ensure fake-indexeddb is loaded before job-queue module
import "fake-indexeddb/auto";

// Mock modules that pull in problematic dependencies (@walletconnect -> uint8arrays)
vi.mock("../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
  getAppKit: () => null,
}));

vi.mock("@wagmi/core", () => ({
  getPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
  })),
}));

vi.mock("../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

// Mock the simulate module (dynamically imported by job queue)
vi.mock("../../modules/work/simulate", () => ({
  simulateWorkSubmission: vi.fn(async () => undefined),
}));

// Mock the EAS encoders (dynamically imported by job queue)
vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(async () => "0xencodedworkdata"),
  encodeWorkApprovalData: vi.fn(() => "0xencodedapprovaldata"),
}));

// Mock the EAS config
vi.mock("../../config/blockchain", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getEASConfig: vi.fn(() => ({
      EAS: { address: "0xEAS" },
      WORK: { uid: "0xworkschema", schema: "" },
      WORK_APPROVAL: { uid: "0xapprovalschema", schema: "" },
      ASSESSMENT: { uid: "0xassessmentschema", schema: "" },
      SCHEMA_REGISTRY: { address: "0xSchemaRegistry" },
    })),
  };
});

import { jobQueue, jobQueueDB } from "../../modules/job-queue";
import type { TransactionSender } from "../../modules/transactions/types";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

/**
 * Creates a mock File with arrayBuffer support for Node.js test environment.
 * Node's File class may not have arrayBuffer() method in all environments.
 */
function createMockFile(content: string, name: string, type: string): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  // Ensure arrayBuffer is available (polyfill for test environments)
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => {
        const reader = new FileReader();
        return new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });
      },
    });
  }

  return file;
}

/**
 * Creates a mock TransactionSender for testing.
 */
function createMockSender(overrides: Partial<TransactionSender> = {}): TransactionSender {
  return {
    sendContractCall: vi.fn(async () => ({
      hash: "0xtesthash" as `0x${string}`,
      sponsored: true,
    })),
    supportsSponsorship: true,
    supportsBatching: false,
    authMode: "passkey",
    ...overrides,
  };
}

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

  it("processes a queued work job during flush when sender is available", async () => {
    const file = createMockFile("content", "work.jpg", "image/jpeg");
    const jobId = await jobQueue.addJob(
      "work",
      {
        title: "Test",
        actionUID: 42,
        gardenAddress: "0x123",
        feedback: "ok",
        details: { species: ["Rose"] },
        timeSpentMinutes: 30,
        media: [file],
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );

    expect(jobId).toBeDefined();

    const mockSender = createMockSender();

    const result = await jobQueue.flush({
      transactionSender: mockSender,
      userAddress: TEST_USER_ADDRESS,
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockSender.sendContractCall).toHaveBeenCalledTimes(1);
    const stats = await jobQueue.getStats(TEST_USER_ADDRESS);
    expect(stats.pending).toBe(0);
  });

  it("skips processing when transaction sender is missing", async () => {
    await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: "0xwork",
        approved: true,
        gardenerAddress: "0xgardener",
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );

    const result = await jobQueue.flush({
      transactionSender: null,
      userAddress: TEST_USER_ADDRESS,
    });

    expect(result.processed).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("marks jobs as failed when underlying submission throws", async () => {
    const mockSender = createMockSender({
      sendContractCall: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    await jobQueue.addJob(
      "work",
      {
        title: "Test",
        actionUID: 99,
        gardenAddress: "0x123",
        feedback: "ok",
        details: { species: ["Rose"] },
        timeSpentMinutes: 30,
        media: [createMockFile("content", "x.jpg", "image/jpeg")],
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );

    const result = await jobQueue.flush({
      transactionSender: mockSender,
      userAddress: TEST_USER_ADDRESS,
    });

    expect(result.failed).toBe(1);
    expect(mockSender.sendContractCall).toHaveBeenCalled();
    const jobs = await jobQueue.getJobs(TEST_USER_ADDRESS);
    expect(jobs[0]?.lastError).toContain("boom");
  });
});
