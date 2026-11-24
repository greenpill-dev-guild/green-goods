import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiTaskLine } from "@remixicon/react";
import React, { lazy, Suspense } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

function importWorkDashboard() {
  return import(".").then((module) => ({ default: module.WorkDashboard }));
}

let workDashboardModulePromise: ReturnType<typeof importWorkDashboard> | null = null;

function loadWorkDashboard() {
  if (workDashboardModulePromise) return workDashboardModulePromise;

  const pendingModule = importWorkDashboard().catch((error) => {
    workDashboardModulePromise = null;
    throw error;
  });
  workDashboardModulePromise = pendingModule;
  return pendingModule;
}

const WorkDashboard = lazy(loadWorkDashboard);

interface WorkDashboardIconProps {
  className?: string;
}

export const WorkDashboardIcon: React.FC<WorkDashboardIconProps> = ({ className }) => {
  const intl = useIntl();
  const isOnline = useOnlineStatus();
  const { count: pendingCount } = useYourWorkCount();
  const [isDashboardReady, setIsDashboardReady] = React.useState(false);
  const isWorkDashboardOpen = useUIStore((s) => s.isWorkDashboardOpen);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const closeWorkDashboard = useUIStore((s) => s.closeWorkDashboard);

  React.useEffect(() => {
    let cancelled = false;
    void loadWorkDashboard().then(
      () => {
        if (!cancelled) setIsDashboardReady(true);
      },
      () => {
        // A reconnect changes isOnline and retries the failed preload.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  // The glyph is green at rest like every launcher's (DL-133); the outline tints while work waits.
  const hasPendingItems = pendingCount > 0;
  const borderColor = hasPendingItems ? pwaStatusStyles.primary.border : undefined;
  const primaryIcon = <RiTaskLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />;

  const badge = hasPendingItems ? (
    <CountBadge count={pendingCount} ring data-testid="notification-badge" />
  ) : undefined;

  return (
    <>
      <IconButton
        emphasis="secondary"
        size="compact"
        onClick={() => openWorkDashboard()}
        disabled={!isDashboardReady}
        aria-busy={!isDashboardReady}
        className={cn(borderColor, className)}
        aria-label={intl.formatMessage({
          id: "app.workDashboard.openButton",
          defaultMessage: "Open Your Work",
        })}
        data-testid="work-dashboard-button"
        icon={primaryIcon}
        badge={badge}
      />

      {/* The launcher is enabled only after this split module is cached locally. */}
      {isWorkDashboardOpen ? (
        <Suspense fallback={null}>
          <WorkDashboard onClose={closeWorkDashboard} />
        </Suspense>
      ) : null}
    </>
  );
};
