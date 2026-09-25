import type { FabAction, FabConfig } from "@green-goods/shared/components/Canvas/NavigationBar";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAddLine } from "@remixicon/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";

// ----------------------------------------------------------------------------
// FAB + Speed Dial — the creation entry that floats above the nav bar on
// tablet/mobile (Cockpit M3, finished — 1a). Split out of the forked
// Shell/NavigationBar so each shell module stays readable.
//
// The FAB is the one tone-filled control in the floating chrome: circular
// 48px (56px with a label when floating), --tone-action fill, warm chrome
// shadow at rest, state-layer + elevation feedback — never a hue shift or
// scale jump. Multi-action configs open the speed dial (the "+" rotates 45°);
// single-action configs fire directly and show a hover tooltip instead.
// ----------------------------------------------------------------------------

export interface FabButtonProps {
  config: FabConfig;
  mobileFloating?: boolean;
}

export function FabButton({ config, mobileFloating = false }: FabButtonProps) {
  const { formatMessage } = useIntl();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [focusedSpeedDialActionId, setFocusedSpeedDialActionId] = useState<string | null>(null);
  const fabButtonRef = useRef<HTMLButtonElement>(null);
  const speedDialActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const reasonIdBase = useId();
  const speedDialShadow = "var(--admin-speed-dial-shadow, var(--m3-elevation-2))";
  const isSingleAction = config.actions.length <= 1;
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
    if (!isSingleAction) {
      setSpeedDialOpen((prev) => !prev);
      return;
    }
    // A disabled sole action fires nothing; the FAB says why instead.
    const sole = config.actions[0];
    if (sole && !sole.disabled) config.onAction(sole.id);
  }, [isSingleAction, config]);
  const sole = isSingleAction ? config.actions[0] : undefined;
  const soleReason =
    sole?.disabled && sole.disabledReasonId
      ? formatMessage({ id: sole.disabledReasonId, defaultMessage: sole.disabledReason })
      : null;

  const closeSpeedDial = useCallback(() => {
    setSpeedDialOpen(false);
    setFocusedSpeedDialActionId(null);
    // Every close path returns focus here: the dial's items unmount with it,
    // so focus would otherwise fall to <body>. An action that opens a dialog
    // moves focus again on its own.
    fabButtonRef.current?.focus();
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
        return;
      }

      // Every action is reachable, disabled ones included, so a keyboard
      // reaches the reason a disabled action gives.
      const actionIds = config.actions.map((action) => action.id);
      if (actionIds.length === 0) return;

      const currentActionId =
        (event.target as HTMLElement)
          .closest<HTMLElement>("[data-slot='speed-dial-item']")
          ?.getAttribute("data-item-id") ?? focusedSpeedDialActionId;
      const currentIndex = currentActionId ? actionIds.indexOf(currentActionId) : -1;
      let nextIndex: number | null = null;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % actionIds.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex =
          currentIndex === -1
            ? actionIds.length - 1
            : (currentIndex - 1 + actionIds.length) % actionIds.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = actionIds.length - 1;
      }

      if (nextIndex === null) return;

      event.preventDefault();
      focusSpeedDialAction(actionIds[nextIndex]!);
    },
    [closeSpeedDial, config.actions, focusSpeedDialAction, focusedSpeedDialActionId]
  );

  useEffect(() => {
    if (!speedDialOpen || isSingleAction) return;

    // With every action disabled, focus still lands in the dial, so a keyboard
    // reaches the reasons.
    const first = config.actions.find((action) => !action.disabled) ?? config.actions[0];
    if (first) focusSpeedDialAction(first.id);
  }, [config.actions, focusSpeedDialAction, isSingleAction, speedDialOpen]);

  return (
    <div
      className={cn("group/fab relative flex items-center", !mobileFloating && "ml-auto")}
      data-component="FabButton"
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
          // w-max: an absolute list inside the FAB's 56px box would otherwise
          // shrink to its narrowest word and wrap every label.
          className="speed-dial-list absolute bottom-full right-0 mb-2 flex w-max flex-col-reverse items-end gap-2 overflow-y-auto overflow-x-hidden overscroll-contain py-0.5"
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
                // Focusable though disabled, so a keyboard reaches its reason.
                aria-disabled={action.disabled || undefined}
                aria-describedby={
                  action.disabled && action.disabledReasonId
                    ? `${reasonIdBase}-${action.id}`
                    : undefined
                }
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 py-2",
                  "border border-[color:var(--admin-speed-dial-border,rgb(var(--stroke-soft-200)))]",
                  "bg-[rgb(var(--admin-surface-0))]",
                  "text-body-md font-medium text-text-strong",
                  "focus-visible:outline-none",
                  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
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
                  {/* Touch has no hover, so a disabled action says why in place. */}
                  {action.disabled && action.disabledReasonId ? (
                    <span
                      id={`${reasonIdBase}-${action.id}`}
                      className="block text-body-sm font-normal text-text-sub"
                    >
                      {formatMessage({
                        id: action.disabledReasonId,
                        defaultMessage: action.disabledReason,
                      })}
                    </span>
                  ) : null}
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
        // Single-action mode renders `floatingActionLabel` as the visible
        // label and tooltip, so the accessible name has to be that same string
        // — speech input activates a control by what it says (WCAG 2.5.3).
        aria-label={
          isSingleAction ? floatingActionLabel : formatMessage({ id: "cockpit.fab.openActions" })
        }
        aria-haspopup={isSingleAction ? undefined : "menu"}
        // Explicit false while collapsed: a menu control that drops the
        // attribute reads as non-expandable.
        aria-expanded={isSingleAction ? undefined : speedDialOpen}
        aria-disabled={sole?.disabled || undefined}
        aria-describedby={soleReason ? `${reasonIdBase}-fab` : undefined}
        data-slot="fab-button"
        data-state={speedDialOpen ? "open" : "closed"}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-full",
          "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
          mobileFloating ? "h-14 gap-2 px-5" : "h-12 w-12",
          "bg-[rgb(var(--tone-action,var(--primary-action)))] text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
          "shadow-[var(--admin-chrome-shadow)]",
          "m3-state-layer [--state-layer-color:var(--tone-on-action,var(--primary-action-foreground))]",
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
          <span className="text-left text-body-md font-semibold">
            {floatingActionLabel}
            {/* Touch has no hover, so a disabled sole action says why in place. */}
            {soleReason ? (
              <span id={`${reasonIdBase}-fab`} className="block text-body-sm font-normal">
                {soleReason}
              </span>
            ) : null}
          </span>
        )}
        {!mobileFloating && soleReason ? (
          <span id={`${reasonIdBase}-fab`} className="sr-only">
            {soleReason}
          </span>
        ) : null}
      </button>

      {/* Dismiss backdrop when speed dial is open */}
      {speedDialOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[-1] cursor-default"
          onClick={closeSpeedDial}
          aria-hidden="true"
          tabIndex={-1}
          data-slot="speed-dial-backdrop"
        />
      )}
    </div>
  );
}
