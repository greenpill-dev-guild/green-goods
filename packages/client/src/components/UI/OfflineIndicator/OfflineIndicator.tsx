import { cn } from "@green-goods/shared/utils";
import { RiCheckLine, RiCloudOffLine } from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOffline } from "@green-goods/shared/hooks";

interface OfflineIndicatorProps {
  className?: string;
  forceShow?: boolean;
  testState?: "offline" | "back-online" | null;
}

type IndicatorState = "offline" | "back-online" | null;

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  forceShow = false, // Default to true for testing
  testState,
}) => {
  // Get data directly from hooks
  const { isOnline } = useOffline();

  // State for tracking "back online" message
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(!isOnline);

  // Handle online/offline transitions
  useEffect(() => {
    if (wasOffline && isOnline) {
      // Show "back online" message when transitioning from offline to online
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000); // Hide after 3 seconds

      return () => clearTimeout(timer);
    }
    setWasOffline(!isOnline);
  }, [isOnline, wasOffline]);

  // Simplified display logic - only handle offline and back-online states
  const displayPriority = useMemo((): IndicatorState => {
    // For testing purposes, allow override
    if (testState !== undefined) return testState;

    // Show "back online" message if transitioning back online
    if (showBackOnline) return "back-online";

    // Show offline indicator when offline
    if (!isOnline) return "offline";

    // For testing purposes, default to offline state for demonstration
    if (forceShow) return "offline";

    return null;
  }, [isOnline, showBackOnline, testState, forceShow]);

  // Simple offline/online status indicator
  const renderIndicator = useCallback(() => {
    const baseBarClasses =
      "w-full flex items-center justify-center gap-2 px-3 py-0.5 text-[8px] font-medium transition-all duration-300 ease-in-out backdrop-blur-md shadow-sm";

    switch (displayPriority) {
      case "offline":
        return (
          <div
            className={`${baseBarClasses} bg-gray-500/95 text-white pointer-events-auto`}
            role="status"
            aria-live="polite"
            aria-label="App is in offline mode"
          >
            <RiCloudOffLine size={8} aria-hidden="true" />
            <span>Offline Mode</span>
          </div>
        );

      case "back-online":
        return (
          <div
            className={`${baseBarClasses} bg-green-500/95 text-white pointer-events-auto`}
            role="status"
            aria-live="polite"
            aria-label="App is back online"
          >
            <RiCheckLine size={10} aria-hidden="true" />
            <span>Back Online</span>
          </div>
        );

      default:
        return null;
    }
  }, [displayPriority]);

  // Compact top bar container with slide-down animations
  const containerClasses = cn(
    "fixed top-0 left-0 right-0 z-30 transition-all duration-500 ease-out pointer-events-none",
    displayPriority ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
    className
  );

  return <div className={containerClasses}>{renderIndicator()}</div>;
};
