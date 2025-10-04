import { Link, useLocation } from "react-router-dom";
import {
  RiDashboardLine,
  RiPlantLine,
  RiSettings3Line,
  RiUploadLine,
  RiLogoutBoxLine,
} from "@remixicon/react";
import { useAuth } from "@/providers/AuthProvider";
import { useRole } from "@/hooks/useRole";
import { useAdminStore } from "@/stores/admin";
import { cn } from "@/utils/cn";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  { name: "Gardens", href: "/gardens", icon: RiPlantLine, roles: ["deployer", "operator", "user"] },
  { name: "Contracts", href: "/contracts", icon: RiSettings3Line, roles: ["deployer"] },
  { name: "Deployment", href: "/deployment", icon: RiUploadLine, roles: ["deployer"] },
];

export function Sidebar() {
  const location = useLocation();
  const { disconnect } = useAuth();
  const { role, isDeployer } = useRole();
  const { sidebarOpen, setSidebarOpen } = useAdminStore();

  const filteredNavigation = navigation.filter((item) => item.roles.includes(role));

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:inset-0"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Green Goods</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Role indicator */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isDeployer ? "bg-red-500" : role === "operator" ? "bg-blue-500" : "bg-gray-500"
              )}
            ></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {role}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {filteredNavigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Keep disconnect for mobile, but main disconnect is now in UserProfile */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 lg:hidden">
          <button
            onClick={disconnect}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <RiLogoutBoxLine className="mr-3 h-5 w-5" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
