import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  return (
    <div className="flex flex-1 min-h-0 bg-bg-weak">
      <Sidebar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Header />
        <main
          className="flex-1 overflow-y-auto"
          style={{ overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
