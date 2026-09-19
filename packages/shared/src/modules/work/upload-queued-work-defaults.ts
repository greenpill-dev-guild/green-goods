/**
 * The ports Upload all uses in the app: the job store, claims, the queue, each
 * kind's attestation, and the simulation. The encoders and the simulation load
 * when the person taps, never with the offline shell.
 *
 * @module modules/work/upload-queued-work-defaults
 */

import { getEASConfig } from "../../config/blockchain";
import { connectivityStore } from "../../stores/connectivity";
import { jobQueueDB } from "../job-queue/db";
import { jobQueue } from "../job-queue/default-instance";
import { acquireAvailableWorkJobs, holdWorkClaims, saveUnderClaim } from "../job-queue/work-claims";
import { uploadKindOf } from "./upload-kinds";
import { suspendUploadPreparation } from "./upload-preparation";
import type { UploadQueuedWorkPorts } from "./upload-queued-work";

export async function createDefaultUploadQueuedWorkPorts(): Promise<UploadQueuedWorkPorts> {
  // Both load now, right after the tap confirmed the connection. The kinds import
  // the encoders themselves, and an import that fails offline stays failed.
  const [simulation] = await Promise.all([
    import("./simulate"),
    import("../../utils/eas/encoders"),
  ]);
  return {
    confirmOnline: () => connectivityStore.confirmOnline(),
    suspendPreparation: suspendUploadPreparation,
    listJobs: (userAddress) => jobQueueDB.getJobs({ userAddress, synced: false }),
    getJob: (id) => jobQueueDB.getJob(id),
    acquire: acquireAvailableWorkJobs,
    hold: holdWorkClaims,
    save: saveUnderClaim,
    attestation: async (job, { chainId, claim, authMode }) => {
      const kind = uploadKindOf(job);
      if (!kind) throw new Error(`Upload all does not carry ${job.kind} jobs`);
      return kind.attestation(job, { chainId, claim, save: saveUnderClaim, authMode });
    },
    easConfig: (chainId) => getEASConfig(chainId),
    simulate: (call, chainId, account) =>
      simulation.simulateQueuedAttestations(call, chainId, account),
    processJob: (jobId, context) => jobQueue.processJob(jobId, context),
    now: () => Date.now(),
  };
}
