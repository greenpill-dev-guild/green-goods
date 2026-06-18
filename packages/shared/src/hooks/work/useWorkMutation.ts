/**
 * Work Mutation Hook
 *
 * Manages the work submission mutation with proper auth branching,
 * toast notifications, and job queue integration.
 *
 * @module hooks/work/useWorkMutation
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import {
  showWalletProgress,
  toastService,
  walletProgressToasts,
  workToasts,
} from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
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
import {
  WorkSubmissionError,
  type WalletSubmissionStage,
} from "../../modules/work/wallet-submission/types";
import { isOfflineTxHash, jobQueue } from "../../modules/job-queue";
import { simulateWorkSubmission } from "../../modules/work/simulate";
import { submitWorkDirectly } from "../../modules/work/wallet-submission";
import { submitWorkToQueue } from "../../modules/work/work-submission";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import type { Action, Address, Work, WorkDraft } from "../../types/domain";
import { getActionTitle } from "../../utils/action/parsers";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { parseAndFormatError, parseContractError } from "../../utils/errors/contract-errors";
import { INDEXER_LAG_SCHEDULE_MS, queryKeys } from "../../config/query-keys";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation, useTimeout } from "../utils/useTimeout";

export interface UseWorkMutationOptions {
  authMode: "wallet" | "passkey" | "embedded" | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  actions: Action[];
  /** User address (smart account or wallet) for scoping jobs */
  userAddress: Address | null;
  /**
   * Client PWA completion behavior is on by default. Admin and other consumers
   * can opt out while still using the shared submission pipeline.
   */
  completeClientFlow?: boolean;
  /**
   * Client PWA queue fallback is on by default. Admin consumers can disable it
   * so a wallet/network failure never looks like a completed admin submission.
   */
  allowOfflineQueue?: boolean;
  onProgress?: (stage: WalletSubmissionStage, message: string) => void;
  onSuccess?: (txHash: `0x${string}` | string) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

/**
 * Detect genuine network/connectivity errors that warrant queue fallback.
 *
 * IMPORTANT: Upload-phase errors (IPFS failures) must NOT be classified as
 * network errors. They contain words like "gateway" and "timeout" from IPFS
 * infrastructure, but silently queuing them hides the failure from the user
 * and skips the wallet signing step entirely. Only transaction-phase and
 * true connectivity errors should trigger the offline queue fallback.
 */
function isNetworkError(error: unknown): boolean {
  // Upload-phase errors should surface to the user, not silently queue
  if (error instanceof WorkSubmissionError && error.phase === "upload") {
    return false;
  }

  const originalError =
    error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (parseContractError(originalError).name === "WalletRequestExpired") {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("connection") ||
    message.includes("gateway")
  );
}

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
  } = options;
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const walletRequestStartedJourneyRef = useRef<string | null>(null);

  // Use managed timeout for toast dismissal to ensure cleanup on unmount
  const { set: scheduleToastDismiss } = useTimeout();
  // Progressive invalidation for indexer lag follow-up
  const lastGardenRef = useRef<string | null>(gardenAddress);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.online(lastGardenRef.current, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(lastGardenRef.current, chainId),
        });
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      const workSubmissionJourneyId = useWorkFlowStore.getState().ensureWorkSubmissionJourneyId();

      // Validate required context before submission
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

      const actionTitle = getActionTitle(actions, actionUID);

      // Branch based on authentication mode
      if (authMode === "wallet") {
        // Check if offline - wallet users also queue when offline
        if (!navigator.onLine) {
          if (!allowOfflineQueue) {
            throw new Error("Offline queue is disabled for this submission surface");
          }

          if (DEBUG_ENABLED) {
            debugLog("[WorkMutation] Wallet user offline - queuing work", {
              gardenAddress,
              actionUID,
              actionTitle,
              userAddress,
            });
          }
          const { txHash: offlineTxHash } = await submitWorkToQueue(
            { ...draft } as WorkDraft,
            gardenAddress,
            actionUID,
            actions,
            chainId,
            images,
            userAddress
          );
          return offlineTxHash;
        }

        // Online wallet users: direct submission
        if (DEBUG_ENABLED) {
          debugLog("[WorkMutation] Submitting work via wallet flow", {
            gardenAddress,
            actionUID,
            actionTitle,
          });
        }
        try {
          walletRequestStartedJourneyRef.current = null;
          return await submitWorkDirectly(
            draft,
            gardenAddress,
            actionUID,
            actionTitle,
            chainId,
            images,
            {
              onProgress: (stage, message) => {
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

                // Map wallet submission stages to toast updates
                if (stage === "complete") {
                  walletProgressToasts.success();
                } else {
                  showWalletProgress(stage, message);
                }
                onProgress?.(stage, message);
              },
            }
          );
        } catch (error) {
          if (isNetworkError(error)) {
            if (!allowOfflineQueue) {
              throw error;
            }

            // Genuine network error during transaction phase — fall back to queue.
            // Insert an optimistic entry so the work is visible in the UI
            // (onMutate skips this for online wallet users, expecting submitWorkDirectly
            // to handle it after the transaction confirms).
            const actionTitle = getActionTitle(actions, actionUID);
            const optimisticWork: Work = {
              id: `0xoffline_optimistic_${Date.now()}`,
              title: actionTitle || "",
              actionUID,
              gardenAddress,
              gardenerAddress: userAddress ?? "",
              feedback: draft.feedback || "",
              metadata: JSON.stringify({
                details: draft.details ?? {},
                timeSpentMinutes: draft.timeSpentMinutes,
              }),
              media: [],
              createdAt: Math.floor(Date.now() / 1000),
              status: "pending",
            };
            queryClient.setQueryData(
              queryKeys.works.merged(gardenAddress, chainId),
              (old: Work[] = []) => [optimisticWork, ...old]
            );

            if (DEBUG_ENABLED) {
              debugLog(
                "[WorkMutation] Network error during wallet submission, falling back to queue",
                {
                  error: error instanceof Error ? error.message : String(error),
                  gardenAddress,
                  actionUID,
                }
              );
            }

            const { txHash: offlineTxHash } = await submitWorkToQueue(
              { ...draft } as WorkDraft,
              gardenAddress,
              actionUID,
              actions,
              chainId,
              images,
              userAddress
            );
            return offlineTxHash;
          }
          throw error;
        }
      }

      if (!allowOfflineQueue) {
        throw new Error("Offline queue is disabled for this submission surface");
      }

      if (DEBUG_ENABLED) {
        debugLog("[WorkMutation] Queuing work submission for passkey flow", {
          gardenAddress,
          actionUID,
          actionTitle,
          userAddress,
        });
      }

      if (navigator.onLine) {
        await simulateWorkSubmission({
          draft,
          gardenAddress,
          actionUID,
          actionTitle: actionTitle || `Action ${actionUID}`,
          chainId,
          images,
          accountAddress: userAddress as `0x${string}`,
        });
      }

      const {
        txHash: offlineTxHash,
        jobId,
        clientWorkId,
      } = await submitWorkToQueue(
        { ...draft } as WorkDraft,
        gardenAddress,
        actionUID,
        actions,
        chainId,
        images,
        userAddress
      );

      if (DEBUG_ENABLED) {
        debugLog("[WorkMutation] Work queued", {
          jobId,
          clientWorkId,
          gardenAddress,
          actionUID,
          isOnline: navigator.onLine,
        });
      }

      if (navigator.onLine && sender) {
        const result = await jobQueue.processJob(jobId, { transactionSender: sender });

        if (DEBUG_ENABLED) {
          debugLog("[WorkMutation] Inline processing attempt finished", {
            jobId,
            clientWorkId,
            success: result.success,
            skipped: result.skipped,
            error: result.error,
          });
        }

        // If processing failed with an actual error (not just skipped), surface it
        if (!result.success && result.error && !result.skipped) {
          throw new Error(result.error);
        }

        if (result.success && result.txHash) {
          return result.txHash as `0x${string}`;
        }
      }

      return offlineTxHash;
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

      // Track submission started
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
          queryKey: queryKeys.works.merged(gardenAddress, chainId),
        });

        previousMerged = queryClient.getQueryData<Work[]>(
          queryKeys.works.merged(gardenAddress, chainId)
        );

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

          queryClient.setQueryData(
            queryKeys.works.merged(gardenAddress, chainId),
            (old: Work[] = []) => [optimisticWork, ...old]
          );

          if (DEBUG_ENABLED) {
            debugLog("[WorkMutation] Inserted optimistic work entry", {
              optimisticId: optimisticWork.id,
              gardenAddress,
            });
          }
        }
      }

      // --- Toasts ---
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
          queryKey: queryKeys.works.online(gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(gardenAddress, chainId),
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
        queryClient.setQueryData(
          queryKeys.works.merged(gardenAddress, chainId),
          context.previousMerged
        );
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

  return useSafeMutation(mutation);
}

export type UseWorkMutationReturn = ReturnType<typeof useWorkMutation>;
