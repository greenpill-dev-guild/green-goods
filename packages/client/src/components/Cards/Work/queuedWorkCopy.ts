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

/** A queued work or decision that Upload all has not sent yet. */
export const WAITING_TO_UPLOAD_MESSAGE = {
  id: "app.uploads.state.waiting",
  defaultMessage: "Waiting to upload",
} satisfies MessageDescriptor;

const NEEDS_ATTENTION = {
  id: "app.uploads.state.needsAttention",
  defaultMessage: "Needs attention",
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
]);

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
      return WAITING_TO_UPLOAD_MESSAGE;
    case "blocked":
    case "photo-needs-attention":
      return NEEDS_ATTENTION;
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
      return { id: "app.work.confirmationFailed" };
    case "sending":
      return { id: "app.home.work.syncingInfo" };
    case "retry-required":
      return { id: "app.work.retryRequiredInfo" };
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
