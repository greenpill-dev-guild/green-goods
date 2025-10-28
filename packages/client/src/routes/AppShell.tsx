import { Outlet, ScrollRestoration } from "react-router-dom";
import { AppBar } from "@/components/Layout/AppBar";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";
import { JobQueueProvider } from "@green-goods/shared/providers/jobQueue";
import { WorkProvider } from "@green-goods/shared/providers/work";

export default function AppShell() {
  return (
    <JobQueueProvider>
      <WorkProvider>
        <main className="flex flex-col h-[calc(100lvh-69px)] overflow-x-hidden">
          <div id="app-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="page-fade-enter">
              <Outlet />
            </div>
          </div>
          <ScrollRestoration />
        </main>
        <AppBar />
        <OfflineIndicator />
      </WorkProvider>
    </JobQueueProvider>
  );
}
