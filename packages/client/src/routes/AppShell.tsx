import { useDocumentScrollLockLifecycle } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { JobQueueProvider } from "@green-goods/shared/providers/JobQueue";
import { WorkProvider } from "@green-goods/shared/providers/Work";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication/Offline/OfflineIndicator";
import { PwaBadgeCoordinator } from "@/components/Communication/PwaBadgeCoordinator";
import { AppBar } from "@/components/Layout/AppBar";
import { APP_ROUTES } from "@/config/pwaRouting";

const ENSClaimReminder = lazy(() =>
  import("./ENSClaimReminder")
    .then((module) => ({ default: module.ENSClaimReminder }))
    // The reminder is an optional adjunct: failing to load it (typically while
    // offline in dev, where chunks are served on demand) must not take down
    // the route through the error boundary.
    .catch(() => ({ default: () => null }))
);

function DeferredEnsClaimReminder() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleCallback =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(callback, 1_000));
    const handle = idleCallback(() => setReady(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return ready ? (
    <Suspense fallback={null}>
      <ENSClaimReminder />
    </Suspense>
  ) : null;
}

export default function AppShell() {
  const { pathname } = useLocation();
  const closeWorkDashboard = useUIStore((state) => state.closeWorkDashboard);
  const previousPathnameRef = useRef(pathname);

  useDocumentScrollLockLifecycle(pathname);

  // Route transitions reset the document; submission returns preserve dashboard state.
  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const isSubmissionReturn =
      previousPathname === APP_ROUTES.garden && pathname.replace(/\/$/, "") === APP_ROUTES.home;

    // Preserve the documented Garden completion flow, which opens the
    // dashboard before returning Home. Every other route transition clears
    // stale dashboard state.
    if (!isSubmissionReturn) closeWorkDashboard();
    window.scrollTo(0, 0);
    previousPathnameRef.current = pathname;
  }, [closeWorkDashboard, pathname]);

  return (
    <JobQueueProvider>
      <PwaBadgeCoordinator />
      <WorkProvider>
        <DeferredEnsClaimReminder />
        {/* Main content area with view-transition-name for SPA transitions */}
        <main className="vt-main flex min-h-dvh flex-col pb-[calc(69px+env(safe-area-inset-bottom))]">
          <div id="app-scroll" className="flex-1">
            <Outlet />
          </div>
        </main>
        <AppBar />
        <OfflineIndicator />
      </WorkProvider>
    </JobQueueProvider>
  );
}
