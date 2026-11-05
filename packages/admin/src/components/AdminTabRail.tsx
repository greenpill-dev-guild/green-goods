import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useIntl } from "react-intl";

// ============================================================================
// Types
// ============================================================================

export interface AdminTab {
  id: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /**
   * What waits on the steward here: pending work, open alerts, join requests.
   * A total belongs in the panel's own header line, and a flag shows nothing
   * (DL-134).
   */
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

/** Which edges of the rail clip tabs; admin-m3-components.css fades them. */
type RailOverflow = "none" | "start" | "end" | "both";

function railOverflow(rail: HTMLElement): RailOverflow {
  const start = rail.scrollLeft > 1;
  const end = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
  if (start && end) return "both";
  if (start) return "start";
  return end ? "end" : "none";
}

/**
 * AdminTabRail — the installed app's equal-width tabs at the cockpit's 36px
 * height (F8).
 *
 * Anatomy:
 * - Rail: a row of equal cells on a hairline rule in the warm stone border
 *   step, drawn inside the rail so the active underline covers it.
 * - Cell: every tab takes an equal share of the row and never less than its
 *   own icon, label and count on one line, so a label never clips. Below 640px
 *   the row fills the phone's width; from 640px the row is at most 180px per
 *   tab, so each cell stops at 180px, and it keeps to the left. 36px tall
 *   (DL-011); the label is 12px with 4px gaps and 6px sides on a phone, 14px
 *   with 8px gaps and 12px sides from 640px, weight 500 in both states, as the
 *   app sets its tabs.
 * - Active: a 10% tint of the tone's on-surface accent fills the cell, and the
 *   label and a 2px underline take the accent itself, all one tone use (Rule
 *   18). Inactive: sub ink; hover darkens the text only (never a hue or bg
 *   shift).
 * - Count badge: the shared `CountBadge` (F10), 16px with 11px/600 numerals on
 *   the workspace tone's accent, only where something waits on the steward
 *   (DL-134).
 * - Overflow: a row that cannot hold its cells scrolls; the edge that clips
 *   tabs fades and tabs snap as it scrolls, so it reads as scrollable (D18).
 *   A selected tab lands clear of the fades.
 */
export function AdminTabRail({
  tabs,
  activeId,
  ariaLabel,
  onChange,
  idBase,
  className,
}: AdminTabRailProps) {
  const { formatMessage } = useIntl();
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const enabledTabs = tabs.filter((tab) => !tab.disabled);
  const [overflow, setOverflow] = useState<RailOverflow>("none");
  const syncOverflow = useCallback(() => {
    const rail = railRef.current;
    if (rail) setOverflow(railOverflow(rail));
  }, []);

  // The rail's scroll padding reserves its edge fades, and the rail snaps every
  // scroll, a programmatic one included, to a tab start just past the start
  // fade (admin-m3-components.css). So a selected tab under a fade moves to the
  // first tab start that clears it; any other offset would snap elsewhere.
  useLayoutEffect(() => {
    const rail = railRef.current;
    const activeTab = tabRefs.current.get(activeId);
    if (!rail || !activeTab) return;

    const railRect = rail.getBoundingClientRect();
    const railStyle = getComputedStyle(rail);
    const clearStart = railRect.left + (Number.parseFloat(railStyle.scrollPaddingLeft) || 0);
    const clearEnd = railRect.right - (Number.parseFloat(railStyle.scrollPaddingRight) || 0);
    const activeRect = activeTab.getBoundingClientRect();
    const ownSnap = activeRect.left - clearStart;
    if (ownSnap < 0) {
      rail.scrollLeft += ownSnap;
    } else if (activeRect.right > clearEnd) {
      const needed = activeRect.right - clearEnd;
      let snap = ownSnap;
      for (const tab of rail.querySelectorAll<HTMLElement>('[role="tab"]')) {
        if (tab === activeTab) break;
        const tabSnap = tab.getBoundingClientRect().left - clearStart;
        if (tabSnap >= needed) {
          snap = tabSnap;
          break;
        }
      }
      rail.scrollLeft += snap;
    }
    syncOverflow();
  }, [activeId, tabs.length, syncOverflow]);

  // The rail's box changes with the viewport, and its tabs with the locale: a
  // translated label can widen a tab while the rail's own box stays the same,
  // so the tabs are observed as well as the rail.
  const tabKey = tabs.map((tab) => tab.id).join("|");
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined" || !tabKey) return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(rail);
    for (const tab of tabRefs.current.values()) observer.observe(tab);
    return () => observer.disconnect();
  }, [syncOverflow, tabKey]);

  // Roving tabindex + WAI-ARIA tabs keyboard pattern
  // (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Activation follows focus
  // so screen-reader users hear the panel content as they cycle.
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
      ref={railRef}
      data-component="AdminTabRail"
      role="tablist"
      aria-label={ariaLabel}
      data-overflow={overflow}
      onScroll={syncOverflow}
      // From 640px the row, rule included, is at most 180px per tab and keeps
      // to the left; equal shares then hold each cell to 180px.
      style={{ "--tab-rail-count": tabs.length } as CSSProperties}
      className={cn(
        "flex w-full min-w-0 overflow-x-auto sm:max-w-[calc(var(--tab-rail-count)*11.25rem)]",
        // The rule is an inset line, not a border: the scrollport clips a tab
        // that reaches into its border, so the active underline could not
        // cover a border-drawn rule.
        "shadow-[inset_0_-1px_0_rgb(var(--stroke-sub-300))]",
        className
      )}
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
              // Equal shares of the row, never narrower than the content
              // (min-w-max), so a label never clips; a cell that needs more
              // than its share takes it from the others.
              "relative inline-flex min-h-9 min-w-max flex-1 cursor-pointer items-center justify-center gap-1 px-1.5 sm:gap-2 sm:px-3",
              "type-label-sm font-medium sm:type-label",
              "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] motion-reduce:transition-none",
              // Inset: the rail is a scroll container, which clips a ring
              // drawn outside the cell at its top and bottom.
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
              active
                ? "bg-[rgb(var(--tone-on-surface-accent,var(--m3-primary))/0.1)] text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                : "bg-transparent text-[rgb(var(--m3-on-surface-variant))] hover:text-[rgb(var(--m3-on-surface))]",
              tab.disabled && "pointer-events-none cursor-not-allowed opacity-[0.38]"
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}

            <span className="whitespace-nowrap">{tab.label}</span>

            {tab.count !== undefined && tab.count > 0 ? (
              <>
                {/* The badge is decorative to assistive tech: `aria-label` on a
                    role-less span is not reliably exposed, and the bare number
                    announces without units. The count reaches the tab's
                    accessible name through the visually hidden span below. */}
                <CountBadge
                  count={tab.count}
                  aria-hidden="true"
                  className="pointer-events-none select-none"
                />
                <span className="sr-only">
                  {formatMessage({ id: "cockpit.tabRail.waitingCount" }, { count: tab.count })}
                </span>
              </>
            ) : null}

            {active ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
