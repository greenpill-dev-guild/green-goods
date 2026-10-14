/**
 * useCommitmentJobs Hook
 *
 * The member's write path for commitment pooling. Every one of these acts is
 * something a gardener does in a field with no signal, so all of them go
 * through the offline queue rather than straight to the chain.
 *
 * The queue already owns the hard parts: it refuses a chain where pooling is
 * unavailable, materializes the creator-scoped request key from a stable client
 * id, and returns the existing job when the same act is enqueued twice, so a
 * double tap can never become two commitments. What this hook adds is the seam
 * a view can call, and the stable client ids the queue's dedupe depends on.
 *
 * @module hooks/commitment-pooling/useCommitmentJobs
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import type { Hex } from "viem";

import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { logger } from "../../modules/app/logger";
import { jobQueue } from "../../modules/job-queue/default-instance";
import type {
  ClaimJobPayload,
  CommitmentCreationPayload,
  EvidenceJobPayload,
  WorkLinkJobPayload,
} from "../../modules/commitment-pooling/jobs";
import type { JobSendPhase, ProcessJobResult } from "../../modules/job-queue/ports";
import type { ActPhaseReport } from "../../modules/transactions/act-phase";
import type { TransactionSender } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/** What a view asks for, before the queue fills in keys and hashes. */
export type CommitmentJobInput =
  | { act: "claim"; payload: ClaimJobPayload }
  | {
      act: "evidence";
      payload: EvidenceJobPayload;
      /** Add and Send: queue the send for confirmation with the proof, to go once it lands. */
      sendToo?: boolean;
    }
  | { act: "workLink"; payload: Omit<WorkLinkJobPayload, "operationKey"> }
  | { act: "sendForConfirmation"; commitmentId: bigint; gardenAddress: Address }
  | {
      act: "confirm";
      commitmentId: bigint;
      gardenAddress: Address;
      /** The reader was seated through the commitment's named confirmer list. */
      membershipNotRequired?: boolean;
    }
  | { act: "create"; payload: Omit<CommitmentCreationPayload, "creationRequestKey"> };

/**
 * The commitment this act belongs to, where there is one. Creation has no id
 * yet, which is exactly why it carries a client-side one instead.
 */
function subjectCommitmentId(input: CommitmentJobInput): bigint | null {
  switch (input.act) {
    case "claim":
    case "evidence":
      return input.payload.commitmentId;
    case "workLink":
      return input.payload.commitmentId;
    case "sendForConfirmation":
    case "confirm":
      return input.commitmentId;
    default:
      return null;
  }
}

/** Put the act into the queue as the job kind its executor expects. */
function queueAct(input: CommitmentJobInput, owner: Address, chainId: number): Promise<string> {
  const meta = { chainId };

  switch (input.act) {
    case "claim":
      return jobQueue.addJob("claim", input.payload, owner, meta);
    case "evidence":
      return jobQueue.addJob("evidence", input.payload, owner, meta);
    case "workLink":
      // `operationKey` is derived by the queue from `clientOperationId`, so a
      // retry behind the same button reuses the key rather than minting one.
      return jobQueue.addJob("workLink", input.payload as WorkLinkJobPayload, owner, meta);
    case "sendForConfirmation":
      return jobQueue.addJob(
        "confirmation",
        {
          action: "submit",
          commitmentId: input.commitmentId,
          gardenAddress: input.gardenAddress,
        },
        owner,
        meta
      );
    case "confirm":
      return jobQueue.addJob(
        "confirmation",
        {
          action: "confirm",
          commitmentId: input.commitmentId,
          gardenAddress: input.gardenAddress,
          ...(input.membershipNotRequired ? { membershipNotRequired: true } : {}),
        },
        owner,
        meta
      );
    case "create":
      return jobQueue.addJob("commitment", input.payload as CommitmentCreationPayload, owner, meta);
  }
}

/**
 * Add and Send's second act, queued behind the proof it goes after (O7: two
 * calls, two signatures). Queued now rather than once the proof lands, so the
 * send is kept whatever happens to this screen: an offline add, a reload, a try
 * the queue repeats. The queue refuses a second, different send for the same
 * promise, so a send already queued there stands and this one is left out.
 *
 * Any other refusal takes the proof back out of the queue and rejects, so Add
 * and Send never quietly becomes Add: the form stays with its draft. Only a
 * proof already on its way, which can't be taken back, goes on alone, and the
 * promise then offers the send.
 */
async function queueSendAfterProof(
  proof: EvidenceJobPayload,
  proofJobId: string,
  owner: Address,
  chainId: number
): Promise<string | undefined> {
  try {
    return await jobQueue.addJob(
      "confirmation",
      {
        action: "submit",
        commitmentId: proof.commitmentId,
        gardenAddress: proof.gardenAddress,
        afterEvidenceJobId: proofJobId,
      },
      owner,
      { chainId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("offline_job_identity_conflict:")) return undefined;
    if (await jobQueue.discardJob(proofJobId).catch(() => false)) throw error;
    logger.warn("[useCommitmentJobs] Add and Send's send was not queued; the proof goes alone", {
      error: message,
    });
    return undefined;
  }
}

/**
 * Where one tap's send stands, for a view that follows it: the queue has the
 * act, the wallet is asked, the chain is confirming, and then either the act
 * landed or it stays queued to send later, with the queue's reason when it gave
 * one. A declined proof stays queued for the person to send, and says so; any
 * other send that fails rejects instead.
 */
export type CommitmentSendReport =
  /** `followUpJobId`: Add and Send's send, queued behind the proof. */
  | { stage: "admitted"; jobId: string; followUpJobId?: string }
  | JobSendPhase
  | { stage: "landed"; txHash: string | null }
  | { stage: "queued"; reason?: string }
  | { stage: "declined" };

/** An act, and optionally who to tell where its send stands. */
export type CommitmentJobVariables = CommitmentJobInput & {
  report?: (event: CommitmentSendReport) => void;
};

const SEND_FAILED = "The commitment could not be sent";

/**
 * A send's reports, fed to a view's act-phase line: broadcast when the chain
 * has the transaction, then either landed or left queued on this device.
 */
export function toActPhaseReport(report: ActPhaseReport): (event: CommitmentSendReport) => void {
  return (event) => {
    if (event.stage === "confirming") report({ type: "broadcast", hash: event.txHash as Hex });
    else if (event.stage === "landed") report({ type: "confirmed" });
    else if (event.stage === "queued") report({ type: "queued" });
  };
}

/**
 * Tell the view how a send ended. The telling can never change the ending: a
 * report that throws is logged, and an act that landed still resolves.
 */
function tell(
  report: ((event: CommitmentSendReport) => void) | undefined,
  event: CommitmentSendReport
): void {
  if (!report) return;
  try {
    report(event);
  } catch (error) {
    logger.warn("[useCommitmentJobs] a send report threw", {
      stage: event.stage,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** One explicit send, and the second pass that settles a creation it submitted. */
async function sendAndSettle(
  jobId: string,
  sender: TransactionSender,
  onPhase?: (phase: JobSendPhase) => void
): Promise<ProcessJobResult> {
  const context = { transactionSender: sender, explicit: true, onPhase };
  const result = await jobQueue.processJob(jobId, context);
  const submitted = !result.success && result.skipped && Boolean(result.txHash);
  return submitted ? jobQueue.processJob(jobId, context) : result;
}

/**
 * A wallet reader's act is sent from here or it is never sent.
 *
 * The background flush in `JobQueueProvider` runs only for passkey and embedded
 * sign-in, where no prompt interrupts anyone, and the admin mounts no provider
 * at all. A wallet prompt has to answer the person's own tap, so this is that
 * tap, the way a queued decision is sent in `submit-approval-command`.
 *
 * What the queue reports decides what happens to the job:
 *
 * - Sent, but a creation: its first pass only submits, and a second pass reads
 *   the new id back from the chain and completes it. The background flush makes
 *   that pass for a passkey; here it is made at once, since the wallet sender
 *   has already waited for the receipt.
 * - Waiting (no steady connection, membership still being read, work not indexed
 *   yet): it stays queued and is not an error, because the tap cannot settle it.
 * - Sent but not yet confirmed (the receipt wait failed, or the answer was lost):
 *   the act's send is on record (`commitment-send-record`), so it waits as
 *   `awaiting-confirmation`. No screen offers to drop it, and a later run
 *   confirms it from the chain instead of sending it again.
 * - Declined at the wallet: the send never left and its record is cleared, so
 *   the job is dropped through the queue's own `discardJob` and the refusal is
 *   reported. The composers keep their own drafts, so nothing the person made
 *   is lost. Proof is the exception: its composer lets go of the draft once the
 *   queue has it, so a declined proof stays, marked for the person's own send,
 *   and the promise offers Send Now and Discard (`keepDeclined`).
 * - Failed any other way, a declined network switch included: the job stays. The
 *   queued row carries it from here, with Send Now and Discard. Pressing the
 *   form's button again is the same act, so the queue answers with this job
 *   (`isSameCreationPlacedAgain`) and it is sent again as it was queued; a press
 *   whose answers changed is refused, and this job is left as it was.
 *
 * Every tap starts the job on a fresh run of tries, as Send Now does. A press
 * that reaches a job already queued would otherwise add to its failures until
 * the queue gave up on it, and the press after that would file a second
 * creation beside the spent one.
 */
async function sendFromTap(
  jobId: string,
  sender: TransactionSender | null,
  report?: (event: CommitmentSendReport) => void,
  {
    keepDeclined = false,
    foreground = false,
  }: { keepDeclined?: boolean; foreground?: boolean } = {}
): Promise<void> {
  if (!foreground && sender?.authMode !== "wallet") {
    // The client background processor owns these sends.
    tell(report, { stage: "queued" });
    return;
  }
  if (!sender) throw new Error("Sign in before sending a commitment");
  await jobQueue.retryJob(jobId);
  const result = await sendAndSettle(jobId, sender, report);
  if (result.success) {
    tell(report, { stage: "landed", txHash: result.txHash ?? null });
    return;
  }
  if (result.skipped) {
    tell(report, { stage: "queued", ...(result.error ? { reason: result.error } : {}) });
    return;
  }

  if (isCancelledTxError(result.error)) {
    if (keepDeclined) {
      tell(report, { stage: "declined" });
      return;
    }
    await jobQueue.discardJob(jobId);
  }
  throw new Error(result.error ?? SEND_FAILED);
}

/**
 * Try Again on a queued row, where no queue provider is mounted to offer one
 * (the admin). The queue gives the job a fresh run of attempts and it is sent as
 * the person's own tap.
 *
 * Unlike a first tap, a failure here keeps the job: the row it came from still
 * offers its send act and Discard, and there is no open form to fall back on.
 * The report says how the send ended, as it does for a first tap.
 */
export async function retryQueuedCommitmentJob(
  jobId: string,
  sender: TransactionSender | null,
  report?: (event: CommitmentSendReport) => void
): Promise<void> {
  if (!sender) throw new Error("Sign in before sending a commitment");
  await jobQueue.retryJob(jobId);
  const result = await sendAndSettle(jobId, sender, report);
  if (result.success) {
    tell(report, { stage: "landed", txHash: result.txHash ?? null });
    return;
  }
  if (result.skipped) {
    tell(report, { stage: "queued" });
    return;
  }
  throw new Error(result.error ?? SEND_FAILED);
}

export function useCommitmentJobs(
  options: { chainId?: number; execution?: "background" | "foreground" } = {}
) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const foreground = options.execution === "foreground";
  const viewer = usePrimaryAddress();
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const { formatMessage } = useIntl();
  const handleError = createMutationErrorHandler({
    source: "useCommitmentJobs",
    toastContext: "commitment",
    // A wrong network and an earlier version still queued read in the person's language.
    formatMessage,
  });

  const mutation = useMutation({
    mutationFn: async ({ report, ...input }: CommitmentJobVariables) => {
      if (!viewer) throw new Error("Sign in before making a commitment");
      const jobId = await queueAct(input as CommitmentJobInput, viewer, chainId);
      const followUpJobId =
        input.act === "evidence" && input.sendToo
          ? await queueSendAfterProof(input.payload, jobId, viewer, chainId)
          : undefined;
      // From here the act is durable: whatever the send does, the queue holds it.
      tell(report, { stage: "admitted", jobId, ...(followUpJobId ? { followUpJobId } : {}) });
      await sendFromTap(jobId, sender, report, {
        keepDeclined: input.act === "evidence",
        foreground,
      });
      return jobId;
    },
    onSuccess: async (_jobId, input) => {
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
      const commitmentId = subjectCommitmentId(input);
      if (commitmentId !== null) {
        await queryClient.invalidateQueries({
          queryKey: commitmentPoolingKeys.commitment(chainId, commitmentId),
        });
      }
    },
    onError: (error, input) => {
      handleError(error, { metadata: { act: input.act, chainId } });
    },
  });

  /**
   * Send an act already in the queue as the person's own tap: Add and Send's
   * second act once its proof has landed. A wallet reader is asked now; anyone
   * else's goes with the background flush. Resolves whether it landed here or
   * was left queued; rejects when it failed or was declined (and dropped).
   */
  const sendQueued = useCallback(
    async ({ jobId, commitmentId }: { jobId: string; commitmentId: bigint }) => {
      let outcome: "landed" | "queued" = "queued";
      await sendFromTap(
        jobId,
        sender,
        (event) => {
          if (event.stage === "landed") outcome = "landed";
        },
        { foreground }
      );
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
      await queryClient.invalidateQueries({
        queryKey: commitmentPoolingKeys.commitment(chainId, commitmentId),
      });
      return outcome;
    },
    [chainId, queryClient, sender, foreground]
  );

  return {
    // `mutateAsync` is already a stable reference, so wrapping it would add a
    // memo that guards nothing.
    enqueue: mutation.mutateAsync,
    sendQueued,
    isPending: mutation.isPending,
    error: mutation.error,
    /** Admin sends from the tap in every auth mode; the client retains its background policy. */
    sendsFromTap: foreground || sender?.authMode === "wallet",
    /** Absent until somebody is signed in; every act needs an owner. */
    viewer: viewer as Address | null,
  };
}
