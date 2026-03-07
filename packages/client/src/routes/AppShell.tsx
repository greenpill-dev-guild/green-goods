import { JobQueueProvider, WorkProvider } from "@green-goods/shared";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { OfflineIndicator } from "@/components/Communication";
import { AppBar } from "@/components/Layout";

export default function AppShell() {
  return (
    <JobQueueProvider>
      <WorkProvider>
        {/* Main content area with view-transition-name for SPA transitions */}
        <main className="vt-main flex h-[calc(100dvh-69px)] min-h-0 flex-col overflow-x-hidden">
          <div
            id="app-scroll"
            className="native-scroll flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          >
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
