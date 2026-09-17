/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EASConfig } from "../../../config/blockchain";
import { TransactionRevertedError, type ContractCall } from "../../../modules/transactions/types";
import { SimulationRejected } from "../../../modules/work/simulation-rejected";
import {
  uploadQueuedWork,
  type UploadQueuedWorkPorts,
} from "../../../modules/work/upload-queued-work";
import { retainedWorkBroadcast } from "../../../modules/work/work-confirmation";
import type { Job, SendCheckpoint, WorkJobPayload } from "../../../types/job-queue";
import { createMockTransactionSender } from "../../test-utils/transaction-fakes";

vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: {} }));
vi.mock("../../../modules/job-queue/job-media-conversion", () => ({
  convertQueuedHeicMedia: vi.fn(),
}));

const USER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x2222222222222222222222222222222222222222";
const OPERATION = `0x${"cd".repeat(32)}` as const;
const TX = `0x${"ab".repeat(32)}` as const;
const EAS_CONFIG = {
  EAS: { address: "0x5555555555555555555555555555555555555555" },
  WORK: { uid: `0x${"66".repeat(32)}`, schema: "" },
  WORK_APPROVAL: { uid: `0x${"77".repeat(32)}`, schema: "" },
  ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
  ASSESSMENT_V3: { uid: `0x${"00".repeat(32)}`, schema: "" },
  SCHEMA_REGISTRY: { address: "0x8888888888888888888888888888888888888888" },
} satisfies EASConfig;
const READY = { preparation: { status: "ready", checkedAt: "2026-09-17T09:00:00.000Z" } };

let sequence = 0;
function work(meta: Job["meta"] = READY): Job {
  sequence += 1;
  return {
    id: `work-${sequence}`,
    kind: "work",
    chainId: 42161,
    userAddress: USER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    meta,
    payload: {
      actionUID: 1,
      gardenAddress: GARDEN,
      feedback: `work ${sequence}`,
      title: "Weeding",
      clientWorkId: `client-${sequence}`,
      uploadCheckpoint: { submittedAt: "2026-09-17T09:00:00.000Z", files: {} },
    },
  } as Job;
}

function decision(): Job {
  sequence += 1;
  return {
    id: `decision-${sequence}`,
    kind: "approval",
    chainId: 42161,
    userAddress: USER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    meta: READY,
    payload: {
      actionUID: 1,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: GARDEN,
      gardenerAddress: USER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    },
  } as Job;
}

function harness(jobs: Job[], overrides: Partial<UploadQueuedWorkPorts> = {}) {
  const store = new Map(jobs.map((job) => [job.id, structuredClone(job)]));
  const released = vi.fn();
  const resumed = vi.fn();
  const ports: UploadQueuedWorkPorts = {
    confirmOnline: vi.fn(async () => true),
    suspendPreparation: vi.fn(() => resumed),
    listJobs: async () => [...store.values()].map((job) => structuredClone(job)),
    getJob: async (id) => structuredClone(store.get(id)),
    acquire: async (ids) =>
      new Map(ids.map((id) => [id, { token: id, assertOwned: vi.fn(), release: released }])),
    hold: () => () => undefined,
    save: vi.fn(async (_claim, id, amend) => {
      const stored = store.get(id);
      if (!stored) throw new Error("submission-ownership-changed");
      amend(stored);
    }),
    images: async () => [],
    encodeWork: vi.fn(async (draft) => `0x${Buffer.from(draft.feedback).toString("hex")}` as const),
    encodeApproval: vi.fn(() => `0x${"ee".repeat(8)}` as const),
    easConfig: () => EAS_CONFIG,
    simulate: vi.fn(async () => undefined),
    processJob: vi.fn(async () => ({ success: true, txHash: TX })),
    now: () => Date.parse("2026-09-17T10:00:00.000Z"),
    ...overrides,
  };
  return { ports, store, released, resumed };
}

const sendOf = (store: Map<string, Job>, id: string): SendCheckpoint | undefined => {
  const job = store.get(id)!;
  return job.kind === "work"
    ? (job.payload as WorkJobPayload).uploadCheckpoint
    : (job.payload as { sendCheckpoint?: SendCheckpoint }).sendCheckpoint;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Upload all", () => {
  it("refuses on an unconfirmed connection before claiming anything", async () => {
    const { ports } = harness([work()], { confirmOnline: vi.fn(async () => false) });
    const sender = createMockTransactionSender();

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "connection-unconfirmed",
    });
    expect(ports.suspendPreparation).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("sends every ready work and decision as one UserOperation, recording the send on each first", async () => {
    const jobs = [work(), work(), decision()];
    const { ports, store, released, resumed } = harness(jobs);
    const sender = createMockTransactionSender();
    const recordedBeforeSend: Array<SendCheckpoint | undefined> = [];
    vi.mocked(sender.sendContractCall).mockImplementation(async (call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      recordedBeforeSend.push(...jobs.map(({ id }) => sendOf(store, id)));
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
      await options?.onBroadcast?.(TX);
      expect(call.functionName).toBe("multiAttest");
      return { hash: TX, sponsored: true };
    });

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "uploaded",
      sent: 3,
      flagged: 0,
    });

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    const [call] = vi.mocked(sender.sendContractCall).mock.calls[0];
    expect(
      (call.args[0] as Array<{ schema: string; data: unknown[] }>).map((group) => [
        group.schema,
        group.data.length,
      ])
    ).toEqual([
      [EAS_CONFIG.WORK.uid, 2],
      [EAS_CONFIG.WORK_APPROVAL.uid, 1],
    ]);
    // Every item carried the intent before the operation could reach the network.
    expect(recordedBeforeSend).toEqual(
      jobs.map(() =>
        expect.objectContaining({
          broadcastPending: true,
          broadcast: { kind: "user-operation", hash: OPERATION },
        })
      )
    );
    for (const { id } of jobs) {
      expect(sendOf(store, id)).toMatchObject({ transactionHash: TX, broadcastPending: false });
      expect(ports.processJob).toHaveBeenCalledWith(id, {
        transactionSender: sender,
        explicit: true,
      });
    }
    expect(released).toHaveBeenCalledTimes(3);
    expect(resumed).toHaveBeenCalledOnce();
  });

  it("sends a wallet's items as one transaction, and splits a long queue into calls within the limit", async () => {
    const wallet = harness(Array.from({ length: 12 }, () => work()));
    const walletSender = createMockTransactionSender({ authMode: "wallet" });

    await uploadQueuedWork(
      { userAddress: USER, chainId: 42161, sender: walletSender },
      wallet.ports
    );
    expect(walletSender.sendContractCall).toHaveBeenCalledTimes(2);

    const passkey = harness(Array.from({ length: 7 }, () => work()));
    const passkeySender = createMockTransactionSender();
    await uploadQueuedWork(
      { userAddress: USER, chainId: 42161, sender: passkeySender },
      passkey.ports
    );
    const sizes = vi
      .mocked(passkeySender.sendContractCall)
      .mock.calls.map(
        ([call]) => (call.args[0] as Array<{ data: unknown[] }>)[0]?.data?.length ?? 1
      );
    expect(sizes).toEqual([5, 2]);
  });

  it("sends only ready items", async () => {
    const ready = work();
    const blocked = work({
      preparation: { status: "blocked", reason: "ActionExpired", checkedAt: "x" },
    });
    const preparing = work({});
    const { ports } = harness([ready, blocked, preparing]);
    const sender = createMockTransactionSender();

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toMatchObject({
      status: "uploaded",
      sent: 1,
    });
    expect(sender.sendContractCall.mock.calls[0][0].functionName).toBe("attest");
  });

  it("flags the item the chain refuses and sends the rest", async () => {
    const [good, ended] = [work(), work()];
    const { ports, store } = harness([good, ended], {
      simulate: vi.fn(async (call: ContractCall) => {
        const refused =
          call.functionName === "multiAttest" ||
          JSON.stringify(call.args, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value
          ).includes(Buffer.from((ended.payload as WorkJobPayload).feedback).toString("hex"));
        if (refused) throw new SimulationRejected("Action ended", "ActionExpired", true);
      }),
    });
    const sender = createMockTransactionSender();

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "uploaded",
      sent: 1,
      flagged: 1,
    });
    expect(store.get(ended.id)?.meta?.preparation).toMatchObject({
      status: "blocked",
      reason: "ActionExpired",
    });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("sends nothing when the upload check cannot reach the chain", async () => {
    const { ports } = harness([work(), work()], {
      simulate: vi.fn(async () => {
        throw new SimulationRejected("Check failed", "unknown", false);
      }),
    });
    const sender = createMockTransactionSender();

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toMatchObject({
      status: "failed",
    });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("clears the send when the call reverts, flags what the chain now refuses, and keeps the rest ready", async () => {
    const [good, ended] = [work(), work()];
    let sent = false;
    const { ports, store } = harness([good, ended], {
      simulate: vi.fn(async (call: ContractCall) => {
        const endedData = Buffer.from((ended.payload as WorkJobPayload).feedback).toString("hex");
        const carriesEnded = JSON.stringify(call.args, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v
        ).includes(endedData);
        if (sent && call.functionName === "attest" && carriesEnded)
          throw new SimulationRejected("Action ended", "ActionExpired", true);
      }),
    });
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
      sent = true;
      throw new TransactionRevertedError(OPERATION, "UserOperation execution reverted");
    });

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "reverted",
      sent: 0,
      flagged: 1,
    });
    for (const { id } of [good, ended]) {
      expect(sendOf(store, id)).not.toHaveProperty("broadcast");
      expect(sendOf(store, id)).not.toHaveProperty("broadcastPending");
      expect(retainedWorkBroadcast(id)).toBeUndefined();
    }
    expect(store.get(good.id)?.meta?.preparation).toMatchObject({ status: "ready" });
    expect(ports.processJob).not.toHaveBeenCalled();
  });

  it("clears the intent and stops when the person declines", async () => {
    const [first, second] = [work(), work()];
    const { ports, store } = harness([first, second]);
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    });

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "declined",
      sent: 0,
      flagged: 0,
    });
    expect(sendOf(store, first.id)).not.toHaveProperty("broadcastPending");
    expect(store.get(first.id)?.meta?.preparation).toMatchObject({ status: "ready" });
  });

  it("keeps the recorded send when the answer is lost, for the queue to confirm", async () => {
    const item = work();
    const { ports, store } = harness([item]);
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      throw Object.assign(new Error("The request took too long"), { name: "TimeoutError" });
    });

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toMatchObject({
      status: "send-unconfirmed",
    });
    expect(sendOf(store, item.id)).toMatchObject({
      broadcastPending: true,
      broadcast: { kind: "user-operation", hash: OPERATION },
    });
  });

  it("sends an embedded wallet's items one at a time through the queue", async () => {
    const jobs = [work(), decision()];
    const { ports } = harness(jobs);
    const sender = createMockTransactionSender({ authMode: "embedded" });

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "uploaded",
      sent: 2,
      flagged: 0,
    });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(ports.processJob).toHaveBeenCalledTimes(2);
  });

  it("reports nothing to upload", async () => {
    const { ports } = harness([work({})]);
    const sender = createMockTransactionSender();

    await expect(
      uploadQueuedWork({ userAddress: USER, chainId: 42161, sender }, ports)
    ).resolves.toEqual({
      status: "nothing-ready",
    });
  });
});
