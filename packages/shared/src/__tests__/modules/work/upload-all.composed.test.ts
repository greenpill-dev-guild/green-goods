/**
 * @vitest-environment jsdom
 *
 * Upload all, composed: the real queue, IndexedDB, claims, preparation, Upload
 * all with its default ports, and the queue's own processJob. Only the network
 * edges are faked. Each of those modules has its own tests; the defects this
 * flow has had lived between them, where both sides were mocked.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}), getAppKit: () => null }));
vi.mock("@wagmi/core", () => ({
  getPublicClient: vi.fn(() => ({ readContract: vi.fn() })),
  getTransactionReceipt: vi.fn(async () => ({ status: "success" })),
}));
vi.mock("../../../modules/app/posthog", () => ({ track: vi.fn() }));
vi.mock("../../../modules/data/eas-sent-attestations", () => ({
  getWorkSubmissionsSince: vi.fn(async () => []),
  getWorkDecisionsSince: vi.fn(async () => []),
}));
vi.mock("../../../modules/work/simulate", () => ({
  simulateWorkSubmission: vi.fn(async () => undefined),
  simulateApprovalSubmission: vi.fn(async () => undefined),
  simulateQueuedAttestations: vi.fn(async () => undefined),
}));
vi.mock("../../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(async () => "0xabcdef"),
  encodeWorkApprovalData: vi.fn(() => "0x123456"),
}));
vi.mock("../../../modules/work/heic-conversion", () => ({
  convertHeicPhoto: vi.fn(async () => ({ status: "unavailable" })),
}));
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getEASConfig: vi.fn(() => ({
    EAS: { address: "0x5555555555555555555555555555555555555555" },
    WORK: { uid: `0x${"66".repeat(32)}`, schema: "" },
    WORK_APPROVAL: { uid: `0x${"77".repeat(32)}`, schema: "" },
    ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
    SCHEMA_REGISTRY: { address: "0x8888888888888888888888888888888888888888" },
  })),
}));

import { jobQueue, jobQueueDB } from "../../../modules/job-queue";
import { acquireAvailableWorkJobs } from "../../../modules/job-queue/work-claims";
import type { TransactionSendOptions } from "../../../modules/transactions/types";
import { prepareQueuedJob } from "../../../modules/work/prepare-queued-work";
import { uploadQueuedWork } from "../../../modules/work/upload-queued-work";
import { createDefaultUploadQueuedWorkPorts } from "../../../modules/work/upload-queued-work-defaults";
import { queuedUploadStatus } from "../../../modules/work/upload-state";
import type { Address } from "../../../types/domain";
import type { ApprovalJobPayload, WorkJobPayload } from "../../../types/job-queue";
import { createMockTransactionSender } from "../../test-utils";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;
const CHAIN = 11155111;
const OPERATION = `0x${"cd".repeat(32)}` as const;
const TX = `0x${"ab".repeat(32)}` as const;

const queueWork = (feedback: string) =>
  jobQueue.addJob(
    "work",
    {
      title: "Weeding",
      actionUID: 1,
      gardenAddress: GARDEN,
      feedback,
      clientWorkId: crypto.randomUUID(),
    } satisfies WorkJobPayload,
    USER,
    { chainId: CHAIN }
  );

const queueDecision = () =>
  jobQueue.addJob(
    "approval",
    {
      actionUID: 1,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: GARDEN,
      gardenerAddress: GARDEN,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    } satisfies ApprovalJobPayload,
    USER,
    { chainId: CHAIN }
  );

/** Background preparation, one item at a time under its own claim, as the app runs it. */
async function prepare(ids: string[]) {
  const results: string[] = [];
  for (const id of ids) {
    const claim = (await acquireAvailableWorkJobs([id], { background: true })).get(id);
    if (!claim) throw new Error(`could not claim ${id}`);
    try {
      const job = await jobQueueDB.getJob(id);
      results.push(await prepareQueuedJob(job!, CHAIN, claim));
    } finally {
      await claim.release();
    }
  }
  return results;
}

/** A sender that reports the way PasskeySender does, and can reconcile its operation. */
function passkeySender(send: (options: TransactionSendOptions | undefined) => Promise<void>) {
  const sender = createMockTransactionSender();
  vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
    await send(options);
    return { hash: TX, sponsored: true };
  });
  sender.reconcileBroadcast = vi.fn(async () => ({
    status: "confirmed" as const,
    transactionHash: TX,
  }));
  return sender;
}

const broadcast = async (options: TransactionSendOptions | undefined) => {
  await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
  await options?.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
};

const upload = async (sender: ReturnType<typeof createMockTransactionSender>) =>
  uploadQueuedWork(
    { userAddress: USER, chainId: CHAIN, sender },
    await createDefaultUploadQueuedWorkPorts()
  );

const stillQueued = async () =>
  (await jobQueueDB.getJobs({ userAddress: USER, synced: false })).map(
    (job) => `${job.kind}:${queuedUploadStatus(job).state}`
  );

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, "onLine", {
    configurable: true,
    value: true,
    writable: true,
  });
});

afterEach(async () => {
  for (const job of await jobQueue.getJobs(USER)) await jobQueueDB.deleteJob(job.id);
});

describe("Upload all, composed with the real queue", () => {
  it("prepares work and a decision, sends them in one call, and finishes each through the queue", async () => {
    const ids = [await queueWork("east beds"), await queueWork("west beds"), await queueDecision()];

    expect(await prepare(ids)).toEqual(["ready", "ready", "ready"]);
    const sender = passkeySender(async (options) => {
      await broadcast(options);
      await options?.onBroadcast?.(TX);
    });

    await expect(upload(sender)).resolves.toEqual({ status: "uploaded", sent: 3, flagged: 0 });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(vi.mocked(sender.sendContractCall).mock.calls[0][0].functionName).toBe("multiAttest");
    expect(await stillQueued()).toEqual([]);
  });

  it("confirms a recovered work in the background after its answer is lost", async () => {
    // Recovery, a declined prompt and a reopened send all leave the hold that
    // recoverStuckWork sets. Upload all records the send without touching it.
    const id = await queueWork("recovered");
    await jobQueueDB.amendJob(id, (job) => {
      job.meta = { ...job.meta, requiresExplicitSend: true, recoveryVersion: 1 };
    });
    expect(await prepare([id])).toEqual(["ready"]);

    // Broadcast, then the wait for the receipt times out on a slow connection.
    const sender = passkeySender(async (options) => {
      await broadcast(options);
      throw Object.assign(new Error("Timed out waiting for the receipt"), {
        name: "TimeoutError",
      });
    });
    await expect(upload(sender)).resolves.toMatchObject({ status: "send-unconfirmed" });
    expect(await stillQueued()).toEqual(["work:sent"]);

    // The confirmation pass, exactly as useQueueConfirmationSync calls it: no `explicit`.
    await expect(jobQueue.processJob(id, { transactionSender: sender })).resolves.toMatchObject({
      success: true,
      txHash: TX,
    });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(await stillQueued()).toEqual([]);
  });

  it("leaves everything ready when the prompt is declined, and sends it on the next tap", async () => {
    const ids = [await queueWork("east beds"), await queueDecision()];
    await prepare(ids);
    const declining = passkeySender(async () => {
      throw new DOMException("Not allowed by the user.", "NotAllowedError");
    });

    await expect(upload(declining)).resolves.toEqual({ status: "declined", sent: 0, flagged: 0 });
    expect((await stillQueued()).sort()).toEqual(["approval:ready", "work:ready"]);

    const sender = passkeySender(async (options) => {
      await broadcast(options);
      await options?.onBroadcast?.(TX);
    });
    await expect(upload(sender)).resolves.toEqual({ status: "uploaded", sent: 2, flagged: 0 });
    expect(await stillQueued()).toEqual([]);
  });
});
