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
import type { WorkDraftRecord, WorkJobPayload } from "../../types/job-queue";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { draftDB } from "../../modules/job-queue/draft-db";
import {
  deleteDraftOfQueuedWork,
  listWorkDrafts,
  returnChangedWorkToDraft,
} from "../../modules/work/draft-lifecycle";
import { createDraftUploadPersistence } from "../../modules/work/draft-upload";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import { AwaitingWorkConfirmation } from "../../modules/work/work-confirmation";

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
  const wizardSaves = (change: Partial<WorkDraftRecord> = {}) =>
    draftDB.saveSnapshot(
      command.userAddress!,
      command.chainId,
      draftId,
      {
        gardenAddress: command.gardenAddress,
        actionUID: 1,
        feedback: command.draft.feedback,
        ...change,
      },
      [photo],
      []
    );
  const record = await wizardSaves();
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
  return { command, ports, send, draftId, queued, listedDrafts, wizardSaves };
}

describe("PWA durable submission boundary", () => {
  it("retains an admin broadcast and checks its receipt without broadcasting again", async () => {
    const { command, ports } = fixture();
    command.allowOfflineQueue = false;
    command.retainSubmission = true;
    const broadcast = vi.fn();
    let confirmed = false;
    ports.direct.submitWork = vi.fn(async (input) => {
      if (!input.draft.uploadCheckpoint?.transactionHash) {
        broadcast();
        await input.onBroadcast?.(hash);
      }
      if (!confirmed) throw new AwaitingWorkConfirmation(hash);
      return hash;
    });
    const outcome = await submitWork(command, ports);
    expect(outcome.kind).toBe("awaiting-confirmation");
    const jobs = await jobQueueDB.getJobs({ userAddress: command.userAddress!, synced: false });
    const retained = jobs.find(
      (job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId
    )!;
    expect(retained.payload).toMatchObject({ uploadCheckpoint: { transactionHash: hash } });
    expect(retained.meta?.requiresExplicitSend).toBe(true);
    await expect(
      submitWork({ ...command, draft: { ...command.draft, uploadCheckpoint: undefined } }, ports)
    ).resolves.toMatchObject({ kind: "awaiting-confirmation", jobId: retained.id });
    confirmed = true;
    await expect(submitWork(command, ports)).resolves.toMatchObject({
      kind: "direct",
      txHash: hash,
    });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("keeps admin offline and unsent network failures out of queued-success outcomes", async () => {
    const { command, ports, send } = fixture();
    command.allowOfflineQueue = false;
    command.retainSubmission = true;
    ports.connectivity.confirm = async () => false;
    await expect(submitWork(command, ports)).rejects.toThrow("Offline queue is disabled");
    expect(send).not.toHaveBeenCalled();
    const jobs = await jobQueueDB.getJobs({ userAddress: command.userAddress! });
    expect(
      jobs.some((job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId)
    ).toBe(false);
    ports.connectivity.confirm = async () => true;
    ports.direct.submitWork = vi.fn().mockRejectedValue(new Error("Network request failed"));
    await expect(submitWork(command, ports)).rejects.toThrow("Network request failed");
    const pending = await jobQueueDB.getJobs({ userAddress: command.userAddress!, synced: false });
    expect(
      pending.find((job) => (job.payload as WorkJobPayload).clientWorkId === command.clientWorkId)
        ?.meta?.requiresExplicitSend
    ).toBe(true);
  });
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

    let whileSending: string | null | undefined;
    ports.direct.submitWork = vi.fn(async (input: SubmitWorkCommand) => {
      // The Submit that is sending the work answers for its own draft.
      whileSending = await deleteDraftOfQueuedWork(job, "retire");
      return send(input);
    });
    await expect(submitWork(command, ports)).resolves.toMatchObject({
      kind: "direct",
      txHash: hash,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(whileSending).toBeNull();
    // Sent: the queue let go of it. The draft is the composer's to retire, and with nothing
    // queued to remove it through, it is listed again and never left out of reach.
    expect(await queued()).toEqual([]);
    expect(await listedDrafts()).toHaveLength(1);
    // Work sent from Your Work has no composer: the queue's report retires its draft.
    expect(await deleteDraftOfQueuedWork(job, "retire")).toBe("removed");
    expect(await draftDB.getDraft(draftId)).toBeUndefined();
  });

  it.each([
    {
      saved: "only moved to another step",
      change: { currentStep: "details" as const },
      kept: false,
    },
    { saved: "changed the work", change: { feedback: "Watered the east bed too" }, kept: true },
    {
      saved: "changed the work and was declined again",
      change: { feedback: "Watered the east bed too" },
      askedAgain: true,
      kept: true,
    },
  ])("keeps the draft of work sent from Your Work when the wizard $saved after the decline: $kept", async ({
    change,
    askedAgain,
    kept,
  }) => {
    const { command, ports, draftId, queued, wizardSaves } = await declinedWalletWork();
    await wizardSaves(change);
    // Asking again does not refresh the queued work, so it still holds the first version.
    if (askedAgain) await expect(submitWork(command, ports)).rejects.toThrow();
    const [job] = await queued();

    // Upload all sends the work as it was queued. A draft that holds more than that was not sent.
    expect(await deleteDraftOfQueuedWork(job, "retire")).toBe(kept ? "kept" : "removed");
    expect((await draftDB.getDraft(draftId))?.feedback).toBe(kept ? change.feedback : undefined);
    expect(await draftDB.getImagesForDraft(draftId)).toHaveLength(kept ? 1 : 0);
  });

  it("discards declined work as one act: its draft and both sets of attachments, then the work", async () => {
    const { draftId, queued, listedDrafts } = await declinedWalletWork();
    const [job] = await queued();
    const discard = () =>
      jobQueue.discardJob(job.id, async (work) => {
        await deleteDraftOfQueuedWork(work, "discard");
      });

    // A draft that cannot be removed stops the discard before the queued work is touched.
    const blocked = vi.spyOn(draftDB, "deleteDraft").mockRejectedValueOnce(new Error("blocked"));
    await expect(discard()).rejects.toThrow("blocked");
    blocked.mockRestore();
    expect(await queued()).toHaveLength(1);
    expect(await draftDB.getDraft(draftId)).toBeDefined();

    expect(await discard()).toBe(true);
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

  it("turns declined work back into a draft when the wizard changes it, and Submit then sends that version once", async () => {
    const { command, ports, send, draftId, queued, listedDrafts, wizardSaves } =
      await declinedWalletWork();
    const [first] = await queued();
    const changed = "Watered the east bed too";

    // A save that only moves between steps leaves the queued work where it is.
    const moved = await wizardSaves({ currentStep: "details" });
    expect(await returnChangedWorkToDraft(moved, jobQueue)).toBe(false);
    expect(await queued()).toHaveLength(1);

    // The draft takes the copy's upload record before the copy goes. While that write fails
    // the copy stays, because the draft still holds the declined prompt's send intent.
    const edited = await wizardSaves({ feedback: changed });
    const blocked = vi.spyOn(draftDB, "updateDraft").mockRejectedValueOnce(new Error("blocked"));
    await expect(returnChangedWorkToDraft(edited, jobQueue)).rejects.toThrow("blocked");
    blocked.mockRestore();
    expect(await queued()).toHaveLength(1);

    // Another tab preparing the copy holds its claim. The copy is still unsent, so this is not
    // "nothing to take back": it rejects, and the save that asked does not count as done.
    expect(await jobQueueDB.acquireExecutionClaim([first.id], "another-tab")).toBe(true);
    await expect(returnChangedWorkToDraft(edited, jobQueue)).rejects.toThrow("queued-copy-held");
    expect(await queued()).toHaveLength(1);
    await jobQueueDB.releaseExecutionClaim([first.id], "another-tab");

    expect(await returnChangedWorkToDraft(edited, jobQueue)).toBe(true);
    // No first version is left to upload from Your Work: the work is one draft again.
    expect(await queued()).toEqual([]);
    expect(await jobQueueDB.getImagesForJob(first.id)).toEqual([]);
    expect(await listedDrafts()).toHaveLength(1);
    expect(await draftDB.getImagesForDraft(draftId)).toHaveLength(1);

    // Submit queues the work as it now stands and sends it. The declined prompt's send
    // intent stayed with the discarded copy, so this is a send, not a wait for the old one.
    const draft = (await draftDB.getDraft(draftId))!;
    command.draft.feedback = changed;
    Object.assign(
      command,
      await createDraftUploadPersistence(draft, command.draft, { current: null })
    );
    ports.direct.submitWork = send;
    await expect(submitWork(command, ports)).resolves.toMatchObject({ kind: "direct" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].draft.feedback).toBe(changed);
  });

  it("leaves a queued copy that may have been sent, and keeps the changed draft when it lands", async () => {
    const { queued, wizardSaves } = await declinedWalletWork();
    const [job] = await queued();
    await jobQueueDB.amendJob(job.id, (stored) => {
      (stored.payload as WorkJobPayload).uploadCheckpoint = {
        submittedAt: new Date().toISOString(),
        files: {},
        transactionHash: hash,
      };
    });

    const changed = await wizardSaves({ feedback: "Watered the east bed too" });
    expect(await returnChangedWorkToDraft(changed, jobQueue)).toBe(false);

    const [sent] = await queued();
    expect(sent.id).toBe(job.id);
    expect(await deleteDraftOfQueuedWork(sent, "retire")).toBe("kept");
  });

  it("sends the changed work when a passkey Submit asks again after a decline", async () => {
    const { command, ports } = fixture();
    command.authMode = "passkey";
    ports.sender = createMockTransactionSender();
    const draftId = crypto.randomUUID();
    const wizardSaves = (feedback: string) =>
      draftDB.saveSnapshot(
        command.userAddress!,
        command.chainId,
        draftId,
        { gardenAddress: command.gardenAddress, actionUID: 1, feedback },
        [],
        []
      );
    const retained = { current: null };
    // As the wizard does: save, which returns changed work to its draft, then Submit.
    const submit = async (feedback: string) => {
      command.draft.feedback = feedback;
      await returnChangedWorkToDraft(await wizardSaves(feedback), jobQueue);
      const record = (await draftDB.getDraft(draftId))!;
      Object.assign(command, await createDraftUploadPersistence(record, command.draft, retained));
      return submitWork(command, ports);
    };
    const sent: string[] = [];
    ports.queue.process = vi
      .fn()
      .mockImplementationOnce(async (jobId: string) => {
        const job = (await jobQueueDB.getJob(jobId))!;
        await jobQueueDB.updateJob({ ...job, meta: { ...job.meta, requiresExplicitSend: true } });
        return { success: false, error: "send-cancelled", skipped: true };
      })
      .mockImplementationOnce(async (jobId: string) => {
        sent.push(((await jobQueueDB.getJob(jobId))!.payload as WorkJobPayload).feedback);
        return { success: true, txHash: hash };
      });

    await expect(submit("Watered the seedlings")).rejects.toMatchObject({ code: 4001 });
    await expect(submit("Watered the east bed too")).resolves.toMatchObject({ kind: "processed" });

    expect(sent).toEqual(["Watered the east bed too"]);
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
