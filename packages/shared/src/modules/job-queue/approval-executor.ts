import type { Hex } from "viem";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job, SendCheckpoint } from "../../types/job-queue";
import { buildApprovalAttestContractCall } from "../../utils/eas/transaction-builder";
import { TransactionRevertedError, type TransactionSender } from "../transactions/types";
import { buildQueuedApprovalDraft } from "../work/queued-work-draft";
import { classifySendFailure } from "../work/send-outcome";
import { settleStrandedDecisionIntent } from "../work/stranded-intent";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  reconcileWorkTransaction,
  rememberWorkBroadcast,
  retainedWorkBroadcastReference,
} from "../work/work-confirmation";
import { jobQueueDB } from "./db";

type EncodeApproval = typeof import("../../utils/eas/encoders").encodeWorkApprovalData;

export interface ApprovalJobExecutorDeps {
  encodeApproval?: EncodeApproval;
  easConfig?: EASConfig;
  reconcile?: typeof reconcileWorkTransaction;
  settleStrandedIntent?: typeof settleStrandedDecisionIntent;
  persist?: (job: Job<ApprovalJobPayload>) => Promise<void>;
}

/**
 * Confirm a decision that was already sent, instead of sending it again: the
 * resolver accepts a second decision for the same work, and a second approval
 * would also repeat its impact report.
 */
async function settleRecordedSend(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: ApprovalJobExecutorDeps,
  persist: (job: Job<ApprovalJobPayload>) => Promise<void>
): Promise<Hex> {
  const checkpoint = job.payload.sendCheckpoint;
  const broadcast = checkpoint?.broadcast ?? retainedWorkBroadcastReference(job.id);
  let transactionHash =
    checkpoint?.transactionHash ?? (broadcast?.kind === "transaction" ? broadcast.hash : undefined);
  let state: "confirmed" | "reverted" | "unresolved" = "unresolved";
  if (broadcast?.kind === "user-operation" && !transactionHash) {
    const result = await sender.reconcileBroadcast?.(broadcast);
    state = result?.status ?? "unresolved";
    if (result?.status === "confirmed") transactionHash = result.transactionHash;
  } else if (transactionHash) {
    state = await (deps.reconcile ?? reconcileWorkTransaction)(transactionHash, chainId);
  }
  if (state === "confirmed") return transactionHash!;
  if (state === "reverted") {
    // Nothing was recorded, so the decision may be sent again.
    const revertedHash = transactionHash ?? broadcast?.hash ?? "0x";
    delete job.payload.sendCheckpoint;
    forgetWorkBroadcast(job.id);
    await persist(job);
    throw new TransactionRevertedError(revertedHash);
  }
  // A transaction hash may be a Safe transaction still collecting signatures.
  if (transactionHash) throw new AwaitingWorkConfirmation(transactionHash);
  return (deps.settleStrandedIntent ?? settleStrandedDecisionIntent)(
    job,
    chainId,
    broadcast?.hash ?? "0x"
  );
}

/**
 * Execute an approval attestation job: encode and send (no IPFS needed).
 *
 * The send is checkpointed like queued work: an intent just before the call
 * can reach the network, then its reference and transaction. A later run
 * confirms a recorded send and never sends the decision twice.
 */
export async function executeApprovalJob(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: ApprovalJobExecutorDeps = {}
): Promise<string> {
  const payload = job.payload as ApprovalJobPayload;
  const persist = deps.persist ?? ((updated) => jobQueueDB.updateJob(updated));
  const recorded = payload.sendCheckpoint;
  if (
    recorded?.broadcast ||
    recorded?.transactionHash ||
    recorded?.broadcastPending ||
    retainedWorkBroadcastReference(job.id)
  ) {
    const hash = await settleRecordedSend(job, chainId, sender, deps, persist);
    forgetWorkBroadcast(job.id);
    return hash;
  }

  // Encode approval attestation data (no IPFS upload needed)
  const encodeApproval =
    deps.encodeApproval ?? (await import("../../utils/eas/encoders")).encodeWorkApprovalData;
  const attestationData = encodeApproval(buildQueuedApprovalDraft(payload), chainId);

  // Build and send attestation via TransactionSender
  const easConfig = deps.easConfig ?? getEASConfig(chainId);
  const contractCall = buildApprovalAttestContractCall(
    easConfig,
    payload.gardenAddress as `0x${string}`,
    attestationData
  );
  let intentRecorded = false;
  let broadcastKnown = false;
  const record = async (checkpoint: SendCheckpoint) => {
    payload.sendCheckpoint = checkpoint;
    await persist(job);
  };
  try {
    const result = await sender.sendContractCall(contractCall, {
      onBeforeBroadcast: async (reference) => {
        await record({
          broadcastPending: true,
          broadcastPendingAt: new Date().toISOString(),
          ...(reference ? { broadcast: reference } : {}),
        });
        intentRecorded = true;
      },
      onBroadcastReference: async (reference) => {
        broadcastKnown = true;
        // Kept in memory too, so a failed write never turns a retry into a second send.
        rememberWorkBroadcast(job.id, reference);
        await record({ ...payload.sendCheckpoint, broadcast: reference, broadcastPending: false });
      },
      onBroadcast: async (hash) => {
        broadcastKnown = true;
        if (payload.sendCheckpoint?.broadcast?.kind !== "user-operation")
          rememberWorkBroadcast(job.id, hash);
        await record({ ...payload.sendCheckpoint, transactionHash: hash, broadcastPending: false });
      },
    });
    if (result.confirmation === "pending") throw new AwaitingWorkConfirmation(result.hash);
    forgetWorkBroadcast(job.id);
    return result.hash;
  } catch (error) {
    if (error instanceof AwaitingWorkConfirmation) throw error;
    const failure =
      error instanceof TransactionRevertedError
        ? ({ kind: "not-sent", cancelled: false } as const)
        : classifySendFailure(error, { intentRecorded, broadcastKnown });
    if (failure.kind === "not-sent") {
      // Nothing was recorded on-chain, so the decision may be sent again.
      delete payload.sendCheckpoint;
      forgetWorkBroadcast(job.id);
      if (intentRecorded) await persist(job);
      throw error;
    }
    throw new AwaitingWorkConfirmation(
      payload.sendCheckpoint?.transactionHash ?? payload.sendCheckpoint?.broadcast?.hash ?? "0x"
    );
  }
}
