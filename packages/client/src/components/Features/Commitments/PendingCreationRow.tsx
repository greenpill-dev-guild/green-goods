import {
  CommitmentRow,
  type CommitmentRowPending,
} from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { type PendingCommitmentCreation } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { RiDeleteBinLine, RiRefreshLine, RiSendPlaneLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { promiseDueDetail } from "./presentation";

export interface PendingCreationRowProps {
  creation: PendingCommitmentCreation;
  isBusy: boolean;
  onRetry: (jobId: string) => void;
  onDiscard: (jobId: string) => void;
  /** The pool can no longer take it, so trying again is not an option. */
  discardOnly?: boolean;
  /**
   * The reader sends queued creations themselves (a wallet sign-in). Nothing
   * sends this one for them, so the row never says it will: it says why the
   * last send failed, when one did, and offers the send and the discard.
   */
  sendsFromTap?: boolean;
}

interface RowCopy {
  /** The pill: one of the shared queue states, or the queue's own words. */
  pending?: CommitmentRowPending;
  chipId?: string;
  noteId: string;
  noteValues?: Record<string, string>;
  /**
   * Something stops the send as it stands, so the note says what before the units do: the
   * line keeps one row on a phone and drops from its end, and the reader needs the reason
   * before they try again.
   */
  blocked?: boolean;
  /** The act the row offers besides Discard; none while a background flush will send it. */
  actId: string | null;
}

const SEND_NOW = "app.commitment.queue.sendNow";

/**
 * What the row says in each cast. Two belong to a reader who sends from their
 * own tap: a send on record may have landed, so it is only checked again, and
 * a creation that never went waits for their Send Now.
 */
function rowCopy(creation: PendingCommitmentCreation, sendsFromTap: boolean): RowCopy {
  if (creation.settlementDeferred) {
    return {
      chipId: "app.pool.queued.settlementDeferred",
      noteId: "app.pool.queued.settlementDeferredNote",
      blocked: true,
      actId: null,
    };
  }
  if (creation.failed) {
    return {
      pending: "sendFailed",
      noteId: "app.pool.queued.failedNote",
      blocked: true,
      actId: "app.pool.queued.retry",
    };
  }
  if (sendsFromTap && creation.hasRecordedSend) {
    return {
      chipId: "app.commitment.queue.notice.checking.title",
      noteId: "app.commitment.queue.notice.checking.body",
      blocked: true,
      actId: "app.commitment.queue.checkAgain",
    };
  }
  if (creation.waitingForMembership) {
    return {
      chipId: "app.pool.queued.waitingMembership",
      noteId: sendsFromTap
        ? "app.pool.queued.waitingMembershipNoteUnsent"
        : "app.pool.queued.waitingMembershipNote",
      blocked: true,
      actId: sendsFromTap ? SEND_NOW : null,
    };
  }
  if (sendsFromTap) {
    return {
      pending: "notSent",
      noteId: creation.sendFailure?.messageId ?? "app.pool.queued.notSentNote",
      noteValues: creation.sendFailure?.values,
      // Why the last send failed (a wallet on another network) is what to fix first.
      blocked: Boolean(creation.sendFailure),
      actId: SEND_NOW,
    };
  }
  return { chipId: "app.pool.queued.waiting", noteId: "app.pool.queued.waitingNote", actId: null };
}

/**
 * A commitment composed on this phone that has not reached the chain, on the shared
 * commitment row (F7).
 *
 * It rides the top of the pool's list in the same row as the indexed ones, so landing back
 * on the pool with the thing visible is the confirmation. The pill carries the queue's
 * state. It has no page yet, so its units lead the details when its title is not already
 * them, and what the state means for the reader follows, in full on hover. While something
 * stops the send (a failed send, the membership it waits for, a deferred reward, a send that
 * may already have gone) the reason leads instead and the units follow, so a phone keeps it
 * in view. The two ways out sit in the row's right slot, the send rightmost. Three casts:
 * waiting to send, waiting for the member's garden hat (which spends no retries), and given
 * up, where retry and discard are the member's explicit choice and nothing is ever dropped
 * silently.
 *
 * A reader who sends from their own tap has no background flush, so for them a creation
 * that has not gone reads as not sent, with Send Now and Discard, and one whose send is on
 * record can only be checked again.
 */
export function PendingCreationRow({
  creation,
  isBusy,
  onRetry,
  onDiscard,
  discardOnly = false,
  sendsFromTap = false,
}: PendingCreationRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const units =
    creation.unitLabel && creation.targetUnits
      ? formatCommitmentUnits(intl, creation.targetUnits, creation.unitLabel)
      : null;
  const primary = creation.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const copy = rowCopy(creation, sendsFromTap);
  // The line keeps its words whole on hover; on a narrow row the end gives way first.
  const note = formatMessage({ id: copy.noteId }, copy.noteValues);
  // A creation whose transaction was already sent keeps its record: retry can still find
  // the commitment, while throwing it away would file a second one. Only the safe case is
  // offered a way to delete, and only where the row offers an act at all.
  const showActs =
    Boolean(copy.actId) || Boolean(creation.settlementDeferred && creation.discardable);
  const discard =
    showActs && creation.discardable ? (
      <IconButton
        onClick={() => onDiscard(creation.jobId)}
        disabled={isBusy}
        aria-label={formatMessage({ id: "app.pool.queued.discard" })}
        title={formatMessage({ id: "app.pool.queued.discard" })}
        icon={<RiDeleteBinLine aria-hidden="true" />}
      />
    ) : null;
  const send =
    copy.actId && !discardOnly ? (
      <IconButton
        emphasis="primary"
        onClick={() => onRetry(creation.jobId)}
        disabled={isBusy}
        aria-label={formatMessage({ id: copy.actId })}
        title={formatMessage({ id: copy.actId })}
        icon={
          copy.actId === SEND_NOW ? (
            <RiSendPlaneLine aria-hidden="true" />
          ) : (
            <RiRefreshLine aria-hidden="true" />
          )
        }
      />
    ) : null;

  return (
    <CommitmentRow
      data-component="PendingCreationRow"
      data-failed={creation.failed ? "true" : "false"}
      data-waiting-membership={creation.waitingForMembership ? "true" : "false"}
      direction={creation.direction}
      title={primary}
      status={
        copy.chipId ? { label: formatMessage({ id: copy.chipId }), tone: "warning" } : undefined
      }
      pending={copy.pending}
      units={creation.title ? units : null}
      note={note}
      blocked={copy.blocked}
      due={creation.groupDueDate ? promiseDueDetail(intl, BigInt(creation.groupDueDate)) : null}
      action={
        discard || send ? (
          <span className="flex items-center gap-1">
            {discard}
            {send}
          </span>
        ) : undefined
      }
    />
  );
}
