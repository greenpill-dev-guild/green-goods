import { cn, useTimeout } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import React, { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

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
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxHeight?: string;
}

/**
 * A modal drawer matching the WorkDashboard bottom-sheet pattern.
 * Uses h-modal height (85dvh), custom CSS keyframe animations, and
 * manual focus trap — identical to DashboardModal for consistent feel.
 */
export const ModalDrawer: React.FC<ModalDrawerProps> = ({
  isOpen,
  onClose,
  header,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  footer,
  className,
  contentClassName,
}) => {
  const { formatMessage } = useIntl();
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { set: scheduleTimeout } = useTimeout();

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, [isOpen]);

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    const closeBtn = dialog.querySelector<HTMLElement>('[data-testid="modal-drawer-close"]');
    closeBtn?.focus();

    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    scheduleTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 bg-black/30 backdrop-blur-sm z-[20000] flex items-end justify-center",
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      tabIndex={-1}
    >
      <div
        ref={dialogRef}
        className={cn(
          "bg-bg-white-0 rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col h-modal",
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{header.title}</h2>
            {header.description && (
              <p className="text-sm text-text-sub-600 truncate">{header.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {header.actions}
            <button
              onClick={handleClose}
              className="btn-icon"
              data-testid="modal-drawer-close"
              aria-label={formatMessage({ id: "app.common.close" })}
            >
              <RiCloseLine className="w-5 h-5 text-text-soft-400 focus:text-primary active:text-primary" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex border-b border-border flex-shrink-0" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => onTabChange?.(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all duration-200 relative flex-1 min-w-0 tap-feedback",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:text-emerald-700",
                  "active:text-emerald-700",
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-bg-weak-50"
                    : "text-text-sub-600"
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
        <div
          className={cn("flex-1 min-h-0", contentClassName || "p-4")}
          role={tabs.length > 0 ? "tabpanel" : undefined}
          aria-labelledby={tabs.length > 0 && activeTab ? `tab-btn-${activeTab}` : undefined}
        >
          {children}
        </div>

        {/* Footer — fixed at bottom, above content scroll */}
        {footer && <div className="flex-shrink-0 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
};
