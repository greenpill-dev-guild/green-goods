import type { WorkJobPayload } from "../../types/job-queue";
import type { JobQueueDatabase } from "./db-schema";
import { compareAddresses } from "../../utils/blockchain/address";

export function workCompletionScope(
  address: string,
  chainId: number,
  clientWorkId: string
): string {
  return `${chainId}:${address.toLowerCase()}:${clientWorkId}`;
}

/** Called inside the queue's transaction so the preview and ID mapping commit together. */
export async function recordWorkCompletion(
  db: Pick<JobQueueDatabase, "jobs" | "work_completions">,
  clientWorkId: string,
  transactionHash: string,
  jobId: string
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job?.chainId) return;
  const scope = workCompletionScope(job.userAddress, job.chainId, clientWorkId);
  const previous = await db.work_completions.get(scope);
  const work = (job.payload as WorkJobPayload).confirmedWork ?? previous?.work;
  if (
    work &&
    (!compareAddresses(work.gardenerAddress, job.userAddress) ||
      !compareAddresses(work.gardenAddress, (job.payload as WorkJobPayload).gardenAddress) ||
      (previous?.gardenAddress && !compareAddresses(work.gardenAddress, previous.gardenAddress)))
  )
    throw new Error("work-identity-conflict");
  if (previous?.workUID && work && previous.workUID.toLowerCase() !== work.id.toLowerCase())
    throw new Error("work-identity-conflict");
  await db.work_completions.put({
    scope,
    clientWorkId,
    userAddress: job.userAddress.toLowerCase(),
    chainId: job.chainId,
    transactionHash,
    ...(work
      ? { gardenAddress: work.gardenAddress }
      : previous?.gardenAddress
        ? { gardenAddress: previous.gardenAddress }
        : {}),
    ...(previous?.indexedAt !== undefined
      ? { indexedAt: previous.indexedAt, workUID: previous.workUID }
      : work
        ? { work, workUID: work.id }
        : {}),
    jobId,
    createdAt: Date.now(),
  });
}

function readWorkCompletions(db: JobQueueDatabase, address: string, chainId: number) {
  const prefix = `${chainId}:${address.toLowerCase()}:`;
  return db.work_completions.where("scope").between(prefix, `${prefix}\uffff`, true, true);
}

/** Indexed cards leave the temporary snapshot; retry identity stays durable. */
export async function retireWorkCompletionSnapshots(
  store: { init: () => Promise<JobQueueDatabase> },
  address: string,
  chainId: number,
  indexedWorkIds: readonly string[]
): Promise<void> {
  const ids = new Set(indexedWorkIds.map((id) => id.toLowerCase()));
  if (!ids.size) return;
  const db = await store.init();
  await db.transaction("rw", db.work_completions, async () => {
    await readWorkCompletions(db, address, chainId)
      .filter((row) => Boolean(row.work && ids.has(row.work.id.toLowerCase())))
      .modify((row) => {
        row.workUID = row.work!.id;
        row.gardenAddress = row.work!.gardenAddress;
        row.indexedAt = Date.now();
        delete row.work;
      });
  });
}
