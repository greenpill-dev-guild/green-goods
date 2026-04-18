import { useCallback, useEffect, useMemo, useState } from "react";
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
        "transition-all duration-250",
        "motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--workspace-tint,59_130_246))]",
        isActive
          ? "bg-[rgb(var(--ws-primary-container,var(--blue-100)))] text-[rgb(var(--ws-on-primary-container,var(--blue-900)))] shadow-[inset_0_0_0_1px_rgb(var(--workspace-tint,59_130_246)/0.18),0_16px_30px_rgb(var(--workspace-tint,59_130_246)/0.18)]"
          : "text-text-sub hover:bg-white/60 hover:text-text-strong"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          mobile ? "h-8 w-8" : "h-9 w-9",
          isActive
            ? "bg-white/78 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.58),0_6px_16px_rgb(var(--workspace-tint,59_130_246)/0.18)]"
            : "bg-black/3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] group-hover:bg-white/72"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-[11px] font-medium leading-tight",
          mobile && "truncate",
          isActive ? "text-[rgb(var(--ws-on-primary-container,var(--blue-900)))]" : "text-text-soft"
        )}
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
  const isSingleAction = config.actions.length <= 1;
  const FabIcon = config.icon;
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

  const handleAction = useCallback(
    (actionId: string) => {
      config.onAction(actionId);
      setSpeedDialOpen(false);
    },
    [config]
  );

  return (
    <div className={cn("group/fab relative flex items-center", !mobileFloating && "ml-auto")}>
      {/* Tooltip — shows on hover for single-action mode */}
      {isSingleAction && (
        <div
          className={cn(
            "pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap",
            "rounded-md bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white",
            "opacity-0 transition-opacity group-hover/fab:opacity-100",
            "motion-reduce:transition-none"
          )}
        >
          {floatingActionLabel}
        </div>
      )}
      {/* Speed dial items — animate upward from FAB */}
      {speedDialOpen && !isSingleAction && (
        <div className="absolute bottom-full right-0 mb-2 flex flex-col-reverse items-end gap-2">
          {config.actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full px-3 py-2",
                  "border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.86)_100%)] shadow-[0_16px_30px_rgba(15,23,42,0.14)]",
                  "dark:border-stroke-soft dark:bg-[linear-gradient(180deg,rgb(var(--bg-soft-200)/0.92)_0%,rgb(var(--bg-weak-50)/0.86)_100%)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.3)]",
                  "text-sm font-medium text-text-strong",
                  "transition-all hover:shadow-[0_20px_34px_rgba(15,23,42,0.18)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--workspace-tint,59_130_246))]",
                  "motion-reduce:animate-none"
                )}
                style={{
                  animation: `speed-dial-in 200ms var(--spring-spatial-easing, cubic-bezier(0.16, 1, 0.3, 1)) ${index * 50}ms both`,
                }}
                aria-label={formatMessage({ id: action.labelId })}
              >
                <ActionIcon className="h-4 w-4" />
                <span>{formatMessage({ id: action.labelId })}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={config.label}
        aria-expanded={speedDialOpen || undefined}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-full border border-white/35",
          mobileFloating ? "h-14 gap-2 px-5" : "h-12 w-12",
          "bg-[rgb(var(--ws-primary,var(--primary-base)))] text-[rgb(var(--ws-on-primary,255_255_255))] shadow-[0_20px_34px_rgba(15,23,42,0.24),inset_0_0_0_1px_rgba(255,255,255,0.24)]",
          "transition-all hover:scale-105 hover:shadow-[0_24px_40px_rgba(15,23,42,0.28),inset_0_0_0_1px_rgba(255,255,255,0.28)]",
          mobileFloating &&
            "shadow-[0_24px_44px_rgb(var(--workspace-tint,59_130_246)/0.32),inset_0_0_0_1px_rgba(255,255,255,0.24)]",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--workspace-tint,59_130_246))] focus-visible:ring-offset-2",
          "motion-reduce:transition-none"
        )}
      >
        <FabIcon
          className={cn(
            "h-5 w-5 transition-transform duration-200",
            "motion-reduce:transition-none",
            speedDialOpen && "rotate-45"
          )}
        />
        {mobileFloating && (
          <span className="text-sm font-semibold tracking-[-0.01em]">{floatingActionLabel}</span>
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
  const visibleSlots = slots.filter((s) => s.visible);
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

  // Role-based visibility: no nav bar if ≤1 tab and no FAB
  if (visibleSlots.length === 0 && !fab) return null;
  if (desktopSlots.length <= 1 && mobileSlots.length <= 1 && !fab) {
    return null;
  }

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });

  return (
    <>
      {!isDesktop && fab && !hideMobileChrome ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-nav px-4 min-[600px]:hidden">
          <div className="mx-auto flex w-full max-w-[1400px] justify-end">
            <div className="pointer-events-auto">
              <FabButton config={fab} mobileFloating />
            </div>
          </div>
        </div>
      ) : null}

      {isDesktop && desktopSlots.length > 1 && (
        <nav
          aria-label={navLabel}
          className={cn(
            // Centering without transform: left:0 + right:0 + mx-auto on a w-max
            // child produces horizontal centering that survives entrance animations
            // which end with `transform: none`.
            "canvas-navigation-bar fixed bottom-4 inset-x-0 mx-auto z-nav flex w-max items-center",
            "gap-1.5 rounded-2xl px-2.5 py-2",
            "glass-ground",
            "dark:border-stroke-soft dark:bg-[linear-gradient(180deg,rgb(var(--bg-soft-200)/0.88)_0%,rgb(var(--bg-white-0)/0.76)_100%)]",
            "animate-[nav-bar-enter_var(--spring-spatial)_both]",
            "motion-reduce:animate-none"
          )}
          style={{
            boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
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

      {isDesktop && fab && (
        <div
          className={cn(
            "fixed bottom-4 right-6 z-nav",
            "animate-[nav-bar-enter_var(--spring-spatial)_both]",
            "motion-reduce:animate-none"
          )}
        >
          <FabButton config={fab} />
        </div>
      )}

      {!isDesktop && mobileSlots.length > 1 && !hideMobileChrome && (
        <nav
          aria-label={navLabel}
          className={cn(
            "canvas-navigation-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-nav flex items-start gap-1.5 rounded-2xl px-2 py-2",
            "glass-ground",
            "animate-[nav-bar-enter_var(--spring-spatial)_both]",
            "motion-reduce:animate-none"
          )}
          style={{
            boxShadow: "0 22px 44px rgba(15, 23, 42, 0.2), inset 0 0 0 1px rgba(255,255,255,0.12)",
          }}
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
