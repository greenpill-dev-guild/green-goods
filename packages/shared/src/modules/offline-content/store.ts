import { INITIAL_OFFLINE_PROGRESS, type OfflineProgress } from "./types";

export type { OfflinePauseReason, OfflineProgress, OfflineRunState } from "./types";

/** Byte and percentage updates reach subscribers at most this often. */
const PROGRESS_NOTIFY_MS = 250;

let snapshot: OfflineProgress = INITIAL_OFFLINE_PROGRESS;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function notify() {
  clearTimeout(notifyTimer);
  notifyTimer = undefined;
  for (const listener of listeners) listener();
}

export function subscribeOfflineProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineProgress(): OfflineProgress {
  return snapshot;
}

/**
 * State changes notify at once; byte and percentage changes are coalesced, so a
 * busy download never re-renders the Settings row more than a few times a second.
 */
export function updateOfflineProgress(
  update: Partial<OfflineProgress> | ((current: OfflineProgress) => OfflineProgress)
): void {
  const next = typeof update === "function" ? update(snapshot) : { ...snapshot, ...update };
  const changedState =
    next.state !== snapshot.state ||
    next.pauseReason !== snapshot.pauseReason ||
    next.storageFull !== snapshot.storageFull ||
    next.missingPhotos !== snapshot.missingPhotos ||
    next.failedReads !== snapshot.failedReads;
  snapshot = next;
  if (changedState) notify();
  else notifyTimer ??= setTimeout(notify, PROGRESS_NOTIFY_MS);
}

/** Persisted reading data could not be written; offline copies may be out of date. */
export function reportOfflineStorageFailure(): void {
  updateOfflineProgress({ storageFull: true });
}

/** Test seam: forget progress between cases. */
export function resetOfflineProgress(): void {
  clearTimeout(notifyTimer);
  notifyTimer = undefined;
  snapshot = INITIAL_OFFLINE_PROGRESS;
}
