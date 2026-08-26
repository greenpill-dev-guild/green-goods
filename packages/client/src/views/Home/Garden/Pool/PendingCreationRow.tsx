import { cn } from "@green-goods/shared/utils/styles/cn";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { type PendingCommitmentCreation } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { RiDeleteBinLine, RiRefreshLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface PendingCreationRowProps {
  creation: PendingCommitmentCreation;
  isBusy: boolean;
  onRetry: (jobId: string) => void;
  onDiscard: (jobId: string) => void;
  /** The pool can no longer take it, so trying again is not an option. */
  discardOnly?: boolean;
}

/**
 * A commitment composed on this phone that has not reached the chain.
 *
 * It rides the top of the pool's list in the same row grammar as the indexed
 * ones, so landing back on the pool with the thing visible is the
 * confirmation. Three casts: waiting to send, waiting for the member's garden
 * hat (which spends no retries), and given up, where retry and discard are
 * the member's explicit choice and nothing is ever dropped silently.
 */
export function PendingCreationRow({
  creation,
  isBusy,
  onRetry,
  onDiscard,
  discardOnly = false,
}: PendingCreationRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const units =
    creation.unitLabel && creation.targetUnits
      ? formatCommitmentUnits(intl, creation.targetUnits, creation.unitLabel)
      : null;
  const primary = creation.title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const chipId = creation.failed
    ? "app.commitments.row.sendFailed"
    : creation.waitingForMembership
      ? "app.pool.queued.waitingMembership"
      : "app.pool.queued.waiting";
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
              {formatMessage({ id: chipId })}
            </StatusBadge>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-text-sub-600">
        {formatMessage({
          id: creation.failed
            ? "app.pool.queued.failedNote"
            : creation.waitingForMembership
              ? "app.pool.queued.waitingMembershipNote"
              : "app.pool.queued.waitingNote",
        })}
      </p>
      {creation.failed ? (
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
            <button
              type="button"
              onClick={() => onDiscard(creation.jobId)}
              disabled={isBusy}
              className="flex items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 py-2 text-xs font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
            >
              <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.queued.discard" })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onRetry(creation.jobId)}
            disabled={isBusy}
            hidden={discardOnly}
            className="flex items-center justify-center gap-1 rounded-[var(--radius-lg)] bg-primary-action px-3 py-2 text-xs font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
          >
            <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "app.pool.queued.retry" })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
