import type { SmartAccountClient } from "permissionless";
import { getEASConfig } from "../../config/blockchain";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData } from "../../utils/eas/encoders";
import {
  buildApprovalAttestTx,
  buildBatchApprovalAttestTx,
  buildWorkAttestTx,
} from "../../utils/eas/transaction-builder";
import { simulateWorkSubmission } from "./simulate";

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
  const smartAccount = smartClient.account;
  if (!smartAccount) {
    throw new Error("Passkey session is not ready. Please re-authenticate and try again.");
  }

  const easConfig = getEASConfig(chainId);

  try {
    debugLog("[PasskeySubmission] Simulating transaction before upload...");
    await simulateWorkSubmission({
      draft,
      gardenAddress,
      actionUID,
      actionTitle,
      chainId,
      images,
      accountAddress: smartAccount.address as `0x${string}`,
    });
    debugLog("[PasskeySubmission] Simulation successful - proceeding to upload");
  } catch (error) {
    debugError("[PasskeySubmission] Simulation failed", error);
    throw error;
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
    account: smartAccount,
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

  try {
    debugLog("[PasskeySubmission] Simulating approval before submission...");
    await simulateApprovalSubmission({
      draft,
      gardenAddress: gardenAddress as `0x${string}`,
      chainId,
      accountAddress: smartClient.account!.address as `0x${string}`,
    });
    debugLog("[PasskeySubmission] Approval simulation successful");
  } catch (error) {
    debugError("[PasskeySubmission] Approval simulation failed", error);
    throw error;
  }

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
