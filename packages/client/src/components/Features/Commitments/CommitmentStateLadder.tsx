import { Button } from "@green-goods/shared/components/Button";
import { Alert } from "@green-goods/shared/components/Alert";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type CommitmentPoolingAvailability } from "@green-goods/shared/commitment-pooling";
import { RiInboxLine, RiPlantLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

import { EmptyState } from "@/components/Communication";
import {
  PWA_SHEET_FOCAL_STATE_CLASSNAME,
  PWA_SHEET_STATE_CLASSNAME,
} from "@/components/Pwa/sheetScrollStyles";

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
  /**
   * Something the tab must say even when it holds nothing: a paused pool's
   * notice, for one. Drawn above the empty state rather than lost with the list.
   */
  emptyLead?: React.ReactNode;
}

function Region({
  className,
  children,
  center = false,
  focal = false,
}: {
  className?: string;
  children: React.ReactNode;
  center?: boolean;
  focal?: boolean;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>
      <div
        className={
          focal
            ? PWA_SHEET_FOCAL_STATE_CLASSNAME
            : center
              ? PWA_SHEET_STATE_CLASSNAME
              : "space-y-4 p-4"
        }
      >
        {children}
      </div>
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
      <Region className={regionClassName} focal>
        <EmptyState
          placement="sheet"
          icon={<RiPlantLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      </Region>
    );
  }

  if (isLoading) {
    return (
      <Region className={regionClassName} center>
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
      <Region className={regionClassName} center>
        <Alert variant="error" className="p-3">
          {formatMessage({ id: copy.errorId })}
        </Alert>
        <Button
          type="button"
          emphasis="secondary"
          onClick={onRetry}
          className="w-full"
          leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
        >
          {formatMessage({ id: "app.commitments.retry" })}
        </Button>
      </Region>
    );
  }

  if (isEmpty) {
    return (
      <Region className={regionClassName} focal>
        {copy.emptyLead}
        {!isOnline ? (
          <EmptyState
            placement="sheet"
            icon={<RiWifiOffLine />}
            title={formatMessage({ id: "app.commitments.offline.title" })}
            description={formatMessage({ id: "app.commitments.offline.description" })}
          />
        ) : (
          <EmptyState
            placement="sheet"
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
