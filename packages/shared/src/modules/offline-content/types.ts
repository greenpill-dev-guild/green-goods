/** What the background download is doing, as the Settings row reports it. */
export type OfflineRunState = "idle" | "downloading" | "paused" | "ready" | "incomplete";

/** Why downloads are waiting. Data Saver pauses photos only; lists keep updating. */
export type OfflinePauseReason = "user" | "offline" | "dataSaver";

export interface OfflineProgress {
  state: OfflineRunState;
  pauseReason?: OfflinePauseReason;
  /** Bytes downloaded by the current or most recent run. */
  runBytes: number;
  /** Completed share of the current run, 0 to 1, never lower than it has already shown. */
  runRatio: number;
  /** Bytes the photo cache holds, as the service worker last reported them. */
  savedBytes: number;
  /** Photos that could not be downloaded in the most recent run. */
  missingPhotos: number;
  /** The saved reading data could not be written, most likely because storage is full. */
  storageFull: boolean;
  completedAt?: number;
}

export const INITIAL_OFFLINE_PROGRESS: OfflineProgress = {
  state: "idle",
  runBytes: 0,
  runRatio: 0,
  savedBytes: 0,
  missingPhotos: 0,
  storageFull: false,
};
