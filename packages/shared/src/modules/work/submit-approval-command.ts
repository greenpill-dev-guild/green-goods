import type { SmartAccountClient } from "permissionless";
import { connectivityStore } from "../../stores/connectivity";
import type { Address, Work, WorkApprovalDraft } from "../../types/domain";
import type { JobQueueHandle, ProcessJobResult } from "../job-queue/ports";
import type { TransactionSender } from "../transactions/types";
import type { ApprovalWalletLifecycleEvent } from "./wallet-submission/types";

export interface SubmitApprovalCommand {
  /**
   * A wallet decision normally goes straight to the wallet, and is refused when
   * it cannot. Where Upload all is on hand (the client), one made offline waits
   * on the device instead, like a passkey's. A surface with no queue to upload
   * from (admin) leaves this off, so a decision never waits where nothing sends it.
   */
  queueWalletDecisions?: boolean;
  authMode: "wallet" | "passkey" | "embedded" | null;
  draft: WorkApprovalDraft;
  work: Work;
  chainId: number;
  userAddress: Address | null;
}

export interface SubmitApprovalPorts {
  /** `confirm`: whether a send may start now; unstable connections never send. */
  connectivity: { isOnline(): boolean; confirm?(): Promise<boolean> };
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

/** Thrown before a wallet is asked, so nothing is signed on a connection that may drop it. */
export class ApprovalConnectionUnconfirmedError extends Error {
  constructor() {
    super("Your connection isn't steady enough to send this decision. Try again in a moment.");
    this.name = "ApprovalConnectionUnconfirmedError";
  }
}

function canSendApprovalNow(ports: SubmitApprovalPorts): Promise<boolean> {
  return ports.connectivity.confirm
    ? ports.connectivity.confirm()
    : Promise.resolve(ports.connectivity.isOnline());
}

export async function submitApproval(
  command: SubmitApprovalCommand,
  ports: SubmitApprovalPorts
): Promise<SubmitApprovalOutcome> {
  validateApproval(command);

  const wallet = command.authMode === "wallet";
  if (wallet) {
    if (await canSendApprovalNow(ports)) {
      const result = await ports.direct(command);
      return { ...result, kind: "direct" };
    }
    // Without a queue to fall back on, it is refused before the wallet is asked.
    if (!command.queueWalletDecisions) throw new ApprovalConnectionUnconfirmedError();
  }

  if (!command.userAddress) {
    throw new Error("User address is required for approval submission");
  }

  const queued = await ports.queue.enqueue({ ...command, userAddress: command.userAddress });
  // A queued wallet decision waits for Upload all: sending it from here would
  // open the wallet on a connection that was just found unsteady.
  if (!wallet && ports.sender && (await canSendApprovalNow(ports))) {
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
  sender: TransactionSender | null,
  dependencies: {
    jobQueue?: Pick<JobQueueHandle, "processJob">;
    onWalletLifecycle?: (event: ApprovalWalletLifecycleEvent) => void;
  } = {}
): SubmitApprovalPorts {
  return {
    connectivity: {
      isOnline: () => connectivityStore.getSnapshot(),
      confirm: () => connectivityStore.confirmOnline(),
    },
    direct: async ({ draft, work, chainId }) => {
      const { submitApprovalDirectly } = await import("./wallet-submission");
      return submitApprovalDirectly(draft, work.gardenAddress, work.gardenerAddress, chainId, {
        onLifecycle: dependencies.onWalletLifecycle,
      });
    },
    queue: {
      enqueue: async ({ draft, work, chainId, userAddress }) => {
        const { submitApprovalToQueue } = await import("./work-submission");
        return submitApprovalToQueue(draft, work, chainId, userAddress);
      },
      process: async (jobId, transactionSender) => {
        const queue = dependencies.jobQueue ?? (await import("../job-queue")).jobQueue;
        // Only a decision tap reaches this port, so the send is explicit.
        return queue.processJob(jobId, { transactionSender, explicit: true });
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
