import { JobQueueProvider } from "@green-goods/shared/providers/JobQueue";
import { WorkProvider } from "@green-goods/shared/providers/Work";
import { useLayoutEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication";
import { PwaBadgeCoordinator } from "@/components/Communication/PwaBadgeCoordinator";
import { AppBar } from "@/components/Layout";
import { ENSClaimReminder } from "./ENSClaimReminder";

export default function AppShell() {
  const { pathname } = useLocation();

  // Reset the custom scroll container on every route change.
  // React Router's <ScrollRestoration> only manages window.scrollTo,
  // but our scrollable element is #app-scroll — so we handle it here.
  useLayoutEffect(() => {
    document.getElementById("app-scroll")?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <JobQueueProvider>
      <PwaBadgeCoordinator />
      <WorkProvider>
        <ENSClaimReminder />
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
