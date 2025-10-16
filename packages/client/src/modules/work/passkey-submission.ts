import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData } from "viem";

import { getEASConfig } from "@/config/blockchain";
import { createLogger } from "@/utils/app/logger";
import { abi as EASAbi } from "@/utils/blockchain/abis/EAS.json";
import { encodeWorkData, encodeWorkApprovalData } from "@/utils/eas/encoders";

const logger = createLogger("PasskeySubmission");

function assertSmartAccount(
  client: SmartAccountClient | null
): asserts client is SmartAccountClient {
  if (!client) {
    throw new Error("Passkey client is not available. Please re-authenticate and try again.");
  }
  if (!client.account) {
    throw new Error("Passkey session is not ready. Please re-authenticate and try again.");
  }
}

export interface PasskeyWorkSubmissionParams {
  client: SmartAccountClient | null;
  draft: WorkDraft;
  gardenAddress: string;
  actionUID: number;
  actionTitle: string;
  chainId: number;
  images: File[];
}

export async function submitWorkWithPasskey({
  client,
  draft,
  gardenAddress,
  actionUID,
  actionTitle,
  chainId,
  images,
}: PasskeyWorkSubmissionParams): Promise<`0x${string}`> {
  logger.log("Submitting work via passkey", { gardenAddress, actionUID, chainId });

  assertSmartAccount(client);

  // TypeScript doesn't understand that client is now guaranteed to be non-null after assertion
  const smartClient = client as SmartAccountClient;

  const easConfig = getEASConfig(chainId);

  const attestationData = await encodeWorkData(
    {
      ...draft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      media: images,
    },
    chainId
  );

  const data = encodeFunctionData({
    abi: EASAbi,
    functionName: "attest",
    args: [
      {
        schema: easConfig.WORK.uid,
        data: {
          recipient: gardenAddress as `0x${string}`,
          expirationTime: NO_EXPIRATION,
          revocable: true,
          refUID: ZERO_BYTES32,
          data: attestationData,
          value: 0n,
        },
      },
    ],
  });

  const hash = await smartClient.sendTransaction({
    account: smartClient.account!,
    chain: smartClient.chain,
    to: easConfig.EAS.address as `0x${string}`,
    data,
    value: 0n,
  });

  logger.log("Passkey work submission sent", { hash });

  return hash;
}

export interface PasskeyApprovalSubmissionParams {
  client: SmartAccountClient | null;
  draft: WorkApprovalDraft;
  gardenerAddress: string;
  chainId: number;
}

export async function submitApprovalWithPasskey({
  client,
  draft,
  gardenerAddress,
  chainId,
}: PasskeyApprovalSubmissionParams): Promise<`0x${string}`> {
  logger.log("Submitting approval via passkey", { gardenerAddress, chainId });

  assertSmartAccount(client);

  // TypeScript doesn't understand that client is now guaranteed to be non-null after assertion
  const smartClient = client as SmartAccountClient;

  const easConfig = getEASConfig(chainId);
  const attestationData = encodeWorkApprovalData(draft, chainId);

  const data = encodeFunctionData({
    abi: EASAbi,
    functionName: "attest",
    args: [
      {
        schema: easConfig.WORK_APPROVAL.uid,
        data: {
          recipient: gardenerAddress as `0x${string}`,
          expirationTime: NO_EXPIRATION,
          revocable: true,
          refUID: ZERO_BYTES32,
          data: attestationData,
          value: 0n,
        },
      },
    ],
  });

  const hash = await smartClient.sendTransaction({
    account: smartClient.account!,
    chain: smartClient.chain,
    to: easConfig.EAS.address as `0x${string}`,
    data,
    value: 0n,
  });

  logger.log("Passkey approval submission sent", { hash });

  return hash;
}
