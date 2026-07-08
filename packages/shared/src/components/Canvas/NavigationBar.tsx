import { RiAddLine } from "@remixicon/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
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

export interface FabAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  labelId: string;
  disabled?: boolean;
}

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
// FAB + Speed Dial — sits in the nav bar row, far-right
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
  const speedDialShadow =
    "var(--admin-speed-dial-shadow, var(--elevation-3, 0 12px 28px rgb(15 23 42 / 0.16)))";
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

      const actionId = action.id;
      config.onAction(actionId);
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
            "rounded-md bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white",
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
        <div
          className="speed-dial-list"
          style={{
            position: "absolute",
            right: 0,
            bottom: "100%",
            marginBottom: "0.5rem",
            display: "flex",
            flexDirection: "column-reverse",
            alignItems: "flex-end",
            gap: "0.5rem",
            maxHeight:
              "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 9.5rem)",
            maxWidth: "calc(100vw - 2rem)",
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehavior: "contain",
            paddingBlock: "0.125rem",
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
                  "border",
                  "text-sm font-medium text-text-strong",
                  "transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-tint,59_130_246)))]",
                  "disabled:cursor-not-allowed disabled:opacity-55",
                  "speed-dial-item",
                  "motion-reduce:animate-none"
                )}
                style={{
                  maxWidth: "calc(100vw - 2rem)",
                  background: "var(--admin-speed-dial-bg, var(--color-material-regular))",
                  borderColor: "var(--admin-speed-dial-border, rgb(var(--stroke-soft-200)))",
                  boxShadow:
                    focusedSpeedDialActionId === action.id
                      ? `0 0 0 2px rgb(var(--tone-focus-ring, var(--tone-tint, 59 130 246))), ${speedDialShadow}`
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

      {/*
        FAB button. Colour is delivered via inline style, not Tailwind utilities:
        this component lives in packages/shared, which the admin/client builds do
        NOT scan, so `bg-[…]`/`text-[…]`/`border-[…]` colour utilities silently
        fail to generate there (CLAUDE.md "Known Gotchas") — that was the
        dark-icon-on-tone-background bug. Same reason the layer positioning below
        uses inline style. Tokens resolve correctly in light + dark; the focus-ring
        colour and icon-rotation transition live in admin CSS keyed on
        [data-slot="fab-button"]. Shadows and the decorative 35%-white border stay
        as class utilities (Storybook fidelity); in admin the shadow comes from
        --admin-chrome-shadow and the border falls back to currentColor.
      */}
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
        style={{
          background: "rgb(var(--tone-action, var(--primary-action)))",
          color: "rgb(var(--tone-on-action, var(--primary-action-foreground)))",
        }}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-full border border-white/35",
          mobileFloating ? "h-14 gap-2 px-5" : "h-12 w-12",
          "shadow-[0_20px_34px_rgba(15,23,42,0.24),inset_0_0_0_1px_rgba(255,255,255,0.24)]",
          "transition-all hover:scale-105 hover:shadow-[0_24px_40px_rgba(15,23,42,0.28),inset_0_0_0_1px_rgba(255,255,255,0.28)]",
          mobileFloating &&
            "shadow-[0_24px_44px_rgb(var(--tone-tint,59_130_246)/0.32),inset_0_0_0_1px_rgba(255,255,255,0.24)]",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "motion-reduce:transition-none"
        )}
      >
        <FabIcon className={cn("h-5 w-5", speedDialOpen && "rotate-45")} />
        {mobileFloating && isSingleAction && (
          <span className="text-sm font-semibold">{floatingActionLabel}</span>
        )}
      </button>

      {/* Dismiss backdrop when speed dial is open */}
      {speedDialOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[-1] cursor-default"
          style={{ position: "fixed", inset: 0, zIndex: -1, cursor: "default" }}
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
    bottom: "var(--admin-nav-offset-desktop, 20px)",
    left: 0,
    right: 0,
    marginInline: "auto",
    zIndex: "var(--z-nav)",
    "--admin-nav-item-count": String(desktopSlots.length),
  } as CSSProperties;

  return (
    <>
      {!isLargeDesktop && fab && !hideMobileChrome ? (
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

      {isDesktop && desktopSlots.length > 1 && (
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
            "border border-stroke-soft-200 bg-bg-white-0 shadow-[var(--edge-rest),_var(--elevation-2)]"
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

      {!isDesktop && mobileSlots.length > 1 && !hideMobileChrome && (
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
            "border border-stroke-soft-200 bg-bg-white-0 shadow-[var(--edge-rest),_var(--elevation-3)]"
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
