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
  | { act: "evidence"; payload: EvidenceJobPayload }
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
 * Where one tap's send stands, for a view that follows it: the wallet is asked,
 * the chain is confirming, and then either the act landed or it stays queued
 * to send later. A send that fails rejects instead.
 */
export type CommitmentSendReport =
  | JobSendPhase
  | { stage: "landed"; txHash: string | null }
  | { stage: "queued" };

/** An act, and optionally who to tell where its send stands. */
export type CommitmentJobVariables = CommitmentJobInput & {
  report?: (event: CommitmentSendReport) => void;
};

const SEND_FAILED = "The commitment could not be sent";

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
 * - Declined at the wallet: the send never left, so the job is dropped through
 *   the queue's own `discardJob` and the refusal is reported. The composers keep
 *   their own drafts, so nothing the person made is lost.
 * - Failed any other way: the job stays. A commitment job records no broadcast
 *   checkpoint, so a wallet that broadcast before the receipt timed out looks
 *   exactly like one that never sent, and dropping it would throw away the only
 *   record of a transaction that may still land. The queued row and the
 *   failed-act surface carry it from here, with Try Again.
 */
async function sendFromTap(
  jobId: string,
  sender: TransactionSender | null,
  report?: (event: CommitmentSendReport) => void
): Promise<void> {
  if (sender?.authMode !== "wallet") {
    // No prompt to answer here: the background flush sends it.
    tell(report, { stage: "queued" });
    return;
  }
  const result = await sendAndSettle(jobId, sender, report);
  if (result.success) {
    tell(report, { stage: "landed", txHash: result.txHash ?? null });
    return;
  }
  if (result.skipped) {
    tell(report, { stage: "queued" });
    return;
  }

  if (isCancelledTxError(result.error)) await jobQueue.discardJob(jobId);
  throw new Error(result.error ?? SEND_FAILED);
}

/**
 * Try Again on a queued row, where no queue provider is mounted to offer one
 * (the admin). The queue gives the job a fresh run of attempts and it is sent as
 * the person's own tap.
 *
 * Unlike a first tap, a failure here keeps the job: the row it came from still
 * offers Try Again and Discard, and there is no open form to fall back on.
 */
export async function retryQueuedCommitmentJob(
  jobId: string,
  sender: TransactionSender | null
): Promise<void> {
  if (!sender) throw new Error("Sign in before sending a commitment");
  await jobQueue.retryJob(jobId);
  const result = await sendAndSettle(jobId, sender);
  if (!result.success && !result.skipped) throw new Error(result.error ?? SEND_FAILED);
}

export function useCommitmentJobs(options: { chainId?: number } = {}) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const viewer = usePrimaryAddress();
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useCommitmentJobs",
    toastContext: "commitment",
  });

  const mutation = useMutation({
    mutationFn: async ({ report, ...input }: CommitmentJobVariables) => {
      if (!viewer) throw new Error("Sign in before making a commitment");
      const jobId = await queueAct(input as CommitmentJobInput, viewer, chainId);
      await sendFromTap(jobId, sender, report);
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

  return {
    // `mutateAsync` is already a stable reference, so wrapping it would add a
    // memo that guards nothing.
    enqueue: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    /** Absent until somebody is signed in; every act needs an owner. */
    viewer: viewer as Address | null,
  };
}
