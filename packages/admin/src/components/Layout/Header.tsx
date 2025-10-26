import { SUPPORTED_CHAINS } from "@green-goods/shared/config/chains";
import { useAdminStore } from "@green-goods/shared/stores";
import { RiMenuLine } from "@remixicon/react";
import { useChainId, useSwitchChain } from "wagmi";
import { UserProfile } from "./UserProfile";

export function Header() {
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const chainId = useChainId();
  const { setSidebarOpen } = useAdminStore();

  const chains = Object.values(SUPPORTED_CHAINS);
  const currentChain = chains.find((chain) => chain.id === chainId) || chains[0];

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
          {/* Chain selector */}
          <select
            value={currentChain.id}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
            disabled={isSwitching}
            className="px-3 py-2 border border-stroke-sub rounded-md text-sm bg-bg-white text-text-strong focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>

          <UserProfile />
        </div>
      </div>
    </header>
  );
}
