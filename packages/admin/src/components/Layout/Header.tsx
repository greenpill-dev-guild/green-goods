import { RiMenuLine } from "@remixicon/react";
import { useSwitchChain, useChainId } from "wagmi";
import { useAdminStore } from "@/stores/admin";
import { SUPPORTED_CHAINS } from "@/config";
import { UserProfile } from "./UserProfile";

export function Header() {
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const chainId = useChainId();
  const { setSidebarOpen } = useAdminStore();
  
  const currentChain = SUPPORTED_CHAINS.find(chain => chain.id === chainId) || SUPPORTED_CHAINS[0];

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <RiMenuLine className="h-6 w-6" />
        </button>

        {/* Page title - will be dynamic based on route */}
        {/* <div className="flex-1 lg:ml-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Green Goods</h1>
        </div> */}

        {/* Right side controls */}
        <div className="flex items-center space-x-4">
          {/* Chain selector */}
          <select
            value={currentChain.id}
            onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
            disabled={isSwitching}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
          >
            {SUPPORTED_CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>

          {/* User profile */}
          <UserProfile />
        </div>
      </div>
    </header>
  );
}