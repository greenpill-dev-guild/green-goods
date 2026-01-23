import { EAS, SchemaEncoder, type Transaction } from "@ethereum-attestation-service/eas-sdk";
import { useMachine } from "@xstate/react";
import { ethers, type Eip1193Provider } from "ethers";
import { useAccount } from "wagmi";
import { getEASConfig } from "../../config/blockchain";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../../modules/data/ipfs";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createAssessmentMachine } from "../../workflows/createAssessment";

// Define CreateAssessmentForm inline
export interface CreateAssessmentForm {
  gardenId: string;
  title: string;
  description: string;
  assessmentType: string;
  capitals: string[];
  metrics: Record<string, unknown>;
  evidenceMedia: File[];
  reportDocuments: string[];
  impactAttestations: string[];
  startDate: number;
  endDate: number;
  location: string;
  tags: string[];
}

export function useCreateAssessmentWorkflow() {
  const [state, send] = useMachine(createAssessmentMachine);
  const { address, connector } = useAccount();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);

  const startCreation = (params: CreateAssessmentForm & { gardenId: string }) => {
    send({ type: "START", params });
  };

  const submitCreation = async (): Promise<string> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    if (!state.context.assessmentParams) {
      throw new Error("Assessment parameters not initialized");
    }

    if (!state.context.assessmentParams.gardenId) {
      throw new Error("Garden ID is required");
    }

    if (typeof window.ethereum === "undefined") {
      const errorMsg = "Web3 provider not found. Please install MetaMask or another web3 wallet.";
      send({ type: "FAILURE", error: errorMsg });
      throw new Error(errorMsg);
    }

    send({ type: "SUBMIT" });

    try {
      const contracts = getNetworkContracts(selectedChainId);
      const easConfig = getEASConfig(selectedChainId);
      if (
        !contracts?.eas ||
        !easConfig.GARDEN_ASSESSMENT.uid ||
        !easConfig.GARDEN_ASSESSMENT.schema
      ) {
        throw new Error(`EAS configuration missing for chain ${selectedChainId}`);
      }

      const params = state.context.assessmentParams;
      const eas = new EAS(contracts.eas);
      // Connect EAS SDK with the wallet's provider
      if (!connector) {
        throw new Error("No wallet connector found");
      }
      const provider = await connector.getProvider();

      // Create ethers provider from raw provider (EIP-1193 compatible)
      const ethersProvider = new ethers.BrowserProvider(provider as Eip1193Provider);
      const signer = await ethersProvider.getSigner();
      eas.connect(signer);

      const schemaEncoder = new SchemaEncoder(easConfig.GARDEN_ASSESSMENT.schema);

      let metricsCid = "";
      try {
        const metricsPayload =
          typeof params.metrics === "string" ? JSON.parse(params.metrics) : params.metrics;
        const uploadedMetrics = await uploadJSONToIPFS(metricsPayload);
        metricsCid = uploadedMetrics.cid;
      } catch (error) {
        console.error("Failed to upload assessment metrics JSON", error);
        throw new Error("Invalid metrics JSON. Please provide valid JSON content.");
      }

      let evidenceMediaCids: string[] = [];
      if (params.evidenceMedia?.length) {
        evidenceMediaCids = await Promise.all(
          params.evidenceMedia.map(async (file: File) => {
            const uploaded = await uploadFileToIPFS(file);
            return uploaded.cid;
          })
        );
      }

      const reportDocuments = (params.reportDocuments || []).filter(Boolean);

      const impactAttestations = (params.impactAttestations || []).map((uid: string) =>
        uid.trim().toLowerCase()
      );

      const toUnixSeconds = (value?: string | number | null) => {
        if (!value) return 0;
        if (typeof value === "number") return Math.floor(value);
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) return 0;
        return Math.floor(timestamp / 1000);
      };

      const encodedData = schemaEncoder.encodeData([
        { name: "title", value: params.title, type: "string" },
        { name: "description", value: params.description, type: "string" },
        { name: "assessmentType", value: params.assessmentType, type: "string" },
        { name: "capitals", value: params.capitals, type: "string[]" },
        { name: "metricsJSON", value: metricsCid, type: "string" },
        { name: "evidenceMedia", value: evidenceMediaCids, type: "string[]" },
        { name: "reportDocuments", value: reportDocuments, type: "string[]" },
        { name: "impactAttestations", value: impactAttestations, type: "bytes32[]" },
        { name: "startDate", value: toUnixSeconds(params.startDate), type: "uint256" },
        { name: "endDate", value: toUnixSeconds(params.endDate), type: "uint256" },
        { name: "location", value: params.location, type: "string" },
        { name: "tags", value: params.tags, type: "string[]" },
      ]);

      // EAS SDK attest returns Transaction<string> where wait() returns the attestation UID
      const attestResult: Transaction<string> = await eas.attest({
        schema: easConfig.GARDEN_ASSESSMENT.uid,
        data: {
          // params already has gardenId from CreateAssessmentForm type
          recipient: params.gardenId,
          expirationTime: 0n,
          revocable: true,
          data: encodedData,
        },
      });

      // Wait for transaction confirmation and get the attestation UID
      const newAttestationUID = await attestResult.wait();

      send({ type: "SUCCESS", txHash: newAttestationUID });

      return newAttestationUID;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      send({ type: "FAILURE", error: message });
      throw error;
    }
  };

  const retry = () => {
    send({ type: "RETRY" });
    submitCreation();
  };

  const reset = () => {
    send({ type: "RESET" });
  };

  return {
    state,
    startCreation,
    submitCreation,
    retry,
    reset,
    canRetry: state.matches("error") && state.context.retryCount < 3,
  };
}
