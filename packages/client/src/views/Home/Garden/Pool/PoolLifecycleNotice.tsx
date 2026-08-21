import { Alert, type CommitmentPoolRecord } from "@green-goods/shared";
import { RiLeafLine, RiPlantLine, RiTimeLine } from "@remixicon/react";
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

  if (inline) {
    return (
      <Alert variant="warning" className="p-3">
        {formatMessage({ id: "app.pool.state.paused.body" })}
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
