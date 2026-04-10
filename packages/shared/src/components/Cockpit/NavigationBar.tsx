import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import { useEventListener } from "../../hooks/utils/useEventListener";
import type { ToolbarSlot } from "./FloatingToolbar";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

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
// NavItem sub-component — icon + label, MD3 active indicator pill
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
        "group relative flex flex-col items-center justify-center gap-0.5",
        mobile ? "min-w-0 flex-1 px-1.5 py-2 rounded-2xl" : "min-w-[3.5rem] px-3 py-1.5 rounded-xl",
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
          mobile && "truncate",
          isActive ? "text-primary-dark" : "text-text-soft"
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
    <div className={cn("relative flex items-center", !mobileFloating && "ml-auto")}>
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
                  "flex items-center gap-2 rounded-full px-3 py-2",
                  "bg-bg-white shadow-lg",
                  "text-sm font-medium text-text-strong",
                  "transition-all hover:shadow-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
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
          "flex items-center justify-center rounded-full",
          mobileFloating ? "h-14 gap-2 px-5" : "h-12 w-12",
          "bg-primary-base text-static-white shadow-lg",
          "transition-all hover:bg-primary-dark hover:shadow-xl",
          mobileFloating && "shadow-[var(--edge-hover),0_18px_36px_rgba(133,109,70,0.18)]",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
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
 * MD3-style floating navigation bar.
 *
 * - Desktop (>=600px): Centered floating pill at bottom
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
  fab,
}: NavigationBarProps) {
  const { formatMessage } = useIntl();
  const visibleSlots = slots.filter((s) => s.visible);
  const desktopSlots = useMemo(
    () => visibleSlots.filter((slot) => !slot.mobileOnly),
    [visibleSlots]
  );
  const mobileSlots = useMemo(
    () => visibleSlots.filter((slot) => !slot.desktopOnly),
    [visibleSlots]
  );

  // Track virtual keyboard visibility to hide nav bar
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;

  useEventListener(viewport, "resize" as never, () => {
    if (viewport) {
      setKeyboardOpen(viewport.height < window.innerHeight * 0.75);
    }
  });

  // Role-based visibility: no nav bar if ≤1 tab and no FAB
  if (visibleSlots.length === 0 && !fab) return null;
  if (desktopSlots.length <= 1 && mobileSlots.length <= 1 && !fab) {
    return null;
  }

  const navLabel = formatMessage({ id: "cockpit.nav.mainNavigation" });

  return (
    <>
      {fab && !keyboardOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-nav px-4 min-[600px]:hidden">
          <div className="mx-auto flex w-full max-w-[1400px] justify-end">
            <div className="pointer-events-auto">
              <FabButton config={fab} mobileFloating />
            </div>
          </div>
        </div>
      ) : null}

      {(desktopSlots.length > 1 || fab) && (
        <nav
          aria-label={navLabel}
          className={cn(
            "cockpit-navigation-bar fixed bottom-4 left-1/2 z-nav hidden -translate-x-1/2 items-center",
            "gap-1 rounded-[1.75rem] px-2 py-1.5",
            "bg-bg-soft/95 backdrop-blur-lg supports-[backdrop-filter]:bg-bg-soft/80",
            "dark:bg-bg-sub/95 dark:supports-[backdrop-filter]:bg-bg-sub/80",
            fab && "pr-2.5",
            "animate-[nav-bar-enter_300ms_cubic-bezier(0.16,1,0.3,1)_both]",
            "motion-reduce:animate-none min-[600px]:flex"
          )}
          style={{
            boxShadow:
              "var(--edge-rest, 0 0 0 1px rgba(0,0,0,0.06)), 0 16px 34px rgba(38, 28, 18, 0.12)",
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
          {fab && <FabButton config={fab} />}
        </nav>
      )}

      {mobileSlots.length > 1 && !keyboardOpen && (
        <nav
          aria-label={navLabel}
          className={cn(
            "cockpit-navigation-bar fixed inset-x-0 bottom-0 z-nav flex items-center gap-1 px-2 pt-2",
            "rounded-t-[1.75rem] bg-bg-soft/95 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-soft/80",
            "dark:bg-bg-sub/95 dark:supports-[backdrop-filter]:bg-bg-sub/80",
            "pb-[max(0.625rem,env(safe-area-inset-bottom))] min-[600px]:hidden",
            "animate-[nav-bar-enter_300ms_cubic-bezier(0.16,1,0.3,1)_both]",
            "motion-reduce:animate-none"
          )}
          style={{
            boxShadow:
              "0 -10px 30px rgba(38, 28, 18, 0.08), var(--edge-rest, 0 0 0 1px rgba(0,0,0,0.06))",
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
