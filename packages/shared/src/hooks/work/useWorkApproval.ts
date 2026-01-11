/**
 * Work Approval Hook
 *
 * Provides unified interface for work approval submission that branches
 * based on authentication mode:
 * - Wallet mode: Direct transaction via wallet client (updates status after confirmation)
 * - Passkey mode: Direct smart-account transaction (Pimlico sponsored, updates status after confirmation)
 *
 * The UI remains in a pending state until the transaction is confirmed on-chain.
 * For offline/queued submissions, status updates occur when the job:completed event fires.
 *
 * @module hooks/work/useWorkApproval
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import {
  trackWorkApprovalFailed,
  trackWorkApprovalStarted,
  trackWorkApprovalSuccess,
  trackWorkRejectionSuccess,
} from "../../modules/app/analytics-events";
import { jobQueue } from "../../modules/job-queue";
import { submitApprovalDirectly } from "../../modules/work/wallet-submission";
import { submitApprovalToQueue } from "../../modules/work/work-submission";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../../utils/debug";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";

interface UseWorkApprovalParams {
  draft: WorkApprovalDraft;
  work: Work;
}

/** Mutation result including wallet submission details */
interface ApprovalMutationResult {
  hash: `0x${string}`;
}

/**
 * Hook for submitting work approvals
 *
 * Automatically branches based on authentication mode:
 * - Wallet users: Direct blockchain transaction
 * - Passkey users: Sponsored smart-account transaction
 *
 * @returns TanStack Query mutation for approval submission
 *
 * @example
 * ```tsx
 * function ApprovalForm({ work }) {
 *   const approvalMutation = useWorkApproval();
 *
 *   const handleApprove = async () => {
 *     await approvalMutation.mutateAsync({
 *       draft: { workUID, actionUID, approved: true, feedback: "Great work!" },
 *       work
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleApprove}
 *       disabled={approvalMutation.isPending}
 *     >
 *       {approvalMutation.isPending ? "Submitting..." : "Approve"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useWorkApproval() {
  const { authMode, smartAccountClient, smartAccountAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ draft, work }: UseWorkApprovalParams): Promise<ApprovalMutationResult> => {
      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Starting approval submission", {
          authMode,
          workUID: draft.workUID,
          approved: draft.approved,
          chainId,
        });
      }

      if (authMode === "wallet") {
        // Direct wallet submission
        if (DEBUG_ENABLED) {
          debugLog("[useWorkApproval] Using direct wallet submission", {
            chainId,
            workUID: draft.workUID,
          });
        }
        const hash = await submitApprovalDirectly(
          draft,
          work.gardenAddress,
          work.gardenerAddress,
          chainId
        );
        return { hash };
      }

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Queuing approval for passkey flow", {
          chainId,
          workUID: draft.workUID,
          approved: draft.approved,
          userAddress: smartAccountAddress,
        });
      }

      // Validate user address for queue operations
      if (!smartAccountAddress) {
        throw new Error("User address is required for approval submission");
      }

      const { txHash: offlineTxHash, jobId } = await submitApprovalToQueue(
        draft,
        work,
        chainId,
        smartAccountAddress
      );

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Approval queued", {
          jobId,
          workUID: draft.workUID,
          isOnline: navigator.onLine,
        });
      }

      if (navigator.onLine && smartAccountClient) {
        try {
          const result = await jobQueue.processJob(jobId, { smartAccountClient });
          if (DEBUG_ENABLED) {
            debugLog("[useWorkApproval] Inline processing attempt finished", {
              jobId,
              success: result.success,
              skipped: result.skipped,
              error: result.error,
            });
          }
          if (result.success && result.txHash) {
            return { hash: result.txHash as `0x${string}` };
          }
          // If processing failed (not skipped), propagate the error
          if (!result.success && result.error && !result.skipped) {
            throw new Error(result.error);
          }
          // If skipped (e.g., already processed), return offline hash as pending
        } catch (error) {
          if (DEBUG_ENABLED) {
            debugWarn("[useWorkApproval] Inline approval processing threw", { jobId, error });
          }
          // Re-throw to trigger onError handler and show user feedback
          throw error;
        }
      }

      return { hash: offlineTxHash };
    },
    onMutate: async (variables) => {
      if (!variables) return;

      // Track approval started
      trackWorkApprovalStarted({
        workUID: variables.draft.workUID,
        gardenAddress: variables.work.gardenAddress,
        approved: variables.draft.approved,
        authMode,
      });

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Submitting approval mutation", {
          authMode,
          chainId,
          workUID: variables.draft.workUID,
          approved: variables.draft.approved,
        });
      }

      const { draft } = variables;

      // Show loading toast
      const actionLabel = draft.approved ? "approval" : "decision";
      const message =
        authMode === "wallet"
          ? "Waiting for wallet confirmation..."
          : !navigator.onLine
            ? `Saving ${actionLabel} offline...`
            : `Submitting ${actionLabel}...`;
      const title =
        authMode === "wallet"
          ? "Confirm in your wallet"
          : !navigator.onLine
            ? "Working offline"
            : "Submitting approval";
      toastService.loading({
        id: "approval-submit",
        title,
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "approval submission",
        suppressLogging: true,
      });
    },
    onSuccess: (result, variables) => {
      const { hash: txHash } = result;
      const isApproval = variables?.draft.approved ?? false;
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");

      // Track approval/rejection success
      if (isApproval) {
        trackWorkApprovalSuccess({
          workUID: variables?.draft.workUID ?? "",
          gardenAddress: variables?.work.gardenAddress ?? "",
          txHash,
          authMode,
        });
      } else {
        trackWorkRejectionSuccess({
          workUID: variables?.draft.workUID ?? "",
          gardenAddress: variables?.work.gardenAddress ?? "",
          txHash,
          authMode,
        });
      }

      // Update status in cache ONLY after transaction is confirmed (not for offline placeholders)
      // This ensures UI transitions to approved/rejected state only after on-chain confirmation
      if (variables && !isOfflineHash) {
        const { draft, work } = variables;

        queryClient.setQueryData(
          queryKeys.works.merged(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? { ...w, status: draft.approved ? ("approved" as const) : ("rejected" as const) }
                : w
            )
        );

        queryClient.setQueryData(
          queryKeys.works.online(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? { ...w, status: draft.approved ? ("approved" as const) : ("rejected" as const) }
                : w
            )
        );

        if (DEBUG_ENABLED) {
          debugLog("[useWorkApproval] Updated status after confirmation", {
            authMode,
            workUID: draft.workUID,
            newStatus: draft.approved ? "approved" : "rejected",
          });
        }
      }

      // Show success toast for wallet mode (direct submission)
      if (authMode === "wallet") {
        toastService.success({
          id: "approval-submit",
          title: isApproval ? "Approval submitted" : "Decision submitted",
          message: "Transaction confirmed.",
          context: "wallet confirmation",
          suppressLogging: true,
        });
      } else {
        // Passkey mode or offline
        const successMessage = isApproval ? "Decision recorded." : "Feedback recorded.";
        const title = isOfflineHash
          ? isApproval
            ? "Approval saved offline"
            : "Decision saved offline"
          : isApproval
            ? "Approval submitted"
            : "Decision submitted";
        const message = isOfflineHash
          ? "We'll sync this automatically when you're back online."
          : successMessage;

        toastService.success({
          id: "approval-submit",
          title,
          message,
          context: "approval submission",
          suppressLogging: true,
        });
      }

      // Invalidate work queries to refetch from EAS after a delay
      // (EAS indexer has 2-6 second lag)
      if (variables) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.works.online(variables.work.gardenAddress, chainId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.works.merged(variables.work.gardenAddress, chainId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.workApprovals.all,
          });
        }, 3000); // 3 second delay for indexer
      }

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Approval submission successful", {
          authMode,
          chainId,
          workUID: variables?.draft.workUID,
          txHash,
          wasOffline: isOfflineHash,
        });
      }
    },
    onError: (error: unknown, variables) => {
      // Track approval failure
      trackWorkApprovalFailed({
        workUID: variables?.draft.workUID ?? "",
        gardenAddress: variables?.work.gardenAddress ?? "",
        error: error instanceof Error ? error.message : "Unknown error",
        authMode,
      });

      const isApproval = variables?.draft.approved ?? false;
      const message =
        authMode === "wallet"
          ? "Transaction failed. Check your wallet and try again."
          : `We couldn't send the ${isApproval ? "approval" : "decision"}. We'll retry shortly.`;
      toastService.error({
        id: "approval-submit",
        title: isApproval ? "Approval failed" : "Decision failed",
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "approval submission",
        description:
          authMode === "wallet"
            ? "If this keeps happening, reconnect your wallet before resubmitting."
            : "Keep the app open; the queue will keep trying in the background.",
        error,
      });
      if (DEBUG_ENABLED) {
        debugError("[useWorkApproval] Approval submission failed", error, {
          authMode,
          chainId,
          workUID: variables?.draft.workUID,
          approved: variables?.draft.approved,
          gardenerAddress: variables?.work?.gardenerAddress,
          message,
        });
      }
    },
  });
}
