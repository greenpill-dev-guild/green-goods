import { Alert } from "@green-goods/shared/components/Alert";
import { FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { uploadFileToIPFS, uploadJSONToIPFS } from "@green-goods/shared/modules/data/ipfs/upload";
import {
  type Address,
  Confidence,
  type Work,
  type WorkMetadata,
} from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Zod schema for the approval form (Rule 8: RHF + Zod)
// ─────────────────────────────────────────────────────────────

// Approval vs rejection is determined by which button the user clicks,
// so additional validation beyond type constraints happens in the submit handler.
export const workApprovalSchema = z.object({
  confidence: z.nativeEnum(Confidence),
  verificationMethod: z.number(),
  feedback: z.string().optional(),
});

export type WorkApprovalFormData = z.infer<typeof workApprovalSchema>;

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

const NOTICE_TONE = {
  information: {
    box: "border-information-light bg-information-lighter",
    ink: "text-information-dark",
  },
  warning: { box: "border-warning-light bg-warning-lighter/70", ink: "text-warning-dark" },
} as const;

/** Why the review form offers no decision, where a notice says so in place of the form. */
const BLOCKED_NOTICES = {
  // Its decisions could not be read, so it may be decided already.
  "status-unread": {
    tone: "warning",
    // It can appear after the form, once a day's read lands, so it is announced.
    alert: true,
    title: {
      id: "app.work.detail.reviewBlocked.statusUnreadTitle",
      defaultMessage: "Status not known",
    },
    message: {
      id: "app.work.detail.reviewBlocked.statusUnreadMessage",
      defaultMessage:
        "This work's decisions are not read yet, or could not be read, so it may already be decided. Approve and Reject come back once its status is read. Refresh to read it again.",
    },
  },
  "self-review": {
    tone: "information",
    title: {
      id: "app.work.detail.reviewBlocked.selfReviewTitle",
      defaultMessage: "Independent review required",
    },
    message: {
      id: "app.work.detail.reviewBlocked.selfReviewMessage",
      defaultMessage: "You submitted this work. Another garden steward must approve or reject it.",
    },
  },
  expired: {
    tone: "warning",
    title: { id: "app.work.detail.reviewBlocked.expiredTitle", defaultMessage: "Action expired" },
    message: {
      id: "app.work.detail.reviewBlocked.expiredMessage",
      defaultMessage: "This action is no longer active, so new approval decisions are blocked.",
    },
  },
  "role-blocked": {
    tone: "information",
    title: {
      id: "app.work.detail.reviewBlocked.stewardTitle",
      defaultMessage: "Owner or steward access required",
    },
    message: {
      id: "app.work.detail.reviewBlocked.stewardMessage",
      defaultMessage: "Only garden owners or stewards can approve or reject work for this garden.",
    },
  },
} as const;

type BlockedNoticeState = keyof typeof BLOCKED_NOTICES;

export function isBlockedNoticeState(state: string): state is BlockedNoticeState {
  return Object.hasOwn(BLOCKED_NOTICES, state);
}

/** The notice the review form shows in place of a decision it cannot offer. */
export function ReviewBlockedNotice({ state }: { state: BlockedNoticeState }) {
  const { formatMessage } = useIntl();
  const notice = BLOCKED_NOTICES[state];
  const tone = NOTICE_TONE[notice.tone];
  if ("alert" in notice) {
    return (
      <Alert variant={notice.tone} title={formatMessage(notice.title)} className="mt-4">
        {formatMessage(notice.message)}
      </Alert>
    );
  }
  return (
    <div className={`mt-4 rounded-xl border p-4 ${tone.box}`}>
      <p className={`type-body font-medium ${tone.ink}`}>{formatMessage(notice.title)}</p>
      <p className={`mt-1 type-body ${tone.ink}`}>{formatMessage(notice.message)}</p>
    </div>
  );
}

/** What the review form shows. A decision already made, or waiting, outranks who may make one. */
export function reviewFormState(form: {
  isReviewed: boolean;
  /** Its decisions could not be read, so it may be decided already: no new decision yet. */
  isStatusUnread?: boolean;
  isHeld: boolean;
  isStaged: boolean;
  isOwnSubmission: boolean;
  isActionExpired: boolean;
  canReview: boolean;
  canApproveOrReject: boolean;
}) {
  if (form.isReviewed) return "reviewed";
  // A held or staged decision is this steward's own and keeps its controls (check again, move on,
  // take it out), whatever a read can say of the work's status.
  if (form.isHeld) return "held";
  if (form.isStaged) return "staged";
  if (form.isStatusUnread) return "status-unread";
  if (form.isOwnSubmission) return "self-review";
  if (form.isActionExpired) return "expired";
  if (!form.canReview) return "no-permission";
  return form.canApproveOrReject ? "actionable" : "role-blocked";
}

/** Uploads a review's audio note and its envelope, returning the link a decision carries. */
export async function uploadReviewNotes(audio: File, comments: string): Promise<string> {
  // IPFS upload chain: audio file -> IPFS CID -> JSON envelope -> IPFS CID
  const { cid: audioCid } = await uploadFileToIPFS(audio, { source: "WorkDetail.reviewNotes" });
  const { cid } = await uploadJSONToIPFS(
    {
      schemaVersion: "review_notes_v1",
      audioNoteCids: [audioCid],
      reviewerComments: comments,
    },
    { source: "WorkDetail.reviewNotes", metadataType: "review_notes" }
  );
  return cid;
}

/** Pair a resolved label with its stable account address at the point of decision. */
export function ReviewDecisionSubject({
  name,
  address,
  title,
}: {
  name: string;
  address: Address | null;
  title?: string;
}) {
  return (
    <>
      {title && `${title} · `}
      {address ? (
        <>
          <bdi>{name}</bdi>
          {" ("}
          <bdi dir="ltr" className="break-all font-mono">
            {address}
          </bdi>
          {")"}
        </>
      ) : (
        name
      )}
    </>
  );
}

export function ReviewSummary({ work }: { work: Work }) {
  const { formatMessage } = useIntl();
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="type-label-sm text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 type-body font-medium text-text-strong">
          {work.status === "approved"
            ? formatMessage({ id: "app.work.status.approved" })
            : formatMessage({ id: "app.work.status.rejected" })}
        </p>
      </div>
      {work.reviewFeedback ? (
        <div className="rounded-md bg-bg-weak p-3">
          <p className="type-label-sm text-text-soft">
            {formatMessage({
              id: "app.work.detail.reviewFeedback",
              defaultMessage: "Feedback to the gardener",
            })}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words type-body text-text-strong">
            {work.reviewFeedback}
          </p>
        </div>
      ) : null}
      <p className="type-meta text-text-soft">
        {formatMessage({ id: "app.work.detail.alreadyReviewed" })}
      </p>
    </div>
  );
}

export function renderMetadataDetails(metadata: Partial<WorkMetadata>): React.ReactNode {
  const entries: Array<{ label: string; value: string }> = [];

  if (metadata.timeSpentMinutes) {
    entries.push({ label: "Time Spent", value: `${metadata.timeSpentMinutes} min` });
  }

  if (metadata.actionSlug) {
    entries.push({ label: "Action Slug", value: metadata.actionSlug });
  }

  if (metadata.tags && metadata.tags.length > 0) {
    entries.push({ label: "Tags", value: metadata.tags.join(", ") });
  }

  // Render generic details
  if (metadata.details) {
    for (const [key, val] of Object.entries(metadata.details)) {
      if (val !== null && val !== undefined && val !== "") {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        entries.push({
          label,
          value: Array.isArray(val) ? val.join(", ") : String(val),
        });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <FactRow key={entry.label} label={entry.label} value={entry.value} />
      ))}
    </>
  );
}
