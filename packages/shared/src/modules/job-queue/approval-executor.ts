import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job } from "../../types/job-queue";
import { buildApprovalAttestContractCall } from "../../utils/eas/transaction-builder";
import type { TransactionSender } from "../transactions/types";
import { buildQueuedApprovalDraft } from "../work/queued-work-draft";
import { sendWithCheckpoint, settleRecordedSend } from "../work/send-with-checkpoint";
import { settleStrandedDecisionIntent } from "../work/stranded-intent";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  reconcileWorkTransaction,
  retainedWorkBroadcastReference,
} from "../work/work-confirmation";
import { jobQueueDB } from "./db";
import { hasRecordedSend, writeSendCheckpoint } from "./queue-policy";

type EncodeApproval = typeof import("../../utils/eas/encoders").encodeWorkApprovalData;

export interface ApprovalJobExecutorDeps {
  encodeApproval?: EncodeApproval;
  easConfig?: EASConfig;
  reconcile?: typeof reconcileWorkTransaction;
  settleStrandedIntent?: typeof settleStrandedDecisionIntent;
  persist?: (job: Job<ApprovalJobPayload>) => Promise<void>;
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
  if (hasRecordedSend(job) || retainedWorkBroadcastReference(job.id)) {
    // Confirmed rather than sent again: the resolver accepts a second decision
    // for the same work, and a second approval would repeat its impact report.
    const hash = await settleRecordedSend({
      jobId: job.id,
      checkpoint: payload.sendCheckpoint,
      chainId,
      sender,
      reconcile: deps.reconcile,
      clear: async () => {
        writeSendCheckpoint(job, undefined);
        await persist(job);
      },
      settleStranded: (pendingHash) =>
        (deps.settleStrandedIntent ?? settleStrandedDecisionIntent)(job, chainId, pendingHash),
    });
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
  const result = await sendWithCheckpoint({
    sender,
    call: contractCall,
    jobIds: [job.id],
    record: async (next) => {
      writeSendCheckpoint(job, next(payload.sendCheckpoint ?? {}));
      await persist(job);
    },
  });
  switch (result.status) {
    case "sent":
      if (result.confirmation === "pending") throw new AwaitingWorkConfirmation(result.hash);
      forgetWorkBroadcast(job.id);
      return result.hash;
    case "reverted":
      // Nothing was recorded on-chain, so the decision may be sent again.
      writeSendCheckpoint(job, undefined);
      forgetWorkBroadcast(job.id);
      await persist(job);
      throw result.error;
    case "not-sent":
      // An embedded wallet's background flush sends decisions too, so a person
      // who declined is not asked again until they choose to send it.
      if (result.cancelled) {
        job.meta = { ...job.meta, requiresExplicitSend: true };
        await persist(job);
      }
      throw result.error;
    case "may-have-sent":
      throw new AwaitingWorkConfirmation(
        payload.sendCheckpoint?.transactionHash ?? payload.sendCheckpoint?.broadcast?.hash ?? "0x"
      );
  }
}
