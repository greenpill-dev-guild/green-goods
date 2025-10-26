import { useRole } from "@green-goods/shared/hooks";
import { useWalletAuth as useAuth } from "@green-goods/shared/providers";
import { useAdminStore } from "@green-goods/shared/stores";
import { cn } from "@green-goods/shared/utils";
import {
  RiDashboardLine,
  RiHammerFill,
  RiLogoutBoxLine,
  RiPlantLine,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  { name: "Gardens", href: "/gardens", icon: RiPlantLine, roles: ["deployer", "operator", "user"] },
  { name: "Actions", href: "/actions", icon: RiHammerFill, roles: ["deployer", "operator"] },
  { name: "Contracts", href: "/contracts", icon: RiSettings3Line, roles: ["deployer"] },
  { name: "Deployment", href: "/deployment", icon: RiUploadLine, roles: ["deployer"] },
];

export function Sidebar() {
  const location = useLocation();
  const { disconnect } = useAuth();
  const { role } = useRole();
  const { sidebarOpen, setSidebarOpen } = useAdminStore();

  const filteredNavigation = navigation.filter((item) => item.roles.includes(role));

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:inset-0"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-stroke-soft shadow-sm">
          <h1 className="text-lg font-semibold text-text-strong">Green Goods</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-text-soft hover:text-text-sub"
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
                    ? "bg-green-100 text-green-700"
                    : "text-text-sub hover:bg-bg-weak hover:text-text-strong"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Keep disconnect for mobile, but main disconnect is now in UserProfile */}
        <div className="p-4 border-t border-stroke-soft lg:hidden">
          <button
            onClick={disconnect}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-sub rounded-md hover:bg-bg-weak hover:text-text-strong transition-colors"
          >
            <RiLogoutBoxLine className="mr-3 h-5 w-5" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
