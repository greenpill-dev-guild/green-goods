import * as Dialog from "@radix-ui/react-dialog";
import { RiAlertLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useSheetPresence } from "../../hooks/ui/useSheetPresence";
import { logger } from "../../modules/app/logger";
import { cn } from "../../utils/styles/cn";
import {
  dialogOverlayClassName,
  dialogOverlayStyle,
  dialogSurfaceStyle,
  useRendersAsSheet,
} from "./dialogChrome";
import { PwaSheet } from "./PwaSheet";

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

const confirmButtonClassName =
  "relative flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-medium transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2 sm:flex-1";

const cancelButtonClassName =
  "min-h-11 w-full min-w-0 rounded-lg bg-bg-weak px-4 py-3 text-sm font-medium text-text-strong transition hover:bg-bg-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2 sm:flex-1";

/**
 * A confirmation dialog using Radix Dialog for accessibility.
 * Centered at 640px and wider; below that it renders the shared PwaSheet
 * bottom sheet, so drafts, deletes, and every other confirm share one
 * surface in the installed app.
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
  const rendersAsSheet = useRendersAsSheet();
  // The sheet registers itself; the centered surface registers here so the
  // installed app's AppBar also steps aside on wide screens (DL-015).
  useSheetPresence(isOpen && !rendersAsSheet);
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
      confirmBtn: "bg-primary-action hover:bg-primary-action-hover text-primary-action-foreground",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    warning: {
      confirmBtn: "bg-warning-base hover:bg-warning-dark text-static-white",
      iconBg: "bg-warning-lighter",
      iconColor: "text-warning-base",
    },
    danger: {
      confirmBtn: "bg-error-base hover:bg-error-dark text-static-white",
      iconBg: "bg-error-lighter",
      iconColor: "text-error-base",
    },
  };

  const styles = variantStyles[variant];
  const defaultIcon =
    variant === "warning" || variant === "danger" ? (
      <RiAlertLine className={cn("h-5 w-5", styles.iconColor)} />
    ) : null;
  const iconContainer =
    icon || defaultIcon ? (
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
          styles.iconBg
        )}
      >
        {icon || defaultIcon}
      </div>
    ) : null;

  const confirmButton = (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={isLoading}
      aria-busy={isLoading || undefined}
      className={cn(confirmButtonClassName, styles.confirmBtn)}
    >
      {isLoading && <RiLoader4Line className="absolute left-4 h-4 w-4 animate-spin" aria-hidden />}
      {resolvedConfirmLabel}
    </button>
  );

  if (rendersAsSheet) {
    return (
      <PwaSheet
        open={isOpen}
        onClose={onClose}
        role={isDestructive ? "alertdialog" : "dialog"}
        title={title}
        description={description}
        icon={iconContainer ?? undefined}
        closeLabel={resolvedCloseLabel}
        preventClose={isLoading}
        testId="confirm-dialog"
      >
        {confirmButton}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void handleCancel();
            onClose();
          }}
          className={cancelButtonClassName}
        >
          {resolvedCancelLabel}
        </button>
      </PwaSheet>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="ConfirmDialog"
          data-slot="overlay"
          className={dialogOverlayClassName}
          style={dialogOverlayStyle}
          data-testid="confirm-dialog-overlay"
        />
        <Dialog.Content
          data-component="ConfirmDialog"
          data-slot="surface"
          role={isDestructive ? "alertdialog" : "dialog"}
          className="fixed bottom-0 left-1/2 z-modal w-full max-w-none -translate-x-1/2 overflow-hidden border border-stroke-soft-200 bg-[var(--color-material-solid)] shadow-[var(--shadow-float)] focus:outline-none sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2"
          style={dialogSurfaceStyle}
          data-testid="confirm-dialog"
          onPointerDownOutside={(e: Event) => {
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e: KeyboardEvent) => {
            if (isLoading) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-stroke-soft p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {iconContainer}
              <div className="min-w-0 flex-1 pt-1">
                <Dialog.Title className="text-title-lg font-semibold text-text-strong">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-body-lg text-text-sub">
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                data-testid="confirm-dialog-close"
                aria-label={resolvedCloseLabel}
                disabled={isLoading}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 p-4 sm:flex-row">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancel}
                className={cancelButtonClassName}
              >
                {resolvedCancelLabel}
              </button>
            </Dialog.Close>
            {confirmButton}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
