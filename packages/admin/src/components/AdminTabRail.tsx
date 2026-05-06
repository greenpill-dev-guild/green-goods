import { cn } from "@green-goods/shared";
import { type ComponentType, type KeyboardEvent, type ReactNode, useCallback, useRef } from "react";

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
 * AdminTabRail — segmented-card tabs per handoff `screens/review.css`
 * (`.rv-tabs` / `.rv-tab` / `.rv-tab-count`).
 *
 * Anatomy:
 * - Grid container: `gap: 6px; padding: 6px; background: var(--surface-quiet);
 *   border-radius: 14px`.
 * - Tab button: `height: 40px; border-radius: 10px; font: 600 14px/1`.
 * - Active tab: raised background + `var(--e1)` shadow (no underline).
 * - Count chip: 22×20 pill, surface-raised on inactive, `var(--g-action)` (green)
 *   on active.
 *
 * Inline styles are used because Tailwind v4 doesn't scan `packages/shared/src/`
 * from admin builds; sticking to `style={{...}}` for handoff-exact values keeps
 * geometry stable across surfaces (CLAUDE.md "Known Gotchas").
 */
export function AdminTabRail({
  tabs,
  activeId,
  ariaLabel,
  onChange,
  idBase,
  className,
}: AdminTabRailProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  // Roving tabindex + WAI-ARIA tabs keyboard pattern
  // (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Activation follows focus
  // so screen-reader users hear the panel content as they cycle, matching the
  // M3 Tabs behavior the segmented-card rewrite shouldn't have lost.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentId: string) => {
      const idx = enabledTabs.findIndex((tab) => tab.id === currentId);
      if (idx < 0) return;

      let nextIdx: number | null = null;
      switch (event.key) {
        case "ArrowRight":
          nextIdx = (idx + 1) % enabledTabs.length;
          break;
        case "ArrowLeft":
          nextIdx = (idx - 1 + enabledTabs.length) % enabledTabs.length;
          break;
        case "Home":
          nextIdx = 0;
          break;
        case "End":
          nextIdx = enabledTabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextTab = enabledTabs[nextIdx];
      if (!nextTab) return;
      onChange(nextTab.id);
      // Move focus on the next paint so React can update tabIndex first.
      requestAnimationFrame(() => {
        tabRefs.current.get(nextTab.id)?.focus();
      });
    },
    [enabledTabs, onChange]
  );

  return (
    <div
      data-component="AdminTabRail"
      role="tablist"
      aria-label={ariaLabel}
      className={cn("w-full min-w-0", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        gap: "6px",
        padding: "6px",
        background: "var(--surface-quiet, rgb(var(--m3-surface-container)))",
        borderRadius: "14px",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) {
                tabRefs.current.set(tab.id, node);
              } else {
                tabRefs.current.delete(tab.id);
              }
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-selected={active}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            data-active={active ? "true" : "false"}
            data-disabled={tab.disabled ? "true" : "false"}
            disabled={tab.disabled}
            // Roving tabindex: only the active tab is in the tab order; the
            // others receive focus via Arrow/Home/End within the tablist.
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
            className={cn(
              "relative inline-flex items-center justify-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--m3-primary)))]",
              tab.disabled && "pointer-events-none opacity-[0.38]"
            )}
            style={{
              height: "40px",
              borderRadius: "10px",
              border: 0,
              padding: "0 12px",
              gap: "6px",
              fontSize: "14px",
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              cursor: tab.disabled ? "not-allowed" : "pointer",
              transition:
                "background-color 150ms, background-image 150ms, color 150ms, box-shadow 150ms",
              backgroundColor: active
                ? "var(--surface-raised, rgb(var(--m3-surface-container-highest)))"
                : "transparent",
              // Handoff DESIGN_NOTES § Tone system: active tab picks up a
              // barely-perceptible tone wash (~6%) layered on the raised surface.
              // Fallback uses `--green-800` (raw RGB triplet) because `--g-action`
              // is already rgb-wrapped and can't be alpha-blended.
              backgroundImage: active
                ? "linear-gradient(rgb(var(--tone-action, var(--green-800)) / 0.06), rgb(var(--tone-action, var(--green-800)) / 0.06))"
                : "none",
              color: active
                ? "var(--ink, rgb(var(--m3-on-surface)))"
                : "var(--on-surface-muted, rgb(var(--m3-on-surface-variant)))",
              boxShadow: active ? "var(--e1, var(--m3-elevation-1))" : "none",
            }}
          >
            {Icon ? <Icon className="shrink-0" aria-hidden /> : null}

            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>

            {tab.count !== undefined && tab.count > 0 ? (
              <span
                aria-label={`${tab.count} items`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "22px",
                  height: "20px",
                  padding: "0 7px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  lineHeight: 1,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  pointerEvents: "none",
                  userSelect: "none",
                  flexShrink: 0,
                  transition: "background-color 150ms, color 150ms, border-color 150ms",
                  background: active
                    ? "var(--g-action, rgb(var(--m3-primary)))"
                    : "var(--surface-raised, rgb(var(--m3-surface-container-highest)))",
                  color: active
                    ? "var(--g-on-action, rgb(var(--m3-on-primary)))"
                    : "var(--on-surface-muted, rgb(var(--m3-on-surface-variant)))",
                  border: active
                    ? "1px solid transparent"
                    : "1px solid var(--outline, rgb(var(--m3-outline-variant)))",
                }}
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
