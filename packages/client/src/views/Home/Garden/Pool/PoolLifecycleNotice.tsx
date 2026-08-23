import { Alert } from "@green-goods/shared";
import {
  type CommitmentPoolRecord,
  isResolvableMetadataCID,
  useCommitmentReason,
} from "@green-goods/shared/commitment-pooling";
import {
  RiCheckboxBlankCircleLine,
  RiCheckboxCircleFill,
  RiLeafLine,
  RiPlantLine,
  RiTimeLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

import { EmptyState } from "@/components/Communication";

export interface PoolLifecycleNoticeProps {
  pool: CommitmentPoolRecord;
  /** Rendered above a still-browsable list rather than in place of it. */
  inline?: boolean;
}

/**
 * What a pool says when it is not open.
 *
 * Each state keeps its own consequence on screen rather than collapsing into a
 * single "unavailable": a paused pool resumes and loses nothing, a closed one
 * keeps its history, and a composted one can be reopened by the garden's
 * stewards. Which of those is true changes what a member should do next.
 */
export function PoolLifecycleNotice({ pool, inline = false }: PoolLifecycleNoticeProps) {
  const { formatMessage } = useIntl();
  const state = pool.state ?? "UNKNOWN";
  // The pause reason is a CID the stewards pinned; the member reads the words,
  // or an em dash when they cannot be read.
  const { reason: pauseReason, isLoading: pauseReasonLoading } = useCommitmentReason(
    state === "PAUSED" ? pool.pauseReasonCID : null
  );

  if (inline) {
    const reasonText = pauseReason?.reason ?? (pauseReasonLoading ? null : "—");
    return (
      <Alert variant="warning" className="p-3">
        <span className="block">{formatMessage({ id: "app.pool.state.paused.body" })}</span>
        {reasonText ? (
          <span className="mt-1 block text-xs" data-component="PoolPauseReason">
            {formatMessage({ id: "app.pool.state.paused.reason" }, { reason: reasonText })}
          </span>
        ) : null}
      </Alert>
    );
  }

  const notices: Record<string, { icon: React.ReactNode; key: string }> = {
    NOT_READY: { icon: <RiPlantLine />, key: "notReady" },
    READY: { icon: <RiTimeLine />, key: "ready" },
    CLOSED: { icon: <RiLeafLine />, key: "closed" },
    COMPOSTED: { icon: <RiLeafLine />, key: "composted" },
  };
  const notice = notices[state] ?? { icon: <RiPlantLine />, key: "unknown" };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        <EmptyState
          icon={notice.icon}
          title={formatMessage({ id: `app.pool.state.${notice.key}.title` })}
          description={formatMessage({ id: `app.pool.state.${notice.key}.body` })}
        />
        {state === "NOT_READY" ? (
          // What a pool needs before it takes anything, in the words the
          // stewards' own setup uses. A qualifying starting assessment is also
          // required on chain, but the app has no selector for it yet, so the
          // list does not claim to know.
          <ul
            className="space-y-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
            aria-label={formatMessage({ id: "app.pool.readiness.title" })}
            data-component="PoolReadinessChecklist"
          >
            <ReadinessRow
              done={isResolvableMetadataCID(pool.charterCID)}
              label={formatMessage({ id: "app.pool.readiness.charter" })}
            />
            <ReadinessRow
              done={pool.providerOpenCommitmentCap > 0n}
              label={formatMessage({ id: "app.pool.readiness.cap" })}
            />
          </ul>
        ) : null}
        {state === "CLOSED" || state === "COMPOSTED" ? (
          <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
            <h4 className="text-sm font-medium text-text-strong-950">
              {formatMessage({ id: "app.pool.lifetime.title" })}
            </h4>
            <p className="mt-1 text-sm text-text-sub-600">
              {formatMessage(
                { id: "app.pool.lifetime.counts" },
                {
                  made: Number(pool.commitmentsDue),
                  kept: Number(pool.commitmentsFulfilled),
                }
              )}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ReadinessRow({ done, label }: { done: boolean; label: string }) {
  const { formatMessage } = useIntl();
  return (
    <li className="flex items-center gap-3 text-sm" data-done={done ? "true" : "false"}>
      {done ? (
        <RiCheckboxCircleFill className="h-5 w-5 shrink-0 text-success-base" aria-hidden="true" />
      ) : (
        <RiCheckboxBlankCircleLine
          className="h-5 w-5 shrink-0 text-text-soft-400"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 text-text-strong-950">{label}</span>
      <span className="sr-only">
        {formatMessage({ id: done ? "app.pool.readiness.done" : "app.pool.readiness.todo" })}
      </span>
    </li>
  );
}
