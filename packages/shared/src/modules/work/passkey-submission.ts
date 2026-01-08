import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { getPublicClient } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";

import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import { debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData, simulateWorkData } from "../../utils/eas/encoders";
import { buildApprovalAttestTx, buildWorkAttestTx } from "../../utils/eas/transaction-builder";
import { parseContractError } from "../../utils/errors/contract-errors";

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

/** Submits a work attestation via the passkey smart account flow. */
export async function submitWorkWithPasskey({
  client,
  draft,
  gardenAddress,
  actionUID,
  actionTitle,
  chainId,
  images,
}: PasskeyWorkSubmissionParams): Promise<`0x${string}`> {
  debugLog("[PasskeySubmission] Submitting work via passkey", {
    gardenAddress,
    actionUID,
    chainId,
  });

  assertSmartAccount(client);

  // TypeScript doesn't understand that client is now guaranteed to be non-null after assertion
  const smartClient = client as SmartAccountClient;

  const easConfig = getEASConfig(chainId);

  // Simulate contract interaction before uploading
  const publicClient = getPublicClient(wagmiConfig, { chainId });
  if (publicClient) {
    try {
      debugLog("[PasskeySubmission] Simulating transaction before upload...");

      // Prepare simulation data (dummy CIDs)
      const simulationData = simulateWorkData(
        {
          ...draft,
          title: `${actionTitle} - ${new Date().toISOString()}`,
          actionUID,
          media: images,
        },
        chainId
      );

      // Simulate the attest call using the smart account address as the sender
      // This verifies that the smart account is a gardener and the action is valid
      await publicClient.simulateContract({
        address: easConfig.EAS.address as `0x${string}`,
        abi: EASABI,
        functionName: "attest",
        args: [
          {
            schema: easConfig.WORK.uid,
            data: {
              recipient: gardenAddress as `0x${string}`,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: simulationData,
              value: 0n,
            },
          },
        ],
        account: smartClient.account!.address, // Use address for simulation
      });
      debugLog("[PasskeySubmission] Simulation successful - proceeding to upload");
    } catch (err: any) {
      debugError("[PasskeySubmission] Simulation failed", err);

      const parsed = parseContractError(err);
      if (parsed.isKnown) {
        // Include error name so the UI provider can recognize it as a known error
        throw new Error(
          `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`
        );
      }

      // Fallback to cause reason if available
      if (err.cause?.reason) {
        throw new Error(`Validation failed: ${err.cause.reason}`);
      }

      throw new Error(
        `Validation failed: ${parsed.message || err.message || "Unknown error during simulation"}`
      );
    }
  }

  const attestationData = await encodeWorkData(
    {
      ...draft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      media: images,
    },
    chainId
  );

  const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

  const hash = await smartClient.sendTransaction({
    account: smartClient.account!,
    chain: smartClient.chain,
    ...txParams,
  });

  debugLog("[PasskeySubmission] Passkey work submission sent", { hash });

  return hash;
}

export interface PasskeyApprovalSubmissionParams {
  client: SmartAccountClient | null;
  draft: WorkApprovalDraft;
  gardenAddress: string;
  chainId: number;
}

/** Submits a work approval attestation using the authenticated passkey session. */
export async function submitApprovalWithPasskey({
  client,
  draft,
  gardenAddress,
  chainId,
}: PasskeyApprovalSubmissionParams): Promise<`0x${string}`> {
  debugLog("[PasskeySubmission] Submitting approval via passkey", {
    gardenAddress,
    chainId,
  });

  assertSmartAccount(client);

  // TypeScript doesn't understand that client is now guaranteed to be non-null after assertion
  const smartClient = client as SmartAccountClient;

  const easConfig = getEASConfig(chainId);
  const attestationData = encodeWorkApprovalData(draft, chainId);

  const txParams = buildApprovalAttestTx(
    easConfig,
    gardenAddress as `0x${string}`,
    attestationData
  );

  const hash = await smartClient.sendTransaction({
    account: smartClient.account!,
    chain: smartClient.chain,
    ...txParams,
  });

  debugLog("[PasskeySubmission] Passkey approval submission sent", { hash });

  return hash;
}
