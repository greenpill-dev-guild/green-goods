/**
 * @vitest-environment node
 */

/**
 * What a person watching one send is told, and what they can never change.
 *
 * Every send reports its stage on the queue's `job:stage` event, for any screen
 * that shows the job (PRD-1552), and to `onPhase` when the caller asked. Reports
 * come after the executor's own checkpoints, and one that throws is logged and
 * ignored. Only a wallet reports the wallet stage. The queue's receipt limit
 * reaches every send, and a wait that ran out of it is recorded.
 */

import { describe, expect, it, vi } from "vitest";
import type { JobQueueDependencies, JobSendPhase } from "../../modules/job-queue/ports";
import {
  sendRecordedAct,
  waitingForRecordedSend,
} from "../../modules/job-queue/commitment-send-record";
import { createJobQueue } from "../../modules/job-queue/queue";
import { hasRecordedSend, sendCheckpointOf } from "../../modules/job-queue/queue-policy";
import { BatchConfirmationPendingError } from "../../modules/transactions/batch-types";
import type { TransactionSender, TransactionSendOptions } from "../../modules/transactions/types";
import type { Job } from "../../types/job-queue";
import {
  createInMemoryJobQueueStore,
  createJobQueueDependencies,
} from "../test-utils/job-queue-fakes";

const USER = "0x1111111111111111111111111111111111111111";

function queuedJob(): Job {
  return {
    id: "job-1",
    kind: "commitment",
    payload: {},
    userAddress: USER,
    chainId: 42161,
    createdAt: 1,
    attempts: 0,
    synced: false,
  } as Job;
}

function setup(overrides: Partial<JobQueueDependencies> = {}) {
  const deps = createJobQueueDependencies(overrides);
  return { deps, queue: createJobQueue(deps) };
}

describe("send phase reports", () => {
  /** An executor that sends one call with checkpoints of its own, as the commitment executor does. */
  function sendingExecutor(checkpoints: TransactionSendOptions) {
    return {
      execute: vi.fn(
        async (_jobId: string, _job: Job, _chainId: number, sender: TransactionSender) => {
          const { hash } = await sender.sendContractCall({} as never, checkpoints);
          return { status: "complete" as const, txHash: hash };
        }
      ),
    };
  }

  /** A sender that asks, then broadcasts, calling the options in the order a real send does. */
  function walletSender(authMode: TransactionSender["authMode"] = "wallet") {
    const sendContractCall = vi.fn(async (_call: unknown, options: TransactionSendOptions = {}) => {
      await options.onBeforeBroadcast?.();
      await options.onBroadcast?.("0xsent");
      return { hash: "0xsent" as const, sponsored: false };
    });
    return {
      sender: { authMode, sendContractCall } as unknown as TransactionSender,
      sendContractCall,
    };
  }

  /** The stages the queue told every screen, in order. */
  function stagesSeen(deps: JobQueueDependencies) {
    return vi
      .mocked(deps.events.emit)
      .mock.calls.filter(([type]) => type === "job:stage")
      .map(([, data]) => (data as { stage: string | null }).stage);
  }

  it("reports the wallet, then the chain, each after the executor's own checkpoint", async () => {
    const order: string[] = [];
    const executors = sendingExecutor({
      onBeforeBroadcast: async () => {
        order.push("checkpoint: before");
      },
      onBroadcast: async (hash) => {
        order.push(`checkpoint: ${hash}`);
      },
    });
    const { queue } = setup({ store: createInMemoryJobQueueStore([queuedJob()]), executors });
    const onPhase = (phase: JobSendPhase) =>
      order.push(phase.stage === "confirming" ? `phase: ${phase.txHash}` : `phase: ${phase.stage}`);

    await expect(
      queue.processJob("job-1", { transactionSender: walletSender().sender, onPhase })
    ).resolves.toEqual({ success: true, txHash: "0xsent" });
    expect(order).toEqual([
      "checkpoint: before",
      "phase: wallet",
      "checkpoint: 0xsent",
      "phase: 0xsent",
    ]);
  });

  it("never lets a report that throws stop the send", async () => {
    const { deps, queue } = setup({
      store: createInMemoryJobQueueStore([queuedJob()]),
      executors: sendingExecutor({}),
    });
    const onPhase = vi.fn(() => {
      throw new Error("the view is gone");
    });

    await expect(
      queue.processJob("job-1", { transactionSender: walletSender().sender, onPhase })
    ).resolves.toEqual({ success: true, txHash: "0xsent" });
    expect(onPhase).toHaveBeenCalledTimes(2);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      "[JobQueue] a send phase report threw",
      expect.objectContaining({ jobId: "job-1", error: "the view is gone" })
    );
  });

  it("lets a checkpoint that fails to save stop the send before anything is reported", async () => {
    const executors = sendingExecutor({
      onBeforeBroadcast: async () => {
        throw new Error("checkpoint not saved");
      },
    });
    const { queue } = setup({ store: createInMemoryJobQueueStore([queuedJob()]), executors });
    const onPhase = vi.fn();

    await expect(
      queue.processJob("job-1", { transactionSender: walletSender().sender, onPhase })
    ).resolves.toMatchObject({ success: false, error: "checkpoint not saved" });
    expect(onPhase).not.toHaveBeenCalled();
  });

  // Upload all, the background flush and a tap that wired nothing all show where a send stands.
  it("tells every screen each send's stage, though nobody passed onPhase, and lets go at the end", async () => {
    const checkpoints = {
      onBeforeBroadcast: vi.fn(async () => undefined),
      onBroadcast: vi.fn(async () => undefined),
    };
    const { deps, queue } = setup({
      store: createInMemoryJobQueueStore([queuedJob()]),
      executors: sendingExecutor(checkpoints),
    });

    await expect(
      queue.processJob("job-1", { transactionSender: walletSender().sender })
    ).resolves.toEqual({ success: true, txHash: "0xsent" });
    expect(stagesSeen(deps)).toEqual(["wallet", "confirming", null]);
    expect(checkpoints.onBeforeBroadcast).toHaveBeenCalledOnce();
    expect(checkpoints.onBroadcast).toHaveBeenCalledWith("0xsent");
    // Let go only once the job completed: between the two, a row would read as sent and stuck.
    const order = vi.mocked(deps.events.emit).mock.calls.map(([type]) => type);
    expect(order.indexOf("job:completed")).toBeGreaterThanOrEqual(0);
    expect(order.lastIndexOf("job:stage")).toBeGreaterThan(order.indexOf("job:completed"));
  });

  it("lets go of a try that stopped before any stage, so no row stays under way", async () => {
    const { deps, queue } = setup({
      store: createInMemoryJobQueueStore([queuedJob()]),
      executors: {
        execute: vi.fn(async () => {
          throw new Error("submission-ownership-changed");
        }),
      },
    });

    await queue.processJob("job-1", { transactionSender: walletSender().sender });
    expect(stagesSeen(deps)).toEqual([null]);
  });

  it("says the wallet stage only for a wallet, since a passkey or an embedded wallet asks nobody then", async () => {
    for (const authMode of ["passkey", "embedded"] as const) {
      const { deps, queue } = setup({
        store: createInMemoryJobQueueStore([queuedJob()]),
        executors: sendingExecutor({}),
      });
      const onPhase = vi.fn();

      await queue.processJob("job-1", {
        transactionSender: walletSender(authMode).sender,
        onPhase,
      });
      expect(stagesSeen(deps)).toEqual(["confirming", null]);
      expect(onPhase.mock.calls).toEqual([[{ stage: "confirming", txHash: "0xsent" }]]);
    }
  });

  it("limits the receipt wait of every send, a creation's too (PRD-1551)", async () => {
    // A creation keeps the transaction the limit names instead of a send record.
    for (const kind of ["claim", "commitment"] as const) {
      const { queue } = setup({
        store: createInMemoryJobQueueStore([{ ...queuedJob(), kind }]),
        executors: sendingExecutor({}),
      });
      const wallet = walletSender();

      await queue.processJob("job-1", { transactionSender: wallet.sender });
      expect(wallet.sendContractCall.mock.calls[0]?.[1]?.receiptWaitLimitMs).toBe(120_000);
    }
  });

  // A Safe's wallet answers with the proposal's own hash, which no receipt follows (PRD-1564).
  it("says a Safe's proposal waits for the Safe's signers, keeps that on record, and never sends it again", async () => {
    const SAFE_TX = `0x${"5a".repeat(32)}` as const;
    const store = createInMemoryJobQueueStore([{ ...queuedJob(), kind: "claim" }]);
    // As the commitment executor does: send through the record, or settle what is on it.
    const executors = {
      execute: vi.fn(async (jobId: string, job: Job, _chainId: number, s: TransactionSender) => {
        if (hasRecordedSend(job))
          return { status: "waiting" as const, reason: "awaiting-confirmation" };
        try {
          const txHash = await sendRecordedAct(jobId, job, {} as never, s, store as never);
          return { status: "complete" as const, txHash };
        } catch (error) {
          const waiting = waitingForRecordedSend(error);
          if (waiting) return waiting;
          throw error;
        }
      }),
    };
    // The order the wallet sender keeps for a Safe (`wallet-sender`).
    const sendContractCall = vi.fn(async (_call: unknown, options: TransactionSendOptions = {}) => {
      await options.onBeforeBroadcast?.();
      await options.onBroadcast?.(SAFE_TX);
      options.onAwaiting?.("safe-signers");
      return {
        hash: SAFE_TX,
        sponsored: false,
        confirmation: "pending" as const,
        awaiting: "safe-signers" as const,
      };
    });
    const sender = { authMode: "wallet", sendContractCall } as unknown as TransactionSender;
    const { deps, queue } = setup({ store, executors });
    const onPhase = vi.fn();

    const settled = { success: false, skipped: true, error: "awaiting-confirmation" };
    await expect(
      queue.processJob("job-1", { transactionSender: sender, explicit: true, onPhase })
    ).resolves.toEqual(settled);
    expect(stagesSeen(deps)).toEqual(["wallet", "confirming", "safe-signers", null]);
    expect(onPhase).toHaveBeenLastCalledWith({ stage: "safe-signers" });
    expect(sendCheckpointOf(store.jobs.get("job-1")!)).toMatchObject({
      transactionHash: SAFE_TX,
      awaiting: "safe-signers",
    });

    // The queue settles it as before: from its record, without asking the wallet again.
    await expect(
      queue.processJob("job-1", { transactionSender: sender, explicit: true })
    ).resolves.toEqual(settled);
    expect(sendContractCall).toHaveBeenCalledOnce();
  });

  it("records a send whose wallet batch outlasted its status wait, as it records a receipt", async () => {
    // A proof and its send go out as one wallet batch; its status wait ran out (PRD-1551).
    const { deps, queue } = setup({
      store: createInMemoryJobQueueStore([{ ...queuedJob(), kind: "confirmation" }]),
      executors: sendingExecutor({}),
    });
    const sendContractCall = vi.fn(async () => {
      throw new BatchConfirmationPendingError({
        status: "unresolved",
        receipts: [],
        sponsored: false,
        waitLimitMs: 120_000,
      });
    });
    const sender = { sendContractCall, authMode: "wallet" } as unknown as TransactionSender;

    await queue.processJob("job-1", { transactionSender: sender, explicit: true });
    expect(deps.analytics.receiptWaitLimitReached).toHaveBeenCalledWith("confirmation", {
      limitMs: 120_000,
      explicit: true,
      authMode: "wallet",
    });
    expect(deps.logger.warn).toHaveBeenCalledWith(
      "[JobQueue] A send's receipt did not come within its limit",
      { jobId: "job-1", kind: "confirmation", limitMs: 120_000 }
    );
  });
});
