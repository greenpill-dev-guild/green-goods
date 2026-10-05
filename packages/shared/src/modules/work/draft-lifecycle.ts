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
 * the composer keeps its draft so a declined prompt can be answered again. That
 * work is already listed, as queued and then as sent, so its draft is not a
 * second item.
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
    const listed: WorkDraftRecord[] = [];
    for (const draft of drafts) {
      const id = draft.clientWorkId;
      const admitted =
        id !== undefined &&
        (queued.has(id) || Boolean(await jobQueueDB.getWorkCompletion(userAddress, chainId, id)));
      if (!admitted) listed.push(draft);
    }
    return listed;
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

/**
 * Queued work that is sent or discarded outside its composer takes the draft
 * with it, attachments included. The queue held the work, so the draft left
 * behind would come back as an item of its own. Resolves whether one was removed.
 */
export async function deleteDraftOfQueuedWork(
  job: Pick<Job, "kind" | "payload" | "userAddress" | "chainId">,
  mode: "discard" | "retire"
): Promise<boolean> {
  const clientWorkId =
    job.kind === "work" ? (job.payload as WorkJobPayload).clientWorkId : undefined;
  if (!clientWorkId || submitting.has(clientWorkId)) return false;
  const drafts = await draftDB.getDraftsForUser(job.userAddress, job.chainId ?? DEFAULT_CHAIN_ID);
  const draft = drafts.find((candidate) => candidate.clientWorkId === clientWorkId);
  if (!draft) return false;
  await deleteWorkDraft(draft.id, mode);
  return true;
}
