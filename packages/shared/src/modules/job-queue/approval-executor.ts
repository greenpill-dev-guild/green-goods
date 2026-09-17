import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job } from "../../types/job-queue";
import { buildApprovalAttestContractCall } from "../../utils/eas/transaction-builder";
import type { TransactionSender } from "../transactions/types";

type EncodeApproval = typeof import("../../utils/eas/encoders").encodeWorkApprovalData;

export interface ApprovalJobExecutorDeps {
  encodeApproval?: EncodeApproval;
  easConfig?: EASConfig;
}

/**
 * Execute an approval attestation job: encode and send (no IPFS needed).
 */
export async function executeApprovalJob(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: ApprovalJobExecutorDeps = {}
): Promise<string> {
  const payload = job.payload as ApprovalJobPayload;

  // Encode approval attestation data (no IPFS upload needed)
  const encodeApproval =
    deps.encodeApproval ?? (await import("../../utils/eas/encoders")).encodeWorkApprovalData;
  const attestationData = encodeApproval(
    {
      actionUID: payload.actionUID,
      workUID: payload.workUID,
      approved: payload.approved,
      feedback: payload.feedback,
      confidence: payload.confidence,
      verificationMethod: payload.verificationMethod,
      reviewNotesCID: payload.reviewNotesCID,
    },
    chainId
  );

  // Build and send attestation via TransactionSender
  const easConfig = deps.easConfig ?? getEASConfig(chainId);
  const contractCall = buildApprovalAttestContractCall(
    easConfig,
    payload.gardenAddress as `0x${string}`,
    attestationData
  );
  const result = await sender.sendContractCall(contractCall);
  return result.hash;
}
