import type { IntlShape } from "react-intl";
import type { UseWorkMutationOptions } from "./useWorkMutation.types";
import { WorkTransactionReverted } from "../../modules/work/work-confirmation";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import { WorkSendCancelledError } from "../../modules/work/send-outcome";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import {
  trackWorkSubmissionFailed,
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestFailed,
} from "../../modules/app/analytics-events";
import { trackContractError, trackUploadError } from "../../modules/app/error-tracking";
import { walletProgressToasts, toastService } from "../../components/toast";
import { formatErrorForToast, parseAndFormatError } from "../../utils/errors/contract-errors";
import { connectionNeededFailure } from "../../utils/errors/unsent-failures";
import { DEBUG_ENABLED, debugError } from "../../utils/debug";

/** Without the offline queue nothing is kept to sync, so offline means nothing was sent. */
function parseSubmissionFailure(error: unknown, allowOfflineQueue: boolean) {
  const formatted = parseAndFormatError(error);
  if (allowOfflineQueue || formatted.parsed.name !== "Offline") return formatted;
  const parsed = connectionNeededFailure(formatted.parsed.raw);
  return { ...formatErrorForToast(parsed), parsed };
}

export function showWorkSubmissionFailure(
  error: unknown,
  {
    intl,
    authMode,
    actionUID,
    gardenAddress,
    chainId,
    imageCount,
    workSubmissionJourneyId,
    allowOfflineQueue,
  }: Pick<UseWorkMutationOptions, "authMode" | "actionUID" | "gardenAddress"> & {
    allowOfflineQueue: boolean;
    intl: IntlShape;
    chainId: number;
    imageCount: number;
    workSubmissionJourneyId: string;
  }
) {
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
    walletProgressToasts.dismiss();
    trackWorkSubmissionFailed({
      actionUID: actionUID ?? 0,
      error: "UserRejected",
      authMode,
      imageCount,
      workSubmissionJourneyId,
      chainId,
      submissionPhase: "transaction",
      parsedErrorFamily: "UserRejected",
    });
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

  // Parse contract error for user-friendly message
  const { title, message, parsed } = parseSubmissionFailure(originalError, allowOfflineQueue);

  // Track submission failure - funnel event
  trackWorkSubmissionFailed({
    actionUID: actionUID ?? 0,
    error: parsed.name,
    authMode,
    imageCount: imageCount,
    workSubmissionJourneyId,
    chainId,
    submissionPhase: phase,
    parsedErrorFamily: parsed.name,
  });

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
