import { useState, useRef, useEffect } from "react";
import {
  RiLogoutBoxLine,
  RiMoonLine,
  RiSunLine,
  RiUserLine,
  RiArrowDownSLine,
  RiComputerLine,
} from "@remixicon/react";
import { useAuth } from "@/providers/AuthProvider";
import { useRole } from "@/hooks/useRole";
import { useDarkMode } from "@/hooks/useDarkMode";
import { cn } from "@/utils/cn";

export function UserProfile() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { disconnect, address } = useAuth();
  const { role } = useRole();
  const { themeMode, setThemeMode } = useDarkMode();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    disconnect();
  };

  const getThemeIcon = (mode: string) => {
    switch (mode) {
      case "light":
        return <RiSunLine className="mr-3 h-4 w-4" />;
      case "dark":
        return <RiMoonLine className="mr-3 h-4 w-4" />;
      case "system":
        return <RiComputerLine className="mr-3 h-4 w-4" />;
      default:
        return <RiComputerLine className="mr-3 h-4 w-4" />;
    }
  };

  const getThemeLabel = (mode: string) => {
    switch (mode) {
      case "light":
        return "Light Mode";
      case "dark":
        return "Dark Mode";
      case "system":
        return "System";
      default:
        return "System";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
            {role}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {role === "deployer" ? "D" : role === "operator" ? "O" : "U"}
            </span>
          </div>
          <RiArrowDownSLine
            className={cn(
              "h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <RiUserLine className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {role} Account
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Theme Options */}
            <div className="px-4 py-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Theme
              </div>
              <div className="space-y-1">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setThemeMode(mode)}
                    className={cn(
                      "flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors",
                      themeMode === mode
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  >
                    {getThemeIcon(mode)}
                    <span className="flex-1 text-left">{getThemeLabel(mode)}</span>
                    {themeMode === mode && (
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <RiLogoutBoxLine className="mr-3 h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
