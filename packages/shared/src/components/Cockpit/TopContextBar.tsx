import { RiArrowLeftLine, RiSearchLine, RiSettings3Line } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";

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
 * - Right side: Search icon, Settings icon, user avatar
 * - z-index 40 per D49
 * - h-14 (56px)
 *
 * On mobile, search icon is hidden to save space (settings + avatar remain).
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
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "text-text-sub hover:bg-bg-weak",
                "transition-colors duration-150",
                "motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
              )}
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

      {/* Right side */}
      <div className="flex items-center gap-1">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={formatMessage({ id: "cockpit.topBar.openSearch" })}
            className={cn(
              "hidden h-10 w-10 items-center justify-center rounded-lg",
              "text-text-sub hover:bg-bg-weak",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
              // Visible only on desktop (>=600px)
              "min-[600px]:flex"
            )}
          >
            <RiSearchLine className="h-5 w-5" />
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={formatMessage({ id: "cockpit.topBar.openSettings" })}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              "text-text-sub hover:bg-bg-weak",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            )}
          >
            <RiSettings3Line className="h-5 w-5" />
          </button>
        )}

        {userAvatar && <div className="ml-1 flex items-center">{userAvatar}</div>}
      </div>
    </header>
  );
}
