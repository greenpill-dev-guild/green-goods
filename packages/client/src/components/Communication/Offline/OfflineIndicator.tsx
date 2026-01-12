import { useOffline } from "@green-goods/shared/hooks";
import { useApp } from "@green-goods/shared/providers";
import { cn } from "@green-goods/shared/utils";
import { RiCheckLine, RiCloudOffLine, RiDownloadLine, RiUserLine } from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface OfflineIndicatorProps {
  className?: string;
  forceShow?: boolean;
  testState?: "offline" | "back-online" | "install" | null;
}

type IndicatorState = "offline" | "back-online" | "install" | null;

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  forceShow = false,
  testState,
}) => {
  const navigate = useNavigate();
  const { isOnline } = useOffline();
  const { isMobile, isInstalled } = useApp();

  // State for tracking "back online" message
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(!isOnline);
  // Allow user to dismiss install banner for this session
  const [installDismissed, setInstallDismissed] = useState(false);

  // Handle online/offline transitions
  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    setWasOffline(!isOnline);
  }, [isOnline, wasOffline]);

  // Display priority: offline > back-online > install nudge
  const displayPriority = useMemo((): IndicatorState => {
    if (testState !== undefined) return testState;

    if (showBackOnline) return "back-online";
    if (!isOnline) return "offline";

    // Install nudge: mobile web (not installed) and not dismissed
    if (isMobile && !isInstalled && !installDismissed) return "install";

    if (forceShow) return "offline";
    return null;
  }, [isOnline, showBackOnline, testState, forceShow, isMobile, isInstalled, installDismissed]);

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
            className={`${baseBarClasses} bg-green-500/95 text-white pointer-events-auto pulse-success`}
            role="status"
            aria-live="polite"
            aria-label="App is back online"
          >
            <RiCheckLine size={10} aria-hidden="true" />
            <span>Back Online</span>
          </div>
        );

      case "install":
        return (
          <div
            className={`${baseBarClasses} bg-bg-white-0/95 text-text-strong-950 border-b border-stroke-soft-200 pointer-events-auto`}
            role="status"
          >
            <RiDownloadLine size={10} className="text-primary" aria-hidden="true" />
            <span className="text-[10px]">Install for full experience.</span>
            <button
              type="button"
              onClick={() => navigate("/profile", { viewTransition: true })}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-stroke-sub-300 bg-bg-white-0 px-2 py-0.5 text-[10px] hover:bg-bg-weak-50 active:scale-95 transition-transform"
            >
              <RiUserLine className="h-3 w-3" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setInstallDismissed(true)}
              className="ml-1 text-[10px] text-text-sub-600 hover:text-text-strong-950"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );

      default:
        return null;
    }
  }, [displayPriority, navigate]);

  const containerClasses = cn(
    "fixed top-0 left-0 right-0 z-30 transition-all duration-500 ease-out pointer-events-none",
    displayPriority ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
    className
  );

  return (
    <div className={containerClasses} data-testid="offline-indicator">
      {renderIndicator()}
    </div>
  );
};
