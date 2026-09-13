/** @vitest-environment node */
import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import {
  createDefaultSubmitWorkPorts,
  submitWork,
  type SubmitWorkCommand,
} from "../../modules/work/submit-work-command";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { jobQueueDB } from "../../modules/job-queue/db";
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
