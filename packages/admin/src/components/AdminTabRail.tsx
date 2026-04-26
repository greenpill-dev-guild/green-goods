import { cn, useMediaQuery } from "@green-goods/shared";
import { type ComponentType, type ReactNode, useLayoutEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AdminTab {
  id: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
  disabled?: boolean;
}

export interface AdminTabRailProps {
  tabs: AdminTab[];
  activeId: string;
  ariaLabel: string;
  onChange: (id: string) => void;
  idBase?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminTabRail — M3 Primary Navigation Tabs
 *
 * Implements the Material Design 3 primary navigation tab anatomy:
 * - Flat surface container (corner-none) with bottom border
 * - 3dp active indicator underline that slides between tabs via spring animation
 * - State layer on each button (m3-state-layer from admin-m3-tokens.css)
 * - 48dp tab height with M3 label-large typography
 * - M3 notification badge on count prop (16dp, corner-full, error bg)
 *
 * Accepts the same data contract as the shared shared stage tab rail so
 * admin views can swap imports without any other code changes.
 */
export function AdminTabRail({
  tabs,
  activeId,
  ariaLabel,
  onChange,
  idBase,
  className,
}: AdminTabRailProps) {
  const hasIcons = tabs.some((tab) => Boolean(tab.icon));
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Track the active indicator geometry (left offset + width)
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // One ref per tab button — indexed by tab position
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Measure on every activeId change (synchronously before paint to avoid flash)
  useLayoutEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
    if (activeIndex === -1) return;

    const el = tabRefs.current[activeIndex];
    if (!el) return;

    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return;

    setIndicator({
      left: el.offsetLeft,
      width: el.offsetWidth,
    });
  }, [activeId, tabs]);

  return (
    <div
      data-component="AdminTabRail"
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        // Container: flat surface, bottom border only
        "relative flex w-full",
        "bg-[rgb(var(--m3-surface))]",
        "border-b border-[rgb(var(--m3-outline-variant))]",
        className
      )}
    >
      {/* Sliding active indicator — 3dp height, rounded top corners */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 z-10 h-[3px] rounded-t-sm bg-[rgb(var(--m3-primary))] motion-reduce:transition-none"
        style={{
          left: indicator.left,
          width: indicator.width,
          transition: prefersReducedMotion
            ? "none"
            : `left var(--spring-spatial-duration) var(--spring-spatial-easing),
               width var(--spring-spatial-duration) var(--spring-spatial-easing)`,
        }}
      />

      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-selected={active}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            data-active={active ? "true" : "false"}
            data-disabled={tab.disabled ? "true" : "false"}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
            className={cn(
              // Layout: equal share, column or row depending on icon presence
              "m3-state-layer",
              "relative flex flex-1 items-center justify-center",
              hasIcons ? "h-12 flex-row gap-2 px-4" : "h-12 flex-row gap-1.5 px-4",
              // Typography: M3 label-large
              "text-label-lg font-medium leading-snug",
              // Color: active vs inactive
              active
                ? "text-[rgb(var(--m3-primary))] [--state-layer-color:var(--m3-primary)]"
                : "text-[rgb(var(--m3-on-surface-variant))] [--state-layer-color:var(--m3-on-surface)]",
              // Focus ring
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--m3-primary))]",
              // Disabled
              tab.disabled && "pointer-events-none opacity-[0.38]"
              // No transition on tab button itself (indicator handles motion)
            )}
          >
            {/* Icon — 18dp, inherits text color */}
            {Icon ? (
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active
                    ? "text-[rgb(var(--m3-primary))]"
                    : "text-[rgb(var(--m3-on-surface-variant))]"
                )}
                aria-hidden
              />
            ) : null}

            {/* Label */}
            <span className="truncate">{tab.label}</span>

            {/* Inline count badge */}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center",
                  "min-w-[1.125rem] h-[1.125rem] px-1",
                  "rounded-[var(--m3-shape-full)]",
                  "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))]",
                  "text-[0.625rem] font-bold leading-none",
                  "pointer-events-none select-none"
                )}
                aria-label={`${tab.count} items`}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
