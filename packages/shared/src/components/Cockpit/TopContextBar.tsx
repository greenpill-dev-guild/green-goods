import { RiArrowLeftLine, RiNotification3Line, RiSearchLine, RiSettings3Line } from "@remixicon/react";
import * as Popover from "@radix-ui/react-popover";
import type React from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";

// ----------------------------------------------------------------------------
// Shared icon button styles — consistent across all right-side icons
// ----------------------------------------------------------------------------

const ICON_BTN = cn(
  "flex h-10 w-10 items-center justify-center rounded-lg",
  "text-text-sub hover:bg-bg-weak active:bg-bg-sub active:scale-95",
  "transition-all duration-150",
  "motion-reduce:transition-none motion-reduce:active:scale-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
);

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TopContextBarProps {
  gardenChip: React.ReactNode;
  /** When a side sheet is open, show item name with back arrow */
  sheetContext?: { label: string; onBack: () => void };
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  userAvatar?: React.ReactNode;
}

// ----------------------------------------------------------------------------
// TopContextBar
// ----------------------------------------------------------------------------

/**
 * Sticky top bar for the admin cockpit layout.
 *
 * - Left side: GardenChip (or sheetContext back-arrow + label when a sheet is open)
 * - Right side: Search, Notifications, Settings, User avatar — all with identical styling
 * - z-index 40 per D49
 * - h-14 (56px)
 *
 * On mobile, search icon is hidden to save space (notifications + settings + avatar remain).
 */
export function TopContextBar({
  gardenChip,
  sheetContext,
  onOpenSearch,
  onOpenSettings,
  userAvatar,
}: TopContextBarProps) {
  const { formatMessage } = useIntl();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 w-full items-center justify-between",
        "border-b border-stroke-sub bg-bg-soft px-4",
        "bg-gradient-to-r from-primary-alpha-10/30 via-bg-soft to-bg-soft"
      )}
    >
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-2">
        {sheetContext ? (
          <>
            <button
              type="button"
              onClick={sheetContext.onBack}
              aria-label={formatMessage({ id: "cockpit.topBar.back" })}
              className={ICON_BTN}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-medium text-text-main">
              {sheetContext.label}
            </span>
          </>
        ) : (
          gardenChip
        )}
      </div>

      {/* Right side — all icons share ICON_BTN styling */}
      <div className="flex items-center gap-1">
        {/* Search — hidden on mobile */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={formatMessage({ id: "cockpit.topBar.openSearch" })}
            className={cn(ICON_BTN, "hidden min-[600px]:flex")}
          >
            <RiSearchLine className="h-5 w-5" />
          </button>
        )}

        {/* Notification bell — placeholder with popover */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={formatMessage({ id: "cockpit.topBar.notifications", defaultMessage: "Notifications" })}
              className={ICON_BTN}
            >
              <RiNotification3Line className="h-5 w-5" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="end"
              sideOffset={4}
              className={cn(
                "z-50 rounded-xl bg-bg-white px-4 py-3 shadow-elevation-3",
                "border border-stroke-soft",
                "text-sm text-text-sub",
                "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
                "duration-200"
              )}
            >
              {formatMessage({ id: "cockpit.topBar.noNotifications", defaultMessage: "No notifications yet" })}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Settings */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={formatMessage({ id: "cockpit.topBar.openSettings" })}
            className={ICON_BTN}
          >
            <RiSettings3Line className="h-5 w-5" />
          </button>
        )}

        {/* User avatar */}
        {userAvatar && <div className="ml-1 flex items-center">{userAvatar}</div>}
      </div>
    </header>
  );
}
