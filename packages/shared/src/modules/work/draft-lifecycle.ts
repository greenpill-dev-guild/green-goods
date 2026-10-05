import { finishLegacyRecovery } from "./legacy-draft-recovery";
import { draftDB } from "../job-queue/draft-db";
import { jobQueueDB } from "../job-queue/db";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import type { Job, WorkDraftRecord, WorkJobPayload } from "../../types/job-queue";

let pending: Promise<unknown> = Promise.resolve();
export function queueDraftWrite<T>(write: () => Promise<T>): Promise<T> {
  const task = pending.catch(() => undefined).then(write);
  pending = task;
  return task;
}
const formResets = new Set<() => void>();
export function registerDraftFormReset(reset: () => void): () => void {
  formResets.add(reset);
  return () => {
    formResets.delete(reset);
  };
}

export async function deleteWorkDraft(id: string, mode: "discard" | "retire" = "discard") {
  const initial = useWorkFlowStore.getState();
  const active = initial.activeDraftId === id;
  const scope = initial.draftScope;
  if (active)
    useWorkFlowStore.setState({ draftEpoch: initial.draftEpoch + 1, draftDeleting: true });
  const generation = useWorkFlowStore.getState().draftEpoch;
  const current = () => {
    const state = useWorkFlowStore.getState();
    return (
      active &&
      state.draftScope === scope &&
      state.draftEpoch === generation &&
      state.activeDraftId === id
    );
  };
  try {
    await queueDraftWrite(async () => {
      const record = await draftDB.getDraft(id);
      // Explicitly discarding the recovery also discards its unscoped source.
      if (mode === "discard" && record?.legacySourceId) await finishLegacyRecovery(record, true);
      await draftDB.deleteDraft(id);
    });
    if (current()) {
      const completed = useWorkFlowStore.getState().submissionCompleted;
      useWorkFlowStore.getState().reset();
      formResets.forEach((reset) => reset());
      if (mode === "retire") useWorkFlowStore.setState({ submissionCompleted: completed });
    }
  } catch (error) {
    if (current())
      useWorkFlowStore.setState({
        draftDeleting: false,
        draftSaveState: "failed",
        draftError: error instanceof Error ? error.message : "draft-delete-failed",
      });
    throw error;
  }
}

/**
 * The drafts Your Work lists and counts.
 *
 * Submit admits work to the upload queue before it asks for a signature, and
 * the composer keeps its draft so a declined prompt can be answered again.
 * While that work waits in the queue it is listed there, so its draft is not a
 * second item. Only then: sending or discarding the queued work removes the
 * draft, and a draft with nothing queued stays where the person can remove it,
 * because every stored draft counts toward their limit.
 */
export async function listWorkDrafts(
  userAddress: string,
  chainId: number
): Promise<WorkDraftRecord[]> {
  const drafts = await draftDB.getDraftsForUser(userAddress, chainId);
  if (!drafts.some((draft) => draft.clientWorkId)) return drafts;
  try {
    const queued = new Set(
      (await jobQueueDB.getJobs({ userAddress, kind: "work", synced: false })).map(
        (job) => (job.payload as WorkJobPayload).clientWorkId
      )
    );
    return drafts.filter((draft) => !draft.clientWorkId || !queued.has(draft.clientWorkId));
  } catch (error) {
    // A queue that cannot be read lists no work either, so every draft stays reachable.
    logger.warn("[WorkDrafts] Could not read the upload queue; listing every draft", { error });
    return drafts;
  }
}

/** Work a Submit is sending now: its composer retires the draft once the outcome is in. */
const submitting = new Set<string>();

/** Leaves this work's draft to the Submit that is sending it. Returns the release. */
export function holdDraftForSubmit(clientWorkId: string): () => void {
  submitting.add(clientWorkId);
  return () => {
    submitting.delete(clientWorkId);
  };
}

async function draftOfWork(userAddress: string, chainId: number, clientWorkId: string) {
  const drafts = await draftDB.getDraftsForUser(userAddress, chainId);
  return drafts.find((draft) => draft.clientWorkId === clientWorkId);
}

/**
 * Which content of its draft a work has as it is handed to the upload queue.
 * Read before the queue copies the work and noted on the queued work after, so
 * a draft the person changes later can be told from the work that is sent.
 * Undefined when the work has no draft, or the draft cannot be read.
 */
export async function draftContentOf(work: {
  userAddress: string;
  chainId: number;
  clientWorkId: string;
}): Promise<number | undefined> {
  try {
    const draft = await draftOfWork(work.userAddress, work.chainId, work.clientWorkId);
    return draft ? (draft.contentRevision ?? 0) : undefined;
  } catch (error) {
    logger.warn("[WorkDrafts] Could not read the draft of submitted work", { error });
    return undefined;
  }
}

/** Notes on newly queued work the draft content it was given. Unnoted work keeps its draft. */
export async function noteQueuedDraftContent(jobId: string, content: number): Promise<void> {
  try {
    await jobQueueDB.amendJob(jobId, (job) => {
      job.meta = { ...job.meta, draftContentRevision: content };
    });
  } catch (error) {
    logger.warn("[WorkDrafts] Could not note which draft content was queued", { error });
  }
}

/**
 * Queued work that is sent or discarded outside its composer takes the draft
 * with it, attachments included. The queue held the work, so the draft left
 * behind would come back as an item of its own.
 *
 * A draft changed since the queue took the work holds something that was not
 * sent. Sending the queued work keeps that draft, and it is listed again;
 * discarding the work removes it, changed or not.
 *
 * Resolves "removed", or "kept" for a changed draft. Null when there is nothing
 * of this work's to remove here: it has no draft, or a Submit that is sending
 * it holds the draft.
 */
export async function deleteDraftOfQueuedWork(
  job: Pick<Job, "kind" | "payload" | "userAddress" | "chainId" | "meta">,
  mode: "discard" | "retire"
): Promise<"removed" | "kept" | null> {
  const clientWorkId =
    job.kind === "work" ? (job.payload as WorkJobPayload).clientWorkId : undefined;
  if (!clientWorkId || submitting.has(clientWorkId)) return null;
  const draft = await draftOfWork(job.userAddress, job.chainId ?? DEFAULT_CHAIN_ID, clientWorkId);
  if (!draft) return null;
  if (mode === "retire" && job.meta?.draftContentRevision !== (draft.contentRevision ?? 0))
    return "kept";
  await deleteWorkDraft(draft.id, mode);
  return "removed";
}
