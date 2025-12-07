import { DEFAULT_CHAIN_ID } from "@green-goods/shared";
import { getChainName } from "@green-goods/shared/config/chains";
import { useUIStore } from "@green-goods/shared/stores";
import { RiMenuLine } from "@remixicon/react";
import { UserProfile } from "./UserProfile";

export function Header() {
  const { setSidebarOpen } = useUIStore();
  const chainLabel = getChainName(DEFAULT_CHAIN_ID);

  return (
    <header className="bg-bg-soft shadow-sm border-b border-stroke-sub">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-md text-text-soft hover:text-text-sub"
        >
          <RiMenuLine className="h-6 w-6" />
        </button>

        {/* Page title - will be dynamic based on route */}
        {/* <div className="flex-1 lg:ml-0">
          <h1 className="text-xl font-semibold text-text-strong">Green Goods</h1>
        </div> */}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side - Chain selector and User profile */}
        <div className="flex items-center gap-4">
          <div className="px-3 py-2 rounded-md border border-stroke-sub bg-bg-white text-sm text-text-strong">
            {chainLabel}
          </div>

          <UserProfile />
        </div>
      </div>
    </header>
  );
}
