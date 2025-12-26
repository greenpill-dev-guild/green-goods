import { useAuth, useRole, useTheme } from "@green-goods/shared/hooks";
import { cn } from "@green-goods/shared/utils";
import {
  RiArrowDownSLine,
  RiComputerLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiSunLine,
  RiUserLine,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { AddressDisplay } from "../AddressDisplay";

export function UserProfile() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut, eoaAddress } = useAuth();
  const { role } = useRole();
  const { theme, setTheme } = useTheme();

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
    signOut?.();
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
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-bg-soft transition-colors"
      >
        <div className="text-right">
          <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
          <div className="text-xs">
            {eoaAddress && <AddressDisplay address={eoaAddress} showCopyButton={false} />}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-bg-soft rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-text-sub">
              {role === "deployer" ? "D" : role === "operator" ? "O" : "U"}
            </span>
          </div>
          <RiArrowDownSLine
            className={cn("h-4 w-4 text-text-soft transition-transform", isOpen && "rotate-180")}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-bg-soft rounded-lg shadow-xl border border-stroke-sub z-50 ring-1 ring-black/5">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-stroke-sub">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-bg-weak rounded-full flex items-center justify-center">
                <RiUserLine className="h-5 w-5 text-text-sub" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-strong capitalize">
                  {role} Account
                </div>
                <div className="text-xs">
                  {eoaAddress && <AddressDisplay address={eoaAddress} showCopyButton={true} />}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Theme Options */}
            <div className="px-4 py-2">
              <div className="text-xs font-medium text-text-soft uppercase tracking-wider mb-2">
                Theme
              </div>
              <div className="space-y-1">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTheme(mode);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors",
                      theme === mode
                        ? "bg-success-lighter text-success-dark border border-success-light"
                        : "text-text-sub hover:bg-bg-weak"
                    )}
                  >
                    {getThemeIcon(mode)}
                    <span className="flex-1 text-left">{getThemeLabel(mode)}</span>
                    {theme === mode && <div className="w-2 h-2 bg-success-base rounded-full"></div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-stroke-soft my-2"></div>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-error-base hover:bg-error-lighter transition-colors"
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
