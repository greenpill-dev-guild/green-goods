import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import {
  buildApprovalAttestContractCall,
  buildWorkAttestContractCall,
} from "../../utils/eas/transaction-builder";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import type { TransactionSender } from "../transactions/types";
import { jobQueueDB } from "./db";
import { type Hex } from "viem";
import {
  executeCommitmentJob,
  toCommitmentJob,
  type CommitmentCreationPayload,
  type CommitmentSeriesJobPayload,
  type WorkLinkJobPayload,
} from "../commitment-pooling/jobs";
import {
  resolveDeferredWorkIdentity,
  type DeferredWorkIdentityResolution,
} from "../commitment-pooling/work-identity";
import { isDemoPoolingActive } from "../commitment-pooling/demo/demo-mode";
import { publishPendingEvidence } from "./evidence-publisher";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { logger } from "../app/logger";
import { createCommitmentChainReads, type CommitmentChainReads } from "./commitment-chain-reads";
import { buildCommitmentContractCall } from "./commitment-call-builder";

type EncodeWork = typeof import("../../utils/eas/encoders").encodeWorkData;
type EncodeApproval = typeof import("../../utils/eas/encoders").encodeWorkApprovalData;
type SimulateWork = typeof import("../work/simulate").simulateWorkSubmission;
type UploadJson = typeof import("../data/ipfs/upload").uploadJSONToIPFS;

export interface WorkJobExecutorDeps {
  images?: (jobId: string) => ReturnType<typeof jobQueueDB.getImagesForJob>;
  simulate?: SimulateWork;
  encodeWork?: EncodeWork;
  easConfig?: EASConfig;
}

export interface ApprovalJobExecutorDeps {
  encodeApproval?: EncodeApproval;
  easConfig?: EASConfig;
}

export type CommitmentExecutorStore = Pick<
  typeof jobQueueDB,
  | "updateJob"
  | "getSeriesIdByClientId"
  | "storeClientSeriesIdMapping"
  | "storeClientCommitmentIdMapping"
  | "getJob"
>;

export interface CommitmentQueueExecutorDeps {
  reads?: CommitmentChainReads;
  store?: CommitmentExecutorStore;
  uploadJson?: UploadJson;
  publishEvidence?: typeof publishPendingEvidence;
  demoActive?: () => boolean;
  resolveWorkIdentity?: (input: {
    clientWorkId: string;
    chainId: number;
    garden: `0x${string}`;
    caller: `0x${string}`;
  }) => Promise<DeferredWorkIdentityResolution>;
}

/**
 * Execute a work attestation job: simulate, encode (includes IPFS upload), and send.
 */
export async function executeWorkJob(
  jobId: string,
  job: Job<WorkJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: WorkJobExecutorDeps = {}
): Promise<string> {
  const getImages = deps.images ?? ((id: string) => jobQueueDB.getImagesForJob(id));
  const images = await getImages(jobId);
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
  const simulate = deps.simulate ?? (await import("../work/simulate")).simulateWorkSubmission;
  await simulate({
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
  const encodeWork = deps.encodeWork ?? (await import("../../utils/eas/encoders")).encodeWorkData;
  const attestationData = await encodeWork(
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
      clientWorkId: payload.clientWorkId,
      gardenAddress: payload.gardenAddress,
      authMode: sender.authMode === "embedded" ? "passkey" : sender.authMode,
    }
  );

  // Build and send attestation via TransactionSender
  const easConfig = deps.easConfig ?? getEASConfig(chainId);
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

export type CommitmentQueueExecution =
  | { status: "complete"; txHash?: Hex; entityId?: bigint }
  | { status: "submitted"; txHash: Hex }
  | { status: "waiting"; reason: string }
  | { status: "identity-conflict"; reason: string }
  /** Gave up on something outside the queue. Terminal, but not a data conflict. */
  | { status: "unavailable"; reason: string };

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
  job: Job,
  store: CommitmentExecutorStore,
  uploadJson?: UploadJson
): Promise<{ published: true } | { published: false; reason: string; terminal?: boolean }> {
  if (job.kind !== "commitment") return { published: true };
  const payload = job.payload as CommitmentCreationPayload;
  if (!payload.metadata || payload.metadataCID) return { published: true };

  try {
    const upload = uploadJson ?? (await import("../data/ipfs/upload")).uploadJSONToIPFS;
    const { cid } = await upload(payload.metadata as unknown as Record<string, unknown>, {
      source: "commitment-creation",
      gardenAddress: payload.gardenAddress,
      metadataType: "commitment",
    });
    payload.metadataCID = cid;
    await store.updateJob({ ...job, payload });
    return { published: true };
  } catch (error) {
    const attempts = Number(job.meta?.metadataAttempts ?? 0) + 1;
    // Mutated, not replaced. The caller writes the job again on the waiting
    // path, spreading the meta it still holds — so a count written only to
    // storage is erased on the same attempt and the ceiling never arrives.
    // The success path above mutates `payload` for exactly this reason.
    job.meta = { ...(job.meta ?? {}), metadataAttempts: attempts };
    await store.updateJob({ ...job });
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
  sender: TransactionSender,
  deps: CommitmentQueueExecutorDeps = {}
): Promise<CommitmentQueueExecution> {
  // Demo mode answers reads from fixtures, but the sender is real: dev mock
  // auth reports `wallet`, so a connected wallet would sign a call built from
  // fixture ids against the deployed module. The act waits instead, which is
  // also the state the demo walk wants to show.
  if ((deps.demoActive ?? isDemoPoolingActive)()) {
    return { status: "waiting", reason: "demo-mode" };
  }
  const store = deps.store ?? jobQueueDB;
  const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
  const publishEvidence = deps.publishEvidence ?? publishPendingEvidence;
  const published =
    job.kind === "evidence"
      ? await publishEvidence(jobId, job)
      : await publishPendingCommitmentMetadata(job, store, deps.uploadJson);
  if (!published.published) {
    // Not an identity conflict: nothing about this commitment disagrees with
    // the chain, a gateway was simply unreachable. Reporting it as one puts a
    // data-integrity signal in the member's job record and makes real conflicts
    // indistinguishable in the metrics.
    return published.terminal
      ? { status: "unavailable", reason: published.reason }
      : { status: "waiting", reason: published.reason };
  }
  let executionJob = job;
  if (job.kind === "workLink") {
    const payload = job.payload as WorkLinkJobPayload;
    if (typeof payload.clientWorkId === "string" && !payload.resolvedWorkUID) {
      if (payload.sourceWorkJobId) {
        const source = await store.getJob(payload.sourceWorkJobId);
        if (source && !source.synced && source.attempts >= 5) {
          return { status: "identity-conflict", reason: "source-work-terminal" };
        }
      }
      const resolution = await (deps.resolveWorkIdentity ?? resolveDeferredWorkIdentity)({
        clientWorkId: payload.clientWorkId,
        chainId,
        garden: payload.gardenAddress as `0x${string}`,
        caller: job.userAddress as `0x${string}`,
      });
      if (resolution.status === "waiting") {
        return { status: "waiting", reason: "work-not-indexed" };
      }
      if (resolution.status === "retryable") {
        throw new Error(resolution.reason);
      }
      if (resolution.status === "conflict") {
        return { status: "identity-conflict", reason: resolution.reason };
      }
      // Keep the persisted payload canonical. Resolution is deterministic from
      // clientWorkId and is repeated on retry instead of adding a mutable cache
      // field that would make a legitimate re-enqueue look like a conflict.
      executionJob = {
        ...job,
        payload: { ...payload, resolvedWorkUID: resolution.workUID },
      };
    }
  }
  const commitmentJob = toCommitmentJob({ ...executionJob, id: jobId }, chainId, moduleAddress);

  const chainReads = deps.reads ?? createCommitmentChainReads({ chainId, moduleAddress });
  const result = await executeCommitmentJob(commitmentJob, {
    ...chainReads,
    resolveSeriesId: (clientSeriesId) => store.getSeriesIdByClientId(clientSeriesId),
    send: async ({ kind, payload, moduleAddress: target, chainId: targetChain }) => {
      const call = buildCommitmentContractCall(kind, payload);
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
      await store.storeClientSeriesIdMapping(
        (job.payload as CommitmentSeriesJobPayload).clientSeriesId,
        result.entityId,
        jobId,
        chainId
      );
    }
    if (result.entityId !== undefined && job.kind === "commitment") {
      await store.storeClientCommitmentIdMapping(
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
