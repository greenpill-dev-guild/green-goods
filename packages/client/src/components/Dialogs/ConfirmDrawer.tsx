import { cn } from "@green-goods/shared/utils";
import { RiCloseLine, RiLoader4Line } from "@remixicon/react";
import React from "react";

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
 * A simple confirmation drawer that slides up from the bottom.
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
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[30000] flex items-end justify-center animate-in fade-in-0 duration-150"
      data-testid="confirm-drawer-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden animate-in slide-in-from-bottom-full duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="confirm-drawer"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{title}</h2>
              {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon flex-shrink-0 ml-2"
            data-testid="confirm-drawer-close"
            aria-label="Close"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 text-sm font-medium text-slate-700 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
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
      </div>
    </div>
  );
};

export default ConfirmDrawer;
