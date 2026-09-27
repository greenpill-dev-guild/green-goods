import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import { selectNavigationBarModel } from "./NavigationBar.model";
import { FabButton } from "./NavigationBarFab";
import type { ViewAction } from "./viewActions.types";
import { useCanvasMobileChromeHidden } from "./useCanvasMobileChromeHidden";

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
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

/** A view action as the speed dial shows it, disabled reason included. */
export type FabAction = Pick<
  ViewAction,
  "id" | "icon" | "label" | "labelId" | "disabled" | "disabledReasonId" | "disabledReason"
>;

export interface FabConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  actions: FabAction[];
  onAction: (actionId: string) => void;
}

export interface NavigationBarProps {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
  /** FAB config — desktop docks with nav, mobile floats above nav. */
  fab?: FabConfig | null;
}

// ----------------------------------------------------------------------------
// NavItem sub-component — icon + label inside a floating dock well
// ----------------------------------------------------------------------------

interface NavItemProps {
  slot: ToolbarSlot;
  isActive: boolean;
  onNavigate: (path: string) => void;
  label: string;
  mobile?: boolean;
}

function NavItem({ slot, isActive, onNavigate, label, mobile = false }: NavItemProps) {
  const Icon = slot.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(slot.path)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden",
        mobile
          ? "min-h-[3.75rem] min-w-0 flex-1 flex-col rounded-[1.15rem] px-1.5 py-2"
          : "min-w-[4.25rem] rounded-[1.1rem] px-3 py-2",
        "transition-[background-color,color,box-shadow] duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
        "motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-tint,59_130_246)))]",
        isActive
          ? "bg-[rgb(var(--tone-primary-container,var(--blue-100)))] text-[rgb(var(--tone-on-primary-container,var(--blue-900)))] shadow-[inset_0_0_0_1px_rgb(var(--tone-tint,59_130_246)/0.18),0_16px_30px_rgb(var(--tone-tint,59_130_246)/0.18)]"
          : "text-text-sub hover:bg-white/60 hover:text-text-strong"
      )}
      data-component="NavigationBar"
      data-slot="item"
      data-state={isActive ? "active" : "inactive"}
      data-item-id={slot.id}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          mobile ? "h-8 w-8" : "h-9 w-9",
          isActive
            ? "bg-white/78 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.58),0_6px_16px_rgb(var(--tone-tint,59_130_246)/0.18)]"
            : "bg-black/3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] group-hover:bg-white/72"
        )}
        data-slot="icon"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-[11px] font-medium leading-tight",
          mobile && "truncate",
          isActive
            ? "text-[rgb(var(--tone-on-primary-container,var(--blue-900)))]"
            : "text-text-soft"
        )}
        data-slot="label"
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
 * Floating dock navigation bar.
 *
 * - Desktop (>=600px): Centered floating pill at bottom
 * - Mobile (<600px): Full-width bar at bottom with safe-area inset
 * - Always shows icon + label (no tooltip-only pattern)
 * - Single DOM tree — no separate desktop/mobile navs
 * - Shared liquid/material visual language across desktop and mobile
 */
export function NavigationBar({ slots, activePath, onNavigate, fab }: NavigationBarProps) {
  const { formatMessage } = useIntl();
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 600px)").matches
  );
  // Tier 2e of the admin design handoff (audit §5.4.4): the FAB is hidden at
  // >=1024px so the page header carries the inline header actions instead.
  // Below 1024px, FAB+speed-dial floats above the navbar on tablet and mobile.
  const [isLargeDesktop, setIsLargeDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  const hideMobileChrome = useCanvasMobileChromeHidden();
  const { desktopSlots, mobileSlots, shouldRender, showMobileFab, showDesktopNav, showMobileNav } =
    useMemo(
      () =>
        selectNavigationBarModel(slots, {
          isDesktop,
          isLargeDesktop,
          hideMobileChrome,
          hasFab: Boolean(fab),
        }),
      [slots, isDesktop, isLargeDesktop, hideMobileChrome, fab]
    );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 600px)");
    const syncDesktop = (event?: MediaQueryListEvent) => {
      setIsDesktop(event ? event.matches : mediaQuery.matches);
    };

    syncDesktop();
    mediaQuery.addEventListener("change", syncDesktop);
    return () => mediaQuery.removeEventListener("change", syncDesktop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncLargeDesktop = (event?: MediaQueryListEvent) => {
      setIsLargeDesktop(event ? event.matches : mediaQuery.matches);
    };

    syncLargeDesktop();
    mediaQuery.addEventListener("change", syncLargeDesktop);
    return () => mediaQuery.removeEventListener("change", syncLargeDesktop);
  }, []);

  if (!shouldRender) return null;

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });
  const desktopNavStyle = {
    position: "fixed",
    bottom: "var(--admin-nav-offset-desktop, 20px)",
    left: 0,
    right: 0,
    marginInline: "auto",
    zIndex: "var(--z-nav)",
    "--admin-nav-item-count": String(desktopSlots.length),
  } as CSSProperties;

  return (
    <>
      {showMobileFab && fab ? (
        // Tier 2e: Floating FAB layer for tablet (600–1023px) and mobile (<600px).
        // Hidden at >=1024px per audit §5.4.4 — desktop puts inline header actions
        // in the page header instead.
        // Inline-style position: Tailwind v4 does not scan packages/shared/src/
        // from admin/client builds, so `fixed`, `inset-x-0`, `bottom-[…]`, `z-nav`,
        // and `px-4` would silently fail to generate. See CLAUDE.md "Known Gotchas".
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
            zIndex: "var(--z-nav)",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            pointerEvents: "none",
          }}
          data-component="NavigationBar"
          data-slot="mobile-fab-layer"
        >
          <div
            style={{
              marginLeft: "auto",
              marginRight: "auto",
              width: "100%",
              maxWidth: "var(--admin-main-max-width, 1400px)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ pointerEvents: "auto" }}>
              <FabButton config={fab} mobileFloating />
            </div>
          </div>
        </div>
      ) : null}

      {showDesktopNav && (
        <nav
          aria-label={navLabel}
          data-component="NavigationBar"
          data-slot="desktop"
          data-state="visible"
          // Inline style for `position: fixed; bottom; left; right; z-index` per
          // CLAUDE.md "Known Gotchas" — Tailwind v4 doesn't scan packages/shared
          // from admin/client builds, so positional utilities can silently fail
          // to compile. Bottom offset reads the admin sheet-system token (single
          // source of truth shared with the sheet-clearance calc); the 20px
          // default preserves the handoff contract for any non-admin consumer.
          style={desktopNavStyle}
          className={cn(
            "canvas-navigation-bar flex w-max items-center",
            "gap-1.5 rounded-2xl px-2.5 py-2",
            "border border-stroke-soft-200 bg-bg-white-0 shadow-[var(--edge-rest),_var(--m3-elevation-1)]"
          )}
          data-item-count={desktopSlots.length}
        >
          {desktopSlots.map((slot) => (
            <NavItem
              key={slot.id}
              slot={slot}
              isActive={activePath === slot.path}
              onNavigate={onNavigate}
              label={formatMessage({ id: slot.labelId })}
            />
          ))}
        </nav>
      )}

      {/* Tier 2e: desktop-docked FAB rendering removed per audit §5.4.4 — at
          >=1024px the page header's inline header actions carry the creation
          flows; no FAB on desktop. The mobile-floating FAB block above now
          covers tablet (600–1023px) too. */}

      {showMobileNav && (
        <nav
          aria-label={navLabel}
          data-component="NavigationBar"
          data-slot="mobile"
          data-state="visible"
          // Inline-style position: admin/client builds do not scan shared JSX for
          // arbitrary `bottom-[...]` or `inset-x-*` classes. Keep only the visual
          // treatment in classes so Storybook stays close to the shared source.
          style={{
            position: "fixed",
            left: "0.75rem",
            right: "0.75rem",
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            zIndex: "var(--z-nav)",
          }}
          className={cn(
            "canvas-navigation-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-nav flex items-start gap-1.5 rounded-2xl px-2 py-2",
            "border border-stroke-soft-200 bg-bg-white-0 shadow-[var(--edge-rest),_var(--m3-elevation-2)]"
          )}
        >
          {mobileSlots.map((slot) => (
            <NavItem
              key={slot.id}
              slot={slot}
              isActive={activePath === slot.path}
              onNavigate={onNavigate}
              label={formatMessage({ id: slot.labelId })}
              mobile
            />
          ))}
        </nav>
      )}
    </>
  );
}
