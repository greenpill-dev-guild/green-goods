import { cn, useAuth, useRole, useUIStore } from "@green-goods/shared";
import {
  RiDashboardLine,
  RiHammerFill,
  RiLogoutBoxLine,
  RiPlantLine,
  RiSafe2Line,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  {
    name: "Dashboard",
    nameId: "app.sidebar.dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    name: "Gardens",
    nameId: "app.sidebar.gardens",
    href: "/gardens",
    icon: RiPlantLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    name: "Actions",
    nameId: "app.sidebar.actions",
    href: "/actions",
    icon: RiHammerFill,
    roles: ["deployer", "operator", "user"],
  },
  {
    name: "Endowments",
    nameId: "app.sidebar.endowments",
    href: "/endowments",
    icon: RiSafe2Line,
    roles: ["deployer", "operator", "user"],
  },
  {
    name: "Contracts",
    nameId: "app.sidebar.contracts",
    href: "/contracts",
    icon: RiSettings3Line,
    roles: ["deployer"],
  },
  {
    name: "Deployment",
    nameId: "app.sidebar.deployment",
    href: "/deployment",
    icon: RiUploadLine,
    roles: ["deployer"],
  },
];

export function Sidebar() {
  const intl = useIntl();
  const location = useLocation();
  const { signOut } = useAuth();
  const { role } = useRole();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const filteredNavigation = navigation.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Backdrop overlay - mobile only */}
      <div
        data-testid="sidebar-backdrop"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <div
        data-testid="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:inset-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-stroke-soft shadow-sm">
            <div className="flex items-center gap-2">
              <img src="/green-goods-logo.png" alt="" className="h-7 w-auto" />
              <h1 className="text-lg font-semibold text-text-strong">Green Goods</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label={intl.formatMessage({
                id: "admin.sidebar.closeMenu",
                defaultMessage: "Close navigation menu",
              })}
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
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary-alpha-10 text-primary-dark"
                      : "text-text-sub hover:bg-bg-weak hover:text-text-strong"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.nameId
                    ? intl.formatMessage({ id: item.nameId, defaultMessage: item.name })
                    : item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer - Keep sign out for mobile, but main sign out is now in UserProfile */}
          <div className="p-4 border-t border-stroke-soft lg:hidden">
            <button
              onClick={() => signOut?.()}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-sub rounded-md hover:bg-bg-weak hover:text-text-strong transition-colors"
            >
              <RiLogoutBoxLine className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
