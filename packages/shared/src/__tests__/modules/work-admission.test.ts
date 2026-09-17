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
import type { WorkJobPayload } from "../../types/job-queue";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { jobQueueDB } from "../../modules/job-queue/db";

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
  ports.connectivity = { isOnline: () => true };
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
describe("PWA durable submission boundary", () => {
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
