/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockTransactionSender } from "@green-goods/shared/testing";
import type { ApprovalJobPayload, WorkJobPayload } from "../../types/job-queue";
import { forgetWorkBroadcast } from "../../modules/work/work-confirmation";

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
// No stranded send in these tests ever landed on-chain.
vi.mock("../../modules/data/eas-sent-attestations", () => ({
  getWorkSubmissionsSince: vi.fn(async () => []),
}));
vi.mock("../../modules/work/simulate", () => ({
  simulateWorkSubmission: vi.fn(async () => undefined),
}));

// Mock the EAS encoders (dynamically imported by job queue)
vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(async () => "0xencodedworkdata"),
  encodeWorkApprovalData: vi.fn(() => "0xencodedapprovaldata"),
}));

// The HEIC decoder is a lazy chunk; tests decide whether it can convert.
const heicConversion = vi.hoisted(() => ({
  convertHeicPhoto: vi.fn(async (): Promise<unknown> => ({ status: "unavailable" })),
}));
vi.mock("../../modules/work/heic-conversion", () => heicConversion);

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

import {
  createDefaultJobQueueDependencies,
  jobQueue,
  jobQueueDB,
  jobQueueEventBus,
} from "../../modules/job-queue";
import { encodeWorkData } from "../../utils/eas/encoders";

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

describe("modules/job-queue", () => {
  it("wires the exported event bus into the default queue dependencies", () => {
    expect(createDefaultJobQueueDependencies().events).toBe(jobQueueEventBus);
  });

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

  it("never sends a commitment act while demo pooling is on", async () => {
    // Dev mock auth reports authMode "wallet", so the sender is a real
    // WalletSender over wagmi even with no smart account. A fixture id must
    // therefore never reach sendContractCall.
    const { isDemoPoolingActive } = await import("../../modules/commitment-pooling/demo/demo-mode");
    window.sessionStorage.setItem("greengoods_dev_mock_pooling", "1");
    expect(isDemoPoolingActive()).toBe(true);

    const jobId = await jobQueueDB.addJob({
      kind: "confirmation",
      payload: {
        action: "confirm",
        commitmentId: 1007n,
        gardenAddress: "0x00000000000000000000000000000000000000aa",
      },
      meta: { chainId: 42161 },
      chainId: 42161,
      userAddress: TEST_USER_ADDRESS,
    });

    const mockSender = createMockTransactionSender();
    const result = await jobQueue.processJob(jobId, { transactionSender: mockSender });

    expect(mockSender.sendContractCall).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.error).toBe("demo-mode");
    window.sessionStorage.clear();
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

    const mockSender = createMockTransactionSender();

    const result = await jobQueue.flush({
      transactionSender: mockSender,
      userAddress: TEST_USER_ADDRESS,
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(encodeWorkData).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test" }),
      11155111,
      expect.objectContaining({ gardenAddress: "0x123" })
    );
    expect(mockSender.sendContractCall).toHaveBeenCalledTimes(1);
    const stats = await jobQueue.getStats(TEST_USER_ADDRESS);
    expect(stats.pending).toBe(0);
  });

  it("keeps work with a HEIC photo queued until the photo can convert, then sends a JPEG", async () => {
    const heic = createMockFile("heic-bytes", "garden.heic", "image/heic");
    const jobId = await jobQueue.addJob(
      "work",
      { title: "Test", actionUID: 42, gardenAddress: "0x123", feedback: "ok", media: [heic] },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const mockSender = createMockTransactionSender();

    const waiting = await jobQueue.processJob(jobId, { transactionSender: mockSender });

    expect(waiting).toMatchObject({
      success: false,
      skipped: true,
      error: "photo-conversion-pending",
    });
    const queued = await jobQueueDB.getJob(jobId);
    expect(queued?.attempts).toBe(0);
    expect(queued?.lastError).toBeUndefined();
    expect(encodeWorkData).not.toHaveBeenCalled();
    expect(mockSender.sendContractCall).not.toHaveBeenCalled();

    heicConversion.convertHeicPhoto.mockResolvedValueOnce({
      status: "converted",
      file: createMockFile("jpeg-bytes", "garden.jpg", "image/jpeg"),
    });
    // A waiting job is re-probed no sooner than the queue's throttle allows.
    const later = Date.now() + 60_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    const sent = await jobQueue.processJob(jobId, { transactionSender: mockSender });
    vi.mocked(Date.now).mockRestore();

    expect(sent).toMatchObject({ success: true });
    const [encoded] = vi.mocked(encodeWorkData).mock.calls[0];
    expect(encoded.media.map((file: File) => file.type)).toEqual(["image/jpeg"]);
  });

  it("sends nothing while the connection is unconfirmed, even when asked", async () => {
    const { connectivityStore } = await import("../../stores/connectivity");
    const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
    const status = vi
      .spyOn(connectivityStore, "getStatusSnapshot")
      .mockReturnValue({ state: "degraded" });
    const jobId = await jobQueue.addJob(
      "work",
      { title: "Test", actionUID: 42, gardenAddress: "0x123", feedback: "ok" },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const sender = createMockTransactionSender();

    try {
      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender, explicit: true })
      ).resolves.toEqual({ success: false, error: "connection-unconfirmed", skipped: true });
      // The store rechecks an unstable connection itself; a flush must not probe per job.
      expect(confirm).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
      status.mockRestore();
    }
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("probes a connection whose last answer is stale before sending", async () => {
    const { connectivityStore } = await import("../../stores/connectivity");
    const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
    const status = vi
      .spyOn(connectivityStore, "getStatusSnapshot")
      .mockReturnValue({ state: "online", checkedAt: Date.now() - 120_000 });
    const jobId = await jobQueue.addJob(
      "work",
      { title: "Test", actionUID: 42, gardenAddress: "0x123", feedback: "ok" },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const sender = createMockTransactionSender();

    try {
      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender, explicit: true })
      ).resolves.toEqual({ success: false, error: "connection-unconfirmed", skipped: true });
      expect(confirm).toHaveBeenCalledOnce();
      expect(confirm).toHaveBeenCalledWith({ maxAgeMs: 60_000 });
    } finally {
      confirm.mockRestore();
      status.mockRestore();
    }
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("confirms a decision whose answer was lost instead of failing it or sending it twice", async () => {
    const sent = `0x${"ab".repeat(32)}` as const;
    const jobId = await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: `0x${"44".repeat(32)}`,
        gardenAddress: "0x123",
        gardenerAddress: "0x456",
        approved: true,
        confidence: 2,
        verificationMethod: 1,
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcast?.(sent);
      throw Object.assign(new Error("The request took too long"), { name: "TimeoutError" });
    });

    await expect(jobQueue.processJob(jobId, { transactionSender: sender })).resolves.toEqual({
      success: false,
      error: "awaiting-confirmation",
      skipped: true,
    });
    const waiting = await jobQueueDB.getJob(jobId);
    expect(waiting?.attempts).toBe(0);
    expect(waiting?.meta?.waitingReason).toBe("awaiting-confirmation");
    expect((waiting?.payload as ApprovalJobPayload).sendCheckpoint?.transactionHash).toBe(sent);

    // After a reload, and past the retry limit, a recorded decision is confirmed, never sent again.
    forgetWorkBroadcast(jobId);
    await jobQueueDB.updateJob({ ...waiting!, attempts: 5 });
    await expect(
      jobQueue.processJob(jobId, { transactionSender: sender, explicit: true })
    ).resolves.toMatchObject({ error: "awaiting-confirmation" });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("never fails a sent decision when its checkpoint cannot be saved", async () => {
    const jobId = await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: `0x${"44".repeat(32)}`,
        gardenAddress: "0x123",
        gardenerAddress: "0x456",
        approved: true,
        confidence: 2,
        verificationMethod: 1,
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const stored = await jobQueueDB.getJob(jobId);
    // An earlier build recorded the intent without a time; stamping it cannot be saved.
    (stored!.payload as ApprovalJobPayload).sendCheckpoint = { broadcastPending: true };
    await jobQueueDB.updateJob(stored!);
    const sender = createMockTransactionSender();
    const update = vi
      .spyOn(jobQueueDB, "updateJob")
      .mockRejectedValueOnce(new Error("QuotaExceededError"));
    try {
      await expect(jobQueue.processJob(jobId, { transactionSender: sender })).resolves.toEqual({
        success: false,
        error: "awaiting-confirmation",
        skipped: true,
      });
    } finally {
      update.mockRestore();
    }
    expect((await jobQueueDB.getJob(jobId))?.attempts).toBe(0);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  describe("a send whose answer was lost", () => {
    const strandedWork = async () => {
      const jobId = await jobQueue.addJob(
        "work",
        {
          title: "Test",
          actionUID: 42,
          gardenAddress: "0x123",
          feedback: "ok",
          clientWorkId: crypto.randomUUID(),
        },
        TEST_USER_ADDRESS,
        { chainId: 11155111 }
      );
      const job = await jobQueueDB.getJob(jobId);
      (job!.payload as WorkJobPayload).uploadCheckpoint = {
        submittedAt: new Date().toISOString(),
        files: {},
        broadcastPending: true,
        broadcastPendingAt: new Date(Date.now() - 31 * 60_000).toISOString(),
      };
      await jobQueueDB.updateJob(job!);
      return jobId;
    };

    it("reopens work that never landed without sending it, until the person taps", async () => {
      const jobId = await strandedWork();
      const sender = createMockTransactionSender();

      await expect(jobQueue.processJob(jobId, { transactionSender: sender })).resolves.toEqual({
        success: false,
        error: "send-intent-expired",
        skipped: true,
      });
      const reopened = await jobQueueDB.getJob(jobId);
      expect(
        (reopened!.payload as WorkJobPayload).uploadCheckpoint?.broadcastPending
      ).toBeUndefined();
      expect(reopened!.meta?.requiresExplicitSend).toBe(true);
      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender })
      ).resolves.toMatchObject({
        error: "send-requires-explicit",
      });
      expect(sender.sendContractCall).not.toHaveBeenCalled();

      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender, explicit: true })
      ).resolves.toMatchObject({ success: true });
      expect(sender.sendContractCall).toHaveBeenCalledOnce();
    });

    it("confirms a sent work in the background even while it is held for an explicit send", async () => {
      // Recovered, declined and reopened work all carry the hold. Upload all
      // records the send without touching it, and the confirmation pass never
      // says `explicit`: a hold that also stopped confirmation left such work
      // awaiting confirmation until the person tapped Check again.
      const jobId = await jobQueue.addJob(
        "work",
        {
          title: "Test",
          actionUID: 42,
          gardenAddress: "0x123",
          feedback: "ok",
          clientWorkId: crypto.randomUUID(),
        },
        TEST_USER_ADDRESS,
        { chainId: 11155111 }
      );
      const operation = `0x${"cd".repeat(32)}` as const;
      const transaction = `0x${"ab".repeat(32)}` as const;
      const job = await jobQueueDB.getJob(jobId);
      (job!.payload as WorkJobPayload).uploadCheckpoint = {
        submittedAt: new Date().toISOString(),
        files: {},
        broadcast: { kind: "user-operation", hash: operation },
        broadcastPending: false,
      };
      job!.meta = { ...job!.meta, requiresExplicitSend: true };
      await jobQueueDB.updateJob(job!);
      const sender = createMockTransactionSender();
      sender.reconcileBroadcast = vi.fn(async () => ({
        status: "confirmed" as const,
        transactionHash: transaction,
      }));

      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender })
      ).resolves.toMatchObject({ success: true, txHash: transaction });
      expect(sender.sendContractCall).not.toHaveBeenCalled();
      expect(await jobQueueDB.getJob(jobId)).toBeUndefined();
    });

    it("sends in the same tap when the tap is what finds the send never landed", async () => {
      const jobId = await strandedWork();
      const sender = createMockTransactionSender();

      await expect(
        jobQueue.processJob(jobId, { transactionSender: sender, explicit: true })
      ).resolves.toMatchObject({ success: true });
      expect(sender.sendContractCall).toHaveBeenCalledOnce();
    });
  });

  it("keeps a declined decision queued instead of spending one of its attempts", async () => {
    const jobId = await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: `0x${"44".repeat(32)}`,
        gardenAddress: "0x123",
        gardenerAddress: "0x456",
        approved: true,
        confidence: 2,
        verificationMethod: 1,
      },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const declined = new DOMException("Not allowed by the user.", "NotAllowedError");
    const sender = createMockTransactionSender({ fail: declined });

    // Declining is a choice, the same as it is for a work. Counting it as a
    // failure would retire the decision after five postponements.
    const result = await jobQueue.processJob(jobId, { transactionSender: sender });

    expect(result).toMatchObject({ success: false, skipped: true });
    const stored = await jobQueueDB.getJob(jobId);
    expect(stored?.attempts).toBe(0);
    expect(stored?.lastError).toBeUndefined();
    expect(stored?.synced).toBe(false);
  });

  it("sends only the job kinds a flush asks for", async () => {
    const workId = await jobQueue.addJob(
      "work",
      { title: "Test", actionUID: 42, gardenAddress: "0x123", feedback: "ok" },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const sender = createMockTransactionSender();

    await expect(
      jobQueue.flush({
        transactionSender: sender,
        userAddress: TEST_USER_ADDRESS,
        kinds: ["approval"],
      })
    ).resolves.toEqual({ processed: 0, failed: 0, skipped: 0 });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect((await jobQueueDB.getJob(workId))?.synced).toBe(false);
  });

  it("keeps declined work queued for an explicit send instead of failing it", async () => {
    const jobId = await jobQueue.addJob(
      "work",
      { title: "Test", actionUID: 42, gardenAddress: "0x123", feedback: "ok" },
      TEST_USER_ADDRESS,
      { chainId: 11155111 }
    );
    const declined = new DOMException("Not allowed by the user.", "NotAllowedError");
    const sender = createMockTransactionSender({ fail: declined });

    const result = await jobQueue.processJob(jobId, { transactionSender: sender });

    expect(result).toEqual({ success: false, error: "send-cancelled", skipped: true });
    const stored = await jobQueueDB.getJob(jobId);
    expect(stored?.attempts).toBe(0);
    expect(stored?.lastError).toBeUndefined();
    expect(stored?.meta?.requiresExplicitSend).toBe(true);

    // Reconnecting never asks again on its own.
    vi.mocked(sender.sendContractCall).mockClear();
    const later = Date.now() + 60_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    await jobQueue.flush({ transactionSender: sender, userAddress: TEST_USER_ADDRESS });
    expect(sender.sendContractCall).not.toHaveBeenCalled();

    // Tapping send does.
    vi.mocked(sender.sendContractCall).mockResolvedValue({
      hash: `0x${"ab".repeat(32)}`,
      sponsored: true,
    });
    const sent = await jobQueue.processJob(jobId, { transactionSender: sender, explicit: true });
    vi.mocked(Date.now).mockRestore();
    expect(sent).toMatchObject({ success: true });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("skips processing when transaction sender is missing", async () => {
    await jobQueue.addJob(
      "approval",
      {
        actionUID: 1,
        workUID: "0xwork",
        gardenAddress: "0xgarden",
        approved: true,
        gardenerAddress: "0xgardener",
        confidence: 1,
        verificationMethod: 1,
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
    const mockSender = createMockTransactionSender({ fail: new Error("boom") });

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
