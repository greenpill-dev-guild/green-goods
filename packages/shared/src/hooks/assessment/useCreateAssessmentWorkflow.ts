import { useQueryClient } from "@tanstack/react-query";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { fromPromise } from "xstate";
import { toastService } from "../../components/toast";
import {
  trackAdminAssessmentCreateFailed,
  trackAdminAssessmentCreateStarted,
  trackAdminAssessmentCreateSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import {
  createAssessment,
  createDefaultCreateAssessmentPorts,
  AssessmentConfirmationUnavailableError,
  AssessmentSubmissionPendingError,
  reconcileAssessmentSubmission,
} from "../../modules/assessment/create-assessment-command";
import { getIpfsInitStatus } from "../../modules/data/ipfs/client";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { Address } from "../../types/domain";
import {
  type AssessmentWorkflowParams,
  createAssessmentMachine,
} from "../../workflows/createAssessment";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useAssessmentDraft } from "./useAssessmentDraft";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import {
  getTransactionScopeKey,
  TransactionConfirmationPendingError,
} from "../../modules/transactions/types";
import { withoutQuotedRequest } from "../../utils/errors/extract-message";
import {
  assessmentSubmissionKey,
  useAssessmentSubmissionStore,
} from "../../stores/useAssessmentSubmissionStore";

export type { AssessmentWorkflowParams, CreateAssessmentForm } from "../../types/domain";
export type { AssessmentDraftRecord } from "./useAssessmentDraft";

export interface UseCreateAssessmentWorkflowOptions {
  /** Garden address for draft persistence. When provided, enables IndexedDB draft auto-save. */
  gardenId?: string;
}

export function useCreateAssessmentWorkflow(options: UseCreateAssessmentWorkflowOptions = {}) {
  const { gardenId: draftGardenId } = options;
  const { formatMessage } = useIntl();
  const address = usePrimaryAddress() ?? undefined;
  const sender = useTransactionSender();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);

  // Draft persistence
  const draft = useAssessmentDraft(draftGardenId, address, {
    enabled: !!draftGardenId && !!address,
  });
  const { saveDraft, clearDraft, peekDraft, draftKey } = draft;
  const draftPersistenceWarningShownRef = useRef(false);

  const notifyDraftPersistenceIssue = useCallback(
    (stage: "save" | "clear") => {
      if (draftPersistenceWarningShownRef.current) return;
      draftPersistenceWarningShownRef.current = true;

      const titleId =
        stage === "save"
          ? "app.assessment.draftPersistence.saveFailed.title"
          : "app.assessment.draftPersistence.clearFailed.title";
      const messageId =
        stage === "save"
          ? "app.assessment.draftPersistence.saveFailed.message"
          : "app.assessment.draftPersistence.clearFailed.message";

      toastService.info({
        title: formatMessage({
          id: titleId,
          defaultMessage:
            stage === "save" ? "Draft backup unavailable" : "Draft cleanup incomplete",
        }),
        message: formatMessage({
          id: messageId,
          defaultMessage:
            stage === "save"
              ? "Assessment submission will continue, but your draft could not be saved."
              : "Assessment submission succeeded, but the local draft could not be cleared.",
        }),
        context: "assessment draft",
        suppressLogging: true,
      });
    },
    [formatMessage]
  );

  // Store mutable dependencies in refs so the machine actor can read
  // current values without recreating the machine on every change
  const identityRef = useRef({ address, sender });
  const scope =
    address && draftGardenId
      ? assessmentSubmissionKey(address, selectedChainId, draftGardenId)
      : null;
  const activeKeyRef = useRef(scope);
  const pendingSubmission = useAssessmentSubmissionStore((state) =>
    scope ? state.pending[scope] : undefined
  );
  const getPending = () =>
    activeKeyRef.current
      ? useAssessmentSubmissionStore.getState().pending[activeKeyRef.current]
      : undefined;
  const chainIdRef = useRef(selectedChainId);
  const formatMessageRef = useRef(formatMessage);

  useEffect(() => {
    identityRef.current = { address, sender };
  }, [address, sender]);
  useEffect(() => {
    chainIdRef.current = selectedChainId;
  }, [selectedChainId]);
  useEffect(() => {
    formatMessageRef.current = formatMessage;
  }, [formatMessage]);

  const machine = useMemo(
    () =>
      createAssessmentMachine.provide({
        guards: {
          canRetry: ({ context }) => !getPending() && context.retryCount < 3,
          isPending: () => Boolean(getPending()),
        },
        actors: {
          reconcileAssessment: fromPromise<string | null>(async ({ signal }) => {
            const key = activeKeyRef.current;
            const pending = getPending();
            const { address: currentAddress, sender: currentSender } = identityRef.current;
            if (
              !key ||
              !pending ||
              !currentSender ||
              currentAddress?.toLowerCase() !== pending.account.toLowerCase() ||
              chainIdRef.current !== pending.chainId
            )
              return null;
            const outcome = await reconcileAssessmentSubmission(pending, currentSender);
            if (
              signal.aborted ||
              activeKeyRef.current !== key ||
              getPending() !== pending ||
              identityRef.current.address?.toLowerCase() !== pending.account.toLowerCase() ||
              chainIdRef.current !== pending.chainId
            )
              return null;
            if (outcome.status === "unresolved") return null;
            useAssessmentSubmissionStore.getState().clear(key);
            if (outcome.status === "reverted") throw new Error("Assessment transaction reverted");
            return outcome.uid;
          }),
          submitAssessment: fromPromise<string, AssessmentWorkflowParams & { gardenId: Address }>(
            async ({ input: params }) => {
              const { address: currentAddress, sender: currentSender } = identityRef.current;
              const currentChainId = chainIdRef.current;
              if (getPending())
                throw new Error(formatMessageRef.current({ id: "app.account.transactionPending" }));

              if (!currentAddress) {
                throw new Error(
                  formatMessageRef.current({
                    id: "app.assessment.accountRequiredMessage",
                    defaultMessage: "Sign in to your account before submitting an assessment.",
                  })
                );
              }
              if (!currentSender) {
                throw new Error(formatMessageRef.current({ id: "app.account.signerNotReady" }));
              }

              try {
                const newAttestationUID = await createAssessment(
                  {
                    params,
                    chainId: currentChainId,
                    onReady: () => {
                      trackAdminAssessmentCreateStarted({
                        gardenId: params.gardenId,
                        assessmentType: params.assessmentType,
                        chainId: currentChainId,
                      });
                    },
                  },
                  createDefaultCreateAssessmentPorts({
                    account: currentAddress,
                    transactionSender: currentSender,
                    checkpoint: (submission) =>
                      useAssessmentSubmissionStore.getState().record(submission),
                    clearCheckpoint: (submission) => {
                      const key = assessmentSubmissionKey(
                        submission.account,
                        submission.chainId,
                        submission.gardenId
                      );
                      if (
                        useAssessmentSubmissionStore.getState().pending[key]?.result.hash ===
                        (submission.result.broadcastReference?.hash ?? submission.result.hash)
                      )
                        useAssessmentSubmissionStore.getState().clear(key);
                    },
                    reportEvidenceFailures: ({ failedCount, totalCount }) => {
                      logger.warn("Some evidence media uploads failed", {
                        source: "useCreateAssessmentWorkflow",
                        failedCount,
                        totalCount,
                      });
                      toastService.info({
                        title: formatMessageRef.current(
                          {
                            id: "app.assessment.partialEvidenceUpload.title",
                            defaultMessage:
                              "{failedCount} of {totalCount} evidence files failed to upload",
                          },
                          {
                            failedCount,
                            totalCount,
                          }
                        ),
                        message: formatMessageRef.current({
                          id: "app.assessment.partialEvidenceUpload.message",
                          defaultMessage:
                            "The assessment was created with partial evidence. You can add more files later.",
                        }),
                        context: "assessment creation",
                        suppressLogging: true,
                      });
                    },
                    reportMetricsFailure: (error) => {
                      logger.error("Failed to upload assessment metrics JSON", {
                        source: "useCreateAssessmentWorkflow",
                        error,
                      });
                    },
                  })
                );
                trackAdminAssessmentCreateSuccess({
                  gardenId: params.gardenId,
                  assessmentType: params.assessmentType,
                  chainId: currentChainId,
                  attestationUid: newAttestationUID,
                });
                return newAttestationUID;
              } catch (error) {
                if (
                  error instanceof AssessmentConfirmationUnavailableError ||
                  error instanceof AssessmentSubmissionPendingError
                ) {
                  useAssessmentSubmissionStore.getState().record(error.assessmentSubmission);
                  // Accepted execution is neither a failed assessment nor permission to retry.
                  throw new Error(
                    formatMessageRef.current({ id: "app.account.transactionPending" })
                  );
                }
                const message =
                  error instanceof TransactionConfirmationPendingError
                    ? formatMessageRef.current({ id: "app.account.transactionPending" })
                    : withoutQuotedRequest(error instanceof Error ? error.message : String(error));
                trackAdminAssessmentCreateFailed({
                  gardenId: params.gardenId,
                  assessmentType: params.assessmentType,
                  chainId: currentChainId,
                  error: message,
                });
                throw new Error(message);
              }
            }
          ),
        },
      }),
    [] // Machine created once — actor reads current values from refs
  );

  const [state, send, actor] = useMachine(machine);
  const identityScope = `${address ? getTransactionScopeKey(address, selectedChainId) : "disconnected"}:${draftGardenId ?? ""}`;
  const previousScope = useRef(identityScope);
  useEffect(() => {
    if (previousScope.current !== identityScope) {
      previousScope.current = identityScope;
      activeKeyRef.current = scope;
      send({ type: "SWITCH_SCOPE" });
    }
    if (pendingSubmission && actor.getSnapshot().matches("idle")) {
      activeKeyRef.current = scope;
      send({ type: "RESTORE_PENDING", gardenId: pendingSubmission.gardenId });
    }
  }, [scope, identityScope, pendingSubmission, send, actor]);

  const startCreation = useCallback(
    (params: AssessmentWorkflowParams & { gardenId: Address }) => {
      if (
        actor.getSnapshot().matches("pending") ||
        actor.getSnapshot().matches("reconciling") ||
        actor.getSnapshot().matches("submitting")
      )
        return false;
      if (address)
        activeKeyRef.current = assessmentSubmissionKey(address, selectedChainId, params.gardenId);
      if (getPending()) return false;
      const ipfsStatus = getIpfsInitStatus();
      if (ipfsStatus.status === "failed" || ipfsStatus.status === "skipped_no_config") {
        toastService.error({
          title: formatMessage({
            id: "app.assessment.storageUnavailable",
            defaultMessage: "Storage unavailable",
          }),
          message: formatMessage({
            id: "app.assessment.storageUnavailableMessage",
            defaultMessage:
              "Assessment uploads are unavailable right now. Please try again after storage is configured.",
          }),
          context: "assessment submission",
          suppressLogging: true,
        });
        return false;
      }

      send({ type: "START", params });
      // The machine validates as it starts, and in its invalid state it ignores
      // the SUBMIT that follows. Answers it refuses are not started, so the
      // caller can say so; the form should have caught them first.
      if (actor.getSnapshot().matches("invalid")) {
        logger.error("The assessment send refused answers the form accepted", {
          source: "useCreateAssessmentWorkflow",
          startDate: params.startDate,
          endDate: params.endDate,
        });
        return false;
      }
      // Persist draft to IndexedDB for offline resilience
      void (async () => {
        const savedDraft = await saveDraft(params);
        if (savedDraft) {
          draftPersistenceWarningShownRef.current = false;
          return;
        }

        if (!draftKey) return;
        notifyDraftPersistenceIssue("save");
      })();
      return true;
    },
    [
      send,
      actor,
      saveDraft,
      draftKey,
      notifyDraftPersistenceIssue,
      formatMessage,
      address,
      selectedChainId,
    ]
  );

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const submitCreation = useCallback(() => {
    send({ type: "SUBMIT" });
  }, [send]);

  const reset = useCallback(() => {
    if (getPending()) return;
    send({ type: "RESET" });
  }, [send]);

  const queryClient = useQueryClient();

  // Invalidate assessment queries and clear draft when workflow reaches success state
  const isSuccess = state.matches("success");
  const gardenId = state.context.assessmentParams?.gardenId ?? state.context.pendingGardenId;

  // Progressive re-invalidation covers EAS GraphQL indexer lag at 2s / 5s / 15s — matches
  // the pattern used by vault mutations (useVaultDeposit, useHarvest, useEmergencyPause).
  const { start: scheduleIndexerRefetch } = useProgressiveInvalidation(
    useCallback(() => {
      if (!gardenId) return;
      const keys = queryInvalidation.invalidateAssessments(gardenId, chainIdRef.current);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }, [gardenId, queryClient]),
    INDEXER_LAG_SCHEDULE_MS
  );
  useEffect(() => {
    if (!isSuccess) return;

    let cancelled = false;

    const finalizeSuccess = async () => {
      await clearDraft();
      const persistedDraft = await peekDraft();
      if (!cancelled) {
        if (persistedDraft) {
          notifyDraftPersistenceIssue("clear");
        } else {
          draftPersistenceWarningShownRef.current = false;
        }
      }

      // Immediate invalidation for admin's direct EAS query
      const keys = queryInvalidation.invalidateAssessments(gardenId, chainIdRef.current);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }

      // Second pass after indexer lag so gardens/assessments data reflects the new attestation
      scheduleIndexerRefetch();
    };

    void finalizeSuccess();

    return () => {
      cancelled = true;
    };
  }, [
    isSuccess,
    clearDraft,
    peekDraft,
    notifyDraftPersistenceIssue,
    gardenId,
    queryClient,
    scheduleIndexerRefetch,
  ]);

  return {
    state,
    startCreation,
    submitCreation,
    retry,
    reset,
    isPending: state.matches("pending") || state.matches("reconciling"),
    isCheckingConfirmation: state.matches("reconciling"),
    checkConfirmation: () => send({ type: "CHECK_CONFIRMATION" }),
    canRetry: state.matches("error") && !getPending() && state.context.retryCount < 3,
    draft,
  };
}
