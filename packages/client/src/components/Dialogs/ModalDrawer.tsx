import { cn, PwaSheet } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { pwaDrawerStyles } from "@/styles/pwaDrawerStyles";

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
 * Bottom-anchored sheet drawer used by PWA surfaces (governance / treasury /
 * wallet / notifications). Internally delegates to the shared `PwaSheet`
 * primitive, which owns drag dismissal, reduced-motion immediate close,
 * focus trap, scroll-lock, Escape, and backdrop click.
 *
 * Consumers retain the `header` / `tabs` / `footer` API; this wrapper just
 * adds the chrome on top of the shared sheet.
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
  const closeLabel = formatMessage({ id: "app.common.close" });

  return (
    <PwaSheet
      open={isOpen}
      onClose={onClose}
      ariaLabel={header.title}
      panelClassName={cn(pwaDrawerStyles.panel, className)}
      panelStyle={maxHeight ? { maxHeight } : undefined}
      autoFocusSelector='[data-testid="modal-drawer-close"]'
      testId="modal-drawer"
      showDragHandle
    >
      <div className={pwaDrawerStyles.header}>
        <div className="flex-1 min-w-0">
          <h2 className="title-section truncate">{header.title}</h2>
          {header.description && (
            <p className="body-sm-regular truncate text-text-sub-600">{header.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {header.actions}
          <button
            onClick={onClose}
            type="button"
            className={cn(
              "min-h-11 min-w-11 flex items-center justify-center",
              pwaDrawerStyles.closeButtonBase
            )}
            data-testid="modal-drawer-close"
            aria-label={closeLabel}
          >
            <RiCloseLine className={cn("w-5 h-5", pwaDrawerStyles.closeIcon)} />
          </button>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className={pwaDrawerStyles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              type="button"
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

      <div
        className={cn("flex-1 min-h-0", contentClassName || "p-4")}
        role={tabs.length > 0 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 0 && activeTab ? `tab-btn-${activeTab}` : undefined}
      >
        {children}
      </div>

      {footer && <div className={pwaDrawerStyles.footer}>{footer}</div>}
    </PwaSheet>
  );
};
