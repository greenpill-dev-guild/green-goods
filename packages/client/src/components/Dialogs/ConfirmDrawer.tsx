import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@green-goods/shared/utils";
import { RiCloseLine, RiLoader4Line } from "@remixicon/react";
import type React from "react";

export interface ConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

/**
 * A confirmation drawer using Radix Dialog for accessibility.
 * Slides up from the bottom on mobile, centered on desktop.
 * Used for confirming destructive actions like delete.
 */
export const ConfirmDrawer: React.FC<ConfirmDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
  icon,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[30000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150"
          data-testid="confirm-drawer-overlay"
        />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-[30001] bg-bg-white-0 rounded-t-3xl shadow-2xl w-full overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 ease-out focus:outline-none"
          data-testid="confirm-drawer"
          onPointerDownOutside={(e) => {
            // Prevent closing when loading
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing when loading
            if (isLoading) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-border">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
              <div className="flex-1 min-w-0">
                <Dialog.Title className="text-lg font-semibold truncate">{title}</Dialog.Title>
                {description && (
                  <Dialog.Description className="text-sm text-text-sub-600 mt-1">
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="btn-icon flex-shrink-0 ml-2"
                data-testid="confirm-drawer-close"
                aria-label="Close"
                disabled={isLoading}
              >
                <RiCloseLine className="w-5 h-5 text-text-soft-400" />
              </button>
            </Dialog.Close>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-4">
            <Dialog.Close asChild>
              <button
                disabled={isLoading}
                className="flex-1 py-3 px-4 text-sm font-medium text-text-strong-950 bg-bg-weak-50 rounded-full hover:bg-bg-soft-200 transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "flex-1 py-3 px-4 text-sm font-medium rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                variant === "danger"
                  ? "text-white bg-red-500 hover:bg-red-600"
                  : "text-white bg-primary hover:bg-primary/90"
              )}
            >
              {isLoading && <RiLoader4Line className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ConfirmDrawer;
