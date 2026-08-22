import { RiRefreshLine, RiSearchLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { EmptyState } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";

export interface CommitmentDetailShellProps {
  children: React.ReactNode;
  onBack: () => void;
  title?: string;
  bar?: React.ReactNode;
}

/**
 * The frame every cast of the detail screen shares: back, the commitment's
 * own heading, a scrolling body, and the fixed bar when there is one.
 */
export function CommitmentDetailShell({
  children,
  onBack,
  title,
  bar,
}: CommitmentDetailShellProps) {
  // TopNav owns the back affordance only; it takes no title of its own, so the
  // commitment names itself in its own heading rather than in a tooltip.
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 pb-24">
          {title ? (
            <h1 className="truncate text-lg font-medium text-text-strong-950" title={title}>
              {title}
            </h1>
          ) : null}
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}

export type CommitmentDetailStateKind = "unavailable" | "notFound" | "loading" | "error";

/**
 * The screen before there is a commitment to show. Each cast says its own
 * thing: a surface that is not ready is not a missing record, and a read that
 * failed is not an empty one.
 */
export function CommitmentDetailState({
  kind,
  onBack,
  onRetry,
}: {
  kind: CommitmentDetailStateKind;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <CommitmentDetailShell onBack={onBack}>
      {kind === "unavailable" ? (
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      ) : kind === "notFound" ? (
        <EmptyState
          icon={<RiSearchLine />}
          title={formatMessage({ id: "app.commitment.notFound.title" })}
          description={formatMessage({ id: "app.commitment.notFound.body" })}
        />
      ) : kind === "loading" ? (
        <div className="space-y-3" role="status">
          <p className="text-xs text-text-soft-400">
            {formatMessage({ id: "app.commitment.loading" })}
          </p>
          <div className="space-y-3 animate-pulse" aria-hidden="true">
            <div className="h-20 rounded-[var(--radius-lg)] bg-bg-weak-50" />
            <div className="h-32 rounded-[var(--radius-lg)] bg-bg-weak-50" />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitment.error.title" })}
          description={formatMessage({ id: "app.commitment.error.body" })}
          action={
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-2 text-sm font-medium text-text-strong-950 tap-target-lg"
            >
              <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.commitments.retry" })}
            </button>
          }
        />
      )}
    </CommitmentDetailShell>
  );
}
