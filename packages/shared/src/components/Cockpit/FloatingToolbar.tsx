import React, { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import { useEventListener } from "../../hooks/utils/useEventListener";

/**
 * Spring easing curve for M3-style animations.
 * cubic-bezier(0.16, 1, 0.3, 1)
 */
const SPRING_EASING = "[cubic-bezier(0.16,1,0.3,1)]";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ToolbarSlot {
  id: string;
  label: string;
  labelId: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  visible: boolean;
}

export interface FloatingToolbarProps {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
}

// ----------------------------------------------------------------------------
// Tooltip sub-component (CSS-driven with group-hover + transition-delay)
// ----------------------------------------------------------------------------

interface ToolbarSlotButtonProps {
  slot: ToolbarSlot;
  isActive: boolean;
  onNavigate: (path: string) => void;
  label: string;
  /** Whether this is in the desktop (vertical) or mobile (horizontal) layout */
  layout: "vertical" | "horizontal";
  /** Whether a sibling tooltip was recently shown (instant follow-up) */
  hasRecentHover: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function ToolbarSlotButton({
  slot,
  isActive,
  onNavigate,
  label,
  layout,
  hasRecentHover,
  onHoverStart,
  onHoverEnd,
}: ToolbarSlotButtonProps) {
  const Icon = slot.icon;

  return (
    <div className="group relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <button
        type="button"
        onClick={() => onNavigate(slot.path)}
        aria-current={isActive ? "page" : undefined}
        aria-label={label}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          "transition-colors duration-200",
          `transition-timing-function-${SPRING_EASING}`,
          "motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
          isActive ? "bg-primary-alpha-10 text-primary-dark" : "text-text-sub hover:bg-bg-weak"
        )}
      >
        <Icon className="h-5 w-5" />
      </button>

      {/* Tooltip — only visible on desktop vertical layout */}
      {layout === "vertical" && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2",
            "whitespace-nowrap rounded-lg bg-bg-strong px-3 py-1.5 text-xs font-medium text-text-white",
            "opacity-0 transition-opacity duration-150",
            `transition-timing-function-${SPRING_EASING}`,
            "motion-reduce:transition-none",
            "group-hover:opacity-100",
            // 800ms delay on first hover, instant on subsequent (controlled via class)
            hasRecentHover ? "group-hover:delay-0" : "group-hover:delay-[800ms]"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// FloatingToolbar
// ----------------------------------------------------------------------------

/**
 * M3-style navigation toolbar.
 *
 * - Desktop (>=600px): Vertical floating pill on the left side
 * - Mobile (<600px): Horizontal bottom bar with safe-area inset
 *
 * Hidden slots (`visible: false`) are excluded entirely.
 * If only 1 visible slot remains, the mobile bar is hidden.
 */
export function FloatingToolbar({ slots, activePath, onNavigate }: FloatingToolbarProps) {
  const { formatMessage } = useIntl();
  const visibleSlots = slots.filter((s) => s.visible);

  // Track virtual keyboard visibility to hide mobile bottom nav
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;

  useEventListener(viewport, "resize" as never, () => {
    if (viewport) {
      // If viewport height is significantly less than window height, keyboard is open
      setKeyboardOpen(viewport.height < window.innerHeight * 0.75);
    }
  });

  // Track recent hover for instant tooltip follow-up
  const [hasRecentHover, setHasRecentHover] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverStart = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHasRecentHover(true);
  }, []);

  const handleHoverEnd = useCallback(() => {
    // Keep "recent" state for 400ms after leaving a button
    hoverTimerRef.current = setTimeout(() => {
      setHasRecentHover(false);
      hoverTimerRef.current = null;
    }, 400);
  }, []);

  if (visibleSlots.length === 0) return null;

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });

  return (
    <>
      {/* Desktop: Vertical floating toolbar */}
      <nav
        role="navigation"
        aria-label={navLabel}
        className={cn(
          "fixed left-4 top-1/2 z-30 hidden -translate-y-1/2",
          "flex-col gap-1 rounded-2xl bg-bg-soft p-2 shadow-md",
          "min-[600px]:flex"
        )}
      >
        {visibleSlots.map((slot) => (
          <ToolbarSlotButton
            key={slot.id}
            slot={slot}
            isActive={activePath === slot.path}
            onNavigate={onNavigate}
            label={formatMessage({ id: slot.labelId })}
            layout="vertical"
            hasRecentHover={hasRecentHover}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
          />
        ))}
      </nav>

      {/* Mobile: Bottom horizontal bar — hidden when only 1 visible slot or keyboard is open */}
      {visibleSlots.length > 1 && !keyboardOpen && (
        <nav
          role="navigation"
          aria-label={navLabel}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex items-center justify-around",
            "border-t border-stroke-sub bg-bg-soft",
            "pb-[env(safe-area-inset-bottom)]",
            "min-[600px]:hidden"
          )}
        >
          {visibleSlots.map((slot) => (
            <ToolbarSlotButton
              key={slot.id}
              slot={slot}
              isActive={activePath === slot.path}
              onNavigate={onNavigate}
              label={formatMessage({ id: slot.labelId })}
              layout="horizontal"
              hasRecentHover={false}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </nav>
      )}
    </>
  );
}
