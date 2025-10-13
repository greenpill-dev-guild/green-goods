import { useMachine } from "@xstate/react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { createAssessmentMachine } from "@/workflows/createAssessment";
import { useAdminStore } from "@/stores/admin";
import type { CreateAssessmentForm } from "@/components/Garden/CreateAssessmentModal";
import { getNetworkContracts } from "@/utils/contracts";
import { useAuth } from "@/providers/AuthProvider";

export function useCreateAssessmentWorkflow() {
  const [state, send] = useMachine(createAssessmentMachine);
  const { address, connector } = useAccount();
  const { user } = useAuth();
  const { selectedChainId } = useAdminStore();

  const EAS_GARDEN_ASSESSMENT_SCHEMA =
  process.env.VITE_PUBLIC_EAS_GARDEN_ASSESSMENT_SCHEMA ||
  "0x76ea40f6c854813bed0224a4334298e63bf77818680bebe1b2921171f2eeb0f6"; // Base Sepolia

  const startCreation = (params: CreateAssessmentForm & { gardenId: string }) => {
    send({ type: "START", params });
  };

  const submitCreation = async (): Promise<string> => {
    console.log('Debug - Validation check:', {
      address,
      hasParams: !!state.context.assessmentParams,
      userWallet: user?.wallet?.address,
      state: state.value,
    });

    if (!address) {
      throw new Error("Wallet not connected");
    }

    if (!user?.wallet?.address) {
      throw new Error("User wallet address not found");
    }

    if (!state.context.assessmentParams) {
      throw new Error("Assessment parameters not initialized");
    }

    if (!state.context.assessmentParams.gardenId) {
      throw new Error("Garden ID is required");
    }

    if (typeof window.ethereum === 'undefined') {
      const errorMsg = "Web3 provider not found. Please install MetaMask or another web3 wallet.";
      send({ type: "FAILURE", error: errorMsg });
      throw new Error(errorMsg);
    }

    send({ type: "SUBMIT" });

    try {
      const contracts = getNetworkContracts(selectedChainId);
      if (!contracts?.easAddress || !contracts.assessmentSchemaUID) {
        throw new Error(`EAS configuration missing for chain ${selectedChainId}`);
      }

  const params = state.context.assessmentParams;
  const eas = new EAS("0x4200000000000000000000000000000000000021");
  // Connect EAS SDK with the wallet's provider
  if (!connector) {
    throw new Error("No wallet connector found");
  }
  const provider = await connector.getProvider();
  
  // Create ethers provider from raw provider
  const ethersProvider = new ethers.BrowserProvider(provider as any);
  const signer = await ethersProvider.getSigner();
  eas.connect(signer);

      const schemaEncoder = new SchemaEncoder(
        "uint8 soilMoisturePercentage,uint256 carbonTonStock,uint256 carbonTonPotential,uint256 gardenSquareMeters,string biome,string remoteReportPDF,string speciesRegistryJSON,string[] polygonCoordinates,string[] treeGenusesObserved,string[] weedGenusesObserved,string[] issues,string[] tags"
      );

      const encodedData = schemaEncoder.encodeData([
        { name: "soilMoisturePercentage", value: params.soilMoisturePercentage, type: "uint8" },
        { name: "carbonTonStock", value: params.carbonTonStock, type: "uint256" },
        { name: "carbonTonPotential", value: params.carbonTonPotential, type: "uint256" },
        { name: "gardenSquareMeters", value: params.gardenSquareMeters, type: "uint256" },
        { name: "biome", value: params.biome, type: "string" },
        { name: "remoteReportPDF", value: params.remoteReportPDF, type: "string" },
        { name: "speciesRegistryJSON", value: params.speciesRegistryJSON, type: "string" },
        { name: "polygonCoordinates", value: params.polygonCoordinates, type: "string[]" },
        { name: "treeGenusesObserved", value: params.treeGenusesObserved, type: "string[]" },
        { name: "weedGenusesObserved", value: params.weedGenusesObserved, type: "string[]" },
        { name: "issues", value: params.issues, type: "string[]" },
        { name: "tags", value: params.tags, type: "string[]" },
      ]);

      // The SDK may return a bytes32 UID or a transaction-like object depending on version.
      const attestResult = await eas.attest({
        schema: EAS_GARDEN_ASSESSMENT_SCHEMA,
        data: {
          // machine context stores CreateAssessmentForm; caller adds gardenId at startCreation
          recipient: (params as any).gardenId,
          expirationTime: 0n,
          revocable: true,
          data: encodedData,
        },
      });

      let newAttestationUID: string;
      if (typeof attestResult === "string") {
        newAttestationUID = attestResult;
      } else if (attestResult && typeof (attestResult as any).wait === "function") {
        // transaction-like object: prefer hash or UID if available
        newAttestationUID = (attestResult as any).attestationUID || (attestResult as any).hash || String(attestResult);
        try {
          // wait for confirmation to get any on-chain UID if SDK returns it in receipt
          const receipt = await (attestResult as any).wait();
          if (receipt && (receipt as any).attestationUID) {
            newAttestationUID = (receipt as any).attestationUID;
          }
        } catch {
          // ignore wait errors; we still have a usable identifier
        }
      } else {
        newAttestationUID = String(attestResult);
      }

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