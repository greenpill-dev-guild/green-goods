import {
  RiArrowLeftLine,
  RiNotification3Line,
  RiSearchLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import * as Popover from "@radix-ui/react-popover";
import type React from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";

// ----------------------------------------------------------------------------
// Shared icon button styles — consistent across all right-side icons
// ----------------------------------------------------------------------------

const ICON_BTN = cn(
  "group/icon relative flex h-10 w-10 items-center justify-center rounded-full",
  "text-text-strong",
  "hover:bg-[rgb(var(--m3-on-surface,15_23_42)/0.08)] hover:scale-105",
  "active:bg-[rgb(var(--m3-on-surface,15_23_42)/0.12)] active:scale-95",
  "transition-all duration-[var(--spring-micro-duration,150ms)]",
  "motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:scale-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))]"
);

// ----------------------------------------------------------------------------
// TopBarIconButton — internal icon button with CSS tooltip
// ----------------------------------------------------------------------------

function TopBarIconButton({
  slot,
  tooltip,
  onClick,
  children,
  className,
}: {
  slot: string;
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      className={cn(ICON_BTN, className)}
      data-component="AppBar"
      data-slot={slot}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap",
          "rounded-md bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white",
          "opacity-0 transition-opacity group-hover/icon:opacity-100",
          "motion-reduce:transition-none"
        )}
        role="tooltip"
        data-slot="tooltip"
      >
        {tooltip}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AppBarProps {
  gardenChip: React.ReactNode;
  /** When a side sheet is open, show item name with back arrow */
  sheetContext?: { label: string; onBack: () => void };
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  /** Open notifications in right sheet (desktop) — bell icon triggers this */
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

// ----------------------------------------------------------------------------
// AppBar
// ----------------------------------------------------------------------------

/**
 * Sticky top bar for the admin canvas layout (M3 AppBar).
 *
 * - Left side: GardenChip (or sheetContext back-arrow + label when a sheet is open)
 * - Right side: Search, Notifications, Settings, User avatar — all with identical styling
 * - z-index 40 per D49
 * - h-14 (56px)
 *
 * On mobile, search icon is hidden to save space (notifications + settings + avatar remain).
 */
export function AppBar({
  gardenChip,
  sheetContext,
  onOpenSearch,
  onOpenSettings,
  onOpenNotifications,
  onOpenProfile,
}: AppBarProps) {
  const { formatMessage } = useIntl();

  return (
    <header
      className={cn(
        "sticky top-0 z-sticky flex h-14 w-full items-center justify-between",
        "bg-transparent px-4"
      )}
      data-component="AppBar"
      data-slot="root"
      data-state={sheetContext ? "sheet-context" : "default"}
    >
      {/* Left side */}
      <div
        className="flex min-w-0 items-center gap-2"
        data-slot="leading"
        data-state={sheetContext ? "sheet-context" : "garden-context"}
      >
        {sheetContext ? (
          <>
            <button
              type="button"
              onClick={sheetContext.onBack}
              aria-label={formatMessage({ id: "cockpit.topBar.back" })}
              className={ICON_BTN}
              data-component="AppBar"
              data-slot="back-button"
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </button>
            <span className="truncate text-title-md text-text-main" data-slot="sheet-label">
              {sheetContext.label}
            </span>
          </>
        ) : (
          gardenChip
        )}
      </div>

      {/* Right side — all icons share ICON_BTN styling via TopBarIconButton */}
      <div className="flex items-center gap-1" data-slot="actions">
        {/* Search — hidden on mobile */}
        {onOpenSearch && (
          <TopBarIconButton
            slot="search-button"
            tooltip={formatMessage({ id: "cockpit.topBar.openSearch", defaultMessage: "Search" })}
            onClick={onOpenSearch}
            className="hidden min-[600px]:flex"
          >
            <RiSearchLine className="h-5 w-5" />
          </TopBarIconButton>
        )}

        {/* Notification bell — desktop: opens right sheet, mobile: popover fallback */}
        {onOpenNotifications ? (
          <TopBarIconButton
            slot="notifications-button"
            tooltip={formatMessage({
              id: "cockpit.topBar.notifications",
              defaultMessage: "Notifications",
            })}
            onClick={onOpenNotifications}
          >
            <RiNotification3Line className="h-5 w-5" />
          </TopBarIconButton>
        ) : (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={formatMessage({
                  id: "cockpit.topBar.notifications",
                  defaultMessage: "Notifications",
                })}
                className={ICON_BTN}
                data-component="AppBar"
                data-slot="notifications-button"
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
                  "z-overlay rounded-xl bg-bg-white px-4 py-3 shadow-elevation-3",
                  "text-sm text-text-sub",
                  "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
                  "duration-200"
                )}
                style={{ boxShadow: "var(--edge-rest), var(--elevation-3)" }}
                data-component="AppBar"
                data-slot="notifications-popover"
              >
                {formatMessage({
                  id: "cockpit.topBar.noNotifications",
                  defaultMessage: "No notifications yet",
                })}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}

        {/* Settings */}
        {onOpenSettings && (
          <TopBarIconButton
            slot="settings-button"
            tooltip={formatMessage({
              id: "cockpit.topBar.openSettings",
              defaultMessage: "Settings",
            })}
            onClick={onOpenSettings}
          >
            <RiSettings3Line className="h-5 w-5" />
          </TopBarIconButton>
        )}

        {/* Profile */}
        {onOpenProfile && (
          <TopBarIconButton
            slot="profile-button"
            tooltip={formatMessage({ id: "cockpit.topBar.openProfile", defaultMessage: "Profile" })}
            onClick={onOpenProfile}
          >
            <RiUserLine className="h-5 w-5" />
          </TopBarIconButton>
        )}
      </div>
    </header>
  );
}
