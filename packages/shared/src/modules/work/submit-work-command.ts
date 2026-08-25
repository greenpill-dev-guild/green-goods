import { parseContractError } from "../../utils/errors/contract-errors";
import { getActionTitle } from "../../utils/action/parsers";
import type { Action, Address, Work, WorkDraft } from "../../types/domain";
import type { JobQueueHandle, ProcessJobResult } from "../job-queue/ports";
import type { TransactionSender } from "../transactions/types";
import type { SimulateWorkSubmissionParams, SimulationDeps } from "./simulate";
import { WorkSubmissionError, type WalletSubmissionStage } from "./wallet-submission/types";

export interface SubmitWorkCommand {
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
  | { kind: "direct"; txHash: `0x${string}`; sponsored: false }
  | {
      kind: "queued";
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
  if (error instanceof WorkSubmissionError && error.phase === "upload") {
    return false;
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
  const resolved = resolveCommand(command);
  const online = ports.connectivity.isOnline();

  if (resolved.authMode === "wallet") {
    if (!online) {
      if (!resolved.allowOfflineQueue) {
        throw new Error("Offline queue is disabled for this submission surface");
      }
      return queuedOutcome(await ports.queue.enqueue(resolved), ports.sender);
    }

    try {
      const txHash = await ports.direct.submitWork(resolved, ports.onWalletStage);
      return { kind: "direct", txHash, sponsored: false };
    } catch (error) {
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
    if (!processed.success && processed.error && !processed.skipped) {
      throw new Error(processed.error);
    }
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
          input.userAddress
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
          { onProgress }
        );
      },
    },
    sender: options.sender,
    onWalletStage: options.onWalletStage,
    onQueueFallback: options.onQueueFallback,
  };
}
