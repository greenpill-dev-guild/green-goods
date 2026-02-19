import { EAS, SchemaEncoder, type Transaction } from "@ethereum-attestation-service/eas-sdk";
import { useMachine } from "@xstate/react";
import { useQueryClient } from "@tanstack/react-query";
import { ethers, type Eip1193Provider } from "ethers";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { fromPromise } from "xstate";
import { useAccount, useWalletClient } from "wagmi";
import { getEASConfig } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
import {
  trackAdminAssessmentCreateFailed,
  trackAdminAssessmentCreateStarted,
  trackAdminAssessmentCreateSuccess,
} from "../../modules/app/analytics-events";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import {
  createAssessmentMachine,
  type AssessmentWorkflowParams,
} from "../../workflows/createAssessment";
import type { Address } from "../../types/domain";
import { queryInvalidation } from "../query-keys";
import { useAssessmentDraft } from "./useAssessmentDraft";

export type { AssessmentWorkflowParams } from "../../types/domain";
export type { CreateAssessmentForm } from "../../types/domain";
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
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);

  // Draft persistence
  const draft = useAssessmentDraft(draftGardenId, address, {
    enabled: !!draftGardenId && !!address,
  });

  // Store mutable dependencies in refs so the machine actor can read
  // current values without recreating the machine on every change
  const addressRef = useRef(address);
  const walletClientRef = useRef(walletClient);
  const chainIdRef = useRef(selectedChainId);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);
  useEffect(() => {
    chainIdRef.current = selectedChainId;
  }, [selectedChainId]);

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
                  }
                  evidenceMediaCids = results
                    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
                    .map((r) => r.value);
                }

                // Upload metrics JSON to IPFS
                let metricsCid = "";
                try {
                  const metricsPayload =
                    typeof params.metrics === "string"
                      ? JSON.parse(params.metrics)
                      : params.metrics;
                  const uploadedMetrics = await uploadJSONToIPFS(metricsPayload);
                  metricsCid = uploadedMetrics.cid;
                } catch (error) {
                  logger.error("Failed to upload assessment metrics JSON", {
                    source: "useCreateAssessmentWorkflow",
                    error,
                  });
                  throw new Error("Invalid metrics JSON. Please provide valid JSON content.");
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
                    revocable: true,
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
      send({ type: "START", params });
      // Persist draft to IndexedDB for offline resilience
      void draft.saveDraft(params);
    },
    [send, draft]
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
    if (isSuccess) {
      void draft.clearDraft();
      // Invalidate assessment queries so the list updates immediately
      const keys = queryInvalidation.invalidateAssessments(gardenId, chainIdRef.current);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [isSuccess, draft, gardenId, queryClient]);

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
