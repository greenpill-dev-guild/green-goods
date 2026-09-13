import { useState } from "react";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { hasActiveWorkExecution } from "../../modules/work/execution-state";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";

/** Read immediately before activation too: a queue claim may start between renders. */
export function isWorkUpdateBlocked(): boolean {
  const draft = useWorkFlowStore.getState();
  return Boolean(
    ((draft.draftScope || draft.activeDraftId) &&
      ["loading", "saving", "failed"].includes(draft.draftSaveState)) ||
      hasActiveWorkExecution()
  );
}
export function useWorkUpdateGuard(): boolean {
  useWorkFlowStore((state) => `${state.draftScope}:${state.activeDraftId}:${state.draftSaveState}`);
  const [, refresh] = useState(0);
  useJobQueueEvents(["job:processing", "job:completed", "job:failed", "queue:sync-completed"], () =>
    refresh((value) => value + 1)
  );
  return isWorkUpdateBlocked();
}
