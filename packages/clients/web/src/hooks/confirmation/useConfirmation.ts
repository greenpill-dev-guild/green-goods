import { useState } from "react";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { useWeb3 } from "../providers/web3";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

interface ContributionDataProps {
  attesting: boolean;
  error: string;
  approve: (feedback: string) => Promise<void>;
  reject: (feedback: string) => Promise<void>;
}

const schemaUID = ""; // TODO: Get the schema UID from the registry
const schemaEncoder = new SchemaEncoder(
  "uint256 contributionId, bool approval, string feedback, address campAccount"
);

export const useConfirmation = (
  contribution: Contribution
): ContributionDataProps => {
  const { provider } = useWeb3();
  const [attesting, setAttesting] = useState(false);
  const [error, setError] = useState("");

  // @ts-ignore
  const ethersProvider = provider && new ethers.BrowserProvider(provider);

  async function approve(feedback: string) {
    setAttesting(true);

    try {
      const signer = await ethersProvider?.getSigner();

      if (!signer) {
        throw new Error("No signer found");
      }

      const eas = new EAS(EASContractAddress);
      eas.connect(signer);

      const encodedData = schemaEncoder.encodeData([
        { name: "contributionId", value: contribution.id, type: "uint256" },
        { name: "approval", value: true, type: "bool" },
        { name: "feedback", value: feedback ?? "", type: "string" },
        {
          name: "campAccount",
          value: contribution.cammpaignAddrs,
          type: "address",
        },
      ]);

      const tx = await eas.attest({
        schema: schemaUID,
        data: {
          recipient: contribution.user,
          revocable: true, // Be aware that if your schema is not revocable, this MUST be false
          data: encodedData,
        },
      });

      const newAttestationUID = await tx.wait();

      console.log("New attestation UID:", newAttestationUID);
    } catch (error: any) {
      setError(error.message);

      console.error("Error approving contribution", error);
    }

    setAttesting(false);
  }

  async function reject(feedback?: string) {
    try {
      const signer = await ethersProvider?.getSigner();

      if (!signer) {
        throw new Error("No signer found");
      }

      const eas = new EAS(EASContractAddress);
      eas.connect(signer);

      const encodedData = schemaEncoder.encodeData([
        { name: "contributionId", value: contribution.id, type: "uint256" },
        { name: "approval", value: true, type: "bool" },
        { name: "feedback", value: feedback ?? "", type: "string" },
        {
          name: "campAccount",
          value: contribution.cammpaignAddrs,
          type: "address",
        },
      ]);

      const tx = await eas.attest({
        schema: schemaUID,
        data: {
          recipient: contribution.user,
          revocable: true, // Be aware that if your schema is not revocable, this MUST be false
          data: encodedData,
        },
      });

      const newAttestationUID = await tx.wait();

      console.log("New attestation UID:", newAttestationUID);
    } catch (error: any) {
      setError(error.message);

      console.error("Error rejecting contribution", error);
    }
  }

  return {
    attesting,
    error,
    approve,
    reject,
  };
};
