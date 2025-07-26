import React from "react";
import { useIntl } from "react-intl";
import { useOfflineDisplayPriority, useOfflineStore } from "@/stores/offlineStore";
import { cn } from "@/utils/cn";
import { SyncErrorBoundary } from "@/components/UI/ErrorBoundary/SyncErrorBoundary";

interface OfflineIndicatorProps {
  className?: string;
}

// Fallback OfflineIndicator that works even if the store has issues
const FallbackOfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const isOnline = navigator.onLine;

  if (isOnline) {
    return null; // Don't show anything when online
  }

  return (
    <div
      data-testid="offline-indicator"
      className={cn(
        "fixed top-0 left-0 right-0 z-[20000] px-4 py-2 text-center text-sm font-medium",
        "bg-gray-500 text-white",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Offline status notification"
    >
      <div data-testid="status-text">📶 Offline</div>
    </div>
  );
};

const OfflineIndicatorInner: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const intl = useIntl();

  // Use a try-catch to safely access the store
  let displayPriority: string | null = null;
  let conflictCount = 0;
  let pendingCount = 0;

  try {
    displayPriority = useOfflineDisplayPriority();
    const storeData = useOfflineStore((state) => ({
      conflictCount: state.conflictCount,
      pendingCount: state.pendingCount,
    }));
    conflictCount = storeData.conflictCount;
    pendingCount = storeData.pendingCount;
  } catch (error) {
    // If the store has issues, just show nothing or fall back to basic online/offline
    console.warn("OfflineIndicator store access failed:", error);
    return <FallbackOfflineIndicator className={className} />;
  }

  // Don't render if nothing to show
  if (!displayPriority) {
    return null;
  }

  const getStatusInfo = () => {
    switch (displayPriority) {
      case "conflicts":
        return {
          text: `⚠️ ${conflictCount} conflict${conflictCount > 1 ? "s" : ""} need resolution`,
          bgColor: "bg-red-500",
          textColor: "text-white",
        };
      case "cleanup":
        return {
          text: "🗄️ Storage cleanup needed",
          bgColor: "bg-yellow-500",
          textColor: "text-white",
        };
      case "syncing":
        return {
          text: "🔄 Syncing...",
          bgColor: "bg-blue-500",
          textColor: "text-white",
        };
      case "offline":
        return {
          text: "📶 Offline",
          bgColor: "bg-gray-500",
          textColor: "text-white",
        };
      case "pending":
        return {
          text: `✅ ${pendingCount} item${pendingCount > 1 ? "s" : ""} pending sync`,
          bgColor: "bg-green-500",
          textColor: "text-white",
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  return (
    <div
      data-testid="offline-indicator"
      className={cn(
        "fixed top-0 left-0 right-0 z-[20000] px-4 py-2 text-center text-sm font-medium",
        statusInfo.bgColor,
        statusInfo.textColor,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Sync status notification"
    >
      <div data-testid="status-text">{statusInfo.text}</div>
      {displayPriority === "conflicts" && (
        <div data-testid="conflicts-count" className="sr-only">
          {conflictCount}
        </div>
      )}
    </div>
  );
};

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = (props) => {
  return (
    <SyncErrorBoundary fallback={<FallbackOfflineIndicator {...props} />}>
      <OfflineIndicatorInner {...props} />
    </SyncErrorBoundary>
  );
};
