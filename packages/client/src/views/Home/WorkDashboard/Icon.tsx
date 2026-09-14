import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCloudOffLine, RiLoader4Line, RiTaskLine } from "@remixicon/react";
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
  const { isOnline, pendingCount, syncStatus } = useOffline();
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
  const isSyncing = syncStatus === "syncing";
  const hasPendingItems = pendingCount > 0;
  const hasOfflineStatus = !isOnline;

  // Determine primary icon and styling based on status priority
  let PrimaryIcon = RiTaskLine;
  let statusTone: PwaStatusTone = hasPendingItems ? "primary" : "neutral";

  if (isSyncing) {
    PrimaryIcon = RiLoader4Line;
    statusTone = "primary";
  } else if (!isOnline) {
    PrimaryIcon = RiCloudOffLine;
    statusTone = "warning";
  }
  const statusStyles = pwaStatusStyles[statusTone];
  // The status tone tints the outline while work is pending, syncing, or offline.
  const borderColor =
    isSyncing || hasOfflineStatus || hasPendingItems ? statusStyles.border : undefined;
  const primaryIcon = (
    <PrimaryIcon
      className={cn(statusStyles.icon, isSyncing && "animate-spin")}
      aria-hidden="true"
    />
  );

  // A count for actual pending items; otherwise a dot while offline or syncing.
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
  } else if (hasOfflineStatus || isSyncing) {
    badge = (
      <span
        className={cn(
          "w-3 h-3 rounded-full border-2 border-bg-white-0",
          statusStyles.dot,
          isSyncing && "animate-pulse"
        )}
        data-testid="status-dot"
      />
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
