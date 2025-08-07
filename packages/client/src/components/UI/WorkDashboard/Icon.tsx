import React, { useState } from "react";
import { RiCloudOffLine, RiLoader4Line, RiTaskLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { cn } from "../../../utils/cn";
import { useOffline } from "../../../hooks/useOffline";
import { WorkDashboard } from "./WorkDashboard";

interface WorkDashboardIconProps {
  className?: string;
}

export const WorkDashboardIcon: React.FC<WorkDashboardIconProps> = ({ className }) => {
  const intl = useIntl();
  const { isOnline, pendingCount, syncStatus } = useOffline();
  const [showDashboard, setShowDashboard] = useState(false);

  // Only show notifications for actual pending work items
  const isSyncing = syncStatus === "syncing";
  const hasPendingItems = pendingCount > 0;
  const hasOfflineStatus = !isOnline;

  // Determine primary icon and styling based on status priority
  let primaryIcon: React.ReactNode;
  let iconColor = "text-slate-500";
  let bgColor = "bg-white";
  let borderColor = "border-slate-200";
  let focusActiveColors = "focus:text-slate-700 active:text-slate-700";

  if (isSyncing) {
    primaryIcon = (
      <RiLoader4Line className="w-4 h-4 animate-spin focus:text-blue-700 active:text-blue-700" />
    );
    iconColor = "text-slate-500";
    focusActiveColors = "focus:text-blue-700 active:text-blue-700";
  } else if (!isOnline) {
    primaryIcon = (
      <RiCloudOffLine className="w-4 h-4 focus:text-orange-700 active:text-orange-700" />
    );
    iconColor = "text-slate-500";
    focusActiveColors = "focus:text-orange-700 active:text-orange-700";
  } else if (hasPendingItems) {
    primaryIcon = <RiTaskLine className="w-4 h-4 focus:text-emerald-700 active:text-emerald-700" />;
    iconColor = "text-slate-500";
    focusActiveColors = "focus:text-emerald-700 active:text-emerald-700";
  } else {
    primaryIcon = <RiTaskLine className="w-4 h-4 focus:text-emerald-700 active:text-emerald-700" />;
    iconColor = "text-slate-500";
    focusActiveColors = "focus:text-emerald-700 active:text-emerald-700";
  }

  // Dashboard state and handlers

  return (
    <>
      <button
        onClick={() => setShowDashboard(true)}
        className={cn(
          "relative p-1 rounded-lg border transition-all duration-200",
          "hover:shadow-lg hover:scale-105 active:scale-95",
          "flex items-center justify-center w-8 h-8",
          "focus:outline-none focus:ring-2",
          // Use state-appropriate colors for focus/active only
          isSyncing
            ? "focus:ring-blue-200 focus:border-blue-600 active:border-blue-600"
            : !isOnline
              ? "focus:ring-orange-200 focus:border-orange-600 active:border-orange-600"
              : "focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
          bgColor,
          borderColor,
          iconColor,
          className
        )}
        aria-label={intl.formatMessage({
          id: "app.workDashboard.openButton",
          defaultMessage: "Open work dashboard",
        })}
        data-testid="work-dashboard-icon"
      >
        {primaryIcon}

        {/* Only show badge for actual pending items */}
        {hasPendingItems && (
          <div className="absolute -top-1.5 -right-1.5">
            <div
              className={cn(
                "inline-flex items-center justify-center text-xs font-semibold text-white rounded-full min-w-[18px] h-[18px] px-1",
                "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm border-2 border-white"
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
                "w-3 h-3 rounded-full border-2 border-white",
                !isOnline
                  ? "bg-orange-500"
                  : isSyncing
                    ? "bg-blue-500 animate-pulse"
                    : "bg-gray-400"
              )}
              data-testid="status-dot"
            />
          </div>
        )}
      </button>

      {/* Dashboard Modal */}
      {showDashboard && <WorkDashboard onClose={() => setShowDashboard(false)} />}
    </>
  );
};
