import { queuedOutcome, submitAdmittedWork } from "./admitted-submission";
import { connectivityStore } from "../../stores/connectivity";
import { jobQueueDB } from "../job-queue/db";
import { createOfflineTxHash } from "../job-queue/queue-policy";
import {
  AwaitingWorkConfirmation,
  WorkTransactionReverted,
  reconcileWorkTransaction,
  isNetworkError,
} from "./work-confirmation";
export { isNetworkError } from "./work-confirmation";
import { getActionTitle } from "../../utils/action/parsers";
import type { Action, Address, Work, WorkDraft, WorkUploadCheckpoint } from "../../types/domain";
import type { JobQueueHandle, ProcessJobResult } from "../job-queue/ports";
import type { TransactionSender } from "../transactions/types";
import type { SimulateWorkSubmissionParams, SimulationDeps } from "./simulate";
import { type WalletSubmissionStage } from "./wallet-submission/types";

export interface SubmitWorkCommand {
  assertOwnership?: () => void | Promise<void>;
  onBroadcast?: (hash: `0x${string}`) => Promise<void>;
  onCheckpoint?: (checkpoint: WorkUploadCheckpoint) => Promise<void>;
  /** Supplied by a resumed journey; otherwise generated once before choosing a transport. */
  clientWorkId?: string;
  authMode: "wallet" | "passkey" | "embedded" | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  actions: Action[];
  userAddress: Address | null;
  chainId: number;
  draft: WorkDraft;
  images: File[];
  allowOfflineQueue: boolean;
}

export interface ResolvedSubmitWorkCommand extends SubmitWorkCommand {
  clientWorkId: string;
  gardenAddress: Address;
  actionUID: number;
  userAddress: Address;
}

export interface QueuedWorkSubmission {
  newlyAdmitted?: boolean;
  txHash: `0x${string}`;
  jobId: string;
  clientWorkId: string;
}

export interface SubmitWorkPorts {
  reconcile?: typeof reconcileWorkTransaction;
  newClientWorkId?: () => string;
  connectivity: { isOnline: () => boolean };
  clock: { now: () => number };
  simulate: (input: SimulateWorkSubmissionParams) => Promise<void>;
  queue: {
    /** Durable admission is required by the PWA runtime; injected legacy ports may omit it. */
    admit?: (input: ResolvedSubmitWorkCommand) => Promise<QueuedWorkSubmission>;
    enqueue: (input: ResolvedSubmitWorkCommand) => Promise<QueuedWorkSubmission>;
    process: (
      jobId: string,
      sender: TransactionSender,
      assertOwnership?: SubmitWorkCommand["assertOwnership"]
    ) => Promise<ProcessJobResult>;
  };
  direct: {
    submitWork: (
      input: ResolvedSubmitWorkCommand,
      onProgress?: (stage: WalletSubmissionStage, message: string) => void
    ) => Promise<`0x${string}`>;
  };
  sender: TransactionSender | null;
  onWalletStage?: (stage: WalletSubmissionStage, message: string) => void;
  onQueueFallback?: (optimistic: Work) => void | Promise<void>;
}

export type SubmitWorkOutcome =
  | { kind: "direct"; txHash: `0x${string}`; sponsored: false; clientWorkId: string }
  | {
      kind: "queued" | "awaiting-confirmation";
      txHash: `0x${string}`;
      sponsored: boolean;
      jobId: string;
      clientWorkId: string;
    }
  | {
      kind: "processed";
      txHash: `0x${string}`;
      sponsored: boolean;
      jobId: string;
      clientWorkId: string;
    };

export interface DefaultSubmitWorkPortOptions {
  sender: TransactionSender | null;
  jobQueue?: Pick<JobQueueHandle, "processJob">;
  simulationDeps?: SimulationDeps;
  onWalletStage?: SubmitWorkPorts["onWalletStage"];
  onQueueFallback?: SubmitWorkPorts["onQueueFallback"];
}

function resolveCommand(command: SubmitWorkCommand): ResolvedSubmitWorkCommand {
  if (!command.gardenAddress) {
    throw new Error("Garden must be selected before submitting work");
  }
  if (typeof command.actionUID !== "number") {
    throw new Error("Action must be selected before submitting work");
  }
  if (!command.userAddress) {
    throw new Error("User address is required for work submission");
  }
  return command as ResolvedSubmitWorkCommand;
}

export function buildOptimisticWork(
  command: SubmitWorkCommand,
  clock: SubmitWorkPorts["clock"]
): Work {
  const resolved = resolveCommand(command);
  const now = clock.now();
  const actionTitle = getActionTitle(resolved.actions, resolved.actionUID);
  return {
    id: `0xoffline_optimistic_${now}`,
    title: actionTitle || "",
    actionUID: resolved.actionUID,
    gardenAddress: resolved.gardenAddress,
    gardenerAddress: resolved.userAddress,
    feedback: resolved.draft.feedback || "",
    metadata: JSON.stringify({
      clientWorkId: resolved.clientWorkId,
      details: resolved.draft.details ?? {},
      timeSpentMinutes: resolved.draft.timeSpentMinutes,
    }),
    media: [],
    createdAt: Math.floor(now / 1000),
    status: "pending",
  };
}

export async function submitWork(
  command: SubmitWorkCommand,
  ports: SubmitWorkPorts
): Promise<SubmitWorkOutcome> {
  const resolved = resolveCommand({
    ...command,
    clientWorkId: command.clientWorkId ?? ports.newClientWorkId?.() ?? crypto.randomUUID(),
  });
  if (resolved.allowOfflineQueue && ports.queue.admit) return submitAdmittedWork(resolved, ports);
  const online = ports.connectivity.isOnline();

  const awaitConfirmation = async (): Promise<SubmitWorkOutcome> => {
    if (!resolved.allowOfflineQueue)
      throw new AwaitingWorkConfirmation(resolved.draft.uploadCheckpoint!.transactionHash!);
    const queued = await ports.queue.enqueue(resolved);
    return {
      ...queuedOutcome(queued, ports.sender),
      kind: "awaiting-confirmation",
    } as SubmitWorkOutcome;
  };
  const checkpoint = resolved.draft.uploadCheckpoint;
  if (checkpoint?.transactionHash) {
    if (checkpoint.transactionReverted) {
      delete checkpoint.transactionHash;
      delete checkpoint.transactionReverted;
      await resolved.onCheckpoint?.(checkpoint);
    } else {
      const state = online
        ? await (ports.reconcile ?? reconcileWorkTransaction)(
            checkpoint.transactionHash,
            resolved.chainId
          )
        : "unresolved";
      if (state === "confirmed")
        return {
          kind: "direct",
          txHash: checkpoint.transactionHash,
          sponsored: false,
          clientWorkId: resolved.clientWorkId,
        };
      if (state === "reverted") {
        checkpoint.transactionReverted = true;
        await resolved.onCheckpoint?.(checkpoint);
        throw new WorkTransactionReverted(checkpoint.transactionHash);
      }
      return awaitConfirmation();
    }
  }

  if (resolved.authMode === "wallet") {
    if (!online) {
      if (!resolved.allowOfflineQueue) {
        throw new Error("Offline queue is disabled for this submission surface");
      }
      return queuedOutcome(await ports.queue.enqueue(resolved), ports.sender);
    }

    try {
      const txHash = await ports.direct.submitWork(resolved, ports.onWalletStage);
      return { kind: "direct", txHash, sponsored: false, clientWorkId: resolved.clientWorkId };
    } catch (error) {
      if (error instanceof WorkTransactionReverted) {
        if (resolved.draft.uploadCheckpoint) {
          resolved.draft.uploadCheckpoint.transactionReverted = true;
          await resolved.onCheckpoint?.(resolved.draft.uploadCheckpoint);
        }
        throw error;
      }
      if (
        resolved.draft.uploadCheckpoint?.transactionHash ||
        error instanceof AwaitingWorkConfirmation
      )
        return awaitConfirmation();
      if (!isNetworkError(error)) throw error;
      if (!resolved.allowOfflineQueue) throw error;
      await ports.onQueueFallback?.(buildOptimisticWork(resolved, ports.clock));
      return queuedOutcome(await ports.queue.enqueue(resolved), ports.sender);
    }
  }

  if (!resolved.allowOfflineQueue) {
    throw new Error("Offline queue is disabled for this submission surface");
  }

  const actionTitle = getActionTitle(resolved.actions, resolved.actionUID);
  if (online) {
    await ports.simulate({
      draft: resolved.draft,
      gardenAddress: resolved.gardenAddress,
      actionUID: resolved.actionUID,
      actionTitle: actionTitle || `Action ${resolved.actionUID}`,
      chainId: resolved.chainId,
      images: resolved.images,
      accountAddress: resolved.userAddress,
    });
  }

  const queued = await ports.queue.enqueue(resolved);
  if (online && ports.sender) {
    const processed = await ports.queue.process(queued.jobId, ports.sender);
    // Queue admission is already durable. Failed execution stays in that queue
    // for retry; returning it retires the editable draft instead of enqueueing again.
    if (!processed.success && processed.error && !processed.skipped) {
      return queuedOutcome(queued, ports.sender);
    }
    if (processed.error === "awaiting-confirmation")
      return {
        ...queuedOutcome(queued, ports.sender),
        kind: "awaiting-confirmation",
      } as SubmitWorkOutcome;
    if (processed.success && processed.txHash) {
      return {
        kind: "processed",
        txHash: processed.txHash as `0x${string}`,
        sponsored: ports.sender.supportsSponsorship,
        jobId: queued.jobId,
        clientWorkId: queued.clientWorkId,
      };
    }
  }

  return queuedOutcome(queued, ports.sender);
}

export function createDefaultSubmitWorkPorts(
  options: DefaultSubmitWorkPortOptions
): SubmitWorkPorts {
  return {
    newClientWorkId: () => crypto.randomUUID(),
    connectivity: { isOnline: () => connectivityStore.getSnapshot() },
    clock: { now: () => Date.now() },
    simulate: async (input) => {
      const { simulateWorkSubmission } = await import("./simulate");
      return simulateWorkSubmission(input, options.simulationDeps);
    },
    queue: {
      admit: async (input) => {
        const admissionToken = crypto.randomUUID();
        const { jobQueue } = await import("../job-queue/default-instance");
        const jobId = await jobQueue.addJob(
          "work",
          {
            ...input.draft,
            clientWorkId: input.clientWorkId,
            gardenAddress: input.gardenAddress,
            actionUID: input.actionUID,
            media: input.images,
          },
          input.userAddress,
          {
            chainId: input.chainId,
            clientWorkId: input.clientWorkId,
            authMode: input.authMode,
            admissionToken,
          }
        );
        const job = await jobQueueDB.getJob(jobId);
        return {
          jobId,
          clientWorkId: input.clientWorkId,
          txHash: createOfflineTxHash(jobId),
          newlyAdmitted: job?.meta?.admissionToken === admissionToken,
        };
      },
      enqueue: async (input) => {
        const { submitWorkToQueue } = await import("./work-submission");
        return submitWorkToQueue(
          { ...input.draft },
          input.gardenAddress,
          input.actionUID,
          input.actions,
          input.chainId,
          input.images,
          input.userAddress,
          { newClientWorkId: () => input.clientWorkId }
        );
      },
      process: async (jobId, sender, assertOwnership) => {
        const queue = options.jobQueue ?? (await import("../job-queue")).jobQueue;
        return queue.processJob(jobId, {
          transactionSender: sender,
          ...(assertOwnership ? { assertOwnership } : {}),
        });
      },
    },
    direct: {
      submitWork: async (input, onProgress) => {
        const { submitWorkDirectly } = await import("./wallet-submission");
        return submitWorkDirectly(
          input.draft,
          input.gardenAddress,
          input.actionUID,
          getActionTitle(input.actions, input.actionUID),
          input.chainId,
          input.images,
          {
            onProgress,
            assertOwnership: input.assertOwnership,
            userAddress: input.userAddress,
            clientWorkId: input.clientWorkId,
            checkpoint: input.draft.uploadCheckpoint,
            onCheckpoint: input.onCheckpoint,
            onBroadcast: input.onBroadcast,
          }
        );
      },
    },
    sender: options.sender,
    onWalletStage: options.onWalletStage,
    onQueueFallback: options.onQueueFallback,
  };
}
