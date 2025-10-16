import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ContractInspector } from "@/components/Debug/ContractInspector";

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-y-auto">
          <Outlet />
          <ContractInspector />
        </main>
      </div>
    </div>
  );
}
