import { cn } from "@green-goods/shared/utils/styles/cn";
import { useDocumentScrollLock } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { useFocusTrap } from "@green-goods/shared/hooks/utils/useFocusTrap";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { RiCloseLine } from "@remixicon/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { getPwaSheetCloseDelayMs, pwaSheetStyles } from "@/components/Pwa/sheetStyles";

export interface AppSheetTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  badge?: React.ReactNode;
}

export interface AppSheetHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export interface AppSheetProps {
  isOpen: boolean;
  onClose: () => void;
  header: AppSheetHeaderProps;
  tabs?: AppSheetTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxHeight?: string;
  /**
   * `fit` sizes the sheet to its content (capped at 85dvh, or `maxHeight`);
   * `fixed` fills the workspace height (85dvh) so tab switches never resize
   * it. Defaults to `fixed` when `tabs` are provided and `fit` otherwise.
   */
  height?: "fit" | "fixed";
}

/**
 * A modal sheet matching the WorkDashboard bottom-sheet pattern: custom CSS
 * keyframe animations and a manual focus trap. Tabbed sheets fill the
 * workspace height (85dvh) so tab switches never resize the sheet; sheets
 * without tabs size to their content and cap at 85dvh (or `maxHeight`). The
 * content region is the single scroll owner unless a consumer passes its own
 * `contentClassName`.
 */
export const AppSheet: React.FC<AppSheetProps> = ({
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
  height,
}) => {
  const { formatMessage } = useIntl();
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeCompletedRef = useRef(false);
  const { set: scheduleTimeout, clear: clearCloseTimeout } = useTimeout();

  useDocumentScrollLock(isOpen && !isClosing);

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  useFocusTrap(dialogRef, {
    enabled: isOpen && !isClosing,
    autoFocusSelector: '[data-testid="app-sheet-close"]',
  });

  useEffect(() => {
    if (isOpen && !isClosing) closeCompletedRef.current = false;
  }, [isClosing, isOpen]);

  const finishClose = useCallback(() => {
    if (closeCompletedRef.current) return;
    closeCompletedRef.current = true;
    clearCloseTimeout();
    setIsClosing(false);
    onClose();
  }, [clearCloseTimeout, onClose]);

  const handleClose = () => {
    if (isClosing) return;
    closeCompletedRef.current = false;
    setIsClosing(true);
    scheduleTimeout(finishClose, getPwaSheetCloseDelayMs());
  };

  useEffect(() => {
    if (!isClosing) return;

    const handlePageHide = () => finishClose();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") finishClose();
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [finishClose, isClosing]);

  if (!isOpen && !isClosing) return null;

  const resolvedHeight = height ?? (tabs.length > 0 ? "fixed" : "fit");

  return (
    <div
      role="presentation"
      className={cn(
        pwaSheetStyles.overlay,
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="app-sheet-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog surface; handlers only stop propagation to the overlay */}
      <div
        ref={dialogRef}
        className={cn(
          pwaSheetStyles.panel,
          resolvedHeight === "fixed" ? pwaSheetStyles.panelFixed : pwaSheetStyles.panelFit,
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        style={maxHeight ? { maxHeight } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
            return;
          }
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="app-sheet"
      >
        {/* Header */}
        <div className={pwaSheetStyles.header}>
          <div className="flex-1 min-w-0">
            <h2 className="title-section truncate">{header.title}</h2>
            {header.description && (
              <p className="body-sm-regular truncate text-text-sub-600">{header.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {header.actions}
            <button
              onClick={handleClose}
              className={cn(
                "min-h-11 min-w-11 flex items-center justify-center",
                pwaSheetStyles.closeButtonBase
              )}
              data-testid="app-sheet-close"
              aria-label={formatMessage({ id: "app.common.close" })}
            >
              <RiCloseLine className={cn("w-5 h-5", pwaSheetStyles.closeIcon)} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className={pwaSheetStyles.tabs} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => onTabChange?.(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  pwaSheetStyles.tabTrigger,
                  activeTab === tab.id ? pwaSheetStyles.tabActive : pwaSheetStyles.tabInactive
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
                      pwaSheetStyles.tabBadge
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
                      pwaSheetStyles.tabIndicator
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content — the sheet's single scroll owner unless the consumer
            takes over with contentClassName (tabbed sheets scroll per tab). */}
        <div
          className={cn(
            "flex-1 min-h-0",
            contentClassName || "overflow-y-auto overscroll-contain p-4"
          )}
          role={tabs.length > 0 ? "tabpanel" : undefined}
          aria-labelledby={tabs.length > 0 && activeTab ? `tab-btn-${activeTab}` : undefined}
        >
          {children}
        </div>

        {/* Footer — fixed at bottom, above content scroll */}
        {footer && <div className={pwaSheetStyles.footer}>{footer}</div>}
      </div>
    </div>
  );
};
