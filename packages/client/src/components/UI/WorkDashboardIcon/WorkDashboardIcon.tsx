import React, { useState } from "react";
import { RiCloudOffLine, RiDatabase2Line, RiNotification3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { cn } from "@/utils/cn";
import { useConflictResolver, useOffline, useStorageManager } from "@/hooks";
import { OfflineWorkDashboard } from "../OfflineWorkDashboard/OfflineWorkDashboard";
import { defaultStorageManager } from "@/modules/storage-manager";

interface WorkDashboardIconProps {
  className?: string;
}

export const WorkDashboardIcon: React.FC<WorkDashboardIconProps> = ({ className }) => {
  const intl = useIntl();
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const { storageInfo } = useStorageManager();
  const { conflicts } = useConflictResolver();
  const [showDashboard, setShowDashboard] = useState(false);

  // Calculate notification status
  const hasConflicts = conflicts.length > 0;
  const needsStorageCleanup = storageInfo?.needsCleanup || false;
  const isSyncing = syncStatus === "syncing";
  const hasPendingItems = pendingCount > 0;
  const hasOfflineStatus = !isOnline;

  // Determine total notification count
  const totalNotifications =
    conflicts.length + (hasPendingItems ? 1 : 0) + (needsStorageCleanup ? 1 : 0);
  const hasNotifications = totalNotifications > 0 || hasOfflineStatus || isSyncing;

  // Determine primary icon based on status priority
  let primaryIcon: React.ReactNode;
  let iconColor = "text-neutral-600";
  let bgColor = "bg-neutral-50";

  if (hasConflicts) {
    primaryIcon = <RiNotification3Line className="w-5 h-5" />;
    iconColor = "text-red-600";
    bgColor = "bg-red-50 border-red-200";
  } else if (!isOnline) {
    primaryIcon = <RiCloudOffLine className="w-5 h-5" />;
    iconColor = "text-orange-600";
    bgColor = "bg-orange-50 border-orange-200";
  } else if (hasPendingItems || needsStorageCleanup) {
    primaryIcon = <RiDatabase2Line className="w-5 h-5" />;
    iconColor = "text-blue-600";
    bgColor = "bg-blue-50 border-blue-200";
  } else {
    primaryIcon = <RiDatabase2Line className="w-5 h-5" />;
  }

  const handleRetryItem = async (workId: string) => {
    console.log("Retry item:", workId);
    // TODO: Implement actual retry logic with offlineSync
  };

  const handleResolveConflict = async (workId: string, resolution: string) => {
    console.log("Resolve conflict:", workId, resolution);
  };

  const handleStorageCleanup = async () => {
    try {
      const result = await defaultStorageManager.performCleanup();
      if (result) {
        console.log("Storage cleanup completed:", result);
      }
    } catch (error) {
      console.error("Storage cleanup failed:", error);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDashboard(true)}
        className={cn(
          "relative p-2 rounded-lg border border-border transition-all duration-200",
          "hover:bg-neutral-50 active:scale-95 shadow-xs",
          "flex items-center justify-center w-10 h-10",
          hasConflicts
            ? "border-red-200 bg-red-50"
            : !isOnline
              ? "border-orange-200 bg-orange-50"
              : hasPendingItems
                ? "border-blue-200 bg-blue-50"
                : "bg-white",
          iconColor,
          isSyncing && "animate-pulse",
          className
        )}
        aria-label={intl.formatMessage({
          id: "app.workDashboard.openButton",
          defaultMessage: "Open work dashboard",
        })}
        data-testid="work-dashboard-icon"
      >
        <div className={cn("transition-transform", isSyncing && "animate-spin")}>{primaryIcon}</div>

        {/* Notification Badge */}
        {hasNotifications && (
          <div className="absolute -top-1 -right-1">
            {totalNotifications > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center text-xs font-medium text-white rounded-full min-w-[16px] h-4 px-1",
                  hasConflicts ? "bg-red-500" : hasPendingItems ? "bg-primary" : "bg-orange-500"
                )}
                data-testid="notification-badge"
              >
                {totalNotifications > 99 ? "99+" : totalNotifications}
              </span>
            ) : (
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  !isOnline
                    ? "bg-orange-500"
                    : isSyncing
                      ? "bg-primary animate-pulse"
                      : "bg-neutral-400"
                )}
                data-testid="status-dot"
              />
            )}
          </div>
        )}
      </button>

      {/* Dashboard Modal */}
      {showDashboard && (
        <OfflineWorkDashboard
          onClose={() => setShowDashboard(false)}
          onRetryItem={handleRetryItem}
          onResolveConflict={handleResolveConflict}
          onStorageCleanup={handleStorageCleanup}
        />
      )}
    </>
  );
};
