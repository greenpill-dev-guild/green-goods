import type { Hex } from "viem";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job } from "../../types/job-queue";
import { buildApprovalAttestContractCall } from "../../utils/eas/transaction-builder";
import type { TransactionSender } from "../transactions/types";
import { createEasLandedLookup } from "../work/eas-landed-lookup";
import { buildQueuedApprovalDraft } from "../work/queued-work-draft";
import { sendWithCheckpoint, settleRecordedSend } from "../work/send-with-checkpoint";
import { settleStrandedDecisionIntent, type StrandedDecisionLookup } from "../work/stranded-intent";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  reconcileWorkTransaction,
  retainedWorkBroadcastReference,
} from "../work/work-confirmation";
import { jobQueueDB } from "./db";
import { hasRecordedSend, writeSendCheckpoint } from "./queue-policy";
import {
  chainTimeOf,
  createSendChainReads,
  intentHead,
  type SendChainReads,
} from "./send-chain-reads";
import {
  holdingSend,
  observeTransactionNonce,
  recordedTransactionSuperseded,
  sendMayStillLand,
} from "./send-guards";

type EncodeApproval = typeof import("../../utils/eas/encoders").encodeWorkApprovalData;

export interface ApprovalJobExecutorDeps {
  encodeApproval?: EncodeApproval;
  easConfig?: EASConfig;
  reconcile?: typeof reconcileWorkTransaction;
  /** Settles a lost send from what the chain recorded; the default asks EAS, behind the guards. */
  settleStrandedIntent?: (
    job: Job<ApprovalJobPayload>,
    chainId: number,
    pendingHash: Hex
  ) => Promise<Hex>;
  persist?: (job: Job<ApprovalJobPayload>) => Promise<void>;
  /** What the default settle asks of the chain. */
  reads?: SendChainReads;
  /** Whether the decision landed; the default reads the steward's own decisions on EAS. */
  lookUpLanded?: StrandedDecisionLookup;
}

/**
 * Execute an approval attestation job: encode and send (no IPFS needed).
 *
 * The send is checkpointed like queued work: an intent just before the call
 * can reach the network, then its reference and transaction. A later run
 * confirms a recorded send and never sends the decision twice. The send holds
 * its lock, and a lost one is offered again only as `send-guards` allows.
 */
export async function executeApprovalJob(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: ApprovalJobExecutorDeps = {}
): Promise<string> {
  const payload = job.payload as ApprovalJobPayload;
  const persist = deps.persist ?? ((updated) => jobQueueDB.updateJob(updated));
  const reads = deps.reads ?? createSendChainReads({ chainId });
  const store = { updateJob: (updated: Job) => persist(updated as Job<ApprovalJobPayload>) };
  const settleStranded =
    deps.settleStrandedIntent ??
    (async (stranded: Job<ApprovalJobPayload>, strandedChain: number, pendingHash: Hex) => {
      // Each pass while the network holds the transaction may keep its nonce.
      await observeTransactionNonce(stranded, reads, store);
      return settleStrandedDecisionIntent(stranded, strandedChain, pendingHash, {
        lookUp: deps.lookUpLanded ?? createEasLandedLookup().decision,
        stillSending: () => sendMayStillLand(stranded, reads),
        transactionSuperseded: () => recordedTransactionSuperseded(stranded, reads),
        chainTime: chainTimeOf(reads),
        persist,
      });
    });

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
      settleStranded: (pendingHash) => settleStranded(job, chainId, pendingHash),
      // A transaction no receipt answers, such as a Safe's own id, settles by the
      // decision's landing.
      settleUnanswered: (transactionHash) => settleStranded(job, chainId, transactionHash),
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
  const result = await holdingSend(job.id, () =>
    sendWithCheckpoint({
      sender,
      call: contractCall,
      jobIds: [job.id],
      // Read just before the intent, after any prompt: a lost send is then
      // timed on the chain's clock.
      intent: () => intentHead(reads.readChainHead),
      record: async (next) => {
        writeSendCheckpoint(job, next(payload.sendCheckpoint ?? {}));
        await persist(job);
      },
    })
  );
  switch (result.status) {
    case "sent":
      if (result.confirmation === "pending") {
        await observeTransactionNonce(job, reads, store);
        throw new AwaitingWorkConfirmation(result.hash);
      }
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
      // Its receipt did not come: keep the nonce its transaction used while the
      // network still holds it.
      await observeTransactionNonce(job, reads, store);
      throw new AwaitingWorkConfirmation(
        payload.sendCheckpoint?.transactionHash ?? payload.sendCheckpoint?.broadcast?.hash ?? "0x"
      );
  }
}
