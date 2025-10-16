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
import { submitApprovalDirectly } from "@/modules/work/wallet-submission";
import { submitApprovalWithPasskey } from "@/modules/work/passkey-submission";
import { useUser } from "@/hooks/auth/useUser";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { createLogger } from "@/utils/app/logger";

const logger = createLogger("useWorkApproval");

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
      logger.log("Starting approval submission", { authMode, workUID: draft.workUID });

      if (authMode === "wallet") {
        // Direct wallet submission
        logger.log("Using direct wallet submission");
        return await submitApprovalDirectly(draft, work.gardenerAddress || "", chainId);
      }

      logger.log("Using passkey smart account submission");
      return await submitApprovalWithPasskey({
        client: smartAccountClient,
        draft,
        gardenerAddress: work.gardenerAddress || "",
        chainId,
      });
    },
    onMutate: () => {
      const message =
        authMode === "wallet" ? "Awaiting wallet confirmation..." : "Submitting approval...";
      toast.loading(message, { id: "approval-submit" });
    },
    onSuccess: () => {
      toast.dismiss("approval-submit");
      const message =
        authMode === "wallet" ? "Approval transaction confirmed!" : "Approval submitted!";
      toast.success(message);
      logger.log("Approval submission successful");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to submit approval. Please try again.";
      toast.error(message);
      toast.dismiss("approval-submit");
      logger.error("Approval submission failed", error);
    },
  });
}
