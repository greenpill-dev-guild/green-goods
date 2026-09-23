/**
 * @vitest-environment node
 */

/**
 * What a person watching one send is told, and what they can never change.
 *
 * `onPhase` is report-only: it hears the wallet being asked and the broadcast,
 * after the executor's own checkpoints, and a report that throws is logged and
 * ignored. Without it the executor's send options reach the wallet untouched.
 */

import { describe, expect, it, vi } from "vitest";
import type { JobQueueDependencies, JobSendPhase } from "../../modules/job-queue/ports";
import { createJobQueue } from "../../modules/job-queue/queue";
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

  /** A wallet that asks, then broadcasts, calling the options in the order a real send does. */
  function walletSender() {
    const sendContractCall = vi.fn(async (_call: unknown, options: TransactionSendOptions = {}) => {
      await options.onBeforeBroadcast?.();
      await options.onBroadcast?.("0xsent");
      return { hash: "0xsent" as const, sponsored: false };
    });
    return { sender: { sendContractCall } as unknown as TransactionSender, sendContractCall };
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
      order.push(phase.stage === "wallet" ? "phase: wallet" : `phase: ${phase.txHash}`);

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

  it("hands the executor's checkpoints over untouched when nobody asked for reports", async () => {
    const checkpoints = {
      onBeforeBroadcast: vi.fn(async () => undefined),
      onBroadcast: vi.fn(async () => undefined),
    };
    const { queue } = setup({
      store: createInMemoryJobQueueStore([queuedJob()]),
      executors: sendingExecutor(checkpoints),
    });
    const wallet = walletSender();

    await queue.processJob("job-1", { transactionSender: wallet.sender });
    const options = wallet.sendContractCall.mock.calls[0]?.[1];
    expect(options?.onBeforeBroadcast).toBe(checkpoints.onBeforeBroadcast);
    expect(options?.onBroadcast).toBe(checkpoints.onBroadcast);
  });
});
