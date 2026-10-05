/** @vitest-environment node */
import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import {
  createDefaultSubmitWorkPorts,
  submitWork,
  type ResolvedSubmitWorkCommand,
  type SubmitWorkCommand,
} from "../../modules/work/submit-work-command";
import type { Action } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { draftDB } from "../../modules/job-queue/draft-db";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { JOB_DISCARDED } from "../../modules/job-queue/queue-policy";
import { deleteDraftOfQueuedWork, listWorkDrafts } from "../../modules/work/draft-lifecycle";
import { createDraftUploadPersistence } from "../../modules/work/draft-upload";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";

// Whether a waiting HEIC photo can convert is each test's call.
const heic = vi.hoisted(() => ({
  convertHeicPhoto: vi.fn(async (): Promise<unknown> => ({ status: "unavailable" })),
}));
vi.mock("../../modules/work/heic-conversion", () => heic);
const hash = `0x${"12".repeat(32)}` as const;
function fixture() {
  const command: SubmitWorkCommand = {
    clientWorkId: crypto.randomUUID(),
    authMode: "wallet",
    gardenAddress: "0x1111111111111111111111111111111111111111",
    actionUID: 1,
    actions: [],
    userAddress: "0x2222222222222222222222222222222222222222",
    chainId: 11155111,
    draft: {
      actionUID: 1,
      title: "Work",
      feedback: "Watered the seedlings",
      details: {},
      media: [],
      timeSpentMinutes: 10,
    },
    images: [],
    allowOfflineQueue: true,
  };
  const ports = createDefaultSubmitWorkPorts({ sender: null });
  ports.connectivity = { isOnline: () => true, confirm: async () => true };
  const send = vi.fn(async (input: SubmitWorkCommand) => {
    const jobs = await jobQueueDB.getJobs({ userAddress: command.userAddress! });
    expect(
      jobs.some(
        (job) => (job.payload as { clientWorkId: string }).clientWorkId === command.clientWorkId
      )
    ).toBe(true);
    await input.onBroadcast?.(hash);
    return hash;
  });
  ports.direct.submitWork = send;
  return { command, ports, send };
}

/**
 * Submit from the wizard with a wallet whose prompt is declined: the draft is
 * saved first, as the wizard saves it, and the queue admits the work before
 * the wallet asks.
 */
async function declinedWalletWork() {
  const { command, ports, send } = fixture();
  const photo = new File([new Uint8Array([1, 2, 3, 4])], "bed.jpg", { type: "image/jpeg" });
  const draftId = crypto.randomUUID();
  const record = await draftDB.saveSnapshot(
    command.userAddress!,
    command.chainId,
    draftId,
    { gardenAddress: command.gardenAddress, actionUID: 1, feedback: command.draft.feedback },
    [photo],
    []
  );
  Object.assign(
    command,
    await createDraftUploadPersistence(record, command.draft, { current: null }),
    { images: [photo] }
  );
  ports.direct.submitWork = vi.fn(async (input: SubmitWorkCommand) => {
    await input.onCheckpoint?.({
      submittedAt: new Date().toISOString(),
      files: {},
      broadcastPending: true,
      broadcastPendingAt: new Date().toISOString(),
    });
    throw new WorkSubmissionError(
      "User rejected the request.",
      "transaction",
      "batch",
      Object.assign(new Error("User rejected the request."), { code: 4001 })
    );
  });
  await expect(submitWork(command, ports)).rejects.toThrow();
  const queued = async () =>
    (
      await jobQueueDB.getJobs({ userAddress: command.userAddress!, kind: "work", synced: false })
    ).filter((job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId);
  const listedDrafts = async () =>
    (await listWorkDrafts(command.userAddress!, command.chainId)).filter(
      (draft) => draft.id === draftId
    );
  return { command, ports, send, draftId, queued, listedDrafts };
}

describe("PWA durable submission boundary", () => {
  it("queues a submission instead of sending while the connection is unconfirmed", async () => {
    const { command, ports, send } = fixture();
    ports.connectivity = { isOnline: () => true, confirm: async () => false };

    await expect(submitWork(command, ports)).resolves.toMatchObject({ kind: "queued" });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps declined passkey work, and asks again when Submit is tapped again", async () => {
    const { command, ports } = fixture();
    command.authMode = "passkey";
    ports.sender = createMockTransactionSender();
    const process = vi
      .fn()
      .mockImplementationOnce(async (jobId: string) => {
        const job = (await jobQueueDB.getJob(jobId))!;
        await jobQueueDB.updateJob({ ...job, meta: { ...job.meta, requiresExplicitSend: true } });
        return { success: false, error: "send-cancelled", skipped: true };
      })
      .mockResolvedValueOnce({ success: true, txHash: hash });
    ports.queue.process = process;

    await expect(submitWork(command, ports)).rejects.toMatchObject({ code: 4001 });
    const pending = await jobQueueDB.getJobs({ userAddress: command.userAddress!, synced: false });
    const kept = pending.find(
      (job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId
    );
    expect(kept?.attempts).toBe(0);

    await expect(submitWork(command, ports)).resolves.toMatchObject({ kind: "processed" });
    expect(process).toHaveBeenCalledTimes(2);
  });

  it("keeps declined wallet work sendable instead of failing it", async () => {
    const { command, ports } = fixture();
    ports.direct.submitWork = vi.fn(async (input: SubmitWorkCommand) => {
      await input.onCheckpoint?.({
        submittedAt: new Date().toISOString(),
        files: {},
        broadcastPending: true,
        broadcastPendingAt: new Date().toISOString(),
        intentBlock: 100n,
        intentChainTime: 1_234,
      });
      throw new Error("Transaction failed", {
        cause: Object.assign(new Error("User rejected the request."), { code: 4001 }),
      });
    });

    await expect(submitWork(command, ports)).rejects.toThrow();

    const pending = await jobQueueDB.getJobs({ userAddress: command.userAddress!, synced: false });
    const kept = pending.find(
      (job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId
    );
    expect(kept?.attempts).toBe(0);
    expect(kept?.meta?.requiresExplicitSend).toBe(true);
    expect((kept?.payload as WorkJobPayload).uploadCheckpoint?.broadcastPending).toBeFalsy();
    // A refusal clears the whole intent, its chain head too.
    expect((kept?.payload as WorkJobPayload).uploadCheckpoint?.intentChainTime).toBeUndefined();
  });

  it("lists declined wallet work once, keeps all of it, and sends it once when Submit asks again", async () => {
    const { command, ports, send, draftId, queued, listedDrafts } = await declinedWalletWork();

    // Your Work reads the queue and the drafts: the work is one item, as queued.
    const [job] = await queued();
    expect(await queued()).toHaveLength(1);
    expect(await listedDrafts()).toEqual([]);
    // Nothing is lost: the queue has the photo, and the composer still has its draft.
    expect(await jobQueueDB.getImagesForJob(job.id)).toHaveLength(1);
    expect(await draftDB.getImagesForDraft(draftId)).toHaveLength(1);

    let removedWhileSending: boolean | undefined;
    ports.direct.submitWork = vi.fn(async (input: SubmitWorkCommand) => {
      // The Submit that is sending the work answers for its own draft.
      removedWhileSending = await deleteDraftOfQueuedWork(job, "retire");
      return send(input);
    });
    await expect(submitWork(command, ports)).resolves.toMatchObject({
      kind: "direct",
      txHash: hash,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(removedWhileSending).toBe(false);
    expect(await draftDB.getDraft(draftId)).toBeDefined();
    // Sent: the queue let go of it, and its draft is still not an item of its own.
    expect(await queued()).toEqual([]);
    expect(await listedDrafts()).toEqual([]);
  });

  it("removes declined work with its draft and both sets of attachments when it is discarded", async () => {
    const { draftId, queued, listedDrafts } = await declinedWalletWork();
    const [job] = await queued();
    const discarded: Array<{ job: Job; error: string }> = [];
    const stop = jobQueueEventBus.on("job:failed", (event) => discarded.push(event));

    try {
      expect(await jobQueue.discardJob(job.id)).toBe(true);
    } finally {
      stop();
    }
    // The queue says which work was discarded; the provider removes that work's draft.
    expect(discarded).toMatchObject([{ error: JOB_DISCARDED, job: { id: job.id } }]);
    expect(await deleteDraftOfQueuedWork(discarded[0].job, "discard")).toBe(true);

    expect(await queued()).toEqual([]);
    expect(await jobQueueDB.getImagesForJob(job.id)).toEqual([]);
    expect(await listedDrafts()).toEqual([]);
    expect(await draftDB.getDraft(draftId)).toBeUndefined();
    expect(await draftDB.getImagesForDraft(draftId)).toEqual([]);
  });

  it("still lists every draft when the upload queue cannot be read", async () => {
    const { listedDrafts } = await declinedWalletWork();
    const read = vi.spyOn(jobQueueDB, "getJobs").mockRejectedValueOnce(new Error("blocked"));
    try {
      expect(await listedDrafts()).toHaveLength(1);
    } finally {
      read.mockRestore();
    }
  });

  it("holds the send lock through an open wallet prompt", async () => {
    const { command, ports } = fixture();
    let entered!: () => void;
    let answer!: () => void;
    const promptOpened = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const walletAnswer = new Promise<typeof hash>((resolve) => {
      answer = () => resolve(hash);
    });
    ports.direct.submitWork = vi.fn(async () => {
      entered();
      return walletAnswer;
    });
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    let held = false;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        locks: {
          request: async (
            _name: string,
            _options: unknown,
            callback: (lock: object) => Promise<unknown>
          ) => {
            held = true;
            try {
              return await callback({ name: _name });
            } finally {
              held = false;
            }
          },
        },
      },
    });
    try {
      const submission = submitWork(command, ports);
      await promptOpened;
      expect(held).toBe(true);
      answer();
      await expect(submission).resolves.toMatchObject({ kind: "direct" });
      expect(held).toBe(false);
    } finally {
      answer();
      if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
      else Reflect.deleteProperty(globalThis, "navigator");
    }
  });

  it("renews the durable claim while a wallet prompt remains open past its lifetime", async () => {
    const { command, ports } = fixture();
    let entered!: () => void;
    let answer!: () => void;
    const promptOpened = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const walletAnswer = new Promise<typeof hash>((resolve) => {
      answer = () => resolve(hash);
    });
    ports.direct.submitWork = vi.fn(async () => {
      entered();
      return walletAnswer;
    });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    try {
      const submission = submitWork(command, ports);
      await promptOpened;
      const jobs = await jobQueueDB.getJobs({ userAddress: command.userAddress! });
      const job = jobs.find(
        (row) => (row.payload as WorkJobPayload).clientWorkId === command.clientWorkId
      )!;
      await vi.advanceTimersByTimeAsync(61_000);
      // A second tab must still be unable to claim this Work after the original 60-second lease.
      expect(await jobQueueDB.acquireExecutionClaim([job.id], "second-tab")).toBe(false);
      answer();
      await expect(submission).resolves.toMatchObject({ kind: "direct" });
    } finally {
      answer();
      vi.useRealTimers();
    }
  });

  it("sends a wallet work's photo as the JPEG it converts to, not the HEIC it was picked as", async () => {
    const { command, ports, send } = fixture();
    const picked = new File(["heic-bytes"], "garden.heic", { type: "image/heic" });
    command.images = [picked];
    heic.convertHeicPhoto.mockResolvedValueOnce({
      status: "converted",
      file: new File(["jpeg-bytes"], "garden.jpg", { type: "image/jpeg" }),
    });

    await expect(submitWork(command, ports)).resolves.toMatchObject({ kind: "direct" });

    const sent = send.mock.calls[0]?.[0] as SubmitWorkCommand;
    expect(sent.images.map((file) => file.type)).toEqual(["image/jpeg"]);
  });

  it("keeps wallet work queued, never failed, while its photo cannot convert yet", async () => {
    const { command, ports, send } = fixture();
    command.images = [new File(["heic-bytes"], "garden.heic", { type: "image/heic" })];
    heic.convertHeicPhoto.mockResolvedValueOnce({ status: "unavailable" });

    const outcome = await submitWork(command, ports);

    expect(outcome.kind).toBe("queued");
    expect(send).not.toHaveBeenCalled();
    const job = await jobQueueDB.getJob((outcome as { jobId: string }).jobId);
    expect(job?.attempts).toBe(0);
    expect(job?.lastError).toBeUndefined();
  });

  it("stores the action's own title with admitted work, and no placeholder when it is unknown", async () => {
    const { command } = fixture();
    const admit = createDefaultSubmitWorkPorts({ sender: null }).queue.admit!;
    const untitled = { ...command.draft, title: "" };

    const known = await admit({
      ...command,
      draft: untitled,
      actions: [{ id: "11155111-1", title: "Watering seedlings" } as Action],
    } as ResolvedSubmitWorkCommand);
    const unknown = await admit({
      ...command,
      clientWorkId: crypto.randomUUID(),
      draft: { ...command.draft, title: "Unknown Action" },
      actions: [],
    } as ResolvedSubmitWorkCommand);

    const knownPayload = (await jobQueueDB.getJob(known.jobId))?.payload as WorkJobPayload;
    const unknownPayload = (await jobQueueDB.getJob(unknown.jobId))?.payload as WorkJobPayload;
    expect(knownPayload.title).toBe("Watering seedlings");
    expect(unknownPayload.title).toBeUndefined();
  });

  it("preserves an inline passkey failure as an error instead of a queued success", async () => {
    const { command, ports } = fixture();
    command.authMode = "passkey";
    ports.sender = createMockTransactionSender();
    ports.queue.process = vi
      .fn()
      .mockResolvedValue({ success: false, error: "unavailable:work-transaction-reverted" });
    await expect(submitWork(command, ports)).rejects.toThrow("work-transaction-reverted");
    const pending = await jobQueueDB.getJobs({ userAddress: command.userAddress!, synced: false });
    expect(
      pending.some(
        (job) => (job.payload as { clientWorkId: string }).clientWorkId === command.clientWorkId
      )
    ).toBe(true);
  });

  it("retains a completed identity when draft retirement fails and never sends it twice", async () => {
    const { command, ports, send } = fixture();
    command.onCheckpoint = async () => {
      throw new Error("draft retirement interrupted");
    };
    expect(await submitWork(command, ports)).toMatchObject({ kind: "direct", txHash: hash });
    expect(
      await submitWork(
        { ...command, draft: { ...command.draft, uploadCheckpoint: undefined } },
        ports
      )
    ).toMatchObject({ kind: "direct", txHash: hash });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("allows only one immediate sender for two simultaneous submissions", async () => {
    const { command, ports, send } = fixture();
    await Promise.all([submitWork(command, ports), submitWork({ ...command }, ports)]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("retains evidence after a failed completion write and reconciles without authorizing a new send", async () => {
    const { command, ports, send } = fixture();
    const save = vi
      .spyOn(jobQueueDB, "storeClientWorkIdMapping")
      .mockRejectedValueOnce(new Error("quota"));
    try {
      expect(await submitWork(command, ports)).toMatchObject({ kind: "awaiting-confirmation" });
    } finally {
      save.mockRestore();
    }
    const jobs = await jobQueueDB.getJobs({ userAddress: command.userAddress! });
    expect(
      jobs.find(
        (job) => (job.payload as { clientWorkId: string }).clientWorkId === command.clientWorkId
      )
    ).toMatchObject({ synced: false, payload: { uploadCheckpoint: { transactionHash: hash } } });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("keeps interrupted hashless signing unresolved on the next attempt", async () => {
    const { command, ports, send } = fixture();
    command.draft.uploadCheckpoint = {
      submittedAt: new Date().toISOString(),
      files: {},
      broadcastPending: true,
    };
    expect(await submitWork(command, ports)).toMatchObject({ kind: "awaiting-confirmation" });
    expect(send).not.toHaveBeenCalled();
  });
});
