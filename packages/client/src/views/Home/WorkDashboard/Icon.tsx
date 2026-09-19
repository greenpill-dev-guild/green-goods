import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { usePendingWorksCount } from "@green-goods/shared/hooks/work/usePendingWorksCount";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiTaskLine } from "@remixicon/react";
import React, { lazy, Suspense } from "react";
import { useIntl } from "react-intl";
import { type PwaStatusTone, pwaStatusStyles } from "@/components/Pwa/statusStyles";

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
  const { data: pendingCount = 0 } = usePendingWorksCount();
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

  // Only show notifications for actual pending work items
  const hasPendingItems = pendingCount > 0;
  const statusTone: PwaStatusTone = hasPendingItems ? "primary" : "neutral";
  const statusStyles = pwaStatusStyles[statusTone];
  const borderColor = hasPendingItems ? statusStyles.border : undefined;
  const primaryIcon = <RiTaskLine className={statusStyles.icon} aria-hidden="true" />;

  let badge: React.ReactNode;
  if (hasPendingItems) {
    badge = (
      <span
        className={cn(
          "inline-flex items-center justify-center text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1",
          pwaStatusStyles.primary.badge,
          "shadow-sm border-2 border-bg-white-0"
        )}
        data-testid="notification-badge"
      >
        {pendingCount > 99 ? "99+" : pendingCount}
      </span>
    );
  }

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
