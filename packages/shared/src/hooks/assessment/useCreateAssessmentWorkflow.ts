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
import { TransactionConfirmationPendingError } from "../../modules/transactions/types";
import { withoutQuotedRequest } from "../../utils/errors/extract-message";

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
  const confirmationPendingRef = useRef(false);
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
          canRetry: ({ context }) => !confirmationPendingRef.current && context.retryCount < 3,
        },
        actors: {
          submitAssessment: fromPromise<string, AssessmentWorkflowParams & { gardenId: Address }>(
            async ({ input: params }) => {
              const { address: currentAddress, sender: currentSender } = identityRef.current;
              const currentChainId = chainIdRef.current;

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
                confirmationPendingRef.current =
                  error instanceof AssessmentConfirmationUnavailableError ||
                  error instanceof TransactionConfirmationPendingError;
                const message =
                  error instanceof AssessmentConfirmationUnavailableError
                    ? formatMessageRef.current({
                        id: "app.assessment.confirmationUnavailable",
                        defaultMessage:
                          "Your assessment transaction was confirmed, but its record is temporarily unavailable. Check your assessments before submitting again.",
                      })
                    : error instanceof TransactionConfirmationPendingError
                      ? formatMessageRef.current({ id: "app.account.transactionPending" })
                      : withoutQuotedRequest(
                          error instanceof Error ? error.message : String(error)
                        );
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

  const startCreation = useCallback(
    (params: AssessmentWorkflowParams & { gardenId: Address }) => {
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
    [send, actor, saveDraft, draftKey, notifyDraftPersistenceIssue, formatMessage]
  );

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const submitCreation = useCallback(() => {
    send({ type: "SUBMIT" });
  }, [send]);

  const reset = useCallback(() => {
    confirmationPendingRef.current = false;
    send({ type: "RESET" });
  }, [send]);

  const queryClient = useQueryClient();

  // Invalidate assessment queries and clear draft when workflow reaches success state
  const isSuccess = state.matches("success");
  const gardenId = state.context.assessmentParams?.gardenId;

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
    canRetry:
      state.matches("error") && !confirmationPendingRef.current && state.context.retryCount < 3,
    draft,
  };
}
