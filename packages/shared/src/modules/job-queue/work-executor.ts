/**
 * The work executor
 *
 * Sends one queued work: its photos converted, the attestation simulated, its
 * uploads published, and the call sent. The send is recorded before it can
 * reach the network and holds its lock until its answer. A later run settles
 * what is on record instead of sending it again: by its receipt, its
 * UserOperation, or what the chain recorded, and a lost send is offered again
 * only as `send-guards` allows.
 *
 * @module modules/job-queue/work-executor
 */

import type { Hex } from "viem";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { buildWorkAttestContractCall } from "../../utils/eas/transaction-builder";
import type { TransactionSender } from "../transactions/types";
import { createEasLandedLookup } from "../work/eas-landed-lookup";
import { buildQueuedWorkDraft, resolveQueuedWorkTitle } from "../work/queued-work-draft";
import { sendWithCheckpoint } from "../work/send-with-checkpoint";
import { settleStrandedWorkIntent, type StrandedWorkLookup } from "../work/stranded-intent";
import { PendingHeicConversionError } from "../work/work-attachments";
import {
  AwaitingWorkConfirmation,
  forgetWorkBroadcast,
  reconcileWorkTransaction,
  retainedWorkBroadcast,
  retainedWorkBroadcastReference,
  WorkTransactionReverted,
} from "../work/work-confirmation";
import { jobQueueDB } from "./db";
import { convertQueuedHeicMedia } from "./job-media-conversion";
import { sendCheckpointOf, writeSendCheckpoint } from "./queue-policy";
import { chainTimeOf, createSendChainReads, type SendChainReads } from "./send-chain-reads";
import {
  holdingSend,
  observeTransactionNonce,
  recordedTransactionSuperseded,
  sendMayStillLand,
} from "./send-guards";

type EncodeWork = typeof import("../../utils/eas/encoders").encodeWorkData;
type SimulateWork = typeof import("../work/simulate").simulateWorkSubmission;

export interface WorkJobExecutorDeps {
  reconcile?: typeof reconcileWorkTransaction;
  images?: (jobId: string) => ReturnType<typeof jobQueueDB.getImagesForJob>;
  convertMedia?: typeof convertQueuedHeicMedia;
  resolveTitle?: (job: Job<WorkJobPayload>, chainId: number) => Promise<string>;
  /** Settles a lost send from what the chain recorded; the default asks EAS, behind the guards. */
  settleStrandedIntent?: (
    job: Job<WorkJobPayload>,
    chainId: number,
    pendingHash: Hex
  ) => Promise<Hex>;
  simulate?: SimulateWork;
  encodeWork?: EncodeWork;
  easConfig?: EASConfig;
  /** What the default settle asks of the chain. */
  reads?: SendChainReads;
  /** Whether the work landed; the default reads the gardener's own work on EAS. */
  lookUpLanded?: StrandedWorkLookup;
}

/** Execute a work attestation job: simulate, encode (includes IPFS upload), and send. */
export async function executeWorkJob(
  jobId: string,
  job: Job<WorkJobPayload>,
  chainId: number,
  sender: TransactionSender,
  deps: WorkJobExecutorDeps = {}
): Promise<string> {
  const knownWorkId = job.payload.clientWorkId;
  if (knownWorkId) {
    const knownHash = (await jobQueueDB.getWorkCompletion(job.userAddress, chainId, knownWorkId))
      ?.transactionHash;
    if (knownHash) return knownHash;
  }
  const payload = job.payload;
  const reads = deps.reads ?? createSendChainReads({ chainId });
  const store = { updateJob: (updated: Job) => jobQueueDB.updateJob(updated) };
  const settleStranded =
    deps.settleStrandedIntent ??
    (async (stranded: Job<WorkJobPayload>, strandedChain: number, pendingHash: Hex) => {
      // Each pass while the network holds the transaction may keep its nonce.
      await observeTransactionNonce(stranded, reads, store);
      return settleStrandedWorkIntent(stranded, strandedChain, pendingHash, {
        lookUp: deps.lookUpLanded ?? createEasLandedLookup().work,
        stillSending: () => sendMayStillLand(stranded, reads),
        transactionSuperseded: () => recordedTransactionSuperseded(stranded, reads),
        chainTime: chainTimeOf(reads),
      });
    });
  const checkpoint = payload.uploadCheckpoint;
  const broadcast = checkpoint?.broadcast ?? retainedWorkBroadcastReference(jobId);
  const previousHash = broadcast?.hash ?? checkpoint?.transactionHash;
  if (previousHash) {
    let state: "confirmed" | "reverted" | "unresolved";
    let transactionHash = checkpoint?.transactionHash;
    if (broadcast?.kind === "user-operation") {
      const result = await sender.reconcileBroadcast?.(broadcast);
      state = result?.status ?? "unresolved";
      if (result?.status === "confirmed") transactionHash = result.transactionHash;
    } else if (!broadcast && (sender.authMode === "passkey" || job.meta?.legacyConfirmation)) {
      const { reconcileLegacyPasskeyWork } = await import("../work/work-confirmation");
      state = await reconcileLegacyPasskeyWork(previousHash, job, chainId);
      transactionHash = previousHash;
    } else {
      state = await (deps.reconcile ?? reconcileWorkTransaction)(previousHash, chainId);
      transactionHash = previousHash;
    }
    if (state === "unresolved") {
      // A UserOperation no bundler reports may never have been sent, and a
      // transaction no receipt answers, such as a Safe's own id, may still
      // land: what the chain recorded settles either.
      transactionHash = await settleStranded(job, chainId, previousHash);
    }
    if (state === "reverted") {
      job.meta = { ...job.meta, workTransactionReverted: true };
      if (payload.uploadCheckpoint) payload.uploadCheckpoint.transactionReverted = true;
      await jobQueueDB.updateJob(job);
      throw new WorkTransactionReverted(previousHash);
    }
    forgetWorkBroadcast(jobId);
    return transactionHash!;
  }
  if (checkpoint?.broadcastPending) {
    // The answer to the send was lost; the gardener's attestations settle it.
    const landed = await settleStranded(job, chainId, "0x");
    forgetWorkBroadcast(jobId);
    return landed;
  }
  await sender.assertOwnership?.(job.userAddress, chainId);
  // A photo picked before the decoder could load is still HEIC. It becomes a
  // JPEG in storage before the simulate and the encode read the files.
  const conversion = await (deps.convertMedia ?? convertQueuedHeicMedia)(job);
  if (conversion.status !== "ready")
    throw new PendingHeicConversionError(
      conversion.status === "pending" ? "photo-conversion-pending" : "photo-needs-attention"
    );
  const getImages = deps.images ?? ((id: string) => jobQueueDB.getImagesForJob(id));
  const images = await getImages(jobId);
  const actionTitle = await (deps.resolveTitle ?? resolveQueuedWorkTitle)(job, chainId);
  const draft = buildQueuedWorkDraft(
    payload,
    images.map((image) => image.file),
    actionTitle
  );

  // Simulate before uploading to IPFS
  const simulate = deps.simulate ?? (await import("../work/simulate")).simulateWorkSubmission;
  await simulate({
    draft,
    gardenAddress: payload.gardenAddress,
    actionUID: payload.actionUID,
    actionTitle,
    chainId,
    images: draft.media,
    accountAddress: job.userAddress as `0x${string}`,
  });

  // Encode attestation data (includes IPFS upload)
  const encodeWork = deps.encodeWork ?? (await import("../../utils/eas/encoders")).encodeWorkData;
  const attestationData = await encodeWork(draft, chainId, {
    clientWorkId: payload.clientWorkId,
    checkpoint: payload.uploadCheckpoint,
    onCheckpoint: async (checkpoint) => {
      await sender.assertOwnership?.(job.userAddress, chainId);
      payload.uploadCheckpoint = checkpoint;
      await jobQueueDB.updateJob(job);
    },
    gardenAddress: payload.gardenAddress,
    authMode: sender.authMode === "embedded" ? "passkey" : sender.authMode,
  });

  // Build and send attestation via TransactionSender
  const easConfig = deps.easConfig ?? getEASConfig(chainId);
  const contractCall = buildWorkAttestContractCall(
    easConfig,
    payload.gardenAddress as `0x${string}`,
    attestationData
  );
  const markReverted = async () => {
    job.meta = { ...job.meta, workTransactionReverted: true };
    if (payload.uploadCheckpoint) payload.uploadCheckpoint.transactionReverted = true;
    await jobQueueDB.updateJob(job);
  };
  const result = await holdingSend(jobId, () =>
    sendWithCheckpoint({
      sender,
      call: { ...contractCall, chainId },
      jobIds: [jobId],
      // Read just before the intent, after any prompt, and again if the answer
      // is lost: a lost send is then timed on the chain's clock.
      readChainHead: reads.readChainHead,
      assertOwnership: async () => {
        await sender.assertOwnership?.(job.userAddress, chainId);
      },
      record: async (next) => {
        const send = next(sendCheckpointOf(job) ?? {});
        writeSendCheckpoint(job, send);
        // Once the network has the send, the stored job already reads as awaiting
        // its confirmation, even if this tab dies before the receipt arrives.
        if (send?.broadcast && send.broadcastPending === false)
          job.meta = {
            ...job.meta,
            waitingForDependency: true,
            waitingReason: "awaiting-confirmation",
          };
        await jobQueueDB.updateJob(job);
      },
    })
  );
  switch (result.status) {
    case "sent":
      if (result.confirmation === "pending") {
        await observeTransactionNonce(job, reads, store);
        throw new AwaitingWorkConfirmation(result.hash);
      }
      forgetWorkBroadcast(jobId);
      return result.hash;
    case "reverted":
      await markReverted();
      throw new WorkTransactionReverted(result.error.hash);
    case "not-sent":
      // Nothing reached the chain: the work stays sendable. A person who
      // declined is not asked again until they choose to send it.
      if (result.cancelled) {
        job.meta = { ...job.meta, requiresExplicitSend: true };
        await jobQueueDB.updateJob(job);
      }
      throw result.error;
    case "may-have-sent":
      // Its receipt did not come: keep the nonce its transaction used while the
      // network still holds it.
      await observeTransactionNonce(job, reads, store);
      throw new AwaitingWorkConfirmation(
        retainedWorkBroadcast(jobId) ?? payload.uploadCheckpoint?.broadcast?.hash ?? "0x"
      );
  }
}
