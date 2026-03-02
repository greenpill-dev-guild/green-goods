import { EAS, SchemaEncoder, type Transaction } from "@ethereum-attestation-service/eas-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useMachine } from "@xstate/react";
import { type Eip1193Provider, ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { useAccount, useWalletClient } from "wagmi";
import { fromPromise } from "xstate";
import { toastService } from "../../components/toast";
import { getEASConfig } from "../../config/blockchain";
import {
  trackAdminAssessmentCreateFailed,
  trackAdminAssessmentCreateStarted,
  trackAdminAssessmentCreateSuccess,
} from "../../modules/app/analytics-events";
import { logger } from "../../modules/app/logger";
import { getIpfsInitStatus, uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { Address } from "../../types/domain";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import {
  type AssessmentWorkflowParams,
  createAssessmentMachine,
} from "../../workflows/createAssessment";
import { queryInvalidation } from "../query-keys";
import { useAssessmentDraft } from "./useAssessmentDraft";

export type { AssessmentWorkflowParams, CreateAssessmentForm } from "../../types/domain";
export type { AssessmentDraftRecord } from "./useAssessmentDraft";

/**
 * Maps assessment type strings to domain enum values matching
 * the contract's AssessmentSchema.domain (uint8).
 * 0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE
 */
const DOMAIN_MAP: Record<string, number> = {
  solar: 0,
  agro: 1,
  edu: 2,
  waste: 3,
};

function assessmentTypeToDomain(assessmentType: string): number {
  const lower = assessmentType.toLowerCase();
  // Support both "solar" and "domain-0" formats
  if (lower.startsWith("domain-")) {
    const num = Number.parseInt(lower.replace("domain-", ""), 10);
    return num >= 0 && num <= 3 ? num : 0;
  }
  return DOMAIN_MAP[lower] ?? 0;
}

export interface UseCreateAssessmentWorkflowOptions {
  /** Garden address for draft persistence. When provided, enables IndexedDB draft auto-save. */
  gardenId?: string;
}

export function useCreateAssessmentWorkflow(options: UseCreateAssessmentWorkflowOptions = {}) {
  const { gardenId: draftGardenId } = options;
  const { formatMessage } = useIntl();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
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
  const addressRef = useRef(address);
  const walletClientRef = useRef(walletClient);
  const chainIdRef = useRef(selectedChainId);
  const formatMessageRef = useRef(formatMessage);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);
  useEffect(() => {
    chainIdRef.current = selectedChainId;
  }, [selectedChainId]);
  useEffect(() => {
    formatMessageRef.current = formatMessage;
  }, [formatMessage]);

  const machine = useMemo(
    () =>
      createAssessmentMachine.provide({
        actors: {
          submitAssessment: fromPromise<string, AssessmentWorkflowParams & { gardenId: Address }>(
            async ({ input: params }) => {
              const currentAddress = addressRef.current;
              const currentWalletClient = walletClientRef.current;
              const currentChainId = chainIdRef.current;

              if (!currentAddress) {
                throw new Error("Wallet not connected");
              }

              if (!currentWalletClient) {
                throw new Error("No wallet client available");
              }

              if (
                typeof currentWalletClient.chain?.id === "number" &&
                currentWalletClient.chain.id !== currentChainId
              ) {
                throw new Error(
                  formatMessageRef.current({
                    id: "app.assessment.chainMismatch",
                    defaultMessage:
                      "Switch your wallet network to the selected chain before submitting this assessment.",
                  })
                );
              }

              trackAdminAssessmentCreateStarted({
                gardenId: params.gardenId,
                assessmentType: params.assessmentType,
                chainId: currentChainId,
              });

              try {
                const contracts = getNetworkContracts(currentChainId);
                const easConfig = getEASConfig(currentChainId);
                if (
                  !contracts?.eas ||
                  !easConfig.ASSESSMENT.uid ||
                  isZeroBytes32(easConfig.ASSESSMENT.uid) ||
                  !easConfig.ASSESSMENT.schema
                ) {
                  throw new Error(`EAS configuration missing for chain ${currentChainId}`);
                }

                // EAS SDK requires an ethers Signer — bridge from viem wallet client
                const eas = new EAS(contracts.eas);
                const { account, transport } = currentWalletClient;
                const ethersProvider = new ethers.BrowserProvider(transport as Eip1193Provider);
                const signer = await ethersProvider.getSigner(account.address);
                eas.connect(signer);

                const schemaEncoder = new SchemaEncoder(easConfig.ASSESSMENT.schema);

                // Upload evidence media to IPFS (partial success allowed)
                let evidenceMediaCids: string[] = [];
                if (params.evidenceMedia?.length) {
                  const results = await Promise.allSettled(
                    params.evidenceMedia.map(async (file: File) => {
                      const uploaded = await uploadFileToIPFS(file);
                      return uploaded.cid;
                    })
                  );
                  const failed = results.filter((r) => r.status === "rejected");
                  if (failed.length > 0) {
                    logger.warn("Some evidence media uploads failed", {
                      source: "useCreateAssessmentWorkflow",
                      failedCount: failed.length,
                      totalCount: params.evidenceMedia.length,
                    });
                    toastService.info({
                      title: formatMessageRef.current(
                        {
                          id: "app.assessment.partialEvidenceUpload.title",
                          defaultMessage:
                            "{failedCount} of {totalCount} evidence files failed to upload",
                        },
                        {
                          failedCount: failed.length,
                          totalCount: params.evidenceMedia.length,
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
                  }
                  evidenceMediaCids = results
                    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
                    .map((r) => r.value);
                }

                // Upload metrics JSON to IPFS
                let metricsCid = "";
                const metricsPayload =
                  typeof params.metrics === "string"
                    ? (() => {
                        try {
                          return JSON.parse(params.metrics);
                        } catch {
                          throw new Error(
                            "Invalid metrics JSON. Please provide valid JSON content."
                          );
                        }
                      })()
                    : params.metrics;

                try {
                  const uploadedMetrics = await uploadJSONToIPFS(metricsPayload);
                  metricsCid = uploadedMetrics.cid;
                } catch (error) {
                  logger.error("Failed to upload assessment metrics JSON", {
                    source: "useCreateAssessmentWorkflow",
                    error,
                  });
                  throw error;
                }

                // Pack rich v1 data into a config JSON and upload to IPFS
                // The contract's v2 AssessmentSchema only stores assessmentConfigCID on-chain
                const reportDocuments = (params.reportDocuments || []).filter(Boolean);
                const impactAttestations = (params.impactAttestations || []).map((uid: string) =>
                  uid.trim().toLowerCase()
                );

                const assessmentConfig = {
                  assessmentType: params.assessmentType,
                  capitals: params.capitals,
                  metricsCid,
                  evidenceMediaCids,
                  reportDocuments,
                  impactAttestations,
                  tags: params.tags,
                };

                const configUpload = await uploadJSONToIPFS(assessmentConfig);
                const assessmentConfigCID = configUpload.cid;

                // Map assessmentType to domain enum (0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE)
                const domain = params.domain ?? assessmentTypeToDomain(params.assessmentType);

                const toUnixSeconds = (value?: string | number | null) => {
                  if (!value) return 0;
                  if (typeof value === "number") return Math.floor(value);
                  const timestamp = new Date(value).getTime();
                  if (Number.isNaN(timestamp)) return 0;
                  return Math.floor(timestamp / 1000);
                };

                // Encode v2 schema matching contract's AssessmentSchema struct:
                // (string title, string description, string assessmentConfigCID,
                //  uint8 domain, uint256 startDate, uint256 endDate, string location)
                const encodedData = schemaEncoder.encodeData([
                  { name: "title", value: params.title, type: "string" },
                  { name: "description", value: params.description, type: "string" },
                  { name: "assessmentConfigCID", value: assessmentConfigCID, type: "string" },
                  { name: "domain", value: domain, type: "uint8" },
                  { name: "startDate", value: toUnixSeconds(params.startDate), type: "uint256" },
                  { name: "endDate", value: toUnixSeconds(params.endDate), type: "uint256" },
                  { name: "location", value: params.location, type: "string" },
                ]);

                const attestResult: Transaction<string> = await eas.attest({
                  schema: easConfig.ASSESSMENT.uid,
                  data: {
                    recipient: params.gardenId,
                    expirationTime: 0n,
                    revocable: false,
                    data: encodedData,
                  },
                });

                const newAttestationUID = await attestResult.wait();
                trackAdminAssessmentCreateSuccess({
                  gardenId: params.gardenId,
                  assessmentType: params.assessmentType,
                  chainId: currentChainId,
                  attestationUid: newAttestationUID,
                });
                return newAttestationUID;
              } catch (error) {
                trackAdminAssessmentCreateFailed({
                  gardenId: params.gardenId,
                  assessmentType: params.assessmentType,
                  chainId: currentChainId,
                  error: error instanceof Error ? error.message : String(error),
                });
                throw error;
              }
            }
          ),
        },
      }),
    [] // Machine created once — actor reads current values from refs
  );

  const [state, send] = useMachine(machine);

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
    [send, saveDraft, draftKey, notifyDraftPersistenceIssue, formatMessage]
  );

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const submitCreation = useCallback(() => {
    send({ type: "SUBMIT" });
  }, [send]);

  const reset = useCallback(() => {
    send({ type: "RESET" });
  }, [send]);

  const queryClient = useQueryClient();

  // Invalidate assessment queries and clear draft when workflow reaches success state
  const isSuccess = state.matches("success");
  const gardenId = state.context.assessmentParams?.gardenId;
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

      // Invalidate assessment queries so the list updates immediately
      const keys = queryInvalidation.invalidateAssessments(gardenId, chainIdRef.current);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    };

    void finalizeSuccess();

    return () => {
      cancelled = true;
    };
  }, [isSuccess, clearDraft, peekDraft, notifyDraftPersistenceIssue, gardenId, queryClient]);

  return {
    state,
    startCreation,
    submitCreation,
    retry,
    reset,
    canRetry: state.matches("error") && state.context.retryCount < 3,
    draft,
  };
}
