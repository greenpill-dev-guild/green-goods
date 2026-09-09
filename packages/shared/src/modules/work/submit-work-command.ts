import {
  AwaitingWorkConfirmation,
  WorkTransactionReverted,
  reconcileWorkTransaction,
} from "./work-confirmation";
import { parseContractError } from "../../utils/errors/contract-errors";
import { getActionTitle } from "../../utils/action/parsers";
import type { Action, Address, Work, WorkDraft, WorkUploadCheckpoint } from "../../types/domain";
import type { JobQueueHandle, ProcessJobResult } from "../job-queue/ports";
import type { TransactionSender } from "../transactions/types";
import type { SimulateWorkSubmissionParams, SimulationDeps } from "./simulate";
import { WorkSubmissionError, type WalletSubmissionStage } from "./wallet-submission/types";

export interface SubmitWorkCommand {
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

interface ResolvedSubmitWorkCommand extends SubmitWorkCommand {
  clientWorkId: string;
  gardenAddress: Address;
  actionUID: number;
  userAddress: Address;
}

interface QueuedWorkSubmission {
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
    enqueue: (input: ResolvedSubmitWorkCommand) => Promise<QueuedWorkSubmission>;
    process: (jobId: string, sender: TransactionSender) => Promise<ProcessJobResult>;
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

/** Genuine connectivity failures may fall back to the durable queue. */
export function isNetworkError(error: unknown): boolean {
  const reason = error instanceof Error && error.cause ? error.cause : error;
  if (
    reason &&
    typeof reason === "object" &&
    (("name" in reason && reason.name === "AbortError") ||
      ("code" in reason && reason.code === 4001))
  )
    return false;
  if (error instanceof WorkSubmissionError && error.phase === "upload") {
    const cause = error.cause;
    const status =
      cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
    const message =
      cause instanceof Error ? cause.message.toLowerCase() : error.message.toLowerCase();
    return (
      [408, 429].includes(status) ||
      status >= 500 ||
      /network|fetch|timeout|timed out|socket|connection|gateway|\b408\b|\b429\b|\b5\d\d\b/.test(
        message
      )
    );
  }

  const originalError =
    error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (parseContractError(originalError).name === "WalletRequestExpired") {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("connection") ||
    message.includes("gateway")
  );
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

function queuedOutcome(
  queued: QueuedWorkSubmission,
  sender: TransactionSender | null
): SubmitWorkOutcome {
  return {
    kind: "queued",
    txHash: queued.txHash,
    sponsored: sender?.supportsSponsorship ?? false,
    jobId: queued.jobId,
    clientWorkId: queued.clientWorkId,
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
    connectivity: { isOnline: () => navigator.onLine },
    clock: { now: () => Date.now() },
    simulate: async (input) => {
      const { simulateWorkSubmission } = await import("./simulate");
      return simulateWorkSubmission(input, options.simulationDeps);
    },
    queue: {
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
      process: async (jobId, sender) => {
        const queue = options.jobQueue ?? (await import("../job-queue")).jobQueue;
        return queue.processJob(jobId, { transactionSender: sender });
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
