import type { AuthMode } from "../../types/auth";
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
  authMode: AuthMode;
  draft: WorkApprovalDraft;
  work: Work;
  chainId: number;
  userAddress: Address | null;
}

export interface SubmitApprovalPorts {
  /** Whether a send may start now; unstable connections never send. */
  connectivity: { confirm(): Promise<boolean> };
  direct(input: SubmitApprovalCommand): Promise<{ hash: `0x${string}`; confirmed: boolean }>;
  queue: {
    enqueue(input: SubmitApprovalCommand & { userAddress: Address }): Promise<{
      txHash: `0x${string}`;
      jobId: string;
    }>;
    process(jobId: string, sender: TransactionSender): Promise<ProcessJobResult>;
  };
  sender: TransactionSender | null;
  /**
   * Whether the chain already holds a decision for the work, read just before a wallet send.
   * Throws when it cannot tell, and nothing is sent: unknown is not "no".
   */
  decisions: { isDecided(input: SubmitApprovalCommand): Promise<boolean> };
}

export interface SubmitApprovalOutcome {
  hash: `0x${string}`;
  confirmed?: boolean;
  kind: "direct" | "queued" | "processed";
}

function validateApproval(command: SubmitApprovalCommand): void {
  if (!command.draft.workUID) throw new Error("Work UID is required for approval");
  if (!command.work.gardenAddress) throw new Error("Garden address is missing from work data");
  if (command.work.status === "approved" || command.work.status === "rejected") {
    throw new ApprovalAlreadyDecidedError();
  }
}

/** Thrown before a wallet is asked, so nothing is signed on a connection that may drop it. */
export class ApprovalConnectionUnconfirmedError extends Error {
  constructor() {
    super("Your connection isn't steady enough to send this decision. Try again in a moment.");
    this.name = "ApprovalConnectionUnconfirmedError";
  }
}

/** The chain already holds a decision for this work: a second one is never sent. */
export class ApprovalAlreadyDecidedError extends Error {
  constructor() {
    super("This work has already been reviewed.");
    this.name = "ApprovalAlreadyDecidedError";
  }
}

/**
 * Why the queue settles a kept decision without sending it: the chain already holds a decision
 * for the work. A job failed for it reads `unavailable:` and then this reason.
 */
export const APPROVAL_ALREADY_DECIDED_REASON = "work-already-decided";

/** The chain could not say whether the work is decided, so nothing was sent: unknown is not "no". */
export class ApprovalDecisionUnreadError extends Error {
  constructor(cause: unknown) {
    super("We couldn't check whether this work is still waiting, so nothing was sent.", { cause });
    this.name = "ApprovalDecisionUnreadError";
  }
}

/** Read right before a wallet send, since a list read earlier may be old by now. */
async function refuseIfDecided(command: SubmitApprovalCommand, ports: SubmitApprovalPorts) {
  let decided: boolean;
  try {
    decided = await ports.decisions.isDecided(command);
  } catch (error) {
    throw new ApprovalDecisionUnreadError(error);
  }
  if (decided) throw new ApprovalAlreadyDecidedError();
}

export async function submitApproval(
  command: SubmitApprovalCommand,
  ports: SubmitApprovalPorts
): Promise<SubmitApprovalOutcome> {
  validateApproval(command);

  const wallet = command.authMode === "wallet";
  if (wallet) {
    if (await ports.connectivity.confirm()) {
      await refuseIfDecided(command, ports);
      const result = await ports.direct(command);
      return { ...result, kind: "direct" };
    }
    // Without a queue to fall back on, it is refused before the wallet is asked.
    if (!command.queueWalletDecisions) throw new ApprovalConnectionUnconfirmedError();
  }

  if (!command.userAddress) {
    throw new Error("User address is required for approval submission");
  }

  // Kept first, so the decision outlives anything that follows; the queue rereads the work's
  // decision on chain right before it sends.
  const queued = await ports.queue.enqueue({ ...command, userAddress: command.userAddress });
  // A queued wallet decision waits for Upload all: sending it from here would
  // open the wallet on a connection that was just found unsteady.
  if (!wallet && ports.sender && (await ports.connectivity.confirm())) {
    const processed = await ports.queue.process(queued.jobId, ports.sender);
    if (processed.success && processed.txHash) {
      return { hash: processed.txHash as `0x${string}`, kind: "processed" };
    }
    if (!processed.success && processed.error && !processed.skipped) {
      if (processed.error === `unavailable:${APPROVAL_ALREADY_DECIDED_REASON}`) {
        throw new ApprovalAlreadyDecidedError();
      }
      throw new Error(processed.error);
    }
  }

  return { hash: queued.txHash, kind: "queued" };
}

export function createDefaultSubmitApprovalPorts(
  sender: TransactionSender | null,
  dependencies: {
    jobQueue?: Pick<JobQueueHandle, "processJob">;
    onWalletLifecycle?: (event: ApprovalWalletLifecycleEvent) => void;
  } = {}
): SubmitApprovalPorts {
  return {
    connectivity: { confirm: () => connectivityStore.confirmOnline() },
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
    decisions: {
      isDecided: async ({ draft, chainId }) => {
        const { createReviewChain } = await import("./review-chain");
        return createReviewChain(chainId).isDecided(draft.workUID);
      },
    },
  };
}
