import { configureConnectivityProbe } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { scrollAppToTop } from "@green-goods/shared/hooks/app/useScrollToTop";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useWalletNetworkAlignment } from "@green-goods/shared/hooks/blockchain/useWalletNetworkAlignment";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useDocumentScrollLockLifecycle } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { logger } from "@green-goods/shared/modules/app/logger";
import { JobQueueProvider } from "@green-goods/shared/providers/JobQueue";
import { WorkProvider } from "@green-goods/shared/providers/Work";
import {
  useDashboardNavigation,
  useDashboardRestoration,
} from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication/Offline/OfflineIndicator";
import { InstallNudge } from "@/components/Communication/Offline/InstallNudge";
import { PwaBadgeCoordinator } from "@/components/Communication/PwaBadgeCoordinator";
import { AppBar } from "@/components/Layout/AppBar";
import { APP_ROUTES, isImmersiveAppRoute } from "@/config/pwaRouting";
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
  useDashboardRestoration();
  // The queue's failure toast opens Your Work on Pending, where the active garden's uploads are
  // listed, or Home's switcher for an upload waiting in another garden.
  const { openYourWork, openGardenSwitcher } = useDashboardNavigation();
  const primaryAddress = usePrimaryAddress();
  useWalletNetworkAlignment();
  // Until a garden is entered there is no bottom bar at all (DL-155, the same check AppBar
  // makes), so the scroller gives its 69px back: a screen that scrolls in a pane of its own, as
  // Profile does, would otherwise end above an empty band. An open sheet only moves the bar
  // aside, and immersive routes draw their own fixed bar where the nav would sit, so both keep it.
  const { gardenId } = useActiveGarden();
  const reservesAppBar = gardenId !== null || isImmersiveAppRoute(pathname);

  useDocumentScrollLockLifecycle(pathname);

  // Home's arrival toast orients a session that opens on Home. Being anywhere else first (the
  // garden flow restored after the app was closed, a shared garden link, Profile after sign-in,
  // or a tap away before the toast was ready) means the session has already arrived.
  useEffect(() => {
    if (primaryAddress && pathname.replace(/\/$/, "") !== APP_ROUTES.home) {
      markArrivalPassed(primaryAddress);
    }
  }, [pathname, primaryAddress]);

  // The visited history entry owns dashboard restoration. Route changes only reset the page.
  useLayoutEffect(() => {
    scrollAppToTop();
  }, [pathname]);

  return (
    <JobQueueProvider onOpenGardenSwitcher={openGardenSwitcher} onOpenYourWork={openYourWork}>
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
            className={cn(
              "native-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
              reservesAppBar
                ? "pb-[calc(69px+var(--safe-area-bottom))]"
                : "pb-[var(--safe-area-bottom)]"
            )}
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
