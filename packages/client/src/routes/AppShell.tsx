import { configureConnectivityProbe } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { scrollAppToTop } from "@green-goods/shared/hooks/app/useScrollToTop";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useDocumentScrollLockLifecycle } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { logger } from "@green-goods/shared/modules/app/logger";
import { JobQueueProvider } from "@green-goods/shared/providers/JobQueue";
import { WorkProvider } from "@green-goods/shared/providers/Work";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { installPressHaptics } from "@green-goods/shared/utils/app/haptics";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication/Offline/OfflineIndicator";
import { InstallNudge } from "@/components/Communication/Offline/InstallNudge";
import { PwaBadgeCoordinator } from "@/components/Communication/PwaBadgeCoordinator";
import { AppBar } from "@/components/Layout/AppBar";
import { APP_ROUTES } from "@/config/pwaRouting";
import { markArrivalPassed } from "@/views/Home/arrivalToast";

const OfflineContentPreparation = lazy(() =>
  import("@/components/Communication/Offline/OfflineContentPreparation")
    // Background preparation is optional, like the reminder below. It starts
    // loading as the shell mounts, so a connection that drops before its chunk
    // arrives (on demand in dev, or before the precache finishes) skips
    // preparation for this visit instead of replacing the route with the error
    // boundary.
    .catch((error: unknown) => {
      logger.warn("[AppShell] Offline content preparation did not load", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { default: () => null };
    })
);

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
  useEffect(() => configureConnectivityProbe("/connectivity-check.txt"), []);
  // One listener answers every button, tab, and chip press in the installed app.
  useEffect(() => installPressHaptics(), []);
  const closeWorkDashboard = useUIStore((state) => state.closeWorkDashboard);
  const previousPathnameRef = useRef(pathname);
  const primaryAddress = usePrimaryAddress();

  useDocumentScrollLockLifecycle(pathname);

  // Home's arrival toast orients a session that opens on Home. Being anywhere else first (the
  // garden flow restored after the app was closed, a shared garden link, Profile after sign-in,
  // or a tap away before the toast was ready) means the session has already arrived.
  useEffect(() => {
    if (primaryAddress && pathname.replace(/\/$/, "") !== APP_ROUTES.home) {
      markArrivalPassed(primaryAddress);
    }
  }, [pathname, primaryAddress]);

  // Route transitions reset the app scroller; submission returns preserve dashboard state.
  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const isSubmissionReturn =
      previousPathname === APP_ROUTES.garden && pathname.replace(/\/$/, "") === APP_ROUTES.home;

    // Preserve the documented Garden completion flow, which opens the
    // dashboard before returning Home. Every other route transition clears
    // stale dashboard state.
    if (!isSubmissionReturn) closeWorkDashboard();
    scrollAppToTop();
    previousPathnameRef.current = pathname;
  }, [closeWorkDashboard, pathname]);

  return (
    <JobQueueProvider>
      <Suspense fallback={null}>
        <OfflineContentPreparation />
      </Suspense>
      <PwaBadgeCoordinator />
      <WorkProvider>
        <DeferredEnsClaimReminder />
        {/* Content scrolls inside #app-scroll, never the document. Android Chrome
            stretches everything on an overscrolled document, the fixed AppBar
            included; an inner scroller stretches only its own content. A pull
            from the top still chains to the unscrollable document, so native
            refresh keeps working. overflow-clip stops Chrome from promoting
            #app-scroll to the document scroller. relative makes main the
            containing block for absolutely positioned content, so the clip also
            holds a stray one (a screen-reader status region) that would
            otherwise make the document scrollable. */}
        <main className="vt-main relative flex h-dvh flex-col overflow-clip">
          <div
            id="app-scroll"
            className="native-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(69px+env(safe-area-inset-bottom))]"
          >
            <Outlet />
          </div>
        </main>
        <AppBar />
        <OfflineIndicator />
        <InstallNudge />
      </WorkProvider>
    </JobQueueProvider>
  );
}
