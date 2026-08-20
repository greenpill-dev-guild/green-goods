import { Alert, cn, type CommitmentPoolingAvailability } from "@green-goods/shared";
import { RiInboxLine, RiPlantLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

import { EmptyState } from "@/components/Communication";

/**
 * Each tab reads from its own source, so each says its own recovery words. A
 * saved-details link that renders "couldn't load your commitments" over a
 * different tab's list is the bug this shape prevents.
 */
export interface TabCopy {
  /** Shown while the tab is still finding out. */
  loadingId: string;
  /** Shown when the read failed. */
  errorId: string;
  /** Shown when the tab is genuinely empty. */
  emptyTitleId: string;
  emptyDescriptionId: string;
  /** Optional way in from the empty state. */
  emptyAction?: React.ReactNode;
}

function Region({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

export interface CommitmentStateLadderProps {
  availability: CommitmentPoolingAvailability;
  isLoading: boolean;
  isError: boolean;
  isOnline: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  copy: TabCopy;
  /** The host surface's own scroll region. A drawer and a garden tab differ. */
  regionClassName?: string;
  children: React.ReactNode;
}

/**
 * The order is the honest one and must not be reshuffled.
 *
 * Availability comes first because an unreachable data layer is not an empty
 * one: telling someone their gardens hold nothing, when the app simply cannot
 * see yet, claims an absence it cannot prove. Offline is checked before empty
 * for the same reason.
 */
export function CommitmentStateLadder({
  availability,
  isLoading,
  isError,
  isOnline,
  isEmpty,
  onRetry,
  copy,
  regionClassName,
  children,
}: CommitmentStateLadderProps) {
  const { formatMessage } = useIntl();

  if (availability.status !== "available") {
    return (
      <Region className={regionClassName}>
        <EmptyState
          icon={<RiPlantLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      </Region>
    );
  }

  if (isLoading) {
    return (
      <Region className={regionClassName}>
        <div className="space-y-2.5" role="status">
          <p className="text-xs text-text-soft-400">{formatMessage({ id: copy.loadingId })}</p>
          <div className="space-y-2.5 animate-pulse" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-[var(--radius-md)] bg-bg-weak-50" />
                <div className="h-3 flex-1 rounded bg-bg-weak-50" />
                <div className="h-3 w-16 rounded bg-bg-weak-50" />
              </div>
            ))}
          </div>
        </div>
      </Region>
    );
  }

  if (isError) {
    return (
      <Region className={regionClassName}>
        <Alert variant="error" className="p-3">
          {formatMessage({ id: copy.errorId })}
        </Alert>
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm font-medium text-text-strong-950 tap-target-lg"
        >
          <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
          {formatMessage({ id: "app.commitments.retry" })}
        </button>
      </Region>
    );
  }

  if (isEmpty) {
    return (
      <Region className={regionClassName}>
        {!isOnline ? (
          <EmptyState
            icon={<RiWifiOffLine />}
            title={formatMessage({ id: "app.commitments.offline.title" })}
            description={formatMessage({ id: "app.commitments.offline.description" })}
          />
        ) : (
          <EmptyState
            icon={<RiInboxLine />}
            title={formatMessage({ id: copy.emptyTitleId })}
            description={formatMessage({ id: copy.emptyDescriptionId })}
            action={copy.emptyAction}
          />
        )}
      </Region>
    );
  }

  return <Region className={regionClassName}>{children}</Region>;
}
