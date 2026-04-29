import { cn, useOffline, useUIStore } from "@green-goods/shared";
import { RiCloudOffLine, RiLoader4Line, RiTaskLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles, type PwaStatusTone } from "@/styles/pwaStatusStyles";
import { WorkDashboard } from ".";

interface WorkDashboardIconProps {
  className?: string;
}

export const WorkDashboardIcon: React.FC<WorkDashboardIconProps> = ({ className }) => {
  const intl = useIntl();
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const isWorkDashboardOpen = useUIStore((s) => s.isWorkDashboardOpen);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const closeWorkDashboard = useUIStore((s) => s.closeWorkDashboard);

  // Only show notifications for actual pending work items
  const isSyncing = syncStatus === "syncing";
  const hasPendingItems = pendingCount > 0;
  const hasOfflineStatus = !isOnline;

  // Determine primary icon and styling based on status priority
  let PrimaryIcon = RiTaskLine;
  let statusTone: PwaStatusTone = hasPendingItems ? "primary" : "neutral";
  const bgColor = "bg-bg-white-0";

  if (isSyncing) {
    PrimaryIcon = RiLoader4Line;
    statusTone = "information";
  } else if (!isOnline) {
    PrimaryIcon = RiCloudOffLine;
    statusTone = "warning";
  }
  const statusStyles = pwaStatusStyles[statusTone];
  const borderColor =
    isSyncing || hasOfflineStatus || hasPendingItems
      ? statusStyles.border
      : pwaStatusStyles.neutral.border;
  const primaryIcon = (
    <PrimaryIcon className={cn("w-4 h-4", statusStyles.icon, isSyncing && "animate-spin")} />
  );

  // Dashboard state and handlers

  return (
    <>
      <button
        onClick={openWorkDashboard}
        className={cn(
          "relative p-1 rounded-lg border",
          "transition-[color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
          "hover:shadow-lg hover:scale-105 active:scale-95",
          "flex items-center justify-center w-8 h-8 tap-target-lg",
          "focus:outline-none focus:ring-2",
          statusStyles.focus,
          bgColor,
          borderColor,
          statusStyles.icon,
          className
        )}
        aria-label={intl.formatMessage({
          id: "app.workDashboard.openButton",
          defaultMessage: "Open work dashboard",
        })}
        data-testid="work-dashboard-button"
      >
        {primaryIcon}

        {/* Only show badge for actual pending items */}
        {hasPendingItems && (
          <div className="absolute -top-1.5 -right-1.5">
            <div
              className={cn(
                "inline-flex items-center justify-center text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1",
                pwaStatusStyles.primary.badge,
                "shadow-sm border-2 border-bg-white-0"
              )}
              data-testid="notification-badge"
            >
              {pendingCount > 99 ? "99+" : pendingCount}
            </div>
          </div>
        )}

        {/* Status indicator dot for offline/syncing without pending items */}
        {(hasOfflineStatus || isSyncing) && !hasPendingItems && (
          <div className="absolute -top-1 -right-1">
            <span
              className={cn(
                "w-3 h-3 rounded-full border-2 border-bg-white-0",
                statusStyles.dot,
                isSyncing && "animate-pulse"
              )}
              data-testid="status-dot"
            />
          </div>
        )}
      </button>

      {/* Dashboard Modal */}
      {isWorkDashboardOpen && <WorkDashboard onClose={closeWorkDashboard} />}
    </>
  );
};
