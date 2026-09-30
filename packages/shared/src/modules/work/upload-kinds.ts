/**
 * What each kind of queued job brings to Upload all
 *
 * Preparation and Upload all know nothing about work or decisions. A kind says
 * how it is checked and staged before a send (`prepare`) and which attestation
 * it becomes (`attestation`). Claims, the one call, the send record and its
 * confirmation are shared by every kind.
 *
 * Adding a kind that becomes an EAS attestation:
 *   1. name it in UPLOAD_JOB_KINDS (upload-state.ts), so the dashboard and the
 *      confirmation pass count it;
 *   2. say where it keeps its send record (SEND_RECORDS, job-queue/queue-policy.ts);
 *   3. add its entry to UPLOAD_KINDS below;
 *   4. send it from its executor through send-with-checkpoint.ts, and give it a
 *      lookup for a send whose answer was lost (stranded-intent.ts).
 *
 * A kind that sends some other contract call, such as a commitment act, cannot
 * ride in EAS.multiAttest. One signature for it needs TransactionSender.sendBatch
 * to carry several calls atomically, and no sender does that yet.
 *
 * @module modules/work/upload-kinds
 */

import type { Hex } from "viem";
import { type EASConfig, getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/work-media";
import type { QueuedAttestation } from "../../utils/eas/transaction-builder";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import { jobQueueDB } from "../job-queue/db";
import { convertQueuedHeicMedia } from "../job-queue/job-media-conversion";
import type { saveUnderClaim, WorkClaim } from "../job-queue/work-claims";
import type { TransactionSender } from "../transactions/types";
import {
  buildQueuedApprovalDraft,
  buildQueuedWorkDraft,
  resolveQueuedWorkTitle,
} from "./queued-work-draft";
import type { UploadPreparation } from "./upload-state";

// The simulation and the encoders load on first use: the offline shell must not carry them.
type Simulation = typeof import("./simulate");
type Encoders = typeof import("../../utils/eas/encoders");

export interface UploadKindDependencies {
  convertMedia: typeof convertQueuedHeicMedia;
  images: (jobId: string) => Promise<Array<{ file: File }>>;
  resolveTitle: typeof resolveQueuedWorkTitle;
  simulateWork: Simulation["simulateWorkSubmission"];
  simulateApproval: Simulation["simulateApprovalSubmission"];
  encodeWork: Encoders["encodeWorkData"];
  encodeApproval: Encoders["encodeWorkApprovalData"];
  easConfig: (chainId: number) => EASConfig;
}

export interface UploadKindContext {
  chainId: number;
  claim: Pick<WorkClaim, "token">;
  /** Every write goes through the claim, so a holder that lost it changes nothing. */
  save: typeof saveUnderClaim;
  /** Who will sign, when an upload still has to run at send time. */
  authMode?: TransactionSender["authMode"];
  dependencies?: Partial<UploadKindDependencies>;
}

/** What preparation found, short of the chain refusing the job, which is thrown. */
export type PreparedAs = Exclude<UploadPreparation["status"], "blocked">;

export interface UploadKind<Payload> {
  /** Check the job and stage what its send needs. Nothing is signed or sent. */
  prepare(job: Job<Payload>, context: UploadKindContext): Promise<PreparedAs>;
  /** The attestation the job becomes, read back from what preparation saved. */
  attestation(job: Job<Payload>, context: UploadKindContext): Promise<QueuedAttestation>;
}

/**
 * Upload progress from this run, laid over what storage holds. Only uploads
 * are taken from memory: a send the store recorded is never overwritten.
 */
export function mergeUploadProgress(
  stored: WorkUploadCheckpoint | undefined,
  progress: WorkUploadCheckpoint
): WorkUploadCheckpoint {
  return {
    ...(stored ?? { submittedAt: progress.submittedAt }),
    files: { ...stored?.files, ...progress.files },
    ...(progress.metadata ? { metadata: progress.metadata } : {}),
  };
}

const loadEncoders = () => import("../../utils/eas/encoders");
const loadSimulation = () => import("./simulate");

/** Encode a work from its stored photos, saving each upload under the claim as it lands. */
async function encodeQueuedWork(
  job: Job<WorkJobPayload>,
  title: string,
  { chainId, claim, save, authMode, dependencies = {} }: UploadKindContext
): Promise<Hex> {
  const { payload } = job;
  const images = await (dependencies.images ?? ((id) => jobQueueDB.getImagesForJob(id)))(job.id);
  const draft = buildQueuedWorkDraft(
    payload,
    images.map((image) => image.file),
    title
  );
  const encodeWork = dependencies.encodeWork ?? (await loadEncoders()).encodeWorkData;
  return encodeWork(draft, chainId, {
    clientWorkId: payload.clientWorkId,
    checkpoint: payload.uploadCheckpoint,
    onCheckpoint: async (progress) => {
      await save(claim, job.id, (stored) => {
        const storedPayload = stored.payload as WorkJobPayload;
        storedPayload.uploadCheckpoint = mergeUploadProgress(
          storedPayload.uploadCheckpoint,
          progress
        );
      });
      payload.uploadCheckpoint = mergeUploadProgress(payload.uploadCheckpoint, progress);
    },
    gardenAddress: payload.gardenAddress,
    ...(authMode ? { authMode } : {}),
  });
}

const work: UploadKind<WorkJobPayload> = {
  async prepare(job, context) {
    const { chainId, claim, save, dependencies = {} } = context;
    const conversion = await (dependencies.convertMedia ?? convertQueuedHeicMedia)(job);
    if (conversion.status !== "ready")
      return conversion.status === "pending" ? "photo-pending" : "photo-needs-attention";

    const images = await (dependencies.images ?? ((id) => jobQueueDB.getImagesForJob(id)))(job.id);
    const actionTitle = await (dependencies.resolveTitle ?? resolveQueuedWorkTitle)(job, chainId, {
      persist: (titled) =>
        save(claim, titled.id, (stored) => {
          (stored.payload as WorkJobPayload).title = titled.payload.title;
        }),
    });
    const draft = buildQueuedWorkDraft(
      job.payload,
      images.map((image) => image.file),
      actionTitle
    );
    const simulateWork =
      dependencies.simulateWork ?? (await loadSimulation()).simulateWorkSubmission;
    await simulateWork({
      draft,
      gardenAddress: job.payload.gardenAddress,
      actionUID: job.payload.actionUID,
      actionTitle,
      chainId,
      images: draft.media,
      accountAddress: job.userAddress as Address,
    });
    // The photos and metadata upload now, so Upload all only has to sign.
    await encodeQueuedWork(job, actionTitle, context);
    return "ready";
  },

  async attestation(job, context) {
    const { payload } = job;
    // The title preparation resolved. Its saved uploads are read back, not uploaded again.
    const title = resolveWorkSubmissionTitle({
      draftTitle: payload.title,
      actionUID: payload.actionUID,
    });
    const easConfig = (context.dependencies?.easConfig ?? getEASConfig)(context.chainId);
    return {
      schema: easConfig.WORK.uid as Hex,
      gardenAddress: payload.gardenAddress as Hex,
      attestationData: await encodeQueuedWork(job, title, context),
    };
  },
};

const approval: UploadKind<ApprovalJobPayload> = {
  async prepare(job, { chainId, dependencies = {} }) {
    const simulateApproval =
      dependencies.simulateApproval ?? (await loadSimulation()).simulateApprovalSubmission;
    await simulateApproval({
      draft: buildQueuedApprovalDraft(job.payload),
      gardenAddress: job.payload.gardenAddress,
      chainId,
      accountAddress: job.userAddress as Address,
    });
    return "ready";
  },

  async attestation(job, { chainId, dependencies = {} }) {
    const encodeApproval =
      dependencies.encodeApproval ?? (await loadEncoders()).encodeWorkApprovalData;
    const easConfig = (dependencies.easConfig ?? getEASConfig)(chainId);
    return {
      schema: easConfig.WORK_APPROVAL.uid as Hex,
      gardenAddress: job.payload.gardenAddress as Hex,
      attestationData: encodeApproval(buildQueuedApprovalDraft(job.payload), chainId),
    };
  },
};

export const UPLOAD_KINDS: Readonly<Record<string, UploadKind<never>>> = { work, approval };

/** The kind a job uploads as, when Upload all carries it. */
export function uploadKindOf(job: Pick<Job, "kind">): UploadKind<unknown> | undefined {
  return UPLOAD_KINDS[job.kind] as UploadKind<unknown> | undefined;
}
