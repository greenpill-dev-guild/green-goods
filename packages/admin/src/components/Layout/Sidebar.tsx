import { useAuth, useRole, useUIStore, cn } from "@green-goods/shared";
import {
  RiBankLine,
  RiCloseLine,
  RiDashboardLine,
  RiHammerFill,
  RiLogoutBoxLine,
  RiPlantLine,
  RiSeedlingLine,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

const generalNav = [
  {
    i18nKey: "app.admin.nav.dashboard",
    defaultMessage: "Dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    i18nKey: "app.admin.nav.gardens",
    defaultMessage: "Gardens",
    href: "/gardens",
    icon: RiPlantLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    i18nKey: "app.admin.nav.treasury",
    defaultMessage: "Treasury",
    href: "/treasury",
    icon: RiBankLine,
    roles: ["deployer", "operator"],
  },
  {
    i18nKey: "app.admin.nav.actions",
    defaultMessage: "Actions",
    href: "/actions",
    icon: RiHammerFill,
    roles: ["deployer", "operator"],
  },
];

const adminNav = [
  {
    i18nKey: "app.admin.nav.contracts",
    defaultMessage: "Contracts",
    href: "/contracts",
    icon: RiSettings3Line,
    roles: ["deployer"],
  },
  {
    i18nKey: "app.admin.nav.deployment",
    defaultMessage: "Deployment",
    href: "/deployment",
    icon: RiUploadLine,
    roles: ["deployer"],
  },
];

export function Sidebar() {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const { signOut } = useAuth();
  const { role } = useRole();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const filteredGeneral = generalNav.filter((item) => item.roles.includes(role));
  const filteredAdmin = adminNav.filter((item) => item.roles.includes(role));

  const renderNavItem = (item: (typeof generalNav)[number]) => {
    const isActive =
      location.pathname === item.href ||
      (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
    const label = formatMessage({ id: item.i18nKey, defaultMessage: item.defaultMessage });

    return (
      <Link
        key={item.i18nKey}
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
          isActive
            ? "bg-primary-alpha-16 text-primary-darker"
            : "text-text-sub hover:bg-bg-weak hover:text-text-strong"
        )}
      >
        <item.icon className="mr-3 h-5 w-5" />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        data-testid="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:inset-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-stroke-soft shadow-sm">
            <div className="flex items-center gap-2">
              <RiSeedlingLine className="h-5 w-5 text-primary-base" />
              <h1 className="font-heading text-lg font-semibold text-text-strong">Green Goods</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-2 rounded-md text-text-soft hover:text-text-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            >
              <RiCloseLine className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1" aria-label="Main navigation">
            {filteredGeneral.map(renderNavItem)}

            {filteredAdmin.length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 subheading-xs text-text-soft">
                    {formatMessage({ id: "app.admin.sidebar.admin", defaultMessage: "Admin" })}
                  </span>
                </div>
                {filteredAdmin.map(renderNavItem)}
              </>
            )}
          </nav>

          {/* Footer - Keep sign out for mobile, but main sign out is now in UserProfile */}
          <div className="p-4 border-t border-stroke-soft lg:hidden">
            <button
              onClick={() => signOut?.()}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-sub rounded-md hover:bg-bg-weak hover:text-text-strong transition-colors"
            >
              <RiLogoutBoxLine className="mr-3 h-5 w-5" />
              {formatMessage({ id: "app.admin.sidebar.signOut", defaultMessage: "Sign Out" })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
