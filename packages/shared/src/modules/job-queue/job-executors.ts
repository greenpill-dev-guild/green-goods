import { getEASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import {
  buildApprovalAttestContractCall,
  buildWorkAttestContractCall,
} from "../../utils/eas/transaction-builder";
import type { TransactionSender } from "../transactions/types";
import { jobQueueDB } from "./db";

/**
 * Execute a work attestation job: simulate, encode (includes IPFS upload), and send.
 */
export async function executeWorkJob(
  jobId: string,
  job: Job<WorkJobPayload>,
  chainId: number,
  sender: TransactionSender
): Promise<string> {
  const images = await jobQueueDB.getImagesForJob(jobId);
  const allFiles = images.map((img) => img.file);
  const payload = job.payload as WorkJobPayload;
  const actionTitle = payload.title || `Action ${payload.actionUID}`;

  // Separate audio from visual media by MIME type
  const audioFiles = allFiles.filter((f) => f.type.startsWith("audio/"));
  const mediaFiles = allFiles.filter((f) => !f.type.startsWith("audio/"));

  const accountAddress = job.userAddress as `0x${string}`;

  // Simulate before uploading to IPFS
  const { simulateWorkSubmission } = await import("../work/simulate");
  await simulateWorkSubmission({
    draft: {
      actionUID: payload.actionUID,
      title: actionTitle,
      feedback: payload.feedback,
      media: mediaFiles,
      details: payload.details ?? {},
      timeSpentMinutes: payload.timeSpentMinutes ?? 0,
      ...(payload.tags ? { tags: payload.tags } : {}),
      ...(audioFiles.length > 0 ? { audioNotes: audioFiles } : {}),
    },
    gardenAddress: payload.gardenAddress,
    actionUID: payload.actionUID,
    actionTitle,
    chainId,
    images: mediaFiles,
    accountAddress,
  });

  // Encode attestation data (includes IPFS upload)
  const { encodeWorkData } = await import("../../utils/eas/encoders");
  const attestationData = await encodeWorkData(
    {
      actionUID: payload.actionUID,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      feedback: payload.feedback,
      media: mediaFiles,
      details: payload.details ?? {},
      timeSpentMinutes: payload.timeSpentMinutes ?? 0,
      ...(payload.tags ? { tags: payload.tags } : {}),
      ...(audioFiles.length > 0 ? { audioNotes: audioFiles } : {}),
    },
    chainId,
    {
      gardenAddress: payload.gardenAddress,
      authMode: sender.authMode === "embedded" ? "passkey" : sender.authMode,
    }
  );

  // Build and send attestation via TransactionSender
  const easConfig = getEASConfig(chainId);
  const contractCall = buildWorkAttestContractCall(
    easConfig,
    payload.gardenAddress as `0x${string}`,
    attestationData
  );
  const result = await sender.sendContractCall(contractCall);
  return result.hash;
}

/**
 * Execute an approval attestation job: encode and send (no IPFS needed).
 */
export async function executeApprovalJob(
  job: Job<ApprovalJobPayload>,
  chainId: number,
  sender: TransactionSender
): Promise<string> {
  const payload = job.payload as ApprovalJobPayload;

  // Encode approval attestation data (no IPFS upload needed)
  const { encodeWorkApprovalData } = await import("../../utils/eas/encoders");
  const attestationData = encodeWorkApprovalData(
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
  const easConfig = getEASConfig(chainId);
  const contractCall = buildApprovalAttestContractCall(
    easConfig,
    payload.gardenAddress as `0x${string}`,
    attestationData
  );
  const result = await sender.sendContractCall(contractCall);
  return result.hash;
}
