import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  return (
    <div className="flex flex-1 min-h-0 bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto overscroll-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
