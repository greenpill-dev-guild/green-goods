import { type PendingCommitmentCreation, StatusBadge } from "@green-goods/shared";
import { RiDeleteBinLine, RiRefreshLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface PendingCreationRowProps {
  creation: PendingCommitmentCreation;
  isBusy: boolean;
  onRetry: (jobId: string) => void;
  onDiscard: (jobId: string) => void;
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
}: PendingCreationRowProps) {
  const { formatMessage } = useIntl();
  const units =
    creation.unitLabel && creation.targetUnits
      ? formatMessage(
          { id: "app.commitments.row.units" },
          { count: creation.targetUnits, unit: creation.unitLabel }
        )
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
        </div>
        <StatusBadge size="sm" variant={tone}>
          {formatMessage({ id: chipId })}
        </StatusBadge>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onDiscard(creation.jobId)}
            disabled={isBusy}
            className="flex items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 py-2 text-xs font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
          >
            <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "app.pool.queued.discard" })}
          </button>
          <button
            type="button"
            onClick={() => onRetry(creation.jobId)}
            disabled={isBusy}
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
