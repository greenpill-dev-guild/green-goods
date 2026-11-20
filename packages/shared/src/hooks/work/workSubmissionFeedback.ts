import type { IntlShape } from "react-intl";
import type { UseWorkMutationOptions, WorkMutationOrigin } from "./useWorkMutation.types";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { recordBestEffort } from "../../modules/job-queue/job-analytics";
import { isOfflineTxHash } from "../../modules/job-queue/queue-policy";
import { WorkTransactionReverted } from "../../modules/work/work-confirmation";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import { WorkSendCancelledError } from "../../modules/work/send-outcome";
import { UploadPolicyCancelledError } from "../../modules/work/upload-policy";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { SEND_STAGE_WORDS } from "../../modules/transactions/send-stage";
import {
  trackWorkSubmissionCancelled,
  trackWorkSubmissionFailed,
  trackWorkSubmissionOffline,
  trackWorkSubmissionQueued,
  trackWorkSubmissionStarted,
  trackWorkSubmissionSuccess,
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestFailed,
} from "../../modules/app/analytics-events";
import { getDistinctId } from "../../modules/app/posthog";
import { connectivityStore } from "../../stores/connectivity";
import { trackContractError, trackUploadError } from "../../modules/app/error-tracking";
import { walletProgressToasts, toastService } from "../../components/toast";
import { formatErrorForToast, parseAndFormatError } from "../../utils/errors/contract-errors";
import { connectionNeededFailure, wasAskedToReconnect } from "../../utils/errors/unsent-failures";
import { DEBUG_ENABLED, debugError } from "../../utils/debug";

/** Without the offline queue nothing is kept to sync, so offline means nothing was sent. */
function parseSubmissionFailure(error: unknown, allowOfflineQueue: boolean) {
  const formatted = parseAndFormatError(error);
  if (allowOfflineQueue || formatted.parsed.name !== "Offline") return formatted;
  const parsed = connectionNeededFailure(formatted.parsed.raw);
  return { ...formatErrorForToast(parsed), parsed };
}

type SubmissionOptions = Pick<
  UseWorkMutationOptions,
  "authMode" | "actionUID" | "allowOfflineQueue"
>;

interface FailureRecord extends Pick<UseWorkMutationOptions, "authMode" | "actionUID"> {
  allowOfflineQueue: boolean;
  chainId: number;
  imageCount: number;
  workSubmissionJourneyId: string;
}

/**
 * Records how a Submit failed (the funnel event, the wallet request, the error itself) and
 * returns what its screen should say, or nothing when there is nothing to say.
 */
function recordFailure(error: unknown, record: FailureRecord) {
  const { authMode, actionUID, chainId, imageCount, workSubmissionJourneyId } = record;
  const submission = {
    actionUID: actionUID ?? 0,
    authMode,
    imageCount,
    workSubmissionJourneyId,
    chainId,
  };

  // The person declined the Terms, left before answering them, or accepted and then left the flow:
  // nothing was admitted.
  // A step before admission, such as a promise take-up, said why it did not go where it ran; its
  // own records say whether that was a failure or a decline, so it is not counted as a cancel.
  if (error instanceof UploadPolicyCancelledError) {
    if (error.stage !== "before-admission")
      trackWorkSubmissionCancelled({
        ...submission,
        submissionPhase: "review",
        // Accepting the Terms and then leaving the flow is not a decline.
        reason: error.stage === "flow-left" ? "flow_left" : "terms_declined",
      });
    else
      trackWorkSubmissionFailed({
        ...submission,
        error: "StoppedBeforeAdmission",
        submissionPhase: "review",
        parsedErrorFamily: "StoppedBeforeAdmission",
      });
    return undefined;
  }

  // Extract phase information from WorkSubmissionError for category-aware tracking.
  // This lets us distinguish IPFS upload failures from transaction failures in PostHog.
  const isPhased = error instanceof WorkSubmissionError;
  const phase = isPhased ? error.phase : "unknown";
  const uploadBatchId = isPhased ? error.uploadBatchId : undefined;

  // Unwrap the original error from `cause` if the wallet-submission layer wrapped it.
  // This ensures tracking sees the real error, not the user-friendly formatted message.
  const originalError =
    error instanceof Error && error.cause instanceof Error ? error.cause : error;

  // The send boundary has proved this was declined before broadcast. Keep the
  // durable work available for retry without reporting a contract failure.
  if (
    originalError instanceof WorkSendCancelledError ||
    (phase === "transaction" && isCancelledTxError(originalError))
  ) {
    trackWorkSubmissionCancelled({
      ...submission,
      submissionPhase: "transaction",
      reason: "signature_declined",
    });
    return { cancelled: true } as const;
  }

  // Parse contract error for user-friendly message
  const { title, message, parsed } = parseSubmissionFailure(
    originalError,
    record.allowOfflineQueue
  );

  // Track submission failure - funnel event
  trackWorkSubmissionFailed({
    ...submission,
    error: parsed.name,
    submissionPhase: phase,
    parsedErrorFamily: parsed.name,
  });

  // Refused before it started because the wallet has not answered: the reconnect
  // prompt already asked, and the draft is still on Review.
  if (wasAskedToReconnect(error)) return undefined;

  if (authMode === "wallet" && parsed.name === "WalletRequestExpired") {
    trackWorkWalletRequestExpired({
      workSubmissionJourneyId,
      authMode,
      chainId,
      actionUID: actionUID ?? undefined,
      imageCount: imageCount,
      submissionPhase: phase,
      parsedErrorFamily: parsed.name,
    });
  } else if (authMode === "wallet" && phase === "transaction") {
    trackWorkWalletRequestFailed({
      workSubmissionJourneyId,
      authMode,
      chainId,
      actionUID: actionUID ?? undefined,
      imageCount: imageCount,
      submissionPhase: phase,
      parsedErrorFamily: parsed.name,
    });
  }

  // Route tracking by phase: upload failures go to storage category,
  // transaction failures go to contract category
  if (phase === "upload") {
    trackUploadError(originalError, {
      uploadCategory: "file_upload",
      source: "useWorkMutation",
      authMode,
      userAction: "submitting work",
      severity: "error",
      recoverable: true,
      metadata: {
        actionUID,
        imageCount: imageCount,
        submission_phase: phase,
      },
    });
  } else {
    trackContractError(originalError, {
      source: "useWorkMutation",
      authMode,
      userAction: "submitting work",
      metadata: {
        actionUID,
        imageCount: imageCount,
        parsedErrorName: parsed.name,
        isKnown: parsed.isKnown,
        submission_phase: phase,
      },
    });
  }
  return { cancelled: false, phase, uploadBatchId, title, message, parsed } as const;
}

/** The analytics person each journey's Submit started under, when the transport had one. */
const startedUnder = new Map<string, string>();

/**
 * Records that a Submit started, and under which analytics person. The mutation's callbacks still
 * run after the submitting screen is gone, by when the account may have changed, so a Submit's
 * ending is recorded only under the person its start was (PRD-1495).
 */
export function recordWorkSubmissionStart(
  event: Parameters<typeof trackWorkSubmissionStarted>[0]
): void {
  recordBestEffort(() => {
    const person = getDistinctId();
    if (event.workSubmissionJourneyId && person !== "not-initialized")
      startedUnder.set(event.workSubmissionJourneyId, person);
    trackWorkSubmissionStarted(event);
  });
}

/** False once the analytics person changed after the journey's Submit started. */
function underStartingPerson(journeyId: string): boolean {
  const person = startedUnder.get(journeyId);
  return person === undefined || person === getDistinctId();
}

/**
 * Records how a Submit failed when nobody is watching it any more: the person left the flow
 * while it was sent. Nothing is shown, but the attempt keeps its ending (PRD-1495).
 */
export function recordWorkSubmissionFailure(
  error: unknown,
  options: SubmissionOptions,
  origin: Pick<WorkMutationOrigin, "journeyId">,
  variables: { images: readonly File[] }
): void {
  // Called from the mutation's own callbacks: a record that fails must not change the Submit.
  recordBestEffort(() => {
    if (!underStartingPerson(origin.journeyId)) return;
    recordFailure(error, {
      authMode: options.authMode,
      actionUID: options.actionUID,
      allowOfflineQueue: options.allowOfflineQueue ?? true,
      chainId: DEFAULT_CHAIN_ID,
      imageCount: variables.images.length,
      workSubmissionJourneyId: origin.journeyId,
    });
  });
}

/**
 * Records how a Submit that did not fail ended, whether or not the person is still in the flow
 * (PRD-1495). Only a send that reached the chain is a success. A send on record whose check has
 * not answered is queued and awaiting confirmation, and work the queue keeps to send later is
 * saved for later (`work_submission_offline`), each with the reason it was not sent.
 */
export function recordWorkSubmissionOutcome(
  origin: Pick<WorkMutationOrigin, "journeyId" | "outcome">,
  txHash: unknown,
  { authMode, actionUID }: SubmissionOptions
): void {
  // Called from the mutation's own callbacks: a record that fails must not change the Submit.
  recordBestEffort(() => {
    if (!underStartingPerson(origin.journeyId)) return;
    const submission = {
      actionUID: actionUID ?? 0,
      authMode,
      workSubmissionJourneyId: origin.journeyId,
      chainId: DEFAULT_CHAIN_ID,
    };
    if (origin.outcome?.kind === "awaiting-confirmation") {
      trackWorkSubmissionQueued({
        ...submission,
        status: "awaiting-confirmation",
        ...(origin.outcome.reason ? { reason: origin.outcome.reason } : {}),
      });
      return;
    }
    if (origin.outcome?.kind === "queued") {
      trackWorkSubmissionOffline({
        ...submission,
        reason: origin.outcome.reason ?? (connectivityStore.getSnapshot() ? "not-sent" : "offline"),
      });
      return;
    }
    trackWorkSubmissionSuccess({
      ...submission,
      wasOffline: typeof txHash === "string" && isOfflineTxHash(txHash),
      submissionPhase: "success",
    });
  });
}

/**
 * A Submit whose send is on record and whose receipt has not come says it is still confirming,
 * in the shared stage words (PRD-1552), or that its check waits for a confirmed connection.
 */
export function showWorkStillConfirming(intl: IntlShape, unchecked: boolean): void {
  const words = SEND_STAGE_WORDS["still-confirming"];
  walletProgressToasts.dismiss();
  toastService.info({
    title: intl.formatMessage(words.label),
    message: intl.formatMessage(
      unchecked ? { id: "app.work.confirmationUnchecked" } : words.detail
    ),
    context: "work",
  });
}

export function showWorkSubmissionFailure(
  error: unknown,
  context: FailureRecord & Pick<UseWorkMutationOptions, "gardenAddress"> & { intl: IntlShape }
) {
  const { intl, authMode, actionUID, gardenAddress, imageCount, allowOfflineQueue } = context;
  const recorded = recordFailure(error, context);
  if (!recorded) return;

  if (recorded.cancelled) {
    walletProgressToasts.dismiss();
    toastService.info({
      id: "work-upload",
      title: intl.formatMessage({ id: "app.work.sendCancelled.title" }),
      // Only the queue keeps declined work to send from Your Work later.
      message: intl.formatMessage({
        id: allowOfflineQueue
          ? "app.work.sendCancelled.message"
          : "app.errors.blockchain.userRejected.message",
      }),
      context: "work upload",
    });
    return;
  }

  const { phase, uploadBatchId, title, message, parsed } = recorded;

  // A passkey account has no wallet to reconnect, so a wallet's own advice reads as an unknown
  // failure there and gets the phase-aware fallback instead.
  const known =
    parsed.isKnown && !(parsed.suggestedAction === "check-wallet" && authMode !== "wallet");

  // Use parsed error if known, otherwise provide phase-aware fallback
  let displayMessage: string;
  if (error instanceof WorkTransactionReverted) {
    displayMessage = intl.formatMessage({ id: "app.work.confirmationFailed" });
  } else if (known) {
    displayMessage = message;
  } else if (phase === "upload") {
    displayMessage = "Media upload failed. Please check your connection and try again.";
  } else if (authMode === "wallet") {
    displayMessage = "Transaction failed. Check your wallet and try again.";
  } else {
    displayMessage = intl.formatMessage({ id: "app.home.work.retryError" });
  }

  if (authMode === "wallet") {
    // Use wallet progress toast for consistent UX
    walletProgressToasts.error(displayMessage, parsed.recoverable ?? false);
  } else {
    // A send that failed for an unknown reason has the one name every surface gives it.
    const displayTitle = known
      ? title
      : intl.formatMessage({ id: "app.toast.queue.jobFailed.title" });
    const description = known
      ? parsed.action || undefined
      : intl.formatMessage({ id: "app.home.work.retryFailedMessage" });

    toastService.error({
      id: "work-upload",
      title: displayTitle,
      message: displayMessage,
      context: "work upload",
      description,
      error,
    });
  }

  if (DEBUG_ENABLED) {
    debugError("[WorkMutation] Work submission failed", error, {
      gardenAddress,
      actionUID,
      authMode,
      phase,
      uploadBatchId,
      imageCount: imageCount,
      parsedError: parsed.name,
      message: displayMessage,
    });
  }
}
