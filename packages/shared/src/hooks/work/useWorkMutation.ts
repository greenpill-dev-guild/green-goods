import { connectivityStore } from "../../stores/connectivity";
import { useIntl } from "react-intl";
import { showWorkSubmissionFailure } from "./workSubmissionFeedback";
import { createDraftUploadPersistence } from "../../modules/work/draft-upload";
import { draftDB } from "../../modules/job-queue/draft-db";
/** Submits work through the current auth mode and preserves durable retry progress. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  showWalletProgress,
  toastService,
  walletProgressToasts,
  workToasts,
} from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  trackWorkSubmissionStarted,
  trackWorkSubmissionSuccess,
  trackWorkWalletRequestStarted,
} from "../../modules/app/analytics-events";
import { addBreadcrumb } from "../../modules/app/error-tracking";
import { isOfflineTxHash } from "../../modules/job-queue/queue-policy";
import {
  createDefaultSubmitWorkPorts,
  submitWork,
  type SubmitWorkOutcome,
} from "../../modules/work/submit-work-command";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import type { Work, WorkDraft } from "../../types/domain";
import { getActionTitle } from "../../utils/action/parsers";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { worksKeys } from "../../config/query-keys/work";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation, useTimeout } from "../utils/useTimeout";
import type { UseWorkMutationOptions } from "./useWorkMutation.types";

export type { UseWorkMutationOptions } from "./useWorkMutation.types";

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
  const {
    authMode,
    gardenAddress,
    actionUID,
    actions,
    userAddress,
    completeClientFlow = true,
    allowOfflineQueue = true,
    onProgress,
    onSuccess,
    onError,
    onSettled,
    dependencies,
  } = options;
  const intl = useIntl();
  const sender = useTransactionSender();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const identity = `${authMode}:${userAddress?.toLowerCase()}:${chainId}`;
  const session = useRef({ identity, generation: 0 });
  if (session.current.identity !== identity)
    session.current = { identity, generation: session.current.generation + 1 };
  type Variables = { draft: WorkDraft; images: File[] };
  type Origin = {
    identity: string;
    generation: number;
    activeDraftId: string | null | undefined;
    journeyId: string;
    outcome?: SubmitWorkOutcome;
  };
  const origins = useRef(new WeakMap<Variables, Origin>());
  const ownsSession = (origin: Origin | undefined) =>
    Boolean(
      origin &&
        origin.identity === session.current.identity &&
        origin.generation === session.current.generation
    );
  const ownsFlow = (origin: Origin | undefined) =>
    ownsSession(origin) &&
    (!completeClientFlow || origin?.activeDraftId === useWorkFlowStore.getState().activeDraftId);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const retainedCheckpoint = useRef<{
    id: string;
    checkpoint: NonNullable<WorkDraft["uploadCheckpoint"]>;
  } | null>(null);
  const walletRequestStartedJourneyRef = useRef<string | null>(null);
  const [lastSubmissionOutcome, setLastSubmissionOutcome] = useState<SubmitWorkOutcome | null>(
    null
  );
  const lastSubmissionOutcomeRef = useRef<SubmitWorkOutcome | null>(null);

  // Use managed timeout for toast dismissal to ensure cleanup on unmount
  const { set: scheduleToastDismiss } = useTimeout();
  // Progressive invalidation for indexer lag follow-up
  const lastGardenRef = useRef<string | null>(gardenAddress);
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
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (variables: Variables) => {
      const { draft, images } = variables;
      const origin = origins.current.get(variables);
      if (!origin || !ownsSession(origin)) throw new Error("submission-ownership-changed");
      const workSubmissionJourneyId = origin.journeyId;

      if (!gardenAddress) {
        throw new Error("Garden must be selected before submitting work");
      }
      if (typeof actionUID !== "number") {
        throw new Error("Action must be selected before submitting work");
      }
      if (!userAddress) {
        throw new Error("User address is required for work submission");
      }

      if (DEBUG_ENABLED) {
        const draftSummary = {
          hasFeedback: Boolean(draft.feedback),
          feedbackLength: draft.feedback?.length ?? 0,
          detailKeys: Object.keys(draft.details ?? {}),
          hasTags: Boolean(draft.tags?.length),
          hasAudioNotes: Boolean(draft.audioNotes?.length),
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

      walletRequestStartedJourneyRef.current = null;
      const activeDraftId = origin.activeDraftId;
      const persistedDraft =
        completeClientFlow && activeDraftId ? await draftDB.getDraft(activeDraftId) : undefined;
      const persistence = persistedDraft
        ? await createDraftUploadPersistence(persistedDraft, draft, retainedCheckpoint)
        : {};
      const outcome = await submitWork(
        {
          ...persistence,
          assertOwnership: () => {
            if (!ownsSession(origin)) throw new Error("submission-ownership-changed");
          },
          authMode,
          gardenAddress,
          actionUID,
          actions,
          userAddress,
          chainId,
          draft,
          images,
          allowOfflineQueue,
        },
        createDefaultSubmitWorkPorts({
          sender,
          jobQueue: dependencies?.jobQueue,
          onWalletStage: (stage, message) => {
            if (!ownsFlow(origin)) return;
            if (
              stage === "confirming" &&
              walletRequestStartedJourneyRef.current !== workSubmissionJourneyId
            ) {
              walletRequestStartedJourneyRef.current = workSubmissionJourneyId;
              trackWorkWalletRequestStarted({
                workSubmissionJourneyId,
                authMode,
                chainId,
                actionUID,
                imageCount: images.length,
                submissionPhase: "wallet_request",
              });
            }

            if (stage === "complete") {
              walletProgressToasts.success();
            } else {
              showWalletProgress(stage, message);
            }
            onProgress?.(stage, message);
          },
          onQueueFallback: (optimisticWork) => {
            if (!ownsSession(origin)) return;
            queryClient.setQueryData(
              worksKeys.merged(gardenAddress, chainId),
              (old: Work[] = []) => [optimisticWork, ...old]
            );
          },
        })
      );
      origin.outcome = outcome;
      if (ownsFlow(origin)) {
        lastSubmissionOutcomeRef.current = outcome;
        setLastSubmissionOutcome(outcome);
      }
      return outcome.txHash;
    },
    onMutate: async (variables) => {
      const flow = useWorkFlowStore.getState();
      const origin: Origin = {
        ...session.current,
        activeDraftId: flow.activeDraftId,
        journeyId: flow.ensureWorkSubmissionJourneyId(),
      };
      origins.current.set(variables, origin);
      const workSubmissionJourneyId = origin.journeyId;

      if (DEBUG_ENABLED && variables) {
        debugLog("[WorkMutation] Starting work submission", {
          gardenAddress,
          actionUID,
          imageCount: variables.images.length,
        });
      }

      const actionTitle = getActionTitle(actions, actionUID);
      addBreadcrumb("work_submission_started", {
        gardenAddress,
        actionUID,
        actionTitle,
        authMode,
        imageCount: variables?.images.length ?? 0,
        workSubmissionJourneyId,
      });
      trackWorkSubmissionStarted({
        actionUID: actionUID ?? 0,
        authMode,
        imageCount: variables?.images.length ?? 0,
        workSubmissionJourneyId,
        chainId,
        submissionPhase: "review",
      });

      // --- Optimistic cache insertion ---
      // Skip for online wallet users — submitWorkDirectly handles its own optimistic insert.
      // Only insert here for passkey users and offline wallet users (queue path).
      // NOTE: If the wallet path hits a network error and falls back to the queue,
      // the catch block inserts an optimistic entry at that point.
      const isWalletOnline = authMode === "wallet" && connectivityStore.getSnapshot();
      let previousMerged: Work[] | undefined;
      if (gardenAddress && userAddress) {
        await queryClient.cancelQueries({
          queryKey: worksKeys.merged(gardenAddress, chainId),
        });

        if (!ownsSession(origin)) throw new Error("submission-ownership-changed");
        previousMerged = queryClient.getQueryData<Work[]>(worksKeys.merged(gardenAddress, chainId));

        if (allowOfflineQueue && !isWalletOnline) {
          // Insert an optimistic Work entry so it appears instantly in lists
          const optimisticWork: Work = {
            id: `0xoffline_optimistic_${Date.now()}`,
            title: actionTitle || "",
            actionUID: actionUID ?? 0,
            gardenerAddress: userAddress,
            gardenAddress,
            feedback: variables.draft.feedback || "",
            metadata: JSON.stringify({
              details: variables.draft.details ?? {},
              timeSpentMinutes: variables.draft.timeSpentMinutes,
            }),
            media: [],
            createdAt: Math.floor(Date.now() / 1000),
            status: "pending",
          };

          queryClient.setQueryData(worksKeys.merged(gardenAddress, chainId), (old: Work[] = []) => [
            optimisticWork,
            ...old,
          ]);

          if (DEBUG_ENABLED) {
            debugLog("[WorkMutation] Inserted optimistic work entry", {
              optimisticId: optimisticWork.id,
              gardenAddress,
            });
          }
        }
      }

      const isOffline = !connectivityStore.getSnapshot();

      if (allowOfflineQueue && isOffline) {
        workToasts.savedOffline();
      } else if (authMode !== "wallet") {
        // For wallet mode, progress toasts are shown via onProgress callback
        workToasts.submitting();
      }

      return { previousMerged };
    },
    onSuccess: (txHash, variables) => {
      const origin = origins.current.get(variables);
      if (!origin || !ownsFlow(origin)) return;
      const isOfflineHash = typeof txHash === "string" && isOfflineTxHash(txHash);
      const workSubmissionJourneyId = origin.journeyId;

      const awaiting = origin.outcome?.kind === "awaiting-confirmation";
      if (awaiting) {
        walletProgressToasts.dismiss();
        toastService.info({
          title: intl.formatMessage({ id: "app.work.awaitingConfirmation" }),
          message: intl.formatMessage({ id: "app.work.confirmationExplanation" }),
          context: "work",
        });
      }
      if (!awaiting) hapticSuccess();

      // Confirmation checks have not established a successful submission yet.
      if (!awaiting)
        trackWorkSubmissionSuccess({
          actionUID: actionUID ?? 0,
          authMode,
          wasOffline: isOfflineHash,
          workSubmissionJourneyId,
          chainId,
          submissionPhase: "success",
        });

      if (completeClientFlow) {
        // Hand off the committed result to the draft retirement lifecycle.
        useWorkFlowStore.getState().setSubmissionCompleted(true);
      }

      if (isOfflineHash) {
        scheduleToastDismiss(() => workToasts.dismiss(), 1000);
      } else if (authMode === "wallet") {
        scheduleToastDismiss(() => walletProgressToasts.dismiss(), 1500);
      } else {
        workToasts.dismiss();
      }

      if (gardenAddress) {
        queryClient.invalidateQueries({
          queryKey: worksKeys.online(gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(gardenAddress, chainId),
        });

        lastGardenRef.current = gardenAddress;
        scheduleFollowUp();
      }

      if (completeClientFlow) {
        openWorkDashboard();
      }

      onSuccess?.(txHash);

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
    onError: (error: unknown, variables, context) => {
      const origin = origins.current.get(variables);
      if (!origin || !ownsFlow(origin)) return;
      const workSubmissionJourneyId = origin.journeyId;

      // Provide haptic feedback for error
      hapticError();

      // Best-effort cleanup for any blob preview URLs attached to failed upload files.
      variables?.images.forEach((image) => {
        const maybePreviewUrl = (image as File & { preview?: string }).preview;
        if (typeof maybePreviewUrl === "string" && maybePreviewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(maybePreviewUrl);
        }
      });

      // Rollback optimistic cache insertion
      if (context?.previousMerged && gardenAddress) {
        queryClient.setQueryData(worksKeys.merged(gardenAddress, chainId), context.previousMerged);
        if (DEBUG_ENABLED) {
          debugLog("[WorkMutation] Rolled back optimistic work entry");
        }
      }

      showWorkSubmissionFailure(error, {
        intl,
        authMode,
        actionUID,
        gardenAddress,
        chainId,
        imageCount: variables?.images.length ?? 0,
        workSubmissionJourneyId,
      });

      onError?.(error);
    },
    onSettled: (_data, _error, variables) => {
      if (ownsFlow(origins.current.get(variables))) onSettled?.();
    },
  });

  return {
    ...useSafeMutation(mutation),
    lastSubmissionOutcome,
    getLastSubmissionOutcome: () => lastSubmissionOutcomeRef.current,
    clearLastSubmissionOutcome: () => {
      lastSubmissionOutcomeRef.current = null;
      setLastSubmissionOutcome(null);
    },
  };
}

export type UseWorkMutationReturn = ReturnType<typeof useWorkMutation>;
