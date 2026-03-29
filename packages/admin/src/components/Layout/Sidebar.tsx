import { cn, useAuth, useRole, useUIStore } from "@green-goods/shared";
import {
  RiDashboardLine,
  RiFileList3Line,
  RiHammerFill,
  RiLogoutBoxLine,
  RiPlantLine,
  RiSafe2Line,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  name: string;
  nameId: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  group: "operations" | "finance" | "platform";
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    nameId: "app.sidebar.dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
    group: "operations",
  },
  {
    name: "Gardens",
    nameId: "app.sidebar.gardens",
    href: "/gardens",
    icon: RiPlantLine,
    roles: ["deployer", "operator", "user"],
    group: "operations",
  },
  {
    name: "Assessments",
    nameId: "app.sidebar.assessments",
    href: "/assessments",
    icon: RiFileList3Line,
    roles: ["deployer", "operator", "user"],
    group: "operations",
  },
  {
    name: "Actions",
    nameId: "app.sidebar.actions",
    href: "/actions",
    icon: RiHammerFill,
    roles: ["deployer", "operator", "user"],
    group: "operations",
  },
  {
    name: "Endowments",
    nameId: "app.sidebar.endowments",
    href: "/endowments",
    icon: RiSafe2Line,
    roles: ["deployer", "operator", "user"],
    group: "finance",
  },
  {
    name: "Contracts",
    nameId: "app.sidebar.contracts",
    href: "/contracts",
    icon: RiSettings3Line,
    roles: ["deployer"],
    group: "platform",
  },
  {
    name: "Deployment",
    nameId: "app.sidebar.deployment",
    href: "/deployment",
    icon: RiUploadLine,
    roles: ["deployer"],
    group: "platform",
  },
];

const GROUP_LABELS: Record<string, { id: string; defaultMessage: string }> = {
  operations: { id: "admin.sidebar.group.operations", defaultMessage: "Operations" },
  finance: { id: "admin.sidebar.group.finance", defaultMessage: "Finance" },
  platform: { id: "admin.sidebar.group.platform", defaultMessage: "Platform" },
};

const GROUP_ORDER = ["operations", "finance", "platform"] as const;

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
          <nav className="flex-1 px-4 py-4 space-y-1">
            {GROUP_ORDER.map((groupKey) => {
              const groupItems = filteredNavigation.filter((item) => item.group === groupKey);
              if (groupItems.length === 0) return null;
              return (
                <div key={groupKey}>
                  <div className="px-3 pt-3 pb-1.5 first:pt-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-soft">
                      {intl.formatMessage(GROUP_LABELS[groupKey])}
                    </span>
                  </div>
                  {groupItems.map((item) => {
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
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-stroke-soft space-y-2">
            <div className="px-3">
              <span className="inline-flex items-center rounded-full bg-primary-lighter px-2.5 py-0.5 text-xs font-medium text-primary-dark capitalize">
                {role}
              </span>
            </div>
            <button
              onClick={() => signOut?.()}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-sub rounded-md hover:bg-bg-weak hover:text-text-strong transition-colors"
            >
              <RiLogoutBoxLine className="mr-3 h-5 w-5" />
              {intl.formatMessage({ id: "app.sidebar.signOut", defaultMessage: "Sign out" })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
