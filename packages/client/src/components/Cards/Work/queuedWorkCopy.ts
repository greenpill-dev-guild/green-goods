import type { MessageDescriptor } from "react-intl";

/** Where a queued work stands, as its metadata records it. */
export interface QueuedWorkState {
  submissionState?: string;
  /** The contract error the chain would refuse a blocked work with. */
  blockedReason?: string;
}

/** Reads the queued state from work metadata. Remote metadata can be a CID, which has none. */
export function readQueuedWorkState(metadata: string | undefined): QueuedWorkState {
  try {
    const { submissionState, blockedReason } = JSON.parse(metadata || "{}") as Record<
      string,
      unknown
    >;
    return {
      submissionState: typeof submissionState === "string" ? submissionState : undefined,
      blockedReason: typeof blockedReason === "string" ? blockedReason : undefined,
    };
  } catch {
    return {};
  }
}

/** Chips stay short so a work's title keeps its width at 360px in every language. */
const TO_UPLOAD_CHIP = {
  id: "app.uploads.chip.toUpload",
  defaultMessage: "To upload",
} satisfies MessageDescriptor;

const BLOCKED_CHIP = {
  id: "app.uploads.chip.blocked",
  defaultMessage: "Blocked",
} satisfies MessageDescriptor;

const AWAITING_CONFIRMATION = {
  id: "app.work.awaitingConfirmation",
  defaultMessage: "Awaiting confirmation",
} satisfies MessageDescriptor;

const CHECKING_SUBMISSION = {
  id: "app.work.checkingSubmission",
  defaultMessage: "Checking whether this work was sent",
} satisfies MessageDescriptor;

const ACTION_ENDED = {
  id: "app.uploads.blocked.actionEnded",
  defaultMessage: "Can't upload: this action has ended",
} satisfies MessageDescriptor;

const CONFIRMATION_FAILED = {
  id: "app.work.confirmationFailed",
  defaultMessage:
    "This upload didn't go through. Your media is saved; try again when you're ready.",
} satisfies MessageDescriptor;

/** Why the chain would refuse an item, by the resolver error it would revert with. */
const BLOCKED_REASONS = new Map<string, MessageDescriptor>([
  [
    "NotGardenMember",
    {
      id: "app.uploads.blocked.notMember",
      defaultMessage: "Can't upload: you're not a member of this garden",
    },
  ],
  [
    "NotGardenOperator",
    {
      id: "app.uploads.blocked.notSteward",
      defaultMessage: "Can't upload: you're not a steward of this garden",
    },
  ],
  ["NotActiveAction", ACTION_ENDED],
  ["ActionExpired", ACTION_ENDED],
  [
    "NotInActionRegistry",
    {
      id: "app.uploads.blocked.actionMissing",
      defaultMessage: "Can't upload: this action no longer exists",
    },
  ],
  [
    "ActionDomainMismatch",
    {
      id: "app.uploads.blocked.actionNotInGarden",
      defaultMessage: "Can't upload: this garden doesn't offer this action",
    },
  ],
  [
    "NotInWorkRegistry",
    {
      id: "app.uploads.blocked.workMissing",
      defaultMessage: "Can't upload: this work isn't on the garden record",
    },
  ],
  [
    "SelfAttestation",
    {
      id: "app.uploads.blocked.selfReview",
      defaultMessage: "Can't upload: you can't review your own work",
    },
  ],
  // Not a resolver error: Upload all marks a batch the chain reverted when no
  // single item explains it. Saying the record won't accept it would contradict
  // the per-item check that just passed.
  ["reverted", CONFIRMATION_FAILED],
]);

const UPLOADING_NOW = {
  id: "app.home.work.syncingInfo",
  defaultMessage: "Uploading to the garden record...",
} satisfies MessageDescriptor;

const UPLOAD_FAILED = {
  id: "app.work.retryRequiredInfo",
  defaultMessage: "Your media stays saved. Choose Upload now when you’re ready to try again.",
} satisfies MessageDescriptor;

const REFUSED = {
  id: "app.uploads.blocked.refused",
  defaultMessage: "Can't upload: the garden record won't accept it",
} satisfies MessageDescriptor;

export function blockedReasonMessage(reason: string | undefined): MessageDescriptor {
  return (reason && BLOCKED_REASONS.get(reason)) || REFUSED;
}

/** The status chip for work still on this device, when its state has a name. */
export function queuedWorkStatusMessage(
  submissionState: string | undefined
): MessageDescriptor | undefined {
  switch (submissionState) {
    case "ready":
    case "preparing":
    case "photo-pending":
      return TO_UPLOAD_CHIP;
    case "blocked":
    case "photo-needs-attention":
      return BLOCKED_CHIP;
    case "awaiting-confirmation":
      return AWAITING_CONFIRMATION;
    case "checking-submission":
      return CHECKING_SUBMISSION;
    default:
      return undefined;
  }
}

/**
 * The line under a queued work that says what it waits for. A ready, sent, or
 * confirming work has none: its status chip already says it.
 */
export function queuedWorkDetailMessage({
  submissionState,
  blockedReason,
}: QueuedWorkState): MessageDescriptor | undefined {
  switch (submissionState) {
    case "reverted":
      return CONFIRMATION_FAILED;
    case "sending":
      return UPLOADING_NOW;
    case "retry-required":
      return UPLOAD_FAILED;
    case "preparing":
      return { id: "app.uploads.state.preparing", defaultMessage: "Preparing to upload" };
    case "photo-pending":
      return {
        id: "app.uploads.state.photoPending",
        defaultMessage: "A photo is still converting",
      };
    case "photo-needs-attention":
      return {
        id: "app.uploads.state.photoNeedsAttention",
        defaultMessage: "A photo couldn't be converted",
      };
    case "blocked":
      return blockedReasonMessage(blockedReason);
    default:
      return undefined;
  }
}

/**
 * The one sentence that says where queued work stands and what happens next.
 * The work detail header shows it; its footer carries only the actions, so the
 * two can never repeat or contradict each other.
 */
export function queuedWorkExplanation(
  state: QueuedWorkState,
  { isOnline, sendFailed = false }: { isOnline: boolean; sendFailed?: boolean }
): MessageDescriptor {
  const waiting = {
    id: "app.home.work.offlineInfo",
    defaultMessage: "Saved on your device. Upload it here when you're connected.",
  };
  switch (state.submissionState) {
    case "awaiting-confirmation":
      return {
        id: "app.work.confirmationExplanation",
        defaultMessage: "Your work was sent. We will check its status automatically when online.",
      };
    case "checking-submission":
      return {
        id: "app.work.checkingSubmissionInfo",
        defaultMessage: "We’re checking whether this work was sent. Your media stays saved.",
      };
    case "reverted":
      return CONFIRMATION_FAILED;
    case "retry-required":
      return UPLOAD_FAILED;
    // Only an observed send says so: offline, nothing is being sent.
    case "sending":
      return isOnline ? UPLOADING_NOW : waiting;
    default:
      if (sendFailed) return UPLOAD_FAILED;
      return queuedWorkDetailMessage(state) ?? waiting;
  }
}
