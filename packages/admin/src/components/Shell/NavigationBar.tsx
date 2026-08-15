import {
  cn,
  useCanvasMobileChromeHidden,
  type FabAction,
  type FabConfig,
  type NavigationBarProps,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiAddLine } from "@remixicon/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";

// ----------------------------------------------------------------------------
// Admin fork of the shared Canvas NavigationBar (Cockpit M3, finished — 1a).
//
// Forked so the cockpit's nav styling lives in JSX that admin's Tailwind
// content scan reaches, ending the descendant-selector overrides that
// previously restyled the shared component from admin-m3-overrides.css.
// Behavior (speed dial, keyboard navigation, breakpoints, role-based slots)
// is unchanged from the shared component; the props/types stay shared so the
// two cannot drift structurally.
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
// FAB + Speed Dial — floats above the nav bar on tablet/mobile
// ----------------------------------------------------------------------------

interface FabButtonProps {
  config: FabConfig;
  mobileFloating?: boolean;
}

function FabButton({ config, mobileFloating = false }: FabButtonProps) {
  const { formatMessage } = useIntl();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [focusedSpeedDialActionId, setFocusedSpeedDialActionId] = useState<string | null>(null);
  const fabButtonRef = useRef<HTMLButtonElement>(null);
  const speedDialActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const speedDialShadow = "var(--admin-speed-dial-shadow, var(--m3-elevation-2))";
  const isSingleAction = config.actions.length <= 1;
  const enabledSpeedDialActions = useMemo(
    () => config.actions.filter((action) => !action.disabled),
    [config.actions]
  );
  // Multi-action FABs present a neutral "+" opener (rotates to "×" on open), not
  // any one action's glyph — so the collapsed button reads as "open the menu",
  // never as a duplicate of the primary action inside the dial. Single-action
  // FABs keep their own action icon (direct-fire, no menu).
  const FabIcon = isSingleAction ? config.icon : RiAddLine;
  const floatingActionLabel =
    isSingleAction && config.actions[0]
      ? formatMessage({ id: config.actions[0].labelId })
      : config.label;

  const handleClick = useCallback(() => {
    if (isSingleAction && config.actions[0]) {
      config.onAction(config.actions[0].id);
    } else {
      setSpeedDialOpen((prev) => !prev);
    }
  }, [isSingleAction, config]);

  const closeSpeedDial = useCallback(() => {
    setSpeedDialOpen(false);
    setFocusedSpeedDialActionId(null);
  }, []);

  const focusSpeedDialAction = useCallback((actionId: string) => {
    const actionNode = speedDialActionRefs.current.get(actionId);
    if (!actionNode) return;

    actionNode.focus();
    setFocusedSpeedDialActionId(actionId);
  }, []);

  const handleAction = useCallback(
    (action: FabAction) => {
      if (action.disabled) return;

      config.onAction(action.id);
      closeSpeedDial();
    },
    [closeSpeedDial, config]
  );

  const handleSpeedDialKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSpeedDial();
        fabButtonRef.current?.focus();
        return;
      }

      const enabledActionIds = enabledSpeedDialActions.map((action) => action.id);
      if (enabledActionIds.length === 0) return;

      const currentActionId =
        (event.target as HTMLElement)
          .closest<HTMLElement>("[data-slot='speed-dial-item']")
          ?.getAttribute("data-item-id") ?? focusedSpeedDialActionId;
      const currentIndex = currentActionId ? enabledActionIds.indexOf(currentActionId) : -1;
      let nextIndex: number | null = null;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % enabledActionIds.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex =
          currentIndex === -1
            ? enabledActionIds.length - 1
            : (currentIndex - 1 + enabledActionIds.length) % enabledActionIds.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = enabledActionIds.length - 1;
      }

      if (nextIndex === null) return;

      event.preventDefault();
      focusSpeedDialAction(enabledActionIds[nextIndex]!);
    },
    [closeSpeedDial, enabledSpeedDialActions, focusSpeedDialAction, focusedSpeedDialActionId]
  );

  useEffect(() => {
    if (!speedDialOpen || isSingleAction) return;

    const firstEnabledAction = enabledSpeedDialActions[0];
    if (!firstEnabledAction) return;

    focusSpeedDialAction(firstEnabledAction.id);
  }, [enabledSpeedDialActions, focusSpeedDialAction, isSingleAction, speedDialOpen]);

  return (
    <div
      className={cn("group/fab relative flex items-center", !mobileFloating && "ml-auto")}
      data-component="NavigationBar"
      data-slot={mobileFloating ? "mobile-fab" : "desktop-fab"}
      data-state={speedDialOpen ? "open" : "closed"}
      data-mode={isSingleAction ? "single-action" : "speed-dial"}
    >
      {/* Tooltip — shows on hover for single-action mode */}
      {isSingleAction && (
        <div
          className={cn(
            "pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap",
            "rounded-[var(--m3-shape-xs)] bg-[rgb(var(--m3-inverse-surface)/0.9)] px-2.5 py-1 text-label-md font-medium text-[rgb(var(--m3-inverse-on-surface))]",
            "opacity-0 transition-opacity group-hover/fab:opacity-100",
            "motion-reduce:transition-none"
          )}
          data-slot="tooltip"
        >
          {floatingActionLabel}
        </div>
      )}
      {/* Speed dial items — animate upward from FAB */}
      {speedDialOpen && !isSingleAction && (
        <div // eslint-disable-line jsx-a11y/interactive-supports-focus -- menu items are focusable <button role="menuitem"> children; focus moves to the first on open
          className="speed-dial-list absolute bottom-full right-0 mb-2 flex flex-col-reverse items-end gap-2 overflow-y-auto overflow-x-hidden overscroll-contain py-0.5"
          style={{
            maxHeight:
              "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 9.5rem)",
            maxWidth: "calc(100vw - 2rem)",
          }}
          data-slot="speed-dial"
          data-state="open"
          role="menu"
          aria-label={config.label}
          onKeyDown={handleSpeedDialKeyDown}
        >
          {config.actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                ref={(node) => {
                  if (node) {
                    speedDialActionRefs.current.set(action.id, node);
                  } else {
                    speedDialActionRefs.current.delete(action.id);
                  }
                }}
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 py-2",
                  "border border-[color:var(--admin-speed-dial-border,rgb(var(--stroke-soft-200)))]",
                  "bg-[rgb(var(--admin-surface-0))]",
                  "text-body-md font-medium text-text-strong",
                  "focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-55",
                  "speed-dial-item",
                  "motion-reduce:animate-none"
                )}
                style={{
                  maxWidth: "calc(100vw - 2rem)",
                  boxShadow:
                    focusedSpeedDialActionId === action.id
                      ? `0 0 0 2px rgb(var(--tone-focus-ring, var(--m3-primary))), ${speedDialShadow}`
                      : speedDialShadow,
                }}
                onFocus={() => setFocusedSpeedDialActionId(action.id)}
                onBlur={() => {
                  setFocusedSpeedDialActionId((current) =>
                    current === action.id ? null : current
                  );
                }}
                aria-label={formatMessage({ id: action.labelId })}
                data-slot="speed-dial-item"
                data-item-id={action.id}
                data-disabled={action.disabled ? "true" : undefined}
              >
                <ActionIcon className="h-4 w-4" />
                <span className="min-w-0 whitespace-normal text-left leading-snug">
                  {formatMessage({ id: action.labelId })}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB — the one tone-filled control in the floating chrome. Warm chrome
          shadow at rest; hover feedback is the state layer + elevation, never a
          hue shift or scale jump. */}
      <button
        ref={fabButtonRef}
        type="button"
        onClick={handleClick}
        aria-label={
          isSingleAction ? config.label : formatMessage({ id: "cockpit.fab.openActions" })
        }
        aria-haspopup={isSingleAction ? undefined : "menu"}
        aria-expanded={speedDialOpen || undefined}
        data-slot="fab-button"
        data-state={speedDialOpen ? "open" : "closed"}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-full",
          mobileFloating ? "h-14 gap-2 px-5" : "h-12 w-12",
          "bg-[rgb(var(--tone-action,var(--primary-action)))] text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
          "shadow-[var(--admin-chrome-shadow)]",
          "m3-state-layer [--state-layer-color:var(--tone-on-action,var(--primary-action-foreground))]",
          "active:scale-95 motion-reduce:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2"
        )}
      >
        <FabIcon
          className={cn(
            "h-5 w-5 transition-[rotate] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] motion-reduce:transition-none",
            speedDialOpen && "rotate-45"
          )}
        />
        {mobileFloating && isSingleAction && (
          <span className="text-body-md font-semibold">{floatingActionLabel}</span>
        )}
      </button>

      {/* Dismiss backdrop when speed dial is open */}
      {speedDialOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[-1] cursor-default"
          onClick={() => setSpeedDialOpen(false)}
          aria-hidden="true"
          tabIndex={-1}
          data-slot="speed-dial-backdrop"
        />
      )}
    </div>
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
