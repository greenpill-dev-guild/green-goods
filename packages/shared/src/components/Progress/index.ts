/**
 * Progress Components
 *
 * Visual indicators for submission progress and background sync status.
 *
 * @module components/Progress
 */

// Submission Progress
export type {
  SubmissionProgressState,
  SubmissionStage,
} from "../../hooks/work/useSubmissionProgress";
export { SubmissionProgress } from "./SubmissionProgress";

// Sync Indicator
export type { SyncStatus } from "./SyncIndicator";
export { SyncIndicator } from "./SyncIndicator";
