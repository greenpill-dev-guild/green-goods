import type { IntlShape } from "react-intl";
import type { UseWorkMutationOptions } from "./useWorkMutation.types";
import { WorkTransactionReverted } from "../../modules/work/work-confirmation";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import {
  trackWorkSubmissionFailed,
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestFailed,
} from "../../modules/app/analytics-events";
import { trackContractError, trackUploadError } from "../../modules/app/error-tracking";
import { walletProgressToasts, toastService } from "../../components/toast";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { DEBUG_ENABLED, debugError } from "../../utils/debug";

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
  }: Pick<UseWorkMutationOptions, "authMode" | "actionUID" | "gardenAddress"> & {
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

  // Parse contract error for user-friendly message
  const { title, message, parsed } = parseAndFormatError(originalError);

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

  // Use parsed error if known, otherwise provide phase-aware fallback
  let displayMessage: string;
  if (error instanceof WorkTransactionReverted) {
    displayMessage = intl.formatMessage({ id: "app.work.confirmationFailed" });
  } else if (parsed.isKnown) {
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
    const displayTitle = parsed.isKnown
      ? title
      : phase === "upload"
        ? "Upload failed"
        : "Work submission failed";
    const description = parsed.isKnown
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
