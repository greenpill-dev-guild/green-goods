import { getEASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import {
  buildApprovalAttestContractCall,
  buildWorkAttestContractCall,
} from "../../utils/eas/transaction-builder";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import type { TransactionSender } from "../transactions/types";
import { jobQueueDB } from "./db";
import { readContract } from "@wagmi/core";
import type { Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import {
  executeCommitmentJob,
  type CommitmentCreationPayload,
  type CommitmentJob,
  type CommitmentJobKind,
  type CommitmentJobPayloadMap,
  type CommitmentSeriesJobPayload,
} from "../commitment-pooling/jobs";
import type { Address } from "../../types/domain";
import {
  CommitmentPoolingModuleABI,
  GardenAccountABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS } from "../../utils/blockchain/garden-roles";
import { logger } from "../app/logger";

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
  const actionTitle = resolveWorkSubmissionTitle({
    draftTitle: payload.title,
    actionUID: payload.actionUID,
  });

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
      title: actionTitle,
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

export type CommitmentQueueExecution =
  | { status: "complete"; txHash?: Hex; entityId?: bigint }
  | { status: "submitted"; txHash: Hex }
  | { status: "waiting"; reason: string }
  | { status: "identity-conflict"; reason: string };

function contractPayload(payload: CommitmentCreationPayload) {
  return {
    poolId: payload.poolId,
    cycleId: payload.cycleId,
    creationRequestKey: payload.creationRequestKey,
    commitmentSeriesId: payload.commitmentSeriesId,
    direction: payload.direction,
    commitmentType: payload.commitmentType,
    claimType: payload.claimType,
    claimMode: payload.claimMode,
    contributorPolicy: payload.contributorPolicy,
    onBehalfOf: payload.onBehalfOf,
    domainTags: payload.domainTags,
    requirements: payload.requirements,
    unitLabel: payload.unitLabel,
    targetUnits: payload.targetUnits,
    requiresAssessment: payload.requiresAssessment,
    dueDate: payload.dueDate,
    metadataCID: payload.metadataCID,
    needUID: payload.needUID,
    counterCommitmentId: payload.counterCommitmentId,
    confirmers: payload.confirmers,
    confirmationThreshold: payload.confirmationThreshold,
    protocolFallbackEnabled: payload.protocolFallbackEnabled,
    consideration: payload.consideration,
    declaredUnitValue: payload.declaredUnitValue,
    declaredValueBasis: payload.declaredValueBasis,
  };
}

function contractCallFor(
  kind: CommitmentJobKind,
  payload: CommitmentJobPayloadMap[CommitmentJobKind]
) {
  switch (kind) {
    case "commitmentSeries": {
      const value = payload as CommitmentJobPayloadMap["commitmentSeries"];
      return {
        functionName: "createCommitmentSeries",
        args: [value.poolId, value.creationRequestKey, value.metadataCID] as const,
      };
    }
    case "commitment":
      return {
        functionName: "createCommitment",
        args: [contractPayload(payload as CommitmentCreationPayload)] as const,
      };
    case "claim": {
      const value = payload as CommitmentJobPayloadMap["claim"];
      return {
        functionName: "claimCommitment",
        args: [value.commitmentId, value.kind, value.gardenContext] as const,
      };
    }
    case "evidence": {
      const value = payload as CommitmentJobPayloadMap["evidence"];
      return {
        functionName: "attachEvidence",
        args: [value.commitmentId, value.cid, value.creditedContributors] as const,
      };
    }
    case "workLink": {
      const value = payload as CommitmentJobPayloadMap["workLink"];
      return {
        functionName: "linkWork",
        args: [
          value.commitmentId,
          value.workUID,
          value.requirementIndex,
          value.operationKey,
        ] as const,
      };
    }
    case "confirmation": {
      const value = payload as CommitmentJobPayloadMap["confirmation"];
      return {
        functionName: value.action === "submit" ? "submitForConfirmation" : "confirmFulfillment",
        args: [value.commitmentId] as const,
      };
    }
  }
}

async function currentGardenMember(
  garden: Address,
  account: Address,
  chainId: number
): Promise<boolean> {
  const results = await Promise.all(
    Object.values(GARDEN_ROLE_FUNCTIONS).map(async (functionName) => {
      try {
        return Boolean(
          await readContract(getWagmiConfig(), {
            address: garden,
            abi: GardenAccountABI,
            functionName,
            args: [account],
            chainId,
          })
        );
      } catch (error) {
        logger.warn("Garden membership probe failed closed", {
          chainId,
          functionName,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return false;
      }
    })
  );
  return results.some(Boolean);
}

/** As many tries as any other job gets, so a dead gateway cannot queue forever. */
const MAX_METADATA_ATTEMPTS = 5;

/**
 * Publish a commitment's words, if it was composed before they could be.
 *
 * Composing works offline, so the member's title travels in the job rather than
 * as a CID. It has to become one before anything else touches this payload: the
 * creation hash covers the CID, and the recovery check compares that hash
 * against what the contract stored, so publishing later would make a successful
 * commitment look like a mismatch.
 *
 * The CID is written back to the stored job the moment it exists. Without that
 * the mutation lives only in memory, and `markJobFailed` re-reads the job from
 * storage — so a broadcast followed by any throw would lose the CID, the next
 * attempt would publish again, and the whole thing would rest on two uploads
 * returning byte-identical CIDs. They should, but a commitment that can never
 * be retried is too much to stake on "should".
 *
 * A failed upload is reported as waiting rather than thrown. Throwing here runs
 * `markJobFailed`, which spends one of five attempts on an outage that has
 * nothing to do with this commitment, and does it before the recovery read that
 * would have noticed the commitment already exists.
 *
 * Waiting forever is its own failure, though. The other waiting reasons resolve
 * inside the queue; this one depends on a service that may never come back, so
 * the attempts are counted separately and the job is allowed to fail once it
 * has tried as many times as any other. Silence in both directions was the
 * thing to avoid: dying invisibly after five attempts, and never dying at all.
 */
async function publishPendingCommitmentMetadata(
  job: Job
): Promise<{ published: true } | { published: false; reason: string; terminal?: boolean }> {
  if (job.kind !== "commitment") return { published: true };
  const payload = job.payload as CommitmentCreationPayload;
  if (!payload.metadata || payload.metadataCID) return { published: true };

  try {
    const { uploadJSONToIPFS } = await import("../data/ipfs/upload");
    const { cid } = await uploadJSONToIPFS(payload.metadata as unknown as Record<string, unknown>, {
      source: "commitment-creation",
      gardenAddress: payload.gardenAddress,
      metadataType: "commitment",
    });
    payload.metadataCID = cid;
    await jobQueueDB.updateJob({ ...job, payload });
    return { published: true };
  } catch (error) {
    const attempts = Number(job.meta?.metadataAttempts ?? 0) + 1;
    await jobQueueDB.updateJob({
      ...job,
      meta: { ...(job.meta ?? {}), metadataAttempts: attempts },
    });
    logger.warn("[JobQueue] Commitment metadata upload failed", {
      jobId: job.id,
      attempts,
      error: error instanceof Error ? error.message : String(error),
    });
    if (attempts >= MAX_METADATA_ATTEMPTS) {
      return { published: false, reason: "metadata-unavailable", terminal: true };
    }
    return { published: false, reason: "metadata-unpublished" };
  }
}

export async function executeCommitmentQueueJob(
  jobId: string,
  job: Job,
  chainId: number,
  sender: TransactionSender
): Promise<CommitmentQueueExecution> {
  const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
  const published = await publishPendingCommitmentMetadata(job);
  if (!published.published) {
    return published.terminal
      ? { status: "identity-conflict", reason: published.reason }
      : { status: "waiting", reason: published.reason };
  }
  const commitmentJob: CommitmentJob = {
    id: jobId,
    kind: job.kind as CommitmentJobKind,
    payload: job.payload as CommitmentJobPayloadMap[CommitmentJobKind],
    chainId,
    moduleAddress,
    userAddress: job.userAddress,
    ...(typeof job.meta?.submittedTxHash === "string"
      ? { submittedTxHash: job.meta.submittedTxHash as Hex }
      : {}),
  };

  const result = await executeCommitmentJob(commitmentJob, {
    readSeriesId: async (holder, key) =>
      (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentSeriesIdByCreationRequest",
        args: [holder, key],
        chainId,
      })) as bigint,
    readSeries: async (seriesId) => {
      const value = (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentSeries",
        args: [seriesId],
        chainId,
      })) as {
        poolId: bigint;
        createdBy: Address;
        metadataCID: string;
        creationPayloadHash: Hex;
      };
      return value;
    },
    readPoolGarden: async (poolId) => {
      const value = (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getPool",
        args: [poolId],
        chainId,
      })) as { garden: Address };
      return value.garden;
    },
    readCommitmentId: async (creator, key) =>
      (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentIdByCreationRequest",
        args: [creator, key],
        chainId,
      })) as bigint,
    readCommitment: async (commitmentId) => {
      const value = (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitment",
        args: [commitmentId],
        chainId,
      })) as { creationPayloadHash: Hex; poolId: bigint; creator: Address };
      return value;
    },
    readWorkLinkPayloadHash: async (caller, key) =>
      (await readContract(getWagmiConfig(), {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getWorkLinkOperationPayloadHash",
        args: [caller, key],
        chainId,
      })) as Hex,
    resolveSeriesId: (clientSeriesId) => jobQueueDB.getSeriesIdByClientId(clientSeriesId),
    hasMembership: (garden, account) => currentGardenMember(garden, account, chainId),
    send: async ({ kind, payload, moduleAddress: target, chainId: targetChain }) => {
      const call = contractCallFor(kind, payload);
      const sent = await sender.sendContractCall({
        address: target,
        abi: CommitmentPoolingModuleABI,
        functionName: call.functionName,
        args: call.args,
        chainId: targetChain,
      });
      return sent.hash;
    },
  });

  if (result.status === "recovered") {
    if (result.entityId !== undefined && job.kind === "commitmentSeries") {
      await jobQueueDB.storeClientSeriesIdMapping(
        (job.payload as CommitmentSeriesJobPayload).clientSeriesId,
        result.entityId,
        jobId,
        chainId
      );
    }
    if (result.entityId !== undefined && job.kind === "commitment") {
      await jobQueueDB.storeClientCommitmentIdMapping(
        (job.payload as CommitmentCreationPayload).clientCommitmentId,
        result.entityId,
        jobId,
        chainId
      );
    }
    return { status: "complete", entityId: result.entityId };
  }
  return result.status === "sent"
    ? job.kind === "commitmentSeries" || job.kind === "commitment"
      ? { status: "submitted", txHash: result.txHash }
      : { status: "complete", txHash: result.txHash }
    : result;
}
