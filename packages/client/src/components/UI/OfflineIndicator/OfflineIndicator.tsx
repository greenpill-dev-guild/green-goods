import { RiCloudLine, RiCloudOffLine, RiLoader4Line } from "@remixicon/react";
import React, { useCallback, useRef, useState } from "react";
import { useOffline } from "@/hooks/useOffline";
import { cn } from "@/utils/cn";
import { WorkDashboard } from "../WorkDashboard";

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const [showDashboard, setShowDashboard] = useState(false);

  // Get data directly from hooks
  const { isOnline, pendingCount, syncStatus } = useOffline();

  // Determine display priority based on current state (removed storage cleanup priority)
  const getDisplayPriority = useCallback(() => {
    if (syncStatus === "syncing") return "syncing";
    if (!isOnline) return "offline";
    if (pendingCount > 0) return "pending";
    return null;
  }, [syncStatus, isOnline, pendingCount]);

  const displayPriority = getDisplayPriority();

  // Render the indicator based on priority (removed cleanup case)
  const renderIndicator = () => {
    switch (displayPriority) {
      case "syncing":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            <RiLoader4Line size={16} className="animate-spin" />
            <span>Syncing...</span>
          </div>
        );

      case "offline":
        return (
          <button
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <RiCloudOffLine size={16} />
            <span>Offline</span>
          </button>
        );

      case "pending":
        return (
          <button
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full text-sm font-medium hover:bg-yellow-100 transition-colors"
          >
            <RiCloudLine size={16} />
            <span>{pendingCount} pending</span>
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className={cn("", className)}>{renderIndicator()}</div>

      {/* Work Dashboard Modal */}
      {showDashboard && <WorkDashboard onClose={() => setShowDashboard(false)} />}
    </>
  );
};
