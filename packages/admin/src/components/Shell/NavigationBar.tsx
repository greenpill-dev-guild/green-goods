import {
  cn,
  useCanvasMobileChromeHidden,
  type NavigationBarProps,
  type ToolbarSlot,
} from "@green-goods/shared";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { FabButton } from "./FabButton";

// ----------------------------------------------------------------------------
// Admin fork of the shared Canvas NavigationBar (Cockpit M3, finished — 1a).
//
// Forked so the cockpit's nav styling lives in JSX that admin's Tailwind
// content scan reaches, ending the descendant-selector overrides that
// previously restyled the shared component from admin-m3-overrides.css.
// Behavior (speed dial, keyboard navigation, breakpoints, role-based slots)
// is unchanged from the shared component; the props/types stay shared so the
// two cannot drift structurally. The FAB + speed dial live in ./FabButton.
//
// Anatomy (1a Hub mockup):
// - Desktop ≥600px: centered floating pill — grid of 94px wells, 4px 6px
//   padding, 2px gap. Material (translucent surface + blur + warm shadow)
//   comes from the `.canvas-navigation-bar` chrome rules in index.css.
// - Item: icon pill 44×28 (desktop) / 56×32 (mobile), label 12/16 +0.5px.
//   Active: tone-primary-container pill + on-primary-container icon,
//   label weight 600 ink. Inactive: transparent pill, label 500 sub,
//   hover opacity 0.75 — never a hue shift.
// - Mobile <600px: full-width M3 bottom bar (80dp) at the screen edge.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// NavItem — icon pill + label inside a dock well
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
        "flex min-w-0 cursor-pointer flex-col items-center justify-center rounded-full bg-transparent",
        mobile ? "flex-1 gap-1 px-0 py-1" : "gap-0.5 px-2.5 pb-1 pt-0.5",
        !isActive && "hover:opacity-75",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
      )}
      data-component="NavigationBar"
      data-slot="item"
      data-state={isActive ? "active" : "inactive"}
      data-item-id={slot.id}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          mobile ? "h-8 w-14" : "h-7 w-11",
          isActive
            ? "bg-[rgb(var(--tone-primary-container,var(--m3-secondary-container)))] text-[rgb(var(--tone-on-primary-container,var(--m3-on-surface)))]"
            : "bg-transparent text-[rgb(var(--m3-on-surface-variant))]"
        )}
        data-slot="icon"
      >
        <Icon className={mobile ? "h-6 w-6" : "h-5 w-5"} />
      </span>
      <span
        className={cn(
          "text-label-md leading-4 tracking-[0.03125rem]",
          mobile && "max-w-full truncate",
          isActive
            ? "font-semibold text-[rgb(var(--m3-on-surface))]"
            : "font-medium text-[rgb(var(--m3-on-surface-variant))]"
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
 * Floating dock navigation bar (admin fork).
 *
 * - Desktop (>=600px): centered floating pill at the bottom — a grid of equal
 *   94px wells so tab targets stay stable as slots appear/disappear
 * - Mobile (<600px): full-width M3 bottom bar at the screen edge (80dp)
 * - Always shows icon + label; single DOM tree per breakpoint
 * - Material lives on `.canvas-navigation-bar` in index.css (chrome contract)
 */
export function NavigationBar({ slots, activePath, onNavigate, fab }: NavigationBarProps) {
  const { formatMessage } = useIntl();
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 600px)").matches
  );
  // The FAB is hidden at >=1024px — the page header carries the inline header
  // actions instead. Below 1024px, FAB + speed dial float above the navbar.
  const [isLargeDesktop, setIsLargeDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  const visibleSlots = useMemo(() => slots.filter((s) => s.visible), [slots]);
  const desktopSlots = useMemo(
    () => visibleSlots.filter((slot) => !slot.mobileOnly),
    [visibleSlots]
  );
  const mobileSlots = useMemo(
    () => visibleSlots.filter((slot) => !slot.desktopOnly),
    [visibleSlots]
  );
  const hideMobileChrome = useCanvasMobileChromeHidden();

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

  // Role-based visibility: no nav bar if ≤1 tab and no FAB
  if (visibleSlots.length === 0 && !fab) return null;
  if (desktopSlots.length <= 1 && mobileSlots.length <= 1 && !fab) {
    return null;
  }

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });
  const desktopNavStyle = {
    position: "fixed",
    bottom: "var(--admin-nav-offset-desktop, 12px)",
    left: 0,
    right: 0,
    marginInline: "auto",
    zIndex: "var(--z-nav)",
    gridTemplateColumns: `repeat(${desktopSlots.length}, var(--admin-nav-item-width-desktop, 5.875rem))`,
    width: `min(calc(${desktopSlots.length} * var(--admin-nav-item-width-desktop, 5.875rem) + 0.75rem), calc(100vw - 2rem))`,
  } as CSSProperties;

  return (
    <>
      {!isLargeDesktop && fab && !hideMobileChrome ? (
        // Floating FAB layer for tablet (600–1023px) and mobile (<600px);
        // desktop puts inline header actions in the page header instead.
        <div
          className="pointer-events-none fixed inset-x-0 z-nav px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
          data-component="NavigationBar"
          data-slot="mobile-fab-layer"
        >
          <div
            className="mx-auto flex w-full justify-end"
            style={{ maxWidth: "var(--admin-main-max-width, 1400px)" }}
          >
            <div className="pointer-events-auto">
              <FabButton config={fab} mobileFloating />
            </div>
          </div>
        </div>
      ) : null}

      {isDesktop && desktopSlots.length > 1 && (
        <nav
          aria-label={navLabel}
          data-component="NavigationBar"
          data-slot="desktop"
          data-state="visible"
          style={desktopNavStyle}
          className="canvas-navigation-bar grid min-h-14 items-stretch gap-0.5 rounded-full px-1.5 py-1"
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

      {!isDesktop && mobileSlots.length > 1 && !hideMobileChrome && (
        <nav
          aria-label={navLabel}
          data-component="NavigationBar"
          data-slot="mobile"
          data-state="visible"
          className="canvas-navigation-bar fixed inset-x-0 bottom-0 z-nav flex min-h-20 items-start rounded-none px-2 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
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
