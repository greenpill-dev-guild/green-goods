import {
  cn,
  DEFAULT_CHAIN_ID,
  getChainName,
  useAuthActions,
  useAuthState,
  useRole,
  useTheme,
} from "@green-goods/shared";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  RiComputerLine,
  RiFileCopyLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiSettings3Line,
  RiSunLine,
} from "@remixicon/react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";

interface UserMenuProps {
  /** Opens the account sheet on the settings tab */
  onOpenSettings?: () => void;
}

const THEME_OPTIONS = [
  { value: "light" as const, icon: RiSunLine, labelId: "cockpit.settings.lightMode" },
  { value: "dark" as const, icon: RiMoonLine, labelId: "cockpit.settings.darkMode" },
  { value: "system" as const, icon: RiComputerLine, labelId: "cockpit.settings.systemMode" },
];

export function UserMenu({ onOpenSettings }: UserMenuProps) {
  const { formatMessage } = useIntl();
  const { eoaAddress } = useAuthState();
  const { signOut } = useAuthActions();
  const { role } = useRole();
  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const roleInitial = role === "deployer" ? "D" : role === "operator" ? "O" : "U";

  const handleCopyAddress = useCallback(() => {
    if (eoaAddress) {
      navigator.clipboard.writeText(eoaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [eoaAddress]);

  const truncatedAddress = eoaAddress
    ? `${eoaAddress.slice(0, 6)}...${eoaAddress.slice(-4)}`
    : null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-bg-weak text-sm font-medium text-text-sub",
            "transition-colors hover:bg-bg-sub",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
          )}
          aria-label={formatMessage({
            id: "cockpit.nav.userMenu",
            defaultMessage: "User menu",
          })}
        >
          {roleInitial}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={12}
          className={cn(
            "z-50 min-w-[220px] rounded-2xl bg-bg-white p-2 shadow-lg",
            "border border-stroke-soft",
            "animate-in fade-in-0 zoom-in-95",
            "data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          {/* Profile section */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-soft text-xs font-medium text-text-sub">
              {roleInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
              {truncatedAddress && (
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1 text-xs text-text-soft hover:text-text-sub transition-colors"
                  title={eoaAddress ?? undefined}
                >
                  <span>
                    {copied
                      ? formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" })
                      : truncatedAddress}
                  </span>
                  <RiFileCopyLine className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-stroke-soft" />

          {/* Theme toggle */}
          <DropdownMenu.Label className="px-2 py-1 text-xs font-medium text-text-soft">
            {formatMessage({ id: "cockpit.nav.theme", defaultMessage: "Theme" })}
          </DropdownMenu.Label>
          <div className="flex gap-1 px-2 py-1">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelId }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary-alpha-10 text-primary-dark"
                      : "text-text-sub hover:bg-bg-weak"
                  )}
                  aria-label={formatMessage({ id: labelId })}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-stroke-soft" />

          {/* Network info */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs text-text-soft">
              {formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
            </span>
            <span className="text-xs font-medium text-text-sub">
              {getChainName(DEFAULT_CHAIN_ID)}
            </span>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-stroke-soft" />

          {/* More settings */}
          {onOpenSettings && (
            <DropdownMenu.Item
              onSelect={onOpenSettings}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-sub",
                "cursor-pointer outline-none",
                "hover:bg-bg-weak focus:bg-bg-weak"
              )}
            >
              <RiSettings3Line className="h-4 w-4" />
              {formatMessage({
                id: "cockpit.nav.moreSettings",
                defaultMessage: "More settings",
              })}
            </DropdownMenu.Item>
          )}

          {/* Disconnect */}
          <DropdownMenu.Item
            onSelect={() => signOut()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium",
              "cursor-pointer outline-none",
              "text-error-base hover:bg-error-lighter focus:bg-error-lighter"
            )}
          >
            <RiLogoutBoxLine className="h-4 w-4" />
            {formatMessage({
              id: "cockpit.settings.disconnect",
              defaultMessage: "Disconnect",
            })}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
