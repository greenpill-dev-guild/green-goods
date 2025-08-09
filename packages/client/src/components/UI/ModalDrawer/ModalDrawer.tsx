import { RiCloseLine } from "@remixicon/react";
import React from "react";
import { cn } from "../../../utils/cn";

export interface ModalDrawerTab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
  badge?: React.ReactNode;
}

export interface ModalDrawerHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export interface ModalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  header: ModalDrawerHeaderProps;
  tabs?: ModalDrawerTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxHeight?: string;
}

export const ModalDrawer: React.FC<ModalDrawerProps> = ({
  isOpen,
  onClose,
  header,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  className,
  contentClassName,
  maxHeight = "95vh",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001] flex items-end justify-center animate-in fade-in-0 duration-150"
      data-testid="modal-drawer-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col",
          "animate-in slide-in-from-bottom-full duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          className
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{header.title}</h2>
            {header.description && (
              <p className="text-sm text-slate-600 truncate">{header.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {header.actions}
            <button
              onClick={onClose}
              className={cn(
                "p-1 hover:bg-slate-100 rounded-full border border-slate-200 transition-all duration-200 flex-shrink-0",
                "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
                "hover:shadow-lg hover:scale-105 active:scale-95"
              )}
              data-testid="modal-drawer-close"
              aria-label="Close modal"
            >
              <RiCloseLine className="w-5 h-5 text-slate-400 focus:text-emerald-700 active:text-emerald-700" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex border-b border-border flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all duration-200 relative flex-1 min-w-0",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:text-emerald-700",
                  "active:text-emerald-700 hover:bg-slate-50",
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-slate-50"
                    : "text-slate-600"
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon && <span className="text-base flex-shrink-0">{tab.icon}</span>}
                <span className="truncate">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="inline-flex items-center justify-center text-xs font-medium text-white bg-primary rounded-full min-w-[16px] h-4 px-1 flex-shrink-0">
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                )}
                {tab.badge}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className={cn("flex-1 min-h-0", contentClassName || "p-4")}>{children}</div>
      </div>
    </div>
  );
};
