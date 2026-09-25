import { RiAddLine } from "@remixicon/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import type { FabAction, FabConfig } from "./NavigationBar";
import { nextSpeedDialActionId } from "./speedDialNavigation";

// ----------------------------------------------------------------------------
// FAB + Speed Dial — sits in the nav bar row, far-right
// ----------------------------------------------------------------------------

interface FabButtonProps {
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

      const currentActionId =
        (event.target as HTMLElement)
          .closest<HTMLElement>("[data-slot='speed-dial-item']")
          ?.getAttribute("data-item-id") ?? focusedSpeedDialActionId;
      const nextId = nextSpeedDialActionId(
        config.actions.map((action) => action.id),
        currentActionId,
        event.key
      );
      if (nextId === null) return;

      event.preventDefault();
      focusSpeedDialAction(nextId);
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
        <div // eslint-disable-line jsx-a11y/interactive-supports-focus -- menu items are focusable <button role="menuitem"> children; focus moves to the first on open
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
            // Sized to its labels, not to the narrow FAB it anchors to, so no
            // label wraps a word per line (admin's fork uses `w-max`).
            width: "max-content",
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
            const reasonId =
              action.disabled && action.disabledReasonId ? `${reasonIdBase}-${action.id}` : null;
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
                aria-describedby={reasonId ?? undefined}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 py-2",
                  "border",
                  "text-sm font-medium text-text-strong",
                  "transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-tint,59_130_246)))]",
                  "speed-dial-item",
                  "motion-reduce:animate-none"
                )}
                style={{
                  maxWidth: "calc(100vw - 2rem)",
                  // Inline, so no consumer's CSS scan can drop the inert look.
                  ...(action.disabled ? { opacity: 0.55, cursor: "not-allowed" } : {}),
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
                  {reasonId && action.disabledReasonId ? (
                    <span id={reasonId} className="block text-xs font-normal text-text-sub">
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
        // Name = visible label (WCAG 2.5.3); aria-expanded stays explicit when collapsed.
        aria-label={
          isSingleAction ? floatingActionLabel : formatMessage({ id: "cockpit.fab.openActions" })
        }
        aria-haspopup={isSingleAction ? undefined : "menu"}
        aria-expanded={isSingleAction ? undefined : speedDialOpen}
        aria-disabled={sole?.disabled || undefined}
        aria-describedby={soleReason ? `${reasonIdBase}-fab` : undefined}
        data-slot="fab-button"
        data-state={speedDialOpen ? "open" : "closed"}
        style={{
          background: "rgb(var(--tone-action, var(--primary-action)))",
          color: "rgb(var(--tone-on-action, var(--primary-action-foreground)))",
          ...(sole?.disabled ? { opacity: 0.55, cursor: "not-allowed" } : {}),
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
          <span className="text-left text-sm font-semibold">
            {floatingActionLabel}
            {/* Touch has no hover, so a disabled sole action says why in place. */}
            {soleReason ? (
              <span id={`${reasonIdBase}-fab`} className="block text-xs font-normal">
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
          style={{ position: "fixed", inset: 0, zIndex: -1, cursor: "default" }}
          onClick={closeSpeedDial}
          aria-hidden="true"
          tabIndex={-1}
          data-slot="speed-dial-backdrop"
        />
      )}
    </div>
  );
}
