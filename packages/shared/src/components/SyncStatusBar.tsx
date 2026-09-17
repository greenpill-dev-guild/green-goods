import { RiUploadCloud2Line, RiWifiOffLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { useOffline } from "../hooks/app/useOffline";
import { usePendingWorksCount } from "../hooks/work/usePendingWorksCount";
import { useUIStore } from "../stores/useUIStore";
import { cn } from "../utils/styles/cn";
import { Button } from "./Button";

interface SyncStatusBarProps {
  className?: string;
  /** Opens Your Work where Upload all sends the queue; the bar shows no action without it. */
  onReviewUploads?: () => void;
}

/**
 * Persistent bar above the app navigation while queued work waits on this
 * device. Nothing sends on its own: Review uploads opens Your Work, where one
 * tap on Upload all sends it. The bar says whether the device is offline and
 * never narrates an unstable connection (D4-A).
 */
export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ className, onReviewUploads }) => {
  const intl = useIntl();
  const { isOnline } = useOffline();
  const { data: pendingCount = 0 } = usePendingWorksCount();
  const isOfflineBannerVisible = useUIStore((s) => s.isOfflineBannerVisible);

  if (!isOfflineBannerVisible || pendingCount === 0) {
    return null;
  }

  const statusLabel = isOnline
    ? intl.formatMessage(
        {
          id: "app.syncBar.pendingOnline",
          defaultMessage: "{count, plural, one {# item} other {# items}} waiting to upload",
        },
        { count: pendingCount }
      )
    : intl.formatMessage(
        {
          id: "app.syncBar.pendingOffline",
          defaultMessage:
            "Offline: {count, plural, one {# item} other {# items}} saved on this device",
        },
        { count: pendingCount }
      );

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-sticky h-8 border-t border-stroke-soft-200 bg-bg-white-0/95 backdrop-blur supports-[backdrop-filter]:bg-bg-white-0/80",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex h-full w-full max-w-screen-md items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-text-sub-600">
          {isOnline ? (
            <RiUploadCloud2Line
              className="h-3.5 w-3.5 flex-shrink-0 text-information-base"
              aria-hidden="true"
            />
          ) : (
            <RiWifiOffLine
              className="h-3.5 w-3.5 flex-shrink-0 text-warning-base"
              aria-hidden="true"
            />
          )}
          <span className="truncate">{statusLabel}</span>
        </div>

        {onReviewUploads && (
          <Button
            emphasis="tertiary"
            size="compact"
            className="flex-shrink-0"
            onClick={onReviewUploads}
            data-testid="review-uploads"
          >
            {intl.formatMessage({
              id: "app.syncBar.reviewUploads",
              defaultMessage: "Review uploads",
            })}
          </Button>
        )}
      </div>
    </div>
  );
};
