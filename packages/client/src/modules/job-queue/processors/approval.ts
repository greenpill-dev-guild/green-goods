import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { encodeFunctionData } from "viem";
import { getEASConfig } from "@/config";
import { abi } from "@/utils/abis/EAS.json";
import { encodeWorkApprovalData } from "@/utils/eas";

interface EncodedApprovalData {
  attestationData: `0x${string}`;
  easConfig: ReturnType<typeof getEASConfig>;
  gardenerAddress: string;
}

export const approvalProcessor: JobProcessor<ApprovalJobPayload, EncodedApprovalData> = {
  async encodePayload(payload: ApprovalJobPayload, chainId: number): Promise<EncodedApprovalData> {
    // Encode work approval data for EAS attestation
    const encodedAttestationData = encodeWorkApprovalData(payload, chainId);
    const easConfig = getEASConfig(chainId);

    return {
      attestationData: encodedAttestationData,
      easConfig,
      gardenerAddress: payload.gardenerAddress,
    };
  },

  async execute(
    encoded: EncodedApprovalData,
    _meta: Record<string, unknown>,
    smartAccountClient: any
  ): Promise<string> {
    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      // eslint-disable-next-line no-console
      console.debug("[approvalProcessor] execute", {
        to: encoded.easConfig.EAS.address,
        gardener: encoded.gardenerAddress,
      });
    }
    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: encoded.easConfig.WORK_APPROVAL.uid,
          data: {
            recipient: encoded.gardenerAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: true,
            refUID: ZERO_BYTES32,
            data: encoded.attestationData,
            value: 0n,
          },
        },
      ],
    });

    try {
      const receipt = await smartAccountClient.sendTransaction({
        to: encoded.easConfig.EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[approvalProcessor] sendTransaction receipt", receipt);
      }
      return receipt;
    } catch (err: any) {
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[approvalProcessor] sendTransaction error", err);
      }
      throw err;
    }
  },
};
