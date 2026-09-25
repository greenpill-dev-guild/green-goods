import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type ComponentType,
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
 * AdminTabRail — underline tabs (Cockpit M3 1a).
 *
 * Anatomy:
 * - Rail: flex row, 4px gap, hairline bottom rule on the warm stone border
 *   step; the active underline overlaps it (-1px bottom margin).
 * - Tab: 7px 16px padding on a 20px line, 14px text — 36px with the underline (DL-011). Active: weight 600 in the workspace
 *   accent + 2px underline in the same color — tone use 1 of 3. Inactive:
 *   weight 500 sub ink; hover darkens the text only (never a hue or bg shift).
 * - Count badge: 1px 8px pill, 12px/600. Active rides tone-primary-container /
 *   on-primary-container; inactive is the neutral chip pair.
 * - Overflow: a rail wider than its box fades the edge that clips tabs and
 *   snaps tabs as it scrolls, so it reads as scrollable (D18).
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

  useLayoutEffect(() => {
    const rail = railRef.current;
    const activeTab = tabRefs.current.get(activeId);
    if (!rail || !activeTab) return;

    const railRect = rail.getBoundingClientRect();
    const activeRect = activeTab.getBoundingClientRect();
    if (activeRect.left < railRect.left) {
      rail.scrollLeft -= railRect.left - activeRect.left;
    } else if (activeRect.right > railRect.right) {
      rail.scrollLeft += activeRect.right - railRect.right;
    }
    syncOverflow();
  }, [activeId, tabs.length, syncOverflow]);

  // The rail's box changes with the viewport and its tabs with the locale.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [syncOverflow]);

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
      className={cn(
        "flex w-full min-w-0 gap-1 overflow-x-auto",
        "border-b border-[color:rgb(var(--stroke-sub-300))]",
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
              "relative -mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 bg-transparent px-4 py-1.75",
              "text-label-lg leading-5",
              "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
              active
                ? "border-[color:rgb(var(--tone-on-surface-accent,var(--m3-primary)))] font-semibold text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                : "border-transparent font-medium text-[rgb(var(--m3-on-surface-variant))] hover:text-[rgb(var(--m3-on-surface))]",
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
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none inline-flex shrink-0 select-none items-center justify-center rounded-full px-2 py-px",
                    "text-label-md font-semibold leading-4 tabular-nums",
                    active
                      ? "bg-[rgb(var(--tone-primary-container,var(--m3-secondary-container)))] text-[rgb(var(--tone-on-primary-container,var(--m3-on-secondary-container)))]"
                      : "bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface-variant))]"
                  )}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
                <span className="sr-only">
                  {formatMessage({ id: "cockpit.tabRail.itemCount" }, { count: tab.count })}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
