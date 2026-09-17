/**
 * Upload all: send every prepared work and decision in one call
 *
 * The person's tap confirms the connection and holds background preparation
 * back. Ready items are claimed, encoded from what preparation saved, and
 * sent as one EAS call per chunk, so a passkey signs one UserOperation and a
 * wallet approves one transaction. The send is recorded on every item before
 * it can reach the network: a lost answer is confirmed later, never sent twice.
 * A call the chain would refuse is split to find the items it refuses; those
 * are flagged and the rest stay ready.
 *
 * @module modules/work/upload-queued-work
 */

import type { Hex } from "viem";
import type { EASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type {
  ApprovalJobPayload,
  Job,
  SendCheckpoint,
  WorkJobPayload,
} from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/work-media";
import {
  buildQueuedAttestationsCall,
  type QueuedAttestation,
} from "../../utils/eas/transaction-builder";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import { logger } from "../app/logger";
import type { ProcessJobContext, ProcessJobResult } from "../job-queue/ports";
import { sendCheckpointOf } from "../job-queue/queue-policy";
import type { saveUnderClaim, WorkClaim } from "../job-queue/work-claims";
import {
  type ContractCall,
  TransactionRevertedError,
  type TransactionSender,
} from "../transactions/types";
import { mergeUploadProgress } from "./prepare-queued-work";
import { buildQueuedApprovalDraft, buildQueuedWorkDraft } from "./queued-work-draft";
import { classifySendFailure } from "./send-outcome";
import { SimulationRejected } from "./simulation-rejected";
import { isUploadJob, queuedUploadStatus } from "./upload-state";
import { forgetWorkBroadcast, rememberWorkBroadcast } from "./work-confirmation";

/** Items per call, until scripts/simulate-upload-all.ts settles the limits. */
const MAX_ITEMS_PER_USER_OPERATION = 5;
const MAX_ITEMS_PER_WALLET_CALL = 10;

type Encoders = typeof import("../../utils/eas/encoders");

export type UploadOutcome =
  | { status: "connection-unconfirmed" }
  | { status: "nothing-ready" }
  /** Sent; items whose receipt has not arrived are confirmed by the queue. */
  | { status: "uploaded"; sent: number; flagged: number }
  | { status: "declined" | "reverted" | "send-unconfirmed"; sent: number; flagged: number }
  | { status: "failed"; sent: number; flagged: number; error: unknown };

export interface UploadQueuedWorkPorts {
  confirmOnline(): Promise<boolean>;
  suspendPreparation(): () => void;
  listJobs(userAddress: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  acquire(ids: string[]): Promise<Map<string, WorkClaim>>;
  hold(claims: WorkClaim[]): () => void;
  save: typeof saveUnderClaim;
  images(jobId: string): Promise<Array<{ file: File }>>;
  encodeWork: Encoders["encodeWorkData"];
  encodeApproval: Encoders["encodeWorkApprovalData"];
  easConfig(chainId: number): EASConfig;
  simulate(call: ContractCall, chainId: number, account: Address): Promise<void>;
  processJob(jobId: string, context: ProcessJobContext): Promise<ProcessJobResult>;
  now(): number;
}

interface ChunkItem {
  job: Job;
  claim: WorkClaim;
  attestation: QueuedAttestation;
}

type ChunkStop = Exclude<UploadOutcome["status"], "connection-unconfirmed" | "nothing-ready">;

/** Replace a job's recorded send, keeping a work's saved uploads. */
function writeSend(target: Job, send: SendCheckpoint | undefined): void {
  if (target.kind === "approval") {
    const payload = target.payload as ApprovalJobPayload;
    if (send) payload.sendCheckpoint = send;
    else delete payload.sendCheckpoint;
    return;
  }
  const payload = target.payload as WorkJobPayload;
  const {
    broadcast: _broadcast,
    broadcastPending: _pending,
    broadcastPendingAt: _pendingAt,
    transactionHash: _hash,
    ...uploads
  } = payload.uploadCheckpoint ?? ({ submittedAt: new Date().toISOString(), files: {} } as const);
  payload.uploadCheckpoint = { ...uploads, ...send } as WorkUploadCheckpoint;
}

export async function uploadQueuedWork(
  input: { userAddress: Address; chainId: number; sender: TransactionSender },
  ports: UploadQueuedWorkPorts
): Promise<UploadOutcome> {
  if (!(await ports.confirmOnline())) return { status: "connection-unconfirmed" };
  const resumePreparation = ports.suspendPreparation();
  let sent = 0;
  let flagged = 0;
  const { chainId, sender } = input;
  const explicitSend: ProcessJobContext = { transactionSender: sender, explicit: true };

  const recordAll = async (
    items: ChunkItem[],
    next: (current: SendCheckpoint) => SendCheckpoint | undefined
  ) => {
    for (const item of items) {
      await ports.save(item.claim, item.job.id, (stored) =>
        writeSend(stored, next(sendCheckpointOf(stored) ?? {}))
      );
      writeSend(item.job, next(sendCheckpointOf(item.job) ?? {}));
    }
  };

  const flag = async (item: ChunkItem, reason: string) => {
    const preparation = {
      status: "blocked",
      reason,
      checkedAt: new Date(ports.now()).toISOString(),
    };
    await ports.save(item.claim, item.job.id, (stored) => {
      stored.meta = { ...stored.meta, preparation };
    });
    flagged += 1;
  };

  /** Simulate each item alone and flag the ones the chain refuses. */
  const flagRefused = async (items: ChunkItem[]): Promise<ChunkItem[]> => {
    const accepted: ChunkItem[] = [];
    for (const item of items) {
      const single = buildQueuedAttestationsCall(ports.easConfig(chainId), {
        works: item.job.kind === "work" ? [item.attestation] : [],
        approvals: item.job.kind === "approval" ? [item.attestation] : [],
      });
      try {
        await ports.simulate(single, chainId, input.userAddress);
        accepted.push(item);
      } catch (error) {
        if (!(error instanceof SimulationRejected && error.definitive)) throw error;
        await flag(item, error.reason);
      }
    }
    return accepted;
  };

  const encode = async (job: Job, claim: WorkClaim): Promise<QueuedAttestation> => {
    if (job.kind === "approval") {
      const payload = job.payload as ApprovalJobPayload;
      return {
        gardenAddress: payload.gardenAddress as Hex,
        attestationData: ports.encodeApproval(buildQueuedApprovalDraft(payload), chainId),
      };
    }
    const payload = (job as Job<WorkJobPayload>).payload;
    const images = await ports.images(job.id);
    // The title preparation resolved: its saved metadata is read back, not uploaded again.
    const draft = buildQueuedWorkDraft(
      payload,
      images.map((image) => image.file),
      resolveWorkSubmissionTitle({ draftTitle: payload.title, actionUID: payload.actionUID })
    );
    // Preparation saved every upload, so this reads them back rather than uploading.
    const attestationData = await ports.encodeWork(draft, chainId, {
      clientWorkId: payload.clientWorkId,
      checkpoint: payload.uploadCheckpoint,
      onCheckpoint: async (progress) => {
        await ports.save(claim, job.id, (stored) => {
          const storedPayload = stored.payload as WorkJobPayload;
          storedPayload.uploadCheckpoint = mergeUploadProgress(
            storedPayload.uploadCheckpoint,
            progress
          );
        });
      },
      gardenAddress: payload.gardenAddress,
      authMode: sender.authMode,
    });
    return { gardenAddress: payload.gardenAddress as Hex, attestationData };
  };

  const sendChunk = async (ids: string[]): Promise<{ stop?: ChunkStop; error?: unknown }> => {
    const claims = await ports.acquire(ids);
    const stopHolding = ports.hold([...claims.values()]);
    let items: ChunkItem[] = [];
    let confirmedItems: ChunkItem[] = [];
    try {
      for (const [id, claim] of claims) {
        const job = await ports.getJob(id);
        if (!job || queuedUploadStatus(job).state !== "ready") continue;
        try {
          items.push({ job, claim, attestation: await encode(job, claim) });
        } catch (error) {
          logger.warn("[UploadAll] Queued item is not ready after all", {
            jobId: id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Its uploads could not be read back: preparation uploads them again.
          // Losing the claim here is the same answer, so it never ends the run.
          await ports
            .save(claim, id, (stored) => {
              const { preparation: _preparation, ...meta } = stored.meta ?? {};
              stored.meta = meta;
            })
            .catch(() => undefined);
        }
      }
      if (items.length === 0) return {};

      const callOf = (chunk: ChunkItem[]) =>
        buildQueuedAttestationsCall(ports.easConfig(chainId), {
          works: chunk
            .filter(({ job }) => job.kind === "work")
            .map(({ attestation }) => attestation),
          approvals: chunk
            .filter(({ job }) => job.kind === "approval")
            .map(({ attestation }) => attestation),
        });
      try {
        await ports.simulate(callOf(items), chainId, input.userAddress);
      } catch (error) {
        if (!(error instanceof SimulationRejected && error.definitive))
          return { stop: "failed", error };
        let accepted: ChunkItem[];
        try {
          accepted = await flagRefused(items);
        } catch (isolationError) {
          return { stop: "failed", error: isolationError };
        }
        // The whole call is refused but no single item is: nothing is sent blind.
        if (accepted.length === items.length) return { stop: "failed", error };
        items = accepted;
        if (items.length === 0) return {};
      }

      let intentRecorded = false;
      let broadcastKnown = false;
      try {
        await sender.sendContractCall(
          { ...callOf(items), chainId },
          {
            onBeforeBroadcast: async (reference) => {
              const at = new Date(ports.now()).toISOString();
              await recordAll(items, () => ({
                broadcastPending: true,
                broadcastPendingAt: at,
                ...(reference ? { broadcast: reference } : {}),
              }));
              intentRecorded = true;
            },
            onBroadcastReference: async (reference) => {
              broadcastKnown = true;
              for (const { job } of items) rememberWorkBroadcast(job.id, reference);
              await recordAll(items, (current) => ({
                ...current,
                broadcast: reference,
                broadcastPending: false,
              }));
            },
            onBroadcast: async (hash) => {
              broadcastKnown = true;
              await recordAll(items, (current) => ({
                ...current,
                transactionHash: hash,
                broadcastPending: false,
              }));
            },
          }
        );
        sent += items.length;
        confirmedItems = items;
        return {};
      } catch (error) {
        const reverted = error instanceof TransactionRevertedError;
        const failure = reverted
          ? ({ kind: "not-sent", cancelled: false } as const)
          : classifySendFailure(error, { intentRecorded, broadcastKnown });
        if (failure.kind === "may-have-sent") return { stop: "send-unconfirmed" };
        // Nothing landed: one call carries every item, so the chain took all or none.
        await recordAll(items, () => undefined);
        for (const { job } of items) forgetWorkBroadcast(job.id);
        if (reverted) {
          const accepted = await flagRefused(items).catch(() => items);
          // No single item explains the revert, so every one is flagged: the
          // same call must not stay ready and go out again unchanged.
          if (accepted.length === items.length)
            for (const item of accepted) await flag(item, "reverted").catch(() => undefined);
          return { stop: "reverted", error };
        }
        return failure.cancelled ? { stop: "declined" } : { stop: "failed", error };
      }
    } finally {
      stopHolding();
      await Promise.allSettled([...claims.values()].map((claim) => claim.release()));
      // The queue confirms each sent item and finishes it the way every send finishes.
      // One it cannot finish now keeps its recorded send for the next confirmation pass.
      for (const { job } of confirmedItems) {
        await ports.processJob(job.id, explicitSend).catch((error: unknown) => {
          logger.warn("[UploadAll] Sent item will be confirmed later", {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }
  };

  try {
    const ready = (await ports.listJobs(input.userAddress)).filter(
      (job) =>
        isUploadJob(job) &&
        (job.chainId ?? chainId) === chainId &&
        queuedUploadStatus(job).state === "ready"
    );
    if (ready.length === 0) return { status: "nothing-ready" };

    // An embedded wallet has no batching: the queue sends its items one at a time.
    if (sender.authMode === "embedded") {
      for (const job of ready) {
        const result = await ports.processJob(job.id, explicitSend);
        if (result.success && !result.skipped) sent += 1;
        if (result.error === "send-cancelled") return { status: "declined", sent, flagged };
      }
      return { status: "uploaded", sent, flagged };
    }

    const limit =
      sender.authMode === "wallet" ? MAX_ITEMS_PER_WALLET_CALL : MAX_ITEMS_PER_USER_OPERATION;
    // Work goes first, as it does inside the call.
    const ordered = [
      ...ready.filter((job) => job.kind === "work"),
      ...ready.filter((job) => job.kind === "approval"),
    ].map((job) => job.id);
    for (let start = 0; start < ordered.length; start += limit) {
      const { stop, error } = await sendChunk(ordered.slice(start, start + limit));
      if (stop === "failed") return { status: "failed", sent, flagged, error };
      if (stop) return { status: stop, sent, flagged };
    }
    return { status: "uploaded", sent, flagged };
  } finally {
    resumePreparation();
  }
}
