import { useDocumentScrollLock } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { useFocusTrap } from "@green-goods/shared/hooks/utils/useFocusTrap";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCloseLine } from "@remixicon/react";
import React, { useRef } from "react";
import { useIntl } from "react-intl";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { pwaDrawerStyles } from "@/components/Pwa/drawerStyles";

interface WorkDashboardShellProps {
  className?: string;
  /** True once the close animation has started: locks release and the exit pose plays. */
  isClosing: boolean;
  onRequestClose: () => void;
  tabs: StandardTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

/**
 * The dashboard's bottom-sheet chrome: scrim, focus-trapped dialog panel, header,
 * tab rail, and the single scroll owner for tab content. Open/close state stays
 * with WorkDashboard so the data hooks and the close timer share one owner.
 */
export const WorkDashboardShell: React.FC<WorkDashboardShellProps> = ({
  className,
  isClosing,
  onRequestClose,
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDivElement>(null);

  useDocumentScrollLock(!isClosing);

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  useFocusTrap(dialogRef, { enabled: !isClosing });

  return (
    <div
      role="presentation"
      className={cn(
        pwaDrawerStyles.overlay,
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={(e) => {
        // Only close if clicking directly on backdrop, not from propagated events
        if (e.target === e.currentTarget) {
          onRequestClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onRequestClose();
        }
      }}
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog surface; handler only stops propagation to the overlay */}
      <div
        ref={dialogRef}
        className={cn(
          pwaDrawerStyles.panel,
          pwaDrawerStyles.panelFixed,
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onRequestClose();
            return;
          }
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        {/* Header */}
        <div className={pwaDrawerStyles.header}>
          <div className="flex-1 min-w-0">
            <h2 className="title-section truncate">
              {intl.formatMessage({
                id: "app.workDashboard.title",
                defaultMessage: "Your work",
              })}
            </h2>
            <p className="text-sm text-text-sub-600 truncate">
              {intl.formatMessage({
                id: "app.workDashboard.description",
                defaultMessage: "Track work submissions and reviews",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onRequestClose}
              className={cn(
                "min-h-11 min-w-11 flex items-center justify-center",
                pwaDrawerStyles.closeButtonBase
              )}
              data-testid="modal-drawer-close"
              aria-label={intl.formatMessage({
                id: "app.workDashboard.closeModal",
                defaultMessage: "Close Modal",
              })}
            >
              <RiCloseLine className={cn("w-5 h-5", pwaDrawerStyles.closeIcon)} />
            </button>
          </div>
        </div>

        {/* Standardized Tabs */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          ariaLabel={intl.formatMessage({
            id: "app.work.tabs.label",
            defaultMessage: "Work sections",
          })}
          triggerClassName="text-xs"
          scrollTargetSelector="#work-dashboard-scroll"
        />

        {/* Content */}
        <div
          id="work-dashboard-scroll"
          className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
