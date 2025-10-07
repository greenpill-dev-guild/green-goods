import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { encodeFunctionData } from "viem";
import { getEASConfig } from "@/config/blockchain";
import { abi } from "@/utils/blockchain/abis/EAS.json";
import { encodeWorkData } from "@/utils/eas/encoders";
import type { SmartAccountClient } from "permissionless";

interface EncodedWorkData {
  attestationData: `0x${string}`;
  easConfig: ReturnType<typeof getEASConfig>;
  gardenAddress: string;
  actionTitle: string;
}

export const workProcessor: JobProcessor<WorkJobPayload, EncodedWorkData> = {
  async encodePayload(payload: WorkJobPayload, chainId: number): Promise<EncodedWorkData> {
    // Get action title from action UID - we'll need to look this up
    // For now, create a default title that includes the action UID
    const actionTitle =
      payload.title || `Action ${payload.actionUID} - ${new Date().toISOString()}`;

    // Encode work data with media files and chain ID
    const encodedAttestationData = await encodeWorkData(
      {
        ...payload,
        title: actionTitle,
        media: payload.media || [],
      },
      chainId
    );

    const easConfig = getEASConfig(chainId);

    return {
      attestationData: encodedAttestationData,
      easConfig,
      gardenAddress: payload.gardenAddress,
      actionTitle,
    };
  },

  async execute(
    encoded: EncodedWorkData,
    _meta: Record<string, unknown>,
    smartAccountClient: SmartAccountClient
  ): Promise<string> {
    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      // eslint-disable-next-line no-console
      console.debug("[workProcessor] execute", {
        to: encoded.easConfig.EAS.address,
        garden: encoded.gardenAddress,
      });
    }
    const encodedData = encodeFunctionData({
      abi,
      functionName: "attest",
      args: [
        {
          schema: encoded.easConfig.WORK.uid,
          data: {
            recipient: encoded.gardenAddress as `0x${string}`,
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
      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }

      const receipt = await (smartAccountClient.sendTransaction as any)({
        to: encoded.easConfig.EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
      });
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[workProcessor] sendTransaction receipt", receipt);
      }
      return receipt;
    } catch (err: any) {
      if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
        // eslint-disable-next-line no-console
        console.debug("[workProcessor] sendTransaction error", err);
      }
      throw err;
    }
  },
};

// Helper function to get action title - this can be enhanced to lookup from actions context
export function getActionTitle(
  actionUID: number,
  actions?: Array<{ id: string; title: string }>,
  chainId?: number
): string {
  if (actions && typeof chainId === "number") {
    const compositeId = `${chainId}-${actionUID}`;
    const action = actions.find((action) => action.id === compositeId);
    if (action) {
      return action.title;
    }
  }
  return `Action ${actionUID}`;
}
