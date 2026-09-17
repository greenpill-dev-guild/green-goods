/**
 * The ports Upload all uses in the app: the job store, claims, the queue, the
 * encoders, and the simulation. The encoders and the simulation load when the
 * person taps, never with the offline shell.
 *
 * @module modules/work/upload-queued-work-defaults
 */

import { getEASConfig } from "../../config/blockchain";
import { connectivityStore } from "../../stores/connectivity";
import { jobQueueDB } from "../job-queue/db";
import { jobQueue } from "../job-queue/default-instance";
import { acquireAvailableWorkJobs, holdWorkClaims, saveUnderClaim } from "../job-queue/work-claims";
import { suspendUploadPreparation } from "./upload-preparation";
import type { UploadQueuedWorkPorts } from "./upload-queued-work";

export async function createDefaultUploadQueuedWorkPorts(): Promise<UploadQueuedWorkPorts> {
  const [encoders, simulation] = await Promise.all([
    import("../../utils/eas/encoders"),
    import("./simulate"),
  ]);
  return {
    confirmOnline: () => connectivityStore.confirmOnline(),
    suspendPreparation: suspendUploadPreparation,
    listJobs: (userAddress) => jobQueueDB.getJobs({ userAddress, synced: false }),
    getJob: (id) => jobQueueDB.getJob(id),
    acquire: acquireAvailableWorkJobs,
    hold: holdWorkClaims,
    save: saveUnderClaim,
    images: (jobId) => jobQueueDB.getImagesForJob(jobId),
    encodeWork: encoders.encodeWorkData,
    encodeApproval: encoders.encodeWorkApprovalData,
    easConfig: (chainId) => getEASConfig(chainId),
    simulate: (call, chainId, account) =>
      simulation.simulateQueuedAttestations(call, chainId, account),
    processJob: (jobId, context) => jobQueue.processJob(jobId, context),
    now: () => Date.now(),
  };
}
