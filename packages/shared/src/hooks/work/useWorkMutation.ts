/**
 * Work Mutation Hook
 *
 * Manages the work submission mutation with proper auth branching,
 * toast notifications, and job queue integration.
 *
 * @module hooks/work/useWorkMutation
 */

import { useMutation } from "@tanstack/react-query";
import type { SmartAccountClient } from "permissionless";
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
} from "../../modules/app/analytics-events";
import { trackContractError, addBreadcrumb } from "../../modules/app/error-tracking";
import { jobQueue } from "../../modules/job-queue";
import { submitWorkDirectly } from "../../modules/work/wallet-submission";
import { submitWorkToQueue } from "../../modules/work/work-submission";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { getActionTitle } from "../../utils/action/parsers";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { parseAndFormatError } from "../../utils/errors/contract-errors";

interface UseWorkMutationOptions {
  authMode: "wallet" | "passkey" | null;
  smartAccountClient: SmartAccountClient | null;
  gardenAddress: string | null;
  actionUID: number | null;
  actions: Action[];
  /** User address (smart account or wallet) for scoping jobs */
  userAddress: string | null;
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
  const { authMode, smartAccountClient, gardenAddress, actionUID, actions, userAddress } = options;
  const chainId = DEFAULT_CHAIN_ID;
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);

  return useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      // Validate user address is available for queue operations
      if (!userAddress) {
        throw new Error("User address is required for work submission");
      }

      if (DEBUG_ENABLED) {
        const draftSummary = {
          hasFeedback: Boolean(draft.feedback),
          feedbackLength: draft.feedback?.length ?? 0,
          plantSelection: draft.plantSelection,
          plantCount: draft.plantCount ?? null,
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
            gardenAddress!,
            actionUID!,
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
        return await submitWorkDirectly(
          draft,
          gardenAddress!,
          actionUID!,
          actionTitle,
          chainId,
          images,
          {
            onProgress: (stage) => {
              // Map wallet submission stages to toast updates
              if (stage === "complete") {
                walletProgressToasts.success();
              } else {
                showWalletProgress(stage);
              }
            },
          }
        );
      }

      if (DEBUG_ENABLED) {
        debugLog("[WorkMutation] Queuing work submission for passkey flow", {
          gardenAddress,
          actionUID,
          actionTitle,
          userAddress,
        });
      }

      const {
        txHash: offlineTxHash,
        jobId,
        clientWorkId,
      } = await submitWorkToQueue(
        { ...draft } as WorkDraft,
        gardenAddress!,
        actionUID!,
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

      if (navigator.onLine && smartAccountClient) {
        const result = await jobQueue.processJob(jobId, { smartAccountClient });

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
    onMutate: (variables) => {
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
      });
      trackWorkSubmissionStarted({
        gardenAddress: gardenAddress ?? "",
        actionUID: actionUID ?? 0,
        actionTitle,
        authMode,
        imageCount: variables?.images.length ?? 0,
      });

      const isOffline = !navigator.onLine;

      if (isOffline) {
        workToasts.savedOffline();
      } else if (authMode !== "wallet") {
        // For wallet mode, progress toasts are shown via onProgress callback
        workToasts.submitting();
      }
      // For wallet mode online, the first progress toast will be shown
      // automatically when submitWorkDirectly calls onProgress("validating")
    },
    onSuccess: (txHash) => {
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");

      // Track submission success
      trackWorkSubmissionSuccess({
        gardenAddress: gardenAddress ?? "",
        actionUID: actionUID ?? 0,
        txHash: String(txHash ?? ""),
        authMode,
        wasOffline: isOfflineHash,
      });

      // Mark submission as complete (triggers checkmark animation in Garden view)
      // The Garden view useEffect will handle:
      // 1. Clearing the draft
      // 2. Navigating to /home
      // 3. Opening the work dashboard
      useWorkFlowStore.getState().setSubmissionCompleted(true);

      if (isOfflineHash) {
        // Offline: dismiss info toast after brief delay
        setTimeout(() => workToasts.dismiss(), 1000);
      } else if (authMode === "wallet") {
        // Wallet mode: success already shown by onProgress("complete") callback
        // Just dismiss the loading toast after a delay so user sees the success
        setTimeout(() => walletProgressToasts.dismiss(), 1500);
      } else {
        // Passkey mode with inline processing: dismiss loading toast
        // Success will be shown by job queue event handler
        workToasts.dismiss();
      }

      // Open work dashboard immediately - navigation will follow from Garden view
      // This creates a fluid transition: success checkmark → dashboard slides up → navigate
      openWorkDashboard();

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
    onError: (error: unknown, variables) => {
      // Parse contract error for user-friendly message
      const { title, message, parsed } = parseAndFormatError(error);

      // Track submission failure - funnel event
      trackWorkSubmissionFailed({
        gardenAddress: gardenAddress ?? "",
        actionUID: actionUID ?? 0,
        error: parsed.message || (error instanceof Error ? error.message : "Unknown error"),
        authMode,
      });

      // Also track as structured exception for PostHog error dashboard
      trackContractError(error, {
        source: "useWorkMutation",
        gardenAddress: gardenAddress ?? undefined,
        authMode,
        userAction: "submitting work",
        metadata: {
          actionUID,
          imageCount: variables?.images.length ?? 0,
          parsedErrorName: parsed.name,
          isKnown: parsed.isKnown,
        },
      });

      // Use parsed error if known, otherwise provide fallback based on auth mode
      const displayMessage = parsed.isKnown
        ? message
        : authMode === "wallet"
          ? "Transaction failed. Check your wallet and try again."
          : "We couldn't submit your work. It'll retry shortly.";

      if (authMode === "wallet") {
        // Use wallet progress toast for consistent UX
        walletProgressToasts.error(displayMessage, parsed.recoverable ?? false);
      } else {
        const displayTitle = parsed.isKnown ? title : "Work submission failed";
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
          imageCount: variables?.images.length ?? 0,
          parsedError: parsed.name,
          message: displayMessage,
        });
      }
    },
  });
}

export type UseWorkMutationReturn = ReturnType<typeof useWorkMutation>;
