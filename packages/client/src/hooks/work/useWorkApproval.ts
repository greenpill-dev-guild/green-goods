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
import toast from "react-hot-toast";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { useUser } from "@/hooks/auth/useUser";
import { submitApprovalWithPasskey } from "@/modules/work/passkey-submission";
import { submitApprovalDirectly } from "@/modules/work/wallet-submission";
import { DEBUG_ENABLED, debugError, debugLog } from "@/utils/debug";

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
        debugLog("[useWorkApproval] Using passkey smart account submission", {
          chainId,
          workUID: draft.workUID,
        });
      }
      return await submitApprovalWithPasskey({
        client: smartAccountClient,
        draft,
        gardenerAddress: work.gardenerAddress || "",
        chainId,
      });
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
      const message =
        authMode === "wallet" ? "Awaiting wallet confirmation..." : "Submitting approval...";
      toast.loading(message, { id: "approval-submit" });
    },
    onSuccess: (_, variables) => {
      toast.dismiss("approval-submit");
      const message =
        authMode === "wallet" ? "Approval transaction confirmed!" : "Approval submitted!";
      toast.success(message);
      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Approval submission successful", {
          authMode,
          chainId,
          workUID: variables?.draft.workUID,
        });
      }
    },
    onError: (error: unknown, variables) => {
      const message =
        error instanceof Error ? error.message : "Failed to submit approval. Please try again.";
      toast.error(message);
      toast.dismiss("approval-submit");
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
