import { Outlet, ScrollRestoration } from "react-router-dom";
import { AppBar } from "@/components/Layout/AppBar";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";
import { JobQueueProvider } from "@/providers/jobQueue";
import { WorkProvider } from "@/providers/work";
import { JoinRootGardenModal } from "@/components/Garden/JoinRootGardenModal";

export default function AppShell() {
  return (
    <JobQueueProvider>
      <WorkProvider>
        <JoinRootGardenModal />
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
  );
}
