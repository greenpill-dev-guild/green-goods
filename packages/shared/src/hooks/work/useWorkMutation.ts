/**
 * Work Mutation Hook
 *
 * Manages the work submission mutation with proper auth branching,
 * toast notifications, and job queue integration.
 *
 * @module hooks/work/useWorkMutation
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  showWalletProgress,
  toastService,
  walletProgressToasts,
  workToasts,
} from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  trackWorkSubmissionFailed,
  trackWorkSubmissionStarted,
  trackWorkSubmissionSuccess,
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestFailed,
  trackWorkWalletRequestStarted,
} from "../../modules/app/analytics-events";
import {
  addBreadcrumb,
  trackContractError,
  trackUploadError,
} from "../../modules/app/error-tracking";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import { isOfflineTxHash } from "../../modules/job-queue/queue-policy";
import {
  createDefaultSubmitWorkPorts,
  submitWork,
  type SubmitWorkOutcome,
} from "../../modules/work/submit-work-command";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import type { Work, WorkDraft } from "../../types/domain";
import { getActionTitle } from "../../utils/action/parsers";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { worksKeys } from "../../config/query-keys/work";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation, useTimeout } from "../utils/useTimeout";
import type { UseWorkMutationOptions } from "./useWorkMutation.types";

export type { UseWorkMutationOptions } from "./useWorkMutation.types";

/**
 * Hook to manage work submission mutation
 *
 * Handles:
 * - Auth mode branching (wallet vs passkey)
 * - Online/offline detection
 * - Toast notifications
 * - Job queue integration
 *
 * @param options - Configuration options
 * @returns Mutation instance
 */
export function useWorkMutation(options: UseWorkMutationOptions) {
  const {
    authMode,
    gardenAddress,
    actionUID,
    actions,
    userAddress,
    completeClientFlow = true,
    allowOfflineQueue = true,
    onProgress,
    onSuccess,
    onError,
    onSettled,
    dependencies,
  } = options;
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const walletRequestStartedJourneyRef = useRef<string | null>(null);
  const [lastSubmissionOutcome, setLastSubmissionOutcome] = useState<SubmitWorkOutcome | null>(
    null
  );
  const lastSubmissionOutcomeRef = useRef<SubmitWorkOutcome | null>(null);

  // Use managed timeout for toast dismissal to ensure cleanup on unmount
  const { set: scheduleToastDismiss } = useTimeout();
  // Progressive invalidation for indexer lag follow-up
  const lastGardenRef = useRef<string | null>(gardenAddress);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryClient.invalidateQueries({
          queryKey: worksKeys.online(lastGardenRef.current, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(lastGardenRef.current, chainId),
        });
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      const workSubmissionJourneyId = useWorkFlowStore.getState().ensureWorkSubmissionJourneyId();

      if (!gardenAddress) {
        throw new Error("Garden must be selected before submitting work");
      }
      if (typeof actionUID !== "number") {
        throw new Error("Action must be selected before submitting work");
      }
      if (!userAddress) {
        throw new Error("User address is required for work submission");
      }

      if (DEBUG_ENABLED) {
        const draftSummary = {
          hasFeedback: Boolean(draft.feedback),
          feedbackLength: draft.feedback?.length ?? 0,
          detailKeys: Object.keys(draft.details ?? {}),
          hasTags: Boolean(draft.tags?.length),
          hasAudioNotes: Boolean(draft.audioNotes?.length),
        };
        debugLog("[WorkMutation] Preparing work submission payload", {
          authMode,
          gardenAddress,
          actionUID,
          userAddress,
          imageCount: images.length,
          draftSummary,
        });
      }

      walletRequestStartedJourneyRef.current = null;
      const outcome = await submitWork(
        {
          authMode,
          gardenAddress,
          actionUID,
          actions,
          userAddress,
          chainId,
          draft,
          images,
          allowOfflineQueue,
        },
        createDefaultSubmitWorkPorts({
          sender,
          jobQueue: dependencies?.jobQueue,
          onWalletStage: (stage, message) => {
            if (
              stage === "confirming" &&
              walletRequestStartedJourneyRef.current !== workSubmissionJourneyId
            ) {
              walletRequestStartedJourneyRef.current = workSubmissionJourneyId;
              trackWorkWalletRequestStarted({
                workSubmissionJourneyId,
                authMode,
                chainId,
                actionUID,
                imageCount: images.length,
                submissionPhase: "wallet_request",
              });
            }

            if (stage === "complete") {
              walletProgressToasts.success();
            } else {
              showWalletProgress(stage, message);
            }
            onProgress?.(stage, message);
          },
          onQueueFallback: (optimisticWork) => {
            queryClient.setQueryData(
              worksKeys.merged(gardenAddress, chainId),
              (old: Work[] = []) => [optimisticWork, ...old]
            );
          },
        })
      );
      lastSubmissionOutcomeRef.current = outcome;
      setLastSubmissionOutcome(outcome);
      return outcome.txHash;
    },
    onMutate: async (variables) => {
      const workSubmissionJourneyId = useWorkFlowStore.getState().ensureWorkSubmissionJourneyId();

      if (DEBUG_ENABLED && variables) {
        debugLog("[WorkMutation] Starting work submission", {
          gardenAddress,
          actionUID,
          imageCount: variables.images.length,
        });
      }

      const actionTitle = getActionTitle(actions, actionUID);
      addBreadcrumb("work_submission_started", {
        gardenAddress,
        actionUID,
        actionTitle,
        authMode,
        imageCount: variables?.images.length ?? 0,
        workSubmissionJourneyId,
      });
      trackWorkSubmissionStarted({
        actionUID: actionUID ?? 0,
        authMode,
        imageCount: variables?.images.length ?? 0,
        workSubmissionJourneyId,
        chainId,
        submissionPhase: "review",
      });

      // --- Optimistic cache insertion ---
      // Skip for online wallet users — submitWorkDirectly handles its own optimistic insert.
      // Only insert here for passkey users and offline wallet users (queue path).
      // NOTE: If the wallet path hits a network error and falls back to the queue,
      // the catch block inserts an optimistic entry at that point.
      const isWalletOnline = authMode === "wallet" && navigator.onLine;
      let previousMerged: Work[] | undefined;
      if (gardenAddress) {
        await queryClient.cancelQueries({
          queryKey: worksKeys.merged(gardenAddress, chainId),
        });

        previousMerged = queryClient.getQueryData<Work[]>(worksKeys.merged(gardenAddress, chainId));

        if (allowOfflineQueue && !isWalletOnline) {
          // Insert an optimistic Work entry so it appears instantly in lists
          const optimisticWork: Work = {
            id: `0xoffline_optimistic_${Date.now()}`,
            title: actionTitle || "",
            actionUID: actionUID ?? 0,
            gardenerAddress: userAddress ?? "",
            gardenAddress,
            feedback: variables.draft.feedback || "",
            metadata: JSON.stringify({
              details: variables.draft.details ?? {},
              timeSpentMinutes: variables.draft.timeSpentMinutes,
            }),
            media: [],
            createdAt: Math.floor(Date.now() / 1000),
            status: "pending",
          };

          queryClient.setQueryData(worksKeys.merged(gardenAddress, chainId), (old: Work[] = []) => [
            optimisticWork,
            ...old,
          ]);

          if (DEBUG_ENABLED) {
            debugLog("[WorkMutation] Inserted optimistic work entry", {
              optimisticId: optimisticWork.id,
              gardenAddress,
            });
          }
        }
      }

      const isOffline = !navigator.onLine;

      if (allowOfflineQueue && isOffline) {
        workToasts.savedOffline();
      } else if (authMode !== "wallet") {
        // For wallet mode, progress toasts are shown via onProgress callback
        workToasts.submitting();
      }
      // For wallet mode online, the first progress toast will be shown
      // automatically when submitWorkDirectly calls onProgress("validating")

      return { previousMerged };
    },
    onSuccess: (txHash) => {
      const isOfflineHash = typeof txHash === "string" && isOfflineTxHash(txHash);
      const workSubmissionJourneyId = useWorkFlowStore.getState().ensureWorkSubmissionJourneyId();

      // Provide haptic feedback for successful submission
      hapticSuccess();

      // Track submission success
      trackWorkSubmissionSuccess({
        actionUID: actionUID ?? 0,
        authMode,
        wasOffline: isOfflineHash,
        workSubmissionJourneyId,
        chainId,
        submissionPhase: "success",
      });

      if (completeClientFlow) {
        // Mark submission as complete (triggers checkmark animation in Garden view)
        // The Garden view useEffect will handle:
        // 1. Clearing the draft
        // 2. Navigating to /home
        // 3. Opening the work dashboard
        useWorkFlowStore.getState().setSubmissionCompleted(true);
      }

      if (isOfflineHash) {
        // Offline: dismiss info toast after brief delay
        scheduleToastDismiss(() => workToasts.dismiss(), 1000);
      } else if (authMode === "wallet") {
        // Wallet mode: success already shown by onProgress("complete") callback
        // Just dismiss the loading toast after a delay so user sees the success
        scheduleToastDismiss(() => walletProgressToasts.dismiss(), 1500);
      } else {
        // Passkey mode with inline processing: dismiss loading toast
        // Success will be shown by job queue event handler
        workToasts.dismiss();
      }

      // Invalidate work queries so lists reflect the new submission
      if (gardenAddress) {
        queryClient.invalidateQueries({
          queryKey: worksKeys.online(gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(gardenAddress, chainId),
        });

        // Schedule progressive follow-up invalidations for indexer lag
        lastGardenRef.current = gardenAddress;
        scheduleFollowUp();
      }

      if (completeClientFlow) {
        // Open work dashboard immediately - navigation will follow from Garden view.
        // This creates a fluid transition: success checkmark -> dashboard slides up -> navigate.
        openWorkDashboard();
      }

      onSuccess?.(txHash);

      if (DEBUG_ENABLED) {
        debugLog("[WorkMutation] Work submission completed", {
          gardenAddress,
          actionUID,
          authMode,
          txHash,
          wasOffline: isOfflineHash,
        });
      }
    },
    onError: (error: unknown, variables, context) => {
      const workSubmissionJourneyId = useWorkFlowStore.getState().ensureWorkSubmissionJourneyId();

      // Provide haptic feedback for error
      hapticError();

      // Best-effort cleanup for any blob preview URLs attached to failed upload files.
      variables?.images.forEach((image) => {
        const maybePreviewUrl = (image as File & { preview?: string }).preview;
        if (typeof maybePreviewUrl === "string" && maybePreviewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(maybePreviewUrl);
        }
      });

      // Rollback optimistic cache insertion
      if (context?.previousMerged && gardenAddress) {
        queryClient.setQueryData(worksKeys.merged(gardenAddress, chainId), context.previousMerged);
        if (DEBUG_ENABLED) {
          debugLog("[WorkMutation] Rolled back optimistic work entry");
        }
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

      // Parse contract error for user-friendly message
      const { title, message, parsed } = parseAndFormatError(originalError);

      // Track submission failure - funnel event
      trackWorkSubmissionFailed({
        actionUID: actionUID ?? 0,
        error: parsed.name,
        authMode,
        imageCount: variables?.images.length ?? 0,
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
          imageCount: variables?.images.length ?? 0,
          submissionPhase: phase,
          parsedErrorFamily: parsed.name,
        });
      } else if (authMode === "wallet" && phase === "transaction") {
        trackWorkWalletRequestFailed({
          workSubmissionJourneyId,
          authMode,
          chainId,
          actionUID: actionUID ?? undefined,
          imageCount: variables?.images.length ?? 0,
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
            imageCount: variables?.images.length ?? 0,
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
            imageCount: variables?.images.length ?? 0,
            parsedErrorName: parsed.name,
            isKnown: parsed.isKnown,
            submission_phase: phase,
          },
        });
      }

      // Use parsed error if known, otherwise provide phase-aware fallback
      let displayMessage: string;
      if (parsed.isKnown) {
        displayMessage = message;
      } else if (phase === "upload") {
        displayMessage = "Media upload failed. Please check your connection and try again.";
      } else if (authMode === "wallet") {
        displayMessage = "Transaction failed. Check your wallet and try again.";
      } else {
        displayMessage = "We couldn't submit your work. It'll retry shortly.";
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
          : "You can stay on this page; the queue will keep retrying.";

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
          imageCount: variables?.images.length ?? 0,
          parsedError: parsed.name,
          message: displayMessage,
        });
      }

      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });

  return {
    ...useSafeMutation(mutation),
    lastSubmissionOutcome,
    getLastSubmissionOutcome: () => lastSubmissionOutcomeRef.current,
    clearLastSubmissionOutcome: () => {
      lastSubmissionOutcomeRef.current = null;
      setLastSubmissionOutcome(null);
    },
  };
}

export type UseWorkMutationReturn = ReturnType<typeof useWorkMutation>;
