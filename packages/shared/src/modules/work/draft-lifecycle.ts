import { finishLegacyRecovery } from "./legacy-draft-recovery";
import { draftDB } from "../job-queue/draft-db";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";

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
