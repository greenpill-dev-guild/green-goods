import { RiMenuLine } from "@remixicon/react";
import { useUser } from "@/providers/user";
import { useRole } from "@/hooks/useRole";
import { useChainSync } from "@/hooks/useChainSync";
import { useAdminStore } from "@/stores/admin";
import { SUPPORTED_CHAINS } from "@/config";

export function Header() {
  const { address } = useUser();
  const { role } = useRole();
  const { currentChain, switchChain, isSwitching } = useChainSync();
  const { setSidebarOpen } = useAdminStore();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
        >
          <RiMenuLine className="h-6 w-6" />
        </button>

        {/* Page title - will be dynamic based on route */}
        <div className="flex-1 lg:ml-0">
          <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-4">
          {/* Chain selector */}
          <select
            value={currentChain.id}
            onChange={(e) => switchChain(Number(e.target.value))}
            disabled={isSwitching}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
          >
            {SUPPORTED_CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>

          {/* User info */}
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 capitalize">{role}</div>
              <div className="text-xs text-gray-500">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
              </div>
            </div>
            <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {role === "admin" ? "A" : "O"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}