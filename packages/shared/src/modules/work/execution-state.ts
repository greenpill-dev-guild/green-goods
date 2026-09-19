const processing = new Set<string>();
// Background preparation is resumable: its uploads are saved as they land and its
// claim expires on its own. So it keeps other holders out, but never holds back
// an app update the way a save or a send does.
const background = new Set<string>();

export interface WorkClaimOptions {
  /** A claim the person is not waiting on, which an app update may interrupt. */
  background?: boolean;
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
  return () => {
    for (const id of ids) {
      processing.delete(id);
      background.delete(id);
    }
  };
}
