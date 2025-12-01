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
import { toastService, workToasts } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { jobQueue } from "../../modules/job-queue";
import { submitWorkDirectly } from "../../modules/work/wallet-submission";
import { submitWorkToQueue } from "../../modules/work/work-submission";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { getActionTitle } from "../../utils/action/parsers";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../../utils/debug";
import { parseAndFormatError } from "../../utils/errors/contract-errors";

interface UseWorkMutationOptions {
  authMode: "wallet" | "passkey" | null;
  smartAccountClient: SmartAccountClient | null;
  gardenAddress: string | null;
  actionUID: number | null;
  actions: Action[];
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
  const { authMode, smartAccountClient, gardenAddress, actionUID, actions } = options;
  const chainId = DEFAULT_CHAIN_ID;
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);

  return useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
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
            });
          }
          const { txHash: offlineTxHash } = await submitWorkToQueue(
            { ...draft } as WorkDraft,
            gardenAddress!,
            actionUID!,
            actions,
            chainId,
            images
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
          images
        );
      }

      if (DEBUG_ENABLED) {
        debugLog("[WorkMutation] Queuing work submission for passkey flow", {
          gardenAddress,
          actionUID,
          actionTitle,
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
        images
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
        try {
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
          if (result.success && result.txHash) {
            return result.txHash as `0x${string}`;
          }
        } catch (error) {
          if (DEBUG_ENABLED) {
            debugWarn("[WorkMutation] Inline processing threw", { jobId, error });
          }
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

      const isOffline = !navigator.onLine;

      if (isOffline) {
        workToasts.savedOffline();
      } else {
        workToasts.submitting();
      }
    },
    onSuccess: (txHash) => {
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");

      // Mark submission as complete (triggers checkmark)
      useWorkFlowStore.getState().setSubmissionCompleted(true);

      if (isOfflineHash) {
        // Offline: dismiss info toast after brief delay
        setTimeout(() => workToasts.dismiss(), 1500);
      } else if (authMode === "wallet") {
        // Wallet mode: show success toast (passkey mode handled by queue events)
        workToasts.success();
      } else {
        // Passkey mode with inline processing: dismiss loading toast
        // Success will be shown by job queue event handler
        workToasts.dismiss();
      }

      // Navigate after short delay to show checkmark
      setTimeout(
        () => {
          openWorkDashboard();
          // Navigation will happen in Garden view via useEffect watching submissionCompleted
        },
        isOfflineHash ? 1000 : 1500
      );

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

      // Use parsed error if known, otherwise provide fallback based on auth mode
      const displayTitle = parsed.isKnown ? title : "Work submission failed";
      const displayMessage = parsed.isKnown
        ? message
        : authMode === "wallet"
          ? "Transaction failed. Check your wallet and try again."
          : "We couldn't submit your work. It'll retry shortly.";

      const description = parsed.isKnown
        ? parsed.action || undefined
        : authMode === "wallet"
          ? "If the issue persists, reconnect your wallet and resubmit."
          : "You can stay on this page; the queue will keep retrying.";

      toastService.error({
        id: "work-upload",
        title: displayTitle,
        message: displayMessage,
        context: authMode === "wallet" ? "wallet confirmation" : "work upload",
        description,
        error,
      });

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
