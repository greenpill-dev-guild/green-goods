/**
 * Work approval mutation with a resumable direct-wallet lifecycle.
 * Queued approvals remain durable in JobQueue and join the same UI completion
 * path through `useWorkApprovalActions` when their job completes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../../config/query-keys/work";
import {
  trackWorkApprovalFailed,
  trackWorkApprovalLifecycle,
  trackWorkApprovalStarted,
  trackWorkApprovalSuccess,
  trackWorkRejectionSuccess,
} from "../../modules/app/analytics-events";
import type { JobQueueHandle } from "../../modules/job-queue/ports";
import {
  LOCAL_OVERLAY_GRACE_MS,
  type OverlayWork,
  overlayDeadline,
} from "../../modules/work/local-status-overlay";
import {
  createDefaultSubmitApprovalPorts,
  submitApproval,
  type SubmitApprovalOutcome,
} from "../../modules/work/submit-approval-command";
import type { Work, WorkApprovalDraft } from "../../types/domain";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { classifyTxError, isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation, useTimeout } from "../utils/useTimeout";
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
  jobQueue?: Pick<JobQueueHandle, "processJob">;
  onApprovalComplete?: (completion: WorkApprovalCompletion) => void | Promise<void>;
}

const PENDING_AUTO_CLEAR_MS = LOCAL_OVERLAY_GRACE_MS;
type PendingWork = OverlayWork;

export function useWorkApproval(dependencies: UseWorkApprovalDependencies = {}) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
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

  const recordDecision = useCallback(
    (
      completion: WorkApprovalCompletion,
      txHash: `0x${string}`,
      awaitingConfirmation: boolean,
      isOfflineHash = false
    ) => {
      const status = completion.approved ? ("approved" as const) : ("rejected" as const);
      const update = (old: PendingWork[] = []): PendingWork[] =>
        old.map((work) =>
          work.id === completion.workUID
            ? {
                ...work,
                status,
                _isPending: awaitingConfirmation,
                _txHash: isOfflineHash ? undefined : txHash,
                _pendingUntilMs: isOfflineHash ? undefined : overlayDeadline(),
              }
            : work
        );
      queryClient.setQueryData(worksKeys.merged(completion.gardenId, chainId), update);
      queryClient.setQueryData(worksKeys.online(completion.gardenId, chainId), update);
    },
    [chainId, queryClient]
  );

  const invalidateApprovalQueries = useCallback(
    async (completion: WorkApprovalCompletion) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: worksKeys.online(completion.gardenId, chainId),
        }),
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(completion.gardenId, chainId),
        }),
        queryClient.invalidateQueries({ queryKey: workApprovalsKeys.all }),
        queryClient.invalidateQueries({ queryKey: approvalsKeys.all }),
      ]);
      lastGardenRef.current = completion.gardenId;
      scheduleFollowUp();
    },
    [chainId, queryClient, scheduleFollowUp]
  );

  const reportApprovalError = useCallback(
    (error: unknown, completion: WorkApprovalCompletion) => {
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
    async (approval: PendingWorkApproval) => {
      if (!approval.txHash) return;
      recordDecision(approval, approval.txHash, false);
      await invalidateApprovalQueries(approval);
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
    },
    [authMode, formatMessage, invalidateApprovalQueries, recordDecision]
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
      const outcome = await submitApproval(
        { authMode, draft, work, chainId, userAddress: primaryAddress },
        createDefaultSubmitApprovalPorts(sender, {
          jobQueue: dependencies.jobQueue,
          onWalletLifecycle: lifecycle.recordWalletStage,
        })
      );
      return outcome;
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
      if (authMode === "wallet") {
        lifecycle.begin({
          approved: draft.approved,
          chainId,
          gardenId: work.gardenAddress,
          workUID: draft.workUID,
        });
      }

      await queryClient.cancelQueries({
        queryKey: worksKeys.merged(work.gardenAddress, chainId),
      });
      await queryClient.cancelQueries({
        queryKey: worksKeys.online(work.gardenAddress, chainId),
      });
      const previousMerged = queryClient.getQueryData<Work[]>(
        worksKeys.merged(work.gardenAddress, chainId)
      );
      const previousOnline = queryClient.getQueryData<Work[]>(
        worksKeys.online(work.gardenAddress, chainId)
      );

      if (authMode !== "wallet") {
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
              candidate.id === draft.workUID &&
              candidate._isPending &&
              (candidate._pendingUntilMs ?? 0) <= Date.now()
                ? { ...candidate, _isPending: false, _pendingUntilMs: undefined }
                : candidate
            );
          queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), clearExpired);
          queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), clearExpired);
        }, PENDING_AUTO_CLEAR_MS + 1000);
      }

      const actionLabel = draft.approved ? "approval" : "decision";
      toastService.loading({
        id: "approval-submit",
        title:
          authMode === "wallet"
            ? formatMessage({ id: "app.toast.approval.walletConfirm.title" })
            : !navigator.onLine
              ? "Working offline"
              : "Submitting approval",
        message:
          authMode === "wallet"
            ? formatMessage({ id: "app.toast.approval.walletConfirm.message" })
            : !navigator.onLine
              ? `Saving ${actionLabel} offline...`
              : `Submitting ${actionLabel}...`,
        context: authMode === "wallet" ? "wallet confirmation" : "approval submission",
        persistent: authMode === "wallet",
        suppressLogging: true,
      });
      return { previousMerged, previousOnline };
    },
    onSuccess: async (result, variables) => {
      if (!variables) return;
      const completion: WorkApprovalCompletion = {
        approved: variables.draft.approved,
        gardenId: variables.work.gardenAddress,
        workUID: variables.draft.workUID,
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
          await invalidateApprovalQueries(completion);
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
      toastService.success({
        id: "approval-submit",
        title: isOfflineHash
          ? completion.approved
            ? "Approval saved offline"
            : "Decision saved offline"
          : completion.approved
            ? "Approval submitted"
            : "Decision submitted",
        message: isOfflineHash
          ? "We'll sync this automatically when you're back online."
          : completion.approved
            ? "Decision recorded."
            : "Feedback recorded.",
        context: "approval submission",
        suppressLogging: true,
      });
      await invalidateApprovalQueries(completion);
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
      reportApprovalError(error, completion);
    },
  });

  const safeMutation = useSafeMutation(mutation, "approval", {
    warnBeforeUnload: authMode !== "wallet",
  });
  return {
    ...safeMutation,
    approvalLifecycleStage: lifecycle.stage,
    isPending: safeMutation.isPending || lifecycle.isPending,
    resumeApproval: lifecycle.resume,
  };
}
