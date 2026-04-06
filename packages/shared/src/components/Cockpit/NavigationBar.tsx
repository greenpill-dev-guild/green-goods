import React, { useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import { useEventListener } from "../../hooks/utils/useEventListener";
import type { ToolbarSlot } from "./FloatingToolbar";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface NavigationBarProps {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
  /** Optional leading content (e.g., GardenChip) — visible on desktop only */
  leading?: React.ReactNode;
  /** Optional trailing content (e.g., UserMenu) — visible on desktop only */
  trailing?: React.ReactNode;
}

// ----------------------------------------------------------------------------
// NavItem sub-component — icon + label, MD3 active indicator pill
// ----------------------------------------------------------------------------

interface NavItemProps {
  slot: ToolbarSlot;
  isActive: boolean;
  onNavigate: (path: string) => void;
  label: string;
}

function NavItem({ slot, isActive, onNavigate, label }: NavItemProps) {
  const Icon = slot.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(slot.path)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-0.5",
        "min-w-[3.5rem] px-3 py-1.5 rounded-xl",
        "transition-colors duration-200",
        "motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
        isActive ? "bg-primary-alpha-10 text-primary-dark" : "text-text-sub hover:bg-bg-weak"
      )}
    >
      <Icon className="h-5 w-5" />
      <span
        className={cn(
          "text-[11px] font-medium leading-tight",
          isActive ? "text-primary-dark" : "text-text-soft"
        )}
      >
        {label}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// NavigationBar
// ----------------------------------------------------------------------------

/**
 * MD3-style floating navigation bar.
 *
 * - Desktop (>=600px): Centered floating pill at bottom with leading/trailing slots
 * - Mobile (<600px): Full-width bar at bottom with safe-area inset
 * - Always shows icon + label (no tooltip-only pattern)
 * - Single DOM tree — no separate desktop/mobile navs
 * - Active indicator: pill-shaped bg-primary-alpha-10
 *
 * Replaces FloatingToolbar (deprecated).
 */
export function NavigationBar({
  slots,
  activePath,
  onNavigate,
  leading,
  trailing,
}: NavigationBarProps) {
  const { formatMessage } = useIntl();
  const visibleSlots = slots.filter((s) => s.visible);

  // Track virtual keyboard visibility to hide nav bar
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;

  useEventListener(viewport, "resize" as never, () => {
    if (viewport) {
      setKeyboardOpen(viewport.height < window.innerHeight * 0.75);
    }
  });

  if (visibleSlots.length === 0) return null;

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });

  return (
    <nav
      aria-label={navLabel}
      className={cn(
        // Base — always floating, z-30
        "fixed z-30 flex items-center",
        // Surface material — frosted glass
        "bg-bg-soft/95 shadow-md",
        "backdrop-blur supports-[backdrop-filter]:bg-bg-soft/80",
        // Desktop (>=600px): centered floating pill
        "min-[600px]:bottom-4 min-[600px]:left-1/2 min-[600px]:-translate-x-1/2",
        "min-[600px]:gap-1 min-[600px]:rounded-2xl min-[600px]:px-2 min-[600px]:py-1.5",
        // Mobile (<600px): full-width bottom bar with insets
        "max-[599px]:inset-x-0 max-[599px]:bottom-0",
        "max-[599px]:justify-around max-[599px]:rounded-t-2xl",
        "max-[599px]:border-t max-[599px]:border-stroke-sub",
        "max-[599px]:px-1 max-[599px]:pt-1",
        "max-[599px]:pb-[max(0.375rem,env(safe-area-inset-bottom))]",
        // Spring easing entrance animation
        "animate-[nav-bar-enter_300ms_cubic-bezier(0.16,1,0.3,1)_both]",
        "motion-reduce:animate-none",
        // Hide when keyboard is open
        keyboardOpen && "max-[599px]:hidden"
      )}
    >
      {/* Leading slot — desktop only */}
      {leading && (
        <div className="hidden min-[600px]:flex items-center pr-1 border-r border-stroke-soft mr-1">
          {leading}
        </div>
      )}

      {/* Nav items — always visible */}
      {visibleSlots.map((slot) => (
        <NavItem
          key={slot.id}
          slot={slot}
          isActive={activePath === slot.path}
          onNavigate={onNavigate}
          label={formatMessage({ id: slot.labelId })}
        />
      ))}

      {/* Trailing slot — desktop only */}
      {trailing && (
        <div className="hidden min-[600px]:flex items-center pl-1 border-l border-stroke-soft ml-1">
          {trailing}
        </div>
      )}
    </nav>
  );
}
