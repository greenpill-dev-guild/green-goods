/**
 * Work approval mutation with a resumable direct-wallet lifecycle.
 * Queued approvals remain durable in JobQueue and join the same UI completion
 * path through `useWorkApprovalActions` when their job completes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { createApprovalToasts, toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import {
  trackWorkApprovalFailed,
  trackWorkApprovalLifecycle,
  trackWorkApprovalStarted,
  trackWorkApprovalSuccess,
  trackWorkRejectionSuccess,
} from "../../modules/app/analytics-events";
import type { JobQueueHandle } from "../../modules/job-queue/ports";
import { refreshApprovalReads } from "../../modules/work/approval-read-refresh";
import {
  clearLapsedOverlay,
  LOCAL_OVERLAY_GRACE_MS,
  type OverlayWork,
  overlayDeadline,
} from "../../modules/work/local-status-overlay";
import {
  ApprovalConnectionUnconfirmedError,
  createDefaultSubmitApprovalPorts,
  submitApproval,
  type SubmitApprovalOutcome,
} from "../../modules/work/submit-approval-command";
import { connectivityStore } from "../../stores/connectivity";
import type { Work, WorkApprovalDraft } from "../../types/domain";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { classifyTxError, isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useTimeout } from "../utils/useTimeout";
import {
  useWorkApprovalLifecycle,
  type PendingWorkApproval,
  type WorkApprovalCompletion,
} from "./useWorkApprovalLifecycle";

interface UseWorkApprovalParams {
  draft: WorkApprovalDraft;
  work: Work;
}

interface UseWorkApprovalDependencies {
  /**
   * Set where Upload all is on hand: a wallet decision made on a connection that
   * cannot send then waits on the device, instead of being refused.
   */
  queueWalletDecisions?: boolean;
  jobQueue?: Pick<JobQueueHandle, "processJob">;
  onApprovalComplete?: (completion: WorkApprovalCompletion) => void | Promise<void>;
}

export type { StagedReview } from "../../stores/useReviewBatchStore";
export { type ReviewBatch, useReviewBatch } from "./useReviewBatch";

const PENDING_AUTO_CLEAR_MS = LOCAL_OVERLAY_GRACE_MS;
type PendingWork = OverlayWork;
interface WorkDecisionCacheSnapshot {
  work: Work;
  merged?: PendingWork[];
  online?: PendingWork[];
}

export function useWorkApproval(dependencies: UseWorkApprovalDependencies = {}) {
  const { formatMessage } = useIntl();
  const approvalToasts = useMemo(() => createApprovalToasts(formatMessage), [formatMessage]);
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { set: scheduleAutoClear } = useTimeout();
  // Decided once, before the wallet is involved, and handed to the command so the
  // two never disagree about whether this decision goes to the wallet or the queue.
  const walletSendsNowRef = useRef(true);
  const decisionCacheRef = useRef<WorkDecisionCacheSnapshot | null>(null);
  const recordDecision = useCallback(
    (
      completion: WorkApprovalCompletion,
      txHash: `0x${string}`,
      awaitingConfirmation: boolean,
      isOfflineHash = false
    ) => {
      const status = completion.approved ? ("approved" as const) : ("rejected" as const);
      const reviewFeedback = completion.feedback?.trim() || undefined;
      // A confirmed transaction holds until the indexer reports it. Only a
      // decision still waiting on its receipt gets a deadline, so a dropped
      // transaction cannot leave the work looking resolved forever.
      const holdsUntilIndexed = isOfflineHash || !awaitingConfirmation;
      const isConfirmed = !isOfflineHash && !awaitingConfirmation;
      const cacheSnapshot =
        decisionCacheRef.current?.work.gardenAddress.toLowerCase() ===
        completion.gardenId.toLowerCase()
          ? decisionCacheRef.current
          : null;
      const matchesWork = (work: Work) => work.id === completion.workUID;
      const withDecision = (work: PendingWork): PendingWork => ({
        ...work,
        status,
        _isPending: awaitingConfirmation,
        _txHash: isOfflineHash ? undefined : txHash,
        _pendingUntilMs: holdsUntilIndexed ? undefined : overlayDeadline(),
        reviewFeedback,
      });
      const confirmedWork = isConfirmed
        ? [
            cacheSnapshot?.work,
            queryClient.getQueryData<Work>(worksKeys.byUID(completion.workUID, chainId)),
            queryClient
              .getQueryData<Work[]>(
                worksKeys.local(completion.gardenId, chainId, primaryAddress ?? undefined)
              )
              ?.find(matchesWork),
            queryClient
              .getQueryData<Work[]>(worksKeys.online(completion.gardenId, chainId))
              ?.find(matchesWork),
          ].find(
            (work) =>
              work &&
              matchesWork(work) &&
              work.gardenAddress.toLowerCase() === completion.gardenId.toLowerCase()
          )
        : undefined;
      const update =
        (fallback: PendingWork[] | undefined, insert?: Work) =>
        (old: PendingWork[] = []): PendingWork[] => {
          const rows = old.length > 0 ? old : (fallback ?? old);
          if (insert && !rows.some(matchesWork)) return [...rows, withDecision(insert)];
          return rows.map((work) => (matchesWork(work) ? withDecision(work) : work));
        };
      // The client projects a separate local list. Persist the decision in the
      // shared overlay even when no garden list has been opened on this device.
      queryClient.setQueryData(
        worksKeys.merged(completion.gardenId, chainId),
        update(cacheSnapshot?.merged, confirmedWork)
      );
      queryClient.setQueryData(
        worksKeys.online(completion.gardenId, chainId),
        update(cacheSnapshot?.online?.length ? cacheSnapshot.online : cacheSnapshot?.merged)
      );
    },
    [chainId, primaryAddress, queryClient]
  );

  const reportApprovalError = useCallback(
    (error: unknown, completion: WorkApprovalCompletion) => {
      // Refused before the wallet was asked: nothing was signed or sent.
      if (error instanceof ApprovalConnectionUnconfirmedError) {
        toastService.info({
          id: "approval-submit",
          title: formatMessage({ id: "app.offline.degraded" }),
          message: formatMessage({ id: "app.approval.connectionUnconfirmed" }),
          context: "approval submission",
          suppressLogging: true,
        });
        return;
      }
      if (isCancelledTxError(error)) {
        toastService.error({
          id: "approval-submit",
          title: formatMessage({ id: "app.txFeedback.cancelled.title" }),
          message: formatMessage({ id: "app.errors.blockchain.userRejected.message" }),
          context: "approval submission",
          error,
          suppressLogging: true,
        });
        return;
      }

      hapticError();
      const actionType = completion.approved ? "approval" : "decision";
      trackWorkApprovalFailed({
        workUID: completion.workUID,
        gardenAddress: completion.gardenId,
        error: classifyTxError(error).kind,
        authMode,
      });
      const handleError = createMutationErrorHandler({
        source: "useWorkApproval",
        toastContext: `${actionType} submission`,
        toastId: "approval-submit",
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
        gardenAddress: completion.gardenId,
        metadata: {
          approved: completion.approved,
          chainId,
          lifecycleStage: "failed",
          workUID: completion.workUID,
        },
      });
    },
    [authMode, chainId, formatMessage]
  );

  const onLifecycleConfirmed = useCallback(
    (approval: PendingWorkApproval) => {
      if (!approval.txHash) return;
      recordDecision(approval, approval.txHash, false);
      decisionCacheRef.current = null;
      hapticSuccess();
      if (approval.approved) {
        trackWorkApprovalSuccess({
          workUID: approval.workUID,
          gardenAddress: approval.gardenId,
          txHash: approval.txHash,
          authMode,
        });
      } else {
        trackWorkRejectionSuccess({
          workUID: approval.workUID,
          gardenAddress: approval.gardenId,
          txHash: approval.txHash,
          authMode,
        });
      }
      toastService.success({
        id: "approval-submit",
        title: approval.approved ? "Approval submitted" : "Decision submitted",
        message: formatMessage({ id: "app.toast.approval.walletConfirmed.message" }),
        context: "wallet confirmation",
        suppressLogging: true,
      });
      refreshApprovalReads(queryClient, chainId, approval, true);
    },
    [authMode, chainId, formatMessage, queryClient, recordDecision]
  );

  const lifecycle = useWorkApprovalLifecycle({
    onConfirmed: onLifecycleConfirmed,
    onComplete: dependencies.onApprovalComplete,
    onFailure: (error, approval) => reportApprovalError(error, approval),
    onStage: ({ approved, reason, stage }) => {
      trackWorkApprovalLifecycle({
        approved,
        authMode,
        stage,
        reason,
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ draft, work }: UseWorkApprovalParams): Promise<SubmitApprovalOutcome> => {
      if (DEBUG_ENABLED) {
        debugLog("[useWorkApproval] Starting approval submission", {
          authMode,
          workUID: draft.workUID,
          approved: draft.approved,
          chainId,
        });
      }
      const ports = createDefaultSubmitApprovalPorts(sender, {
        jobQueue: dependencies.jobQueue,
        onWalletLifecycle: lifecycle.recordWalletStage,
      });
      const queuesWalletDecisions = authMode === "wallet" && dependencies.queueWalletDecisions;
      return submitApproval(
        {
          authMode,
          draft,
          work,
          chainId,
          userAddress: primaryAddress,
          queueWalletDecisions: dependencies.queueWalletDecisions,
        },
        queuesWalletDecisions
          ? {
              ...ports,
              connectivity: { confirm: async () => walletSendsNowRef.current },
            }
          : ports
      );
    },
    onMutate: async (variables) => {
      if (!variables) return;
      const { draft, work } = variables;
      trackWorkApprovalStarted({
        workUID: draft.workUID,
        gardenAddress: work.gardenAddress,
        approved: draft.approved,
        authMode,
      });
      // A wallet is only involved on a connection that can send, wherever this
      // runs. Where decisions can wait, an unsteady connection queues the
      // decision; where they cannot, the command refuses it. Either way the
      // wallet prompt and its toast belong to a send that is really starting.
      const walletSendsNow = authMode === "wallet" && (await connectivityStore.confirmOnline());
      walletSendsNowRef.current = walletSendsNow;
      if (walletSendsNow) {
        lifecycle.begin({
          approved: draft.approved,
          chainId,
          gardenId: work.gardenAddress,
          workUID: draft.workUID,
          feedback: draft.feedback,
        });
      }

      const previousMerged = queryClient.getQueryData<Work[]>(
        worksKeys.merged(work.gardenAddress, chainId)
      );
      const previousOnline = queryClient.getQueryData<Work[]>(
        worksKeys.online(work.gardenAddress, chainId)
      );
      decisionCacheRef.current = {
        work,
        merged: previousMerged,
        online: previousOnline,
      };
      await queryClient.cancelQueries(
        { queryKey: worksKeys.merged(work.gardenAddress, chainId) },
        { revert: false }
      );
      await queryClient.cancelQueries(
        { queryKey: worksKeys.online(work.gardenAddress, chainId) },
        { revert: false }
      );

      if (!walletSendsNow) {
        const status = draft.approved ? ("approved" as const) : ("rejected" as const);
        const pendingUntilMs = Date.now() + PENDING_AUTO_CLEAR_MS;
        const setPending = (old: Work[] = []) =>
          old.map((candidate) =>
            candidate.id === draft.workUID
              ? { ...candidate, status, _isPending: true, _pendingUntilMs: pendingUntilMs }
              : candidate
          );
        queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), setPending);
        queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), setPending);
        scheduleAutoClear(() => {
          const clearExpired = (old: PendingWork[] = []) =>
            old.map((candidate) =>
              candidate.id === draft.workUID ? clearLapsedOverlay(candidate) : candidate
            );
          queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), clearExpired);
          queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), clearExpired);
        }, PENDING_AUTO_CLEAR_MS + 1000);
      }

      if (walletSendsNow) approvalToasts.walletConfirm();
      else approvalToasts.submitting(draft.approved);
      return { previousMerged, previousOnline };
    },
    onSuccess: async (result, variables) => {
      if (!variables) return;
      const completion: WorkApprovalCompletion = {
        approved: variables.draft.approved,
        gardenId: variables.work.gardenAddress,
        workUID: variables.draft.workUID,
        feedback: variables.draft.feedback,
      };
      const isOfflineHash = result.hash.startsWith("0xoffline_");

      if (result.kind === "direct") {
        if (result.confirmed === false) {
          lifecycle.recordWalletStage({
            stage: "broadcast",
            txHash: result.hash,
            reason: "receipt-timeout",
          });
          recordDecision(completion, result.hash, true);
          toastService.success({
            id: "approval-submit",
            title: completion.approved ? "Approval submitted" : "Decision submitted",
            message: formatMessage({ id: "app.toast.approval.walletConfirm.message" }),
            context: "wallet confirmation",
            suppressLogging: true,
          });
          refreshApprovalReads(queryClient, chainId, completion, false);
          decisionCacheRef.current = null;
          return;
        }
        lifecycle.recordWalletStage({ stage: "confirmed", txHash: result.hash });
        await lifecycle.completeConfirmed();
        return;
      }

      hapticSuccess();
      if (completion.approved) {
        trackWorkApprovalSuccess({
          workUID: completion.workUID,
          gardenAddress: completion.gardenId,
          txHash: result.hash,
          authMode,
        });
      } else {
        trackWorkRejectionSuccess({
          workUID: completion.workUID,
          gardenAddress: completion.gardenId,
          txHash: result.hash,
          authMode,
        });
      }
      recordDecision(completion, result.hash, isOfflineHash, isOfflineHash);
      // The decision waits on this device for Upload all: nothing sends it on its own.
      if (isOfflineHash) approvalToasts.savedOffline(completion.approved);
      else approvalToasts.success(completion.approved);
      refreshApprovalReads(queryClient, chainId, completion, !isOfflineHash);
      decisionCacheRef.current = null;
    },
    onError: (error: unknown, variables, context) => {
      if (!variables) return;
      if (context?.previousMerged) {
        queryClient.setQueryData(
          worksKeys.merged(variables.work.gardenAddress, chainId),
          context.previousMerged
        );
      }
      if (context?.previousOnline) {
        queryClient.setQueryData(
          worksKeys.online(variables.work.gardenAddress, chainId),
          context.previousOnline
        );
      }
      const completion = {
        approved: variables.draft.approved,
        gardenId: variables.work.gardenAddress,
        workUID: variables.draft.workUID,
      };
      if (isCancelledTxError(error)) lifecycle.cancel();
      else lifecycle.fail();
      decisionCacheRef.current = null;
      reportApprovalError(error, completion);
    },
  });

  const safeMutation = useSafeMutation(mutation, "approval");
  return {
    ...safeMutation,
    approvalLifecycleStage: lifecycle.stage,
    isPending: safeMutation.isPending || lifecycle.isPending,
    resumeApproval: lifecycle.resume,
  };
}
