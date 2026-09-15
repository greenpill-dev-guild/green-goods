import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useApp } from "@green-goods/shared/providers/App";
import {
  useConnectivityStatus,
  useOnlineStatus,
} from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  RiCheckLine,
  RiCloseLine,
  RiCloudOffLine,
  RiDownloadLine,
  RiUserLine,
} from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";

interface OfflineIndicatorProps {
  className?: string;
  forceShow?: boolean;
  testState?: IndicatorState;
}

type IndicatorState = "offline" | "unavailable" | "checking" | "back-online" | "install" | null;

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  forceShow = false,
  testState,
}) => {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const connection = useConnectivityStatus();
  const { isMobile, isInstalled } = useApp();

  // State for tracking "back online" message
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(!isOnline);
  // Allow user to dismiss install banner for this session
  const [installDismissed, setInstallDismissed] = useState(false);

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

  // Display priority: offline > back-online > install nudge
  const displayPriority = useMemo((): IndicatorState => {
    if (testState !== undefined) return testState;

    if (connection.state === "checking") return "checking";
    if (connection.state === "unavailable") return "unavailable";
    if (!isOnline) return "offline";
    if (showBackOnline) return "back-online";

    // Install nudge: mobile web (not installed) and not dismissed
    if (isMobile && !isInstalled && !installDismissed) return "install";

    if (forceShow) return "offline";
    return null;
  }, [
    connection.state,
    isOnline,
    showBackOnline,
    testState,
    forceShow,
    isMobile,
    isInstalled,
    installDismissed,
  ]);

  const renderIndicator = useCallback(() => {
    const baseBarClasses =
      "w-full flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium transition-all duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)] backdrop-blur-md shadow-sm";

    switch (displayPriority) {
      case "checking":
      case "unavailable":
        return (
          <div
            className={`${baseBarClasses} bg-bg-strong-950/95 text-text-white-0 pointer-events-auto`}
            role="status"
            aria-live="polite"
          >
            <RiCloudOffLine size={12} aria-hidden="true" />
            <span>
              {displayPriority === "checking"
                ? formatMessage({
                    id: "app.offline.checking",
                    defaultMessage: "Checking connection…",
                  })
                : formatMessage({
                    id: "app.offline.unavailable",
                    defaultMessage: "Connection unavailable. Your work stays saved.",
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

      case "install":
        return (
          <div
            className={`${baseBarClasses} overflow-y-clip bg-bg-white-0/95 text-text-strong-950 border-b border-stroke-soft-200 pointer-events-auto`}
            role="status"
          >
            <RiDownloadLine size={10} className="text-primary" aria-hidden="true" />
            <span className="text-[10px]">
              {formatMessage({
                id: "app.offline.installPrompt",
                defaultMessage: "Install for full experience.",
              })}
            </span>
            {/* The strip sits in the 24px the page headers leave at the top, so it is thinner than
                its compact actions. The negative margins keep it thin, and the vertical clip stops
                their boxes and hit areas from covering the header controls beneath. */}
            <Button
              type="button"
              emphasis="tertiary"
              size="compact"
              onClick={() => navigate(APP_ROUTES.profile, { viewTransition: true })}
              leadingIcon={<RiUserLine className="h-3 w-3" aria-hidden="true" />}
              className="-my-2 text-[10px]"
            >
              {formatMessage({
                id: "app.offline.installPromptProfile",
                defaultMessage: "Profile",
              })}
            </Button>
            <IconButton
              size="compact"
              onClick={() => setInstallDismissed(true)}
              className="-my-2"
              aria-label={formatMessage({
                id: "app.offline.installPromptDismiss",
                defaultMessage: "Dismiss",
              })}
              icon={<RiCloseLine aria-hidden="true" />}
            />
          </div>
        );

      default:
        return null;
    }
  }, [displayPriority, navigate, formatMessage]);

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
