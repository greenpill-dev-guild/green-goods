import { useDocumentScrollLockLifecycle } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { JobQueueProvider } from "@green-goods/shared/providers/JobQueue";
import { WorkProvider } from "@green-goods/shared/providers/Work";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication/Offline/OfflineIndicator";
import { PwaBadgeCoordinator } from "@/components/Communication/PwaBadgeCoordinator";
import { AppBar } from "@/components/Layout/AppBar";
import { APP_ROUTES } from "@/config/pwaRouting";

const ENSClaimReminder = lazy(() =>
  import("./ENSClaimReminder").then((module) => ({ default: module.ENSClaimReminder }))
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

  // Reset the custom scroll container on every route change.
  // React Router's <ScrollRestoration> only manages window.scrollTo,
  // but our scrollable element is #app-scroll — so we handle it here.
  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const isSubmissionReturn =
      previousPathname === APP_ROUTES.garden && pathname === APP_ROUTES.home;

    // Preserve the documented Garden completion flow, which opens the
    // dashboard before returning Home. Every other route transition clears
    // stale dashboard state.
    if (!isSubmissionReturn) closeWorkDashboard();
    document.getElementById("app-scroll")?.scrollTo(0, 0);
    previousPathnameRef.current = pathname;
  }, [closeWorkDashboard, pathname]);

  return (
    <JobQueueProvider>
      <PwaBadgeCoordinator />
      <WorkProvider>
        <DeferredEnsClaimReminder />
        {/* Main content area with view-transition-name for SPA transitions */}
        <main className="vt-main flex flex-col h-[calc(100lvh-69px)] overflow-x-hidden">
          <div id="app-scroll" className="flex-1 overflow-y-auto overflow-x-hidden native-scroll">
            <Outlet />
          </div>
          <ScrollRestoration />
        </main>
        <AppBar />
        <OfflineIndicator />
      </WorkProvider>
    </JobQueueProvider>
  );
}
