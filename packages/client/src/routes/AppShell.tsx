import { Outlet, ScrollRestoration } from "react-router-dom";
import { GardensProvider } from "@/providers/garden";
import { JobQueueProvider } from "@/providers/jobQueue";
import { WorkProvider } from "@/providers/work";
import { AppBar } from "@/components/Layout/AppBar";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";

export default function AppShell() {
  return (
    <GardensProvider>
      <JobQueueProvider>
        <WorkProvider>
          <main className="flex flex-col h-[calc(100lvh-69px)]">
            <div id="app-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
              <Outlet />
            </div>
            <ScrollRestoration />
          </main>
          <AppBar />
          <OfflineIndicator />
        </WorkProvider>
      </JobQueueProvider>
    </GardensProvider>
  );
}
