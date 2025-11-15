/**
 * Work Approval Hook
 *
 * Provides unified interface for work approval submission that branches
 * based on authentication mode:
 * - Wallet mode: Direct transaction via wallet client
 * - Passkey mode: Direct smart-account transaction (Pimlico sponsored)
 *
 * @module hooks/work/useWorkApproval
 */

import { useMutation } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { useUser } from "../auth/useUser";
import { jobQueue } from "../../modules/job-queue";
import { submitApprovalDirectly } from "../../modules/work/wallet-submission";
import { submitApprovalToQueue } from "../../modules/work/work-submission";
import { toastService } from "../../toast";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../../utils/debug";

interface UseWorkApprovalParams {
  draft: WorkApprovalDraft;
  work: Work;
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
  const { authMode, smartAccountClient } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  return useMutation({
    mutationFn: async ({ draft, work }: UseWorkApprovalParams) => {
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
        return await submitApprovalDirectly(draft, work.gardenerAddress || "", chainId);
      }

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Queuing approval for passkey flow", {
          chainId,
          workUID: draft.workUID,
          approved: draft.approved,
        });
      }

      const { txHash: offlineTxHash, jobId } = await submitApprovalToQueue(draft, work, chainId);

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
            return result.txHash as `0x${string}`;
          }
        } catch (error) {
          if (DEBUG_ENABLED) {
            debugWarn("[useWorkApproval] Inline approval processing threw", { jobId, error });
          }
        }
      }

      return offlineTxHash;
    },
    onMutate: (variables) => {
      if (DEBUG_ENABLED && variables) {
        debugLog("[useWorkApproval] Submitting approval mutation", {
          authMode,
          chainId,
          workUID: variables.draft.workUID,
          approved: variables.draft.approved,
        });
      }
      const actionLabel = variables?.draft.approved ? "approval" : "decision";
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
    onSuccess: (txHash, variables) => {
      const isApproval = variables?.draft.approved ?? false;
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");
      const successMessage = isApproval ? "Decision recorded." : "Feedback recorded.";
      const title =
        authMode === "wallet"
          ? isApproval
            ? "Approval submitted"
            : "Decision submitted"
          : isOfflineHash
            ? isApproval
              ? "Approval saved offline"
              : "Decision saved offline"
            : isApproval
              ? "Approval submitted"
              : "Decision submitted";
      const message =
        authMode === "wallet"
          ? "Transaction confirmed."
          : isOfflineHash
            ? "We'll sync this automatically when you're back online."
            : successMessage;
      toastService.success({
        id: "approval-submit",
        title,
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "approval submission",
        suppressLogging: true,
      });
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
