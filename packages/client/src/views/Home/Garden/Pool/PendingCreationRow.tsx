import { cn } from "@green-goods/shared/utils/styles/cn";
import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { type PendingCommitmentCreation } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { RiDeleteBinLine, RiRefreshLine, RiSeedlingLine, RiSendPlaneLine } from "@remixicon/react";
import { useIntl } from "react-intl";

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
  chipId: string;
  noteId: string;
  noteValues?: Record<string, string>;
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
  if (creation.failed) {
    return {
      chipId: "app.commitments.row.sendFailed",
      noteId: "app.pool.queued.failedNote",
      actId: "app.pool.queued.retry",
    };
  }
  if (sendsFromTap && creation.hasRecordedSend) {
    return {
      chipId: "app.commitment.queue.notice.checking.title",
      noteId: "app.commitment.queue.notice.checking.body",
      actId: "app.commitment.queue.checkAgain",
    };
  }
  if (creation.waitingForMembership) {
    return {
      chipId: "app.pool.queued.waitingMembership",
      noteId: sendsFromTap
        ? "app.pool.queued.waitingMembershipNoteUnsent"
        : "app.pool.queued.waitingMembershipNote",
      actId: sendsFromTap ? SEND_NOW : null,
    };
  }
  if (sendsFromTap) {
    return {
      chipId: "app.pool.queued.notSent",
      noteId: creation.sendFailure?.messageId ?? "app.pool.queued.notSentNote",
      noteValues: creation.sendFailure?.values,
      actId: SEND_NOW,
    };
  }
  return { chipId: "app.pool.queued.waiting", noteId: "app.pool.queued.waitingNote", actId: null };
}

/**
 * A commitment composed on this phone that has not reached the chain.
 *
 * It rides the top of the pool's list in the same row grammar as the indexed
 * ones, so landing back on the pool with the thing visible is the
 * confirmation. Three casts: waiting to send, waiting for the member's garden
 * hat (which spends no retries), and given up, where retry and discard are
 * the member's explicit choice and nothing is ever dropped silently.
 *
 * A reader who sends from their own tap has no background flush, so for them a
 * creation that has not gone reads as not sent, with Send Now and Discard, and
 * one whose send is on record can only be checked again.
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
  const tone = creation.failed ? "error" : "warning";

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-dashed border-stroke-soft-200 bg-bg-white-0 p-3"
      data-component="PendingCreationRow"
      data-failed={creation.failed ? "true" : "false"}
      data-waiting-membership={creation.waitingForMembership ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-weak-50 text-text-sub-600"
          aria-hidden="true"
        >
          <RiSeedlingLine className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-strong-950" title={primary}>
            {primary}
          </p>
          {creation.title && units ? (
            <p className="mt-0.5 truncate text-xs text-text-sub-600">{units}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-text-soft-400">
            {formatMessage({
              id:
                creation.direction === "REQUEST"
                  ? "app.commitments.direction.request"
                  : "app.commitments.direction.offer",
            })}
          </p>
          {/* Under the words, as on the indexed rows, so the title keeps its width. */}
          <div className="mt-2">
            <StatusBadge size="sm" variant={tone}>
              {formatMessage({ id: copy.chipId })}
            </StatusBadge>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-text-sub-600">
        {formatMessage({ id: copy.noteId }, copy.noteValues)}
      </p>
      {copy.actId ? (
        <div
          className={cn(
            "mt-3 grid gap-2",
            creation.discardable && !discardOnly ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {/* A creation whose transaction was already sent keeps its record: retry
              can still find the commitment, while throwing it away would file a
              second one. Only the safe case is offered a way to delete. */}
          {creation.discardable ? (
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              onClick={() => onDiscard(creation.jobId)}
              disabled={isBusy}
              leadingIcon={<RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />}
            >
              {formatMessage({ id: "app.pool.queued.discard" })}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => onRetry(creation.jobId)}
            disabled={isBusy}
            hidden={discardOnly}
            leadingIcon={
              copy.actId === SEND_NOW ? (
                <RiSendPlaneLine className="h-4 w-4" aria-hidden="true" />
              ) : (
                <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
              )
            }
          >
            {formatMessage({ id: copy.actId })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
