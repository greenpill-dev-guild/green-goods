import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { getPublicClient } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";

import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import { debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData, simulateWorkData } from "../../utils/eas/encoders";
import {
  buildApprovalAttestTx,
  buildBatchApprovalAttestTx,
  buildWorkAttestTx,
} from "../../utils/eas/transaction-builder";
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
    chainId,
    {
      gardenAddress,
      authMode: "passkey",
    }
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

export interface PasskeyBatchApprovalParams {
  client: SmartAccountClient | null;
  approvals: Array<{
    draft: WorkApprovalDraft;
    gardenAddress: string;
  }>;
  chainId: number;
  /** Optional AbortSignal for cancellation support */
  signal?: AbortSignal;
}

/**
 * Submit multiple work approvals in a single transaction using EAS multiAttest.
 * This dramatically improves UX when operators need to approve/reject multiple works.
 *
 * @param params - Batch approval parameters
 * @returns Transaction hash
 * @throws Error if approvals array is empty
 */
export async function submitBatchApprovalsWithPasskey({
  client,
  approvals,
  chainId,
  signal,
}: PasskeyBatchApprovalParams): Promise<`0x${string}`> {
  // Check for abort before starting
  if (signal?.aborted) {
    throw new DOMException("Batch approval aborted", "AbortError");
  }

  // Guard against empty approvals array
  if (approvals.length === 0) {
    debugLog("[PasskeySubmission] Empty approvals array - rejecting");
    throw new Error("No approvals provided. At least one approval is required.");
  }

  debugLog("[PasskeySubmission] Submitting batch approvals via passkey", {
    count: approvals.length,
    chainId,
  });

  assertSmartAccount(client);

  const smartClient = client as SmartAccountClient;
  const easConfig = getEASConfig(chainId);

  // Check abort again before encoding (could be expensive for large batches)
  if (signal?.aborted) {
    throw new DOMException("Batch approval aborted", "AbortError");
  }

  // Encode all approvals
  const encodedApprovals = approvals.map(({ draft, gardenAddress }) => ({
    gardenAddress: gardenAddress as `0x${string}`,
    attestationData: encodeWorkApprovalData(draft, chainId),
  }));

  // Build batch transaction
  const txParams = buildBatchApprovalAttestTx(easConfig, encodedApprovals);

  // Check abort before sending transaction
  if (signal?.aborted) {
    throw new DOMException("Batch approval aborted", "AbortError");
  }

  const hash = await smartClient.sendTransaction({
    account: smartClient.account!,
    chain: smartClient.chain,
    ...txParams,
  });

  debugLog("[PasskeySubmission] Passkey batch approval sent", {
    hash,
    count: approvals.length,
  });

  return hash;
}
