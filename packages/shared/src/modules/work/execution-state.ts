import { logger } from "../app/logger";

const processing = new Set<string>();
// Background preparation is resumable: its uploads are saved as they land and its
// claim expires on its own. So it keeps other holders out, but never holds back
// an app update the way a save or a send does.
const background = new Set<string>();
// A page that shows whether work is under way hears each claim taken and each one let go.
const listeners = new Set<() => void>();

export interface WorkClaimOptions {
  /** A claim the person is not waiting on, which an app update may interrupt. */
  background?: boolean;
}

// A listener is a page's concern. One that throws must not stop a claim being taken or let go.
function tellListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      logger.error("A work execution listener failed", { error });
    }
  }
}

/**
 * Hears every claim taken and every claim released. The release is the only word that a send has
 * let go: the queue reports a job done while its claim is still held.
 */
export function subscribeToWorkExecution(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasActiveWorkExecution(): boolean {
  for (const id of processing) if (!background.has(id)) return true;
  return false;
}
export function claimWorkJobs(ids: string[], options: WorkClaimOptions = {}): (() => void) | null {
  if (ids.some((id) => processing.has(id))) return null;
  for (const id of ids) {
    processing.add(id);
    if (options.background) background.add(id);
  }
  tellListeners();
  return () => {
    for (const id of ids) {
      processing.delete(id);
      background.delete(id);
    }
    tellListeners();
  };
}
