/**
 * Where the gardener's own queued work stands, grouped the way its page answers:
 * waiting to upload, being prepared, needing attention, failed to upload, or
 * already sent and being checked. The notice says why; the bar holds the acts.
 */
export type WorkUploadGroup = "waiting" | "preparing" | "attention" | "failed" | "sent";

export function workUploadGroup(submissionState: string | undefined): WorkUploadGroup {
  switch (submissionState) {
    case "blocked":
    case "photo-needs-attention":
      return "attention";
    case "retry-required":
    case "reverted":
      return "failed";
    case "preparing":
    case "photo-pending":
      return "preparing";
    case "awaiting-confirmation":
    case "checking-submission":
    case "sending":
      return "sent";
    default:
      return "waiting";
  }
}

/**
 * Whether Discard is offered for the gardener's own queued work, on its page
 * and in Your Work. Never once a send may be on its way, never while
 * preparation is working on it online, and never after a reverted send, which
 * left a transaction behind. The queue refuses those itself; this keeps the
 * screens from offering what it would refuse.
 */
export function canDiscardQueuedWork(
  submissionState: string | undefined,
  { isOnline, pausedForDataSaver }: { isOnline: boolean; pausedForDataSaver: boolean }
): boolean {
  switch (workUploadGroup(submissionState)) {
    case "waiting":
    case "attention":
      return true;
    case "preparing":
      return !isOnline || pausedForDataSaver;
    case "failed":
      return submissionState !== "reverted";
    default:
      return false;
  }
}
