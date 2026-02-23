import { cn, useAuth, useRole, useTheme } from "@green-goods/shared";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  RiArrowDownSLine,
  RiComputerLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiSunLine,
  RiUserLine,
} from "@remixicon/react";
import { AddressDisplay } from "../AddressDisplay";

export function UserProfile() {
  const { signOut, eoaAddress } = useAuth();
  const { role } = useRole();
  const { theme, setTheme } = useTheme();

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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-bg-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base">
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
              className="h-4 w-4 text-text-soft transition-transform"
              aria-hidden="true"
            />
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-64 bg-bg-soft rounded-lg shadow-xl border border-stroke-sub z-50 ring-1 ring-black/5 animate-fade-in-up"
        >
          {/* User Info Header */}
          <DropdownMenu.Label className="px-4 py-3 border-b border-stroke-sub">
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
          </DropdownMenu.Label>

          {/* Theme Options */}
          <DropdownMenu.Group>
            <DropdownMenu.Label className="px-4 pt-3 pb-1 text-xs font-medium text-text-soft uppercase tracking-wider">
              Theme
            </DropdownMenu.Label>
            {(["light", "dark", "system"] as const).map((mode) => (
              <DropdownMenu.Item
                key={mode}
                onSelect={() => setTheme(mode)}
                className={cn(
                  "flex items-center mx-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer outline-none",
                  theme === mode
                    ? "bg-success-lighter text-success-dark border border-success-light"
                    : "text-text-sub hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
                )}
              >
                {getThemeIcon(mode)}
                <span className="flex-1 text-left">{getThemeLabel(mode)}</span>
                {theme === mode && <div className="w-2 h-2 bg-success-base rounded-full"></div>}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>

          <DropdownMenu.Separator className="border-t border-stroke-soft my-2" />

          <DropdownMenu.Item
            onSelect={() => signOut?.()}
            className="flex items-center w-full px-4 py-2 text-sm text-error-base hover:bg-error-lighter data-[highlighted]:bg-error-lighter transition-colors cursor-pointer outline-none"
          >
            <RiLogoutBoxLine className="mr-3 h-4 w-4" />
            Disconnect
          </DropdownMenu.Item>

          <div className="py-1" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
