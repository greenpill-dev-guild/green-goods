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
import { useCallback } from "react";
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
import type { Work, WorkApprovalDraft } from "../../types/domain";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog, debugWarn } from "../../utils/debug";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { ValidationError } from "../../utils/errors/validation-error";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryKeys } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useTimeout } from "../utils/useTimeout";

interface UseWorkApprovalParams {
  draft: WorkApprovalDraft;
  work: Work;
}

/** Mutation result including wallet submission details */
interface ApprovalMutationResult {
  hash: `0x${string}`;
}

const PENDING_AUTO_CLEAR_MS = 60_000;
type PendingWork = Work & { _isPending?: boolean; _pendingUntilMs?: number };

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
  const { runWithLock, isPending: isLockPending } = useMutationLock("approval");

  // Separate timeouts: one for auto-clearing stale pending flags, another for indexer lag follow-up.
  // Using a single useTimeout caused the indexer lag timer to cancel the auto-clear timer.
  const { set: scheduleAutoClear } = useTimeout();
  const { set: scheduleInvalidation } = useTimeout();

  const mutation = useMutation({
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

      if (navigator.onLine) {
        await simulateApprovalSubmission({
          draft,
          gardenAddress: work.gardenAddress,
          chainId,
          accountAddress: smartAccountAddress as `0x${string}`,
        });
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

      const { draft, work } = variables;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.works.merged(work.gardenAddress, chainId),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.works.online(work.gardenAddress, chainId),
      });

      // Snapshot previous state for rollback on error
      const previousMerged = queryClient.getQueryData<Work[]>(
        queryKeys.works.merged(work.gardenAddress, chainId)
      );
      const previousOnline = queryClient.getQueryData<Work[]>(
        queryKeys.works.online(work.gardenAddress, chainId)
      );

      const pendingUntilMs = Date.now() + PENDING_AUTO_CLEAR_MS;

      // Optimistically update the work status with a pending indicator
      const optimisticStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

      queryClient.setQueryData(
        queryKeys.works.merged(work.gardenAddress, chainId),
        (old: Work[] = []) =>
          old.map((w) =>
            w.id === draft.workUID
              ? {
                  ...w,
                  status: optimisticStatus,
                  _isPending: true,
                  _pendingUntilMs: pendingUntilMs,
                }
              : w
          )
      );

      queryClient.setQueryData(
        queryKeys.works.online(work.gardenAddress, chainId),
        (old: Work[] = []) =>
          old.map((w) =>
            w.id === draft.workUID
              ? {
                  ...w,
                  status: optimisticStatus,
                  _isPending: true,
                  _pendingUntilMs: pendingUntilMs,
                }
              : w
          )
      );

      // Auto-clear stale pending flags if no completion signal is observed.
      // Uses dedicated timer so it isn't cancelled by the indexer lag follow-up.
      scheduleAutoClear(() => {
        queryClient.setQueryData(
          queryKeys.works.merged(work.gardenAddress, chainId),
          (old: PendingWork[] = []) =>
            old.map((w) =>
              w.id === draft.workUID && w._isPending && (w._pendingUntilMs ?? 0) <= Date.now()
                ? { ...w, _isPending: false, _pendingUntilMs: undefined }
                : w
            )
        );
        queryClient.setQueryData(
          queryKeys.works.online(work.gardenAddress, chainId),
          (old: PendingWork[] = []) =>
            old.map((w) =>
              w.id === draft.workUID && w._isPending && (w._pendingUntilMs ?? 0) <= Date.now()
                ? { ...w, _isPending: false, _pendingUntilMs: undefined }
                : w
            )
        );
      }, PENDING_AUTO_CLEAR_MS + 1000);

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Applied optimistic update", {
          workUID: draft.workUID,
          newStatus: optimisticStatus,
        });
      }

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

      // Return context for rollback
      return { previousMerged, previousOnline };
    },
    onSuccess: (result, variables) => {
      const { hash: txHash } = result;
      const isApproval = variables?.draft.approved ?? false;
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");

      // Provide haptic feedback for successful approval
      hapticSuccess();

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

      // Clear _isPending flag and confirm status after transaction is confirmed
      // For offline hashes, keep _isPending until job is processed
      if (variables) {
        const { draft, work } = variables;
        const confirmedStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        // Update to clear pending flag (optimistic update already set the status)
        queryClient.setQueryData(
          queryKeys.works.merged(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? {
                    ...w,
                    status: confirmedStatus,
                    _isPending: isOfflineHash, // Keep pending for offline, clear for confirmed
                    _txHash: isOfflineHash ? undefined : txHash,
                    _pendingUntilMs: undefined,
                  }
                : w
            )
        );

        queryClient.setQueryData(
          queryKeys.works.online(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? {
                    ...w,
                    status: confirmedStatus,
                    _isPending: isOfflineHash,
                    _txHash: isOfflineHash ? undefined : txHash,
                    _pendingUntilMs: undefined,
                  }
                : w
            )
        );

        if (DEBUG_ENABLED) {
          debugLog("[useWorkApproval] Confirmed optimistic update", {
            authMode,
            workUID: draft.workUID,
            newStatus: confirmedStatus,
            isPending: isOfflineHash,
            txHash,
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

      // Invalidate work queries immediately - polling with smart backoff handles indexer lag
      // No need for fixed 3-second delay - immediate invalidation + exponential backoff is faster
      if (variables) {
        // Immediate invalidation for responsive UX
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.online(variables.work.gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(variables.work.gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workApprovals.all,
        });

        // Schedule a follow-up invalidation for indexer lag (non-blocking)
        scheduleInvalidation(() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.works.online(variables.work.gardenAddress, chainId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.works.merged(variables.work.gardenAddress, chainId),
          });
        }, INDEXER_LAG_FOLLOWUP_MS);
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
    onError: (error: unknown, variables, context) => {
      // Provide haptic feedback for error
      hapticError();

      // Rollback optimistic updates using context from onMutate
      if (context?.previousMerged && variables) {
        queryClient.setQueryData(
          queryKeys.works.merged(variables.work.gardenAddress, chainId),
          context.previousMerged
        );
      }
      if (context?.previousOnline && variables) {
        queryClient.setQueryData(
          queryKeys.works.online(variables.work.gardenAddress, chainId),
          context.previousOnline
        );
      }

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Rolled back optimistic update due to error", {
          workUID: variables?.draft.workUID,
        });
      }

      const isApproval = variables?.draft.approved ?? false;
      const actionType = isApproval ? "approval" : "decision";

      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Rolled back optimistic update due to error", {
          workUID: variables?.draft.workUID,
        });
      }

      handleApprovalError(error, {
        authMode,
        gardenAddress: variables?.work.gardenAddress,
        metadata: {
          chainId,
          workUID: variables?.draft.workUID,
          gardenAddress: variables?.work.gardenAddress,
          approved: variables?.draft.approved,
          gardenerAddress: variables?.work?.gardenerAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}
