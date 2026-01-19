import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@green-goods/shared/utils";
import { RiCloseLine } from "@remixicon/react";
import type React from "react";

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

/**
 * A modal drawer using Radix Dialog for accessibility.
 * Slides up from the bottom, supports tabs, and handles focus management.
 */
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
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[20000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150"
          data-testid="modal-drawer-overlay"
        />
        <Dialog.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[20001] bg-bg-white-0 rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "focus:outline-none",
            className
          )}
          style={{ maxHeight }}
          data-testid="modal-drawer"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold truncate">{header.title}</Dialog.Title>
              {header.description && (
                <Dialog.Description className="text-sm text-text-sub-600 truncate">
                  {header.description}
                </Dialog.Description>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {header.actions}
              <Dialog.Close asChild>
                <button
                  className="btn-icon"
                  data-testid="modal-drawer-close"
                  aria-label="Close modal"
                >
                  <RiCloseLine className="w-5 h-5 text-text-soft-400 focus:text-primary active:text-primary" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="flex border-b border-border flex-shrink-0" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
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
          <div className={cn("flex-1 min-h-0", contentClassName || "p-4")} role="tabpanel">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
