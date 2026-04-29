import { cn, useFocusTrap, useTimeout } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import React, { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { getPwaDrawerCloseDelayMs, pwaDrawerStyles } from "@/styles/pwaDrawerStyles";

export interface ModalDrawerTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
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
  maxHeight,
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
  useFocusTrap(dialogRef, { enabled: isOpen });

  const handleClose = () => {
    setIsClosing(true);
    scheduleTimeout(() => {
      setIsClosing(false);
      onClose();
    }, getPwaDrawerCloseDelayMs());
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="presentation"
      className={cn(
        pwaDrawerStyles.overlay,
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
          pwaDrawerStyles.panel,
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        style={maxHeight ? { maxHeight } : undefined}
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
        <div className={pwaDrawerStyles.header}>
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
              className={cn("p-2", pwaDrawerStyles.closeButtonBase)}
              data-testid="modal-drawer-close"
              aria-label={formatMessage({ id: "app.common.close" })}
            >
              <RiCloseLine className={cn("w-5 h-5", pwaDrawerStyles.closeIcon)} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className={pwaDrawerStyles.tabs} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => onTabChange?.(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  pwaDrawerStyles.tabTrigger,
                  activeTab === tab.id ? pwaDrawerStyles.tabActive : pwaDrawerStyles.tabInactive
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon && (
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-sm [&>i]:text-base [&>svg]:h-4 [&>svg]:w-4">
                    {tab.icon}
                  </span>
                )}
                <span className="min-w-0 truncate whitespace-nowrap">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center text-xs font-medium rounded-full min-w-[16px] h-4 px-1 flex-shrink-0",
                      pwaDrawerStyles.tabBadge
                    )}
                  >
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                )}
                {tab.badge}
                {activeTab === tab.id && (
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5",
                      pwaDrawerStyles.tabIndicator
                    )}
                  />
                )}
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
        {footer && <div className={pwaDrawerStyles.footer}>{footer}</div>}
      </div>
    </div>
  );
};
