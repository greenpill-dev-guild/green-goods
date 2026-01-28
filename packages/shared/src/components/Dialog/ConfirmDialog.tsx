import * as Dialog from "@radix-ui/react-dialog";
import { RiAlertLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { logger } from "../../modules/app/logger";
import { cn } from "../../utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Optional handler for explicit cancel action (not overlay/escape close). */
  onCancel?: () => void | Promise<void>;
  /**
   * Optional error handler for when onConfirm throws.
   * If not provided, errors will be re-thrown.
   */
  onError?: (error: unknown) => void;
  /**
   * Optional error handler for when onCancel throws.
   * If not provided, errors will be re-thrown (matching onError behavior).
   */
  onCancelError?: (error: unknown) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "warning" | "danger";
  isLoading?: boolean;
  icon?: ReactNode;
}

/**
 * A confirmation dialog using Radix Dialog for accessibility.
 * Centered on desktop, slides up from bottom on mobile.
 * Replaces window.confirm() for consistent UX across the application.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  onError,
  onCancelError,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  isLoading = false,
  icon,
}: ConfirmDialogProps) {
  const { formatMessage } = useIntl();
  const resolvedConfirmLabel = confirmLabel ?? formatMessage({ id: "app.common.confirm" });
  const resolvedCancelLabel = cancelLabel ?? formatMessage({ id: "app.common.cancel" });
  const resolvedCloseLabel = formatMessage({ id: "app.common.close" });
  /**
   * Handle confirmation with error handling.
   * If onError is provided, it will be called with the error.
   * Otherwise, errors are re-thrown.
   */
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      logger.error("[ConfirmDialog] handleConfirm failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    try {
      await onCancel();
    } catch (error) {
      logger.error("[ConfirmDialog] handleCancel failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (onCancelError) {
        onCancelError(error);
      } else {
        throw error;
      }
    }
  };

  const isDestructive = variant === "danger" || variant === "warning";

  const variantStyles = {
    default: {
      confirmBtn: "bg-primary hover:bg-primary/90 text-white-0",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    warning: {
      confirmBtn: "bg-warning-base hover:bg-warning-dark text-white-0",
      iconBg: "bg-warning-lighter",
      iconColor: "text-warning-base",
    },
    danger: {
      confirmBtn: "bg-error-base hover:bg-error-dark text-white-0",
      iconBg: "bg-error-lighter",
      iconColor: "text-error-base",
    },
  };

  const styles = variantStyles[variant];
  const defaultIcon =
    variant === "warning" || variant === "danger" ? (
      <RiAlertLine className={cn("h-5 w-5", styles.iconColor)} />
    ) : null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150"
          data-testid="confirm-dialog-overlay"
        />
        <Dialog.Content
          role={isDestructive ? "alertdialog" : undefined}
          className="fixed z-50 w-full max-w-md overflow-hidden bg-bg-white-0 shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
          data-testid="confirm-dialog"
          onPointerDownOutside={(e: Event) => {
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e: KeyboardEvent) => {
            if (isLoading) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {(icon || defaultIcon) && (
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                    styles.iconBg
                  )}
                >
                  {icon || defaultIcon}
                </div>
              )}
              <div className="min-w-0 flex-1 pt-1">
                <Dialog.Title className="text-lg font-semibold text-text-strong-950">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-text-sub-600">
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft-400 transition hover:bg-bg-soft-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                data-testid="confirm-dialog-close"
                aria-label={resolvedCloseLabel}
                disabled={isLoading}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-4">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancel}
                className="flex-1 rounded-full bg-bg-weak-50 px-4 py-3 text-sm font-medium text-text-strong-950 transition hover:bg-bg-soft-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                {resolvedCancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                styles.confirmBtn
              )}
            >
              {isLoading && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {resolvedConfirmLabel}
            </button>
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-stroke-sub-300" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ConfirmDialog;
