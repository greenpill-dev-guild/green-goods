import { useSyncExternalStore } from "react";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { hasActiveWorkExecution } from "../../modules/work/execution-state";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";

/** Read immediately before activation too: a queue claim may start between renders. */
export function isWorkUpdateBlocked(): boolean {
  const draft = useWorkFlowStore.getState();
  return Boolean(
    ((draft.draftScope || draft.activeDraftId) &&
      ["loading", "saving", "failed"].includes(draft.draftSaveState)) ||
      hasActiveWorkExecution()
  );
}

/** A draft's save shows in the work store; work being sent shows as queue events. */
function subscribeToWork(onChange: () => void): () => void {
  const leaveDrafts = useWorkFlowStore.subscribe(onChange);
  const leaveQueue = jobQueueEventBus.onMultiple(
    ["job:processing", "job:completed", "job:failed", "queue:sync-completed"],
    onChange
  );
  return () => {
    leaveDrafts();
    leaveQueue();
  };
}

function neverBlockedOnTheServer(): boolean {
  return false;
}

/**
 * Whether saving or sending work holds back an app update, kept current as that work starts and
 * ends.
 *
 * It is a subscription, not a value read while rendering. The read names no reactive value, so the
 * React Compiler, which the app builds run and the tests do not, keeps the first answer for as long
 * as the component lives, and the installed app's root lives as long as the page. Settings would
 * go on offering Restart, with no word about unsaved work, while a save or a send was under way.
 */
export function useWorkUpdateGuard(): boolean {
  return useSyncExternalStore(subscribeToWork, isWorkUpdateBlocked, neverBlockedOnTheServer);
}
