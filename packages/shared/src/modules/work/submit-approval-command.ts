import type { SmartAccountClient } from "permissionless";
import type { Address, Work, WorkApprovalDraft } from "../../types/domain";
import type { ProcessJobResult } from "../job-queue";
import type { TransactionSender } from "../transactions/types";

export interface SubmitApprovalCommand {
  authMode: "wallet" | "passkey" | "embedded" | null;
  draft: WorkApprovalDraft;
  work: Work;
  chainId: number;
  userAddress: Address | null;
}

export interface SubmitApprovalPorts {
  connectivity: { isOnline(): boolean };
  direct(input: SubmitApprovalCommand): Promise<{ hash: `0x${string}`; confirmed: boolean }>;
  queue: {
    enqueue(input: SubmitApprovalCommand & { userAddress: Address }): Promise<{
      txHash: `0x${string}`;
      jobId: string;
    }>;
    process(jobId: string, sender: TransactionSender): Promise<ProcessJobResult>;
  };
  sender: TransactionSender | null;
}

export interface SubmitApprovalOutcome {
  hash: `0x${string}`;
  confirmed?: boolean;
  kind: "direct" | "queued" | "processed";
}

export interface BatchApprovalItem {
  draft: WorkApprovalDraft;
  work: Work;
}

export interface SubmitBatchApprovalsCommand {
  authMode: "wallet" | "passkey" | "embedded" | null;
  items: BatchApprovalItem[];
  chainId: number;
}

export interface SubmitBatchApprovalsPorts {
  direct(items: BatchApprovalItem[], chainId: number): Promise<`0x${string}`>;
  sponsored(items: BatchApprovalItem[], chainId: number): Promise<`0x${string}`>;
}

export interface SubmitBatchApprovalsOutcome {
  hash: `0x${string}`;
  count: number;
}

function validateApproval(command: SubmitApprovalCommand): void {
  if (!command.draft.workUID) throw new Error("Work UID is required for approval");
  if (!command.work.gardenAddress) throw new Error("Garden address is missing from work data");
  if (command.work.status === "approved" || command.work.status === "rejected") {
    throw new Error(`This work has already been ${command.work.status}`);
  }
}

export async function submitApproval(
  command: SubmitApprovalCommand,
  ports: SubmitApprovalPorts
): Promise<SubmitApprovalOutcome> {
  validateApproval(command);

  if (command.authMode === "wallet") {
    const result = await ports.direct(command);
    return { ...result, kind: "direct" };
  }

  if (!command.userAddress) {
    throw new Error("User address is required for approval submission");
  }

  const queued = await ports.queue.enqueue({ ...command, userAddress: command.userAddress });
  if (ports.connectivity.isOnline() && ports.sender) {
    const processed = await ports.queue.process(queued.jobId, ports.sender);
    if (processed.success && processed.txHash) {
      return { hash: processed.txHash as `0x${string}`, kind: "processed" };
    }
    if (!processed.success && processed.error && !processed.skipped) {
      throw new Error(processed.error);
    }
  }

  return { hash: queued.txHash, kind: "queued" };
}

export async function submitBatchApprovals(
  command: SubmitBatchApprovalsCommand,
  ports: SubmitBatchApprovalsPorts
): Promise<SubmitBatchApprovalsOutcome> {
  if (command.items.length === 0) throw new Error("No items to approve");

  const hash =
    command.authMode === "wallet"
      ? await ports.direct(command.items, command.chainId)
      : await ports.sponsored(command.items, command.chainId);
  return { hash, count: command.items.length };
}

export function createDefaultSubmitApprovalPorts(
  sender: TransactionSender | null
): SubmitApprovalPorts {
  return {
    connectivity: { isOnline: () => navigator.onLine },
    direct: async ({ draft, work, chainId }) => {
      const { submitApprovalDirectly } = await import("./wallet-submission");
      return submitApprovalDirectly(draft, work.gardenAddress, work.gardenerAddress, chainId);
    },
    queue: {
      enqueue: async ({ draft, work, chainId, userAddress }) => {
        const { submitApprovalToQueue } = await import("./work-submission");
        return submitApprovalToQueue(draft, work, chainId, userAddress);
      },
      process: async (jobId, transactionSender) => {
        const { jobQueue } = await import("../job-queue");
        return jobQueue.processJob(jobId, { transactionSender });
      },
    },
    sender,
  };
}

export function createDefaultSubmitBatchApprovalsPorts(
  smartAccountClient: SmartAccountClient | null
): SubmitBatchApprovalsPorts {
  return {
    direct: async (items, chainId) => {
      const { submitBatchApprovalsDirectly } = await import("./wallet-submission");
      return submitBatchApprovalsDirectly(
        items.map(({ draft, work }) => ({
          draft,
          gardenAddress: work.gardenAddress,
          gardenerAddress: work.gardenerAddress,
        })),
        chainId
      );
    },
    sponsored: async (items, chainId) => {
      if (!smartAccountClient) {
        throw new Error("Smart account not available. Please re-authenticate.");
      }
      const { submitBatchApprovalsWithPasskey } = await import("./passkey-submission");
      return submitBatchApprovalsWithPasskey({
        client: smartAccountClient,
        approvals: items.map(({ draft, work }) => ({
          draft,
          gardenAddress: work.gardenAddress,
        })),
        chainId,
      });
    },
  };
}
