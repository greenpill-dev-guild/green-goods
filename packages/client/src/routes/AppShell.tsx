import { JobQueueProvider, WorkProvider } from "@green-goods/shared";
import { useLayoutEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication";
import { AppBar } from "@/components/Layout";

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
      <WorkProvider>
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
