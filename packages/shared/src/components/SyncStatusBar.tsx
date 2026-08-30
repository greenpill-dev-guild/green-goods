import { RiLoader4Line, RiUploadCloud2Line, RiWifiOffLine } from "@remixicon/react";
import React, { lazy, Suspense, useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { useOffline } from "../hooks/app/useOffline";
import { useAuth } from "../hooks/auth/useAuth";
import { usePendingWorksCount } from "../hooks/work/usePendingWorksCount";
import { useUIStore } from "../stores/useUIStore";
import { cn } from "../utils/styles/cn";

const SyncStatusBarWalletAction = lazy(() =>
  import("./SyncStatusBarWalletAction").then(({ SyncStatusBarWalletAction }) => ({
    default: SyncStatusBarWalletAction,
  }))
);

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
  const isOfflineBannerVisible = useUIStore((s) => s.isOfflineBannerVisible);
  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncingChange = useCallback((nextIsSyncing: boolean) => {
    setIsSyncing(nextIsSyncing);
  }, []);

  const pendingCount = pendingWorksCount;
  const isWalletUser = authMode === "wallet";

  if (!isOfflineBannerVisible || pendingCount === 0) {
    return null;
  }

  const statusLabel = !isOnline
    ? intl.formatMessage(
        {
          id: "app.syncBar.pendingOffline",
          defaultMessage: "Offline: {count} items waiting to send when you're back online",
        },
        { count: pendingCount }
      )
    : isSyncing
      ? intl.formatMessage(
          {
            id: "app.syncBar.syncing",
            defaultMessage: "Sending {count} items...",
          },
          { count: pendingCount }
        )
      : intl.formatMessage(
          {
            id: "app.syncBar.pendingOnline",
            defaultMessage: "{count} items waiting to send",
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
          <Suspense fallback={null}>
            <SyncStatusBarWalletAction
              isOnline={isOnline}
              pendingCount={pendingCount}
              onSyncingChange={handleSyncingChange}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};
