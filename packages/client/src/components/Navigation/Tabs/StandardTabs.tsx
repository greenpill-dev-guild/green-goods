import { cn } from "@green-goods/shared";
import React from "react";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

export interface StandardTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface StandardTabsProps {
  tabs: StandardTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  triggerClassName?: string;
  variant?: "default" | "compact";
  isLoading?: boolean;
  scrollTargetSelector?: string;
}

export const StandardTabs: React.FC<StandardTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  triggerClassName,
  variant = "default",
  isLoading = false,
  scrollTargetSelector,
}) => {
  function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
    let el: HTMLElement | null = start;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function scrollContainerToTop(startEl?: HTMLElement | null) {
    // 1) Explicit selector if provided
    if (scrollTargetSelector) {
      const explicit = document.querySelector(scrollTargetSelector) as HTMLElement | null;
      if (explicit) {
        explicit.scrollTop = 0;
        return;
      }
    }
    // 2) Nearest scrollable ancestor if available
    const nearest = startEl ? findScrollableAncestor(startEl) : null;
    if (nearest) {
      nearest.scrollTop = 0;
      return;
    }
    // 3) Fallback to main app scroll container or window
    const appScroll = document.getElementById("app-scroll");
    if (appScroll) {
      appScroll.scrollTop = 0;
      return;
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  return (
    <div className={cn("flex border-b border-border flex-shrink-0 bg-bg-white-0", className)}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={(event) => {
            if (tab.disabled) return;
            scrollContainerToTop(event.currentTarget as HTMLElement);
            onTabChange(tab.id);
          }}
          disabled={tab.disabled}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1 px-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] relative flex-1 min-w-0 tap-feedback sm:min-h-12 sm:gap-2 sm:px-3 sm:text-label-sm",
            "focus:outline-none focus-visible:shadow-button-primary-focus",
            variant === "compact" ? "py-2.5 sm:py-3" : "py-3 sm:py-3.5",
            activeTab === tab.id
              ? cn(pwaStatusStyles.primary.text, pwaStatusStyles.primary.surface)
              : pwaStatusStyles.neutral.text,
            tab.disabled && "opacity-50 cursor-not-allowed",
            triggerClassName
          )}
          data-testid={`tab-${tab.id}`}
        >
          {tab.icon && (
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-sm [&>i]:text-base [&>svg]:h-4 [&>svg]:w-4">
              {tab.icon}
            </span>
          )}

          {/* Label */}
          <span className="min-w-0 truncate whitespace-nowrap">{tab.label}</span>

          {/* Count badge */}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center text-xs font-medium rounded-full min-w-[16px] h-4 px-1 flex-shrink-0",
                pwaStatusStyles.primary.badge
              )}
            >
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}

          {/* Bottom indicator with loading animation */}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5">
              {isLoading ? (
                <div className="w-full h-full bg-bg-soft-200">
                  <div
                    className={cn("h-full", pwaStatusStyles.information.progress)}
                    style={{
                      animationName: "standardTabLoading",
                      animationDuration: "var(--spring-effects-slow-duration)",
                      animationTimingFunction: "var(--spring-effects-slow-easing)",
                      animationIterationCount: "infinite",
                    }}
                  />
                </div>
              ) : (
                <div className={cn("w-full h-full", pwaStatusStyles.primary.progress)} />
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
