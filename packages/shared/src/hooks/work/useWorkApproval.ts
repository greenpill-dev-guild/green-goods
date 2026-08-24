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
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  trackWorkApprovalFailed,
  trackWorkApprovalStarted,
  trackWorkApprovalSuccess,
  trackWorkRejectionSuccess,
} from "../../modules/app/analytics-events";
import {
  LOCAL_OVERLAY_GRACE_MS,
  type OverlayWork,
  overlayDeadline,
} from "../../modules/work/local-status-overlay";
import {
  createDefaultSubmitApprovalPorts,
  submitApproval,
} from "../../modules/work/submit-approval-command";
import type { JobQueueHandle } from "../../modules/job-queue/ports";
import type { Work, WorkApprovalDraft } from "../../types/domain";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../../config/query-keys/work";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation, useTimeout } from "../utils/useTimeout";

interface UseWorkApprovalParams {
  draft: WorkApprovalDraft;
  work: Work;
}

/** Mutation result including wallet submission details */
interface ApprovalMutationResult {
  hash: `0x${string}`;
  confirmed?: boolean;
}

const PENDING_AUTO_CLEAR_MS = LOCAL_OVERLAY_GRACE_MS;
type PendingWork = OverlayWork;

export function useWorkApproval(
  dependencies: { jobQueue?: Pick<JobQueueHandle, "processJob"> } = {}
) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  // Separate timeouts: one for auto-clearing stale pending flags, another for progressive indexer invalidation.
  // Using a single useTimeout caused the indexer lag timer to cancel the auto-clear timer.
  const { set: scheduleAutoClear } = useTimeout();
  const lastGardenRef = useRef<string>("");
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
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

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

      const result = await submitApproval(
        { authMode, draft, work, chainId, userAddress: primaryAddress },
        createDefaultSubmitApprovalPorts(sender, dependencies)
      );
      return { hash: result.hash, confirmed: result.confirmed };
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
        queryKey: worksKeys.merged(work.gardenAddress, chainId),
      });
      await queryClient.cancelQueries({
        queryKey: worksKeys.online(work.gardenAddress, chainId),
      });

      // Snapshot previous state for rollback on error
      const previousMerged = queryClient.getQueryData<Work[]>(
        worksKeys.merged(work.gardenAddress, chainId)
      );
      const previousOnline = queryClient.getQueryData<Work[]>(
        worksKeys.online(work.gardenAddress, chainId)
      );

      // Wallet mode leaves indexed work untouched while the signature is pending.
      // Once the wallet returns a transaction hash, onSuccess records the decision
      // even when receipt waiting times out so stale cached pending status cannot
      // override the indexer's later result.

      if (authMode !== "wallet") {
        const optimisticStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        const pendingUntilMs = Date.now() + PENDING_AUTO_CLEAR_MS;

        queryClient.setQueryData(
          worksKeys.merged(work.gardenAddress, chainId),
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
          worksKeys.online(work.gardenAddress, chainId),
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
            worksKeys.merged(work.gardenAddress, chainId),
            (old: PendingWork[] = []) =>
              old.map((w) =>
                w.id === draft.workUID && w._isPending && (w._pendingUntilMs ?? 0) <= Date.now()
                  ? { ...w, _isPending: false, _pendingUntilMs: undefined }
                  : w
              )
          );
          queryClient.setQueryData(
            worksKeys.online(work.gardenAddress, chainId),
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
      }

      // Show loading toast
      const actionLabel = draft.approved ? "approval" : "decision";
      const message =
        authMode === "wallet"
          ? formatMessage({ id: "app.toast.approval.walletConfirm.message" })
          : !navigator.onLine
            ? `Saving ${actionLabel} offline...`
            : `Submitting ${actionLabel}...`;
      const title =
        authMode === "wallet"
          ? formatMessage({ id: "app.toast.approval.walletConfirm.title" })
          : !navigator.onLine
            ? "Working offline"
            : "Submitting approval";
      toastService.loading({
        id: "approval-submit",
        title,
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "approval submission",
        // Wallet mode waits on the human signature, which can exceed any fixed
        // timeout — keep it up until the flow replaces it. Passkey/offline are
        // fast, so they keep the default auto-dismiss safety window.
        persistent: authMode === "wallet",
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

      // A returned hash means the decision reached the chain, so record it —
      // the operator should see that their action registered. Two things keep
      // that honest: a submission whose receipt never arrived stays visibly
      // pending, and every overlay carries a deadline. Once the deadline
      // lapses the indexer is authoritative again, so a dropped transaction
      // cannot leave the work looking resolved.
      if (variables) {
        const { draft, work } = variables;
        const confirmedStatus = draft.approved ? ("approved" as const) : ("rejected" as const);
        const awaitingConfirmation = isOfflineHash || result.confirmed === false;

        const recordDecision = (old: PendingWork[] = []): PendingWork[] =>
          old.map((w) =>
            w.id === draft.workUID
              ? {
                  ...w,
                  status: confirmedStatus,
                  _isPending: awaitingConfirmation,
                  _txHash: isOfflineHash ? undefined : txHash,
                  // Offline jobs stay authoritative until their queued job
                  // completes; everything else expires back to indexed truth.
                  _pendingUntilMs: isOfflineHash ? undefined : overlayDeadline(),
                }
              : w
          );

        queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), recordDecision);
        queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), recordDecision);

        if (DEBUG_ENABLED) {
          debugLog("[useWorkApproval] Recorded decision", {
            authMode,
            workUID: draft.workUID,
            newStatus: confirmedStatus,
            isPending: awaitingConfirmation,
            confirmed: result.confirmed,
            txHash,
          });
        }
      }

      // Show success toast for wallet mode (direct submission)
      if (authMode === "wallet") {
        toastService.success({
          id: "approval-submit",
          title: isApproval ? "Approval submitted" : "Decision submitted",
          message: formatMessage({
            id:
              result.confirmed === false
                ? "app.toast.approval.walletConfirm.message"
                : "app.toast.approval.walletConfirmed.message",
          }),
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
          queryKey: worksKeys.online(variables.work.gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(variables.work.gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: workApprovalsKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: approvalsKeys.all,
        });

        // Schedule progressive follow-up invalidations for indexer lag (non-blocking)
        lastGardenRef.current = variables.work.gardenAddress;
        scheduleFollowUp();
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
          worksKeys.merged(variables.work.gardenAddress, chainId),
          context.previousMerged
        );
      }
      if (context?.previousOnline && variables) {
        queryClient.setQueryData(
          worksKeys.online(variables.work.gardenAddress, chainId),
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

      // Create error handler with approval-specific configuration
      const handleError = createMutationErrorHandler({
        source: "useWorkApproval",
        toastContext: `${actionType} submission`,
        toastId: "approval-submit",
        trackError: (errorMsg) =>
          trackWorkApprovalFailed({
            workUID: variables?.draft.workUID ?? "",
            gardenAddress: variables?.work.gardenAddress ?? "",
            error: errorMsg,
            authMode,
          }),
        getFallbackMessage: (mode) =>
          mode === "wallet"
            ? "Transaction failed. Check your wallet and try again."
            : `We couldn't send the ${actionType}. We'll retry shortly.`,
        getFallbackDescription: (mode) =>
          mode === "wallet"
            ? "If this keeps happening, reconnect your wallet before resubmitting."
            : "Keep the app open; the queue will keep trying in the background.",
      });

      handleError(error, {
        authMode,
        gardenAddress: variables?.work.gardenAddress,
        metadata: {
          chainId,
          workUID: variables?.draft.workUID,
          approved: variables?.draft.approved,
          gardenerAddress: variables?.work?.gardenerAddress,
        },
      });
    },
  });

  return useSafeMutation(mutation, "approval");
}
