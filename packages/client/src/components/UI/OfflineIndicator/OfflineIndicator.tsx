import React from "react";
import { RiWifiOffLine, RiRefreshLine, RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { cn } from "@/utils/cn";
import { useOffline } from "@/utils/useOffline";

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const intl = useIntl();
  const { isOnline, pendingCount, syncStatus } = useOffline();

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0 && syncStatus === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-50 rounded-lg p-3 shadow-lg",
        !isOnline ? "bg-warning-base text-white" : "bg-primary-base text-white",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <RiWifiOffLine className="h-5 w-5" />
              <span className="text-sm font-medium">
                {intl.formatMessage({
                  id: "app.offline.workingOffline",
                  defaultMessage: "Working offline",
                })}
              </span>
            </>
          ) : syncStatus === "syncing" ? (
            <>
              <RiRefreshLine className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">
                {intl.formatMessage({
                  id: "app.offline.syncing",
                  defaultMessage: "Syncing...",
                })}
              </span>
            </>
          ) : (
            <>
              <RiCheckLine className="h-5 w-5" />
              <span className="text-sm font-medium">
                {intl.formatMessage({
                  id: "app.offline.synced",
                  defaultMessage: "All synced",
                })}
              </span>
            </>
          )}
        </div>
        {pendingCount > 0 && (
          <span className="text-sm">
            {intl.formatMessage(
              {
                id: "app.offline.pendingItems",
                defaultMessage: "{count} pending",
              },
              { count: pendingCount }
            )}
          </span>
        )}
      </div>
    </div>
  );
};
