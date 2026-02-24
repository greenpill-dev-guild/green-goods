import { DEFAULT_CHAIN_ID, getChainName, useUIStore } from "@green-goods/shared";
import { RiMenuLine } from "@remixicon/react";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { UserProfile } from "./UserProfile";

export function Header() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const chainLabel = getChainName(DEFAULT_CHAIN_ID);

  return (
    <header className="bg-bg-soft shadow-sm border-b border-stroke-sub">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          className="lg:hidden min-h-11 min-w-11 p-2 rounded-md text-text-soft hover:text-text-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
        >
          <RiMenuLine className="h-6 w-6" />
        </button>

        {/* Page title - will be dynamic based on route */}
        {/* <div className="flex-1 lg:ml-0">
          <h1 className="text-xl font-semibold text-text-strong">Green Goods</h1>
        </div> */}

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0 hidden lg:block">
          <Breadcrumbs />
        </div>

        {/* Spacer for mobile (breadcrumbs hidden) */}
        <div className="flex-1 lg:hidden" />

        {/* Right side - Search, Chain badge, User profile */}
        <div className="flex items-center gap-2">
          <CommandPalette />

          <div className="px-3 py-2 rounded-md border border-stroke-sub bg-bg-white text-sm text-text-strong">
            {chainLabel}
          </div>

          <UserProfile />
        </div>
      </div>
    </header>
  );
}
