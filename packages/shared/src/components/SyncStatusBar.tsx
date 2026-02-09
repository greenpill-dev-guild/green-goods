import { RiLoader4Line, RiUploadCloud2Line, RiWifiOffLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { useAuth, useBatchWorkSync, useOffline, usePendingWorksCount } from "../hooks";
import { useQueueFlush } from "../providers/JobQueue";
import { useUIStore } from "../stores/useUIStore";
import { cn } from "../utils/styles/cn";

interface SyncStatusBarProps {
  className?: string;
}

/**
 * Persistent queue sync status bar shown above the app navigation.
 */
export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ className }) => {
  const intl = useIntl();
  const { authMode } = useAuth();
  const { isOnline } = useOffline();
  const { data: pendingWorksCount = 0 } = usePendingWorksCount();
  const { isOfflineBannerVisible } = useUIStore();
  const flushQueue = useQueueFlush();
  const batchWorkSync = useBatchWorkSync();

  const pendingCount = pendingWorksCount;
  const isWalletUser = authMode === "wallet";
  const isSyncing = batchWorkSync.isPending;

  if (!isOfflineBannerVisible || pendingCount === 0) {
    return null;
  }

  const handleSyncAll = async () => {
    if (!isOnline || isSyncing) return;
    if (isWalletUser) {
      await batchWorkSync.mutateAsync();
      return;
    }
    await flushQueue();
  };

  const statusLabel = !isOnline
    ? intl.formatMessage(
        {
          id: "app.syncBar.pendingOffline",
          defaultMessage: "Offline: {count} items waiting to sync",
        },
        { count: pendingCount }
      )
    : isSyncing
      ? intl.formatMessage(
          {
            id: "app.syncBar.syncing",
            defaultMessage: "Syncing {count} items...",
          },
          { count: pendingCount }
        )
      : intl.formatMessage(
          {
            id: "app.syncBar.pendingOnline",
            defaultMessage: "{count} items waiting to sync",
          },
          { count: pendingCount }
        );

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 h-8 border-t border-stroke-soft-200 bg-bg-white-0/95 backdrop-blur supports-[backdrop-filter]:bg-bg-white-0/80",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex h-full w-full max-w-screen-md items-center justify-between px-3">
        <div className="flex items-center gap-2 text-xs text-text-sub-600">
          {isSyncing ? (
            <RiLoader4Line className="h-3.5 w-3.5 animate-spin text-information-base" />
          ) : !isOnline ? (
            <RiWifiOffLine className="h-3.5 w-3.5 text-warning-base" />
          ) : (
            <RiUploadCloud2Line className="h-3.5 w-3.5 text-information-base" />
          )}
          <span className="truncate">{statusLabel}</span>
        </div>

        {isWalletUser && (
          <button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={!isOnline || isSyncing}
            className="text-xs font-medium text-primary disabled:text-text-soft-400"
          >
            {!isOnline
              ? intl.formatMessage({
                  id: "app.syncBar.reconnect",
                  defaultMessage: "Reconnect to sync",
                })
              : intl.formatMessage(
                  {
                    id: "app.syncBar.syncAll",
                    defaultMessage: "Sync All ({count})",
                  },
                  { count: pendingCount }
                )}
          </button>
        )}
      </div>
    </div>
  );
};
