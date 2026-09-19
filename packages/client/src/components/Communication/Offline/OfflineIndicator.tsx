import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  useConnectivityStatus,
  useOnlineStatus,
} from "@green-goods/shared/hooks/app/useOnlineStatus";
import { RiCheckLine, RiCloudOffLine } from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";

interface OfflineIndicatorProps {
  className?: string;
  forceShow?: boolean;
  testState?: IndicatorState;
}

type IndicatorState = "offline" | "degraded" | "back-online" | null;

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  forceShow = false,
  testState,
}) => {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const connection = useConnectivityStatus();

  // State for tracking "back online" message
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(!isOnline);

  // Handle online/offline transitions
  useEffect(() => {
    if (!isOnline) {
      setShowBackOnline(false);
      setWasOffline(true);
      return;
    }

    if (!wasOffline) return;

    setShowBackOnline(true);
    const timer = setTimeout(() => {
      setShowBackOnline(false);
      setWasOffline(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isOnline, wasOffline]);

  // Display priority: offline > degraded > back-online.
  const displayPriority = useMemo((): IndicatorState => {
    if (testState !== undefined) return testState;

    if (!isOnline) return "offline";
    if (connection.state === "degraded") return "degraded";
    if (showBackOnline) return "back-online";

    if (forceShow) return "offline";
    return null;
  }, [connection.state, isOnline, showBackOnline, testState, forceShow]);

  const renderIndicator = useCallback(() => {
    const baseBarClasses =
      "w-full flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium transition-all duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)] backdrop-blur-md shadow-sm";

    switch (displayPriority) {
      case "degraded":
        return (
          <div
            className={`${baseBarClasses} bg-bg-strong-950/95 text-text-white-0 pointer-events-auto`}
            role="status"
            aria-live="polite"
          >
            <RiCloudOffLine size={12} aria-hidden="true" />
            <span>
              {formatMessage({
                id: "app.offline.degraded",
                defaultMessage: "Connection unstable",
              })}
            </span>
          </div>
        );
      case "offline":
        return (
          <div
            className={`${baseBarClasses} bg-bg-strong-950/95 text-text-white-0 pointer-events-auto`}
            role="status"
            aria-live="polite"
            aria-label={formatMessage({
              id: "app.offline.label",
              defaultMessage: "App is in offline mode",
            })}
          >
            <RiCloudOffLine size={8} aria-hidden="true" />
            <span>{formatMessage({ id: "app.offline.mode", defaultMessage: "Offline Mode" })}</span>
          </div>
        );

      case "back-online":
        return (
          <div
            className={`${baseBarClasses} bg-primary-action/95 text-primary-action-foreground pointer-events-auto pulse-success`}
            role="status"
            aria-live="polite"
            aria-label={formatMessage({
              id: "app.offline.backOnlineLabel",
              defaultMessage: "App is back online",
            })}
          >
            <RiCheckLine size={10} aria-hidden="true" />
            <span>
              {formatMessage({ id: "app.offline.backOnline", defaultMessage: "Back Online" })}
            </span>
          </div>
        );

      default:
        return null;
    }
  }, [displayPriority, formatMessage]);

  const containerClasses = cn(
    "vt-offline-banner fixed top-0 left-0 right-0 z-nav transition-all duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] pointer-events-none",
    displayPriority ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
    className
  );

  return (
    <div
      className={containerClasses}
      style={{ top: "env(safe-area-inset-top, 0px)", zIndex: "calc(var(--z-nav, 30) + 1)" }}
      data-testid="offline-indicator"
    >
      {renderIndicator()}
    </div>
  );
};
