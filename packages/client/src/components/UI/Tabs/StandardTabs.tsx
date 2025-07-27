import React from "react";
import { cn } from "@/utils/cn";

export interface StandardTab {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface StandardTabsProps {
  tabs: StandardTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  variant?: "default" | "compact";
  isLoading?: boolean;
}

export const StandardTabs: React.FC<StandardTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  variant = "default",
  isLoading = false,
}) => {
  return (
    <div className={cn("flex border-b border-border flex-shrink-0", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          disabled={tab.disabled}
          className={cn(
            "flex items-center justify-center gap-1.5 text-sm font-medium transition-colors relative flex-1 min-w-0",
            variant === "compact" ? "py-2.5" : "py-3",
            activeTab === tab.id ? "text-primary bg-slate-50" : "text-slate-600 hover:bg-slate-50",
            tab.disabled && "opacity-50 cursor-not-allowed"
          )}
          data-testid={`tab-${tab.id}`}
        >
          {/* Icon - handle both emoji strings and React components */}
          {tab.icon && (
            <span className="text-base flex-shrink-0">
              {typeof tab.icon === "string" ? tab.icon : tab.icon}
            </span>
          )}

          {/* Label */}
          <span className="truncate">{tab.label}</span>

          {/* Count badge */}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="inline-flex items-center justify-center text-xs font-medium text-white bg-primary rounded-full min-w-[16px] h-4 px-1 flex-shrink-0">
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}

          {/* Bottom indicator with loading animation */}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5">
              {isLoading ? (
                <div className="w-full h-full bg-slate-200">
                  <div
                    className="h-full bg-primary animate-[standardTabLoading_2s_ease-in-out_infinite]"
                    style={{
                      animation: "standardTabLoading 2s ease-in-out infinite",
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-primary" />
              )}
            </div>
          )}
        </button>
      ))}

      {/* CSS for loading animation */}
      <style>{`
        @keyframes standardTabLoading {
          0% {
            width: 0%;
          }
          50% {
            width: 100%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
};
