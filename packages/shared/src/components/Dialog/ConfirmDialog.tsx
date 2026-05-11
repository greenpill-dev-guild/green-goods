import * as Dialog from "@radix-ui/react-dialog";
import { RiAlertLine, RiCloseLine, RiLoader4Line } from "@remixicon/react";
import type { CSSProperties, ReactNode } from "react";
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

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconContainerClassName?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  hideCloseButton?: boolean;
  /** When true, prevents close via overlay click or Escape — useful during in-flight mutations. */
  preventClose?: boolean;
}

const dialogShellSizeClasses: Record<NonNullable<DialogShellProps["size"]>, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl lg:max-w-5xl",
};

const dialogOverlayClassName =
  "fixed inset-0 z-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

const dialogOverlayStyle = {
  backgroundColor: "var(--color-overlay)",
  animationDuration: "var(--spring-effects-fast-duration)",
  animationTimingFunction: "var(--spring-effects-fast-easing)",
} satisfies CSSProperties;

const dialogSurfaceStyle = {
  animationDuration: "var(--spring-spatial-duration)",
  animationTimingFunction: "var(--spring-spatial-easing)",
} satisfies CSSProperties;

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconContainerClassName,
  children,
  size = "md",
  className,
  bodyClassName,
  headerClassName,
  hideCloseButton = false,
  preventClose = false,
}: DialogShellProps) {
  const { formatMessage } = useIntl();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="DialogShell"
          data-slot="overlay"
          className={dialogOverlayClassName}
          style={dialogOverlayStyle}
        />
        <Dialog.Content
          data-component="DialogShell"
          data-slot="surface"
          className={cn(
            "fixed z-modal w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-[var(--color-material-solid)] border border-stroke-soft-200 shadow-[var(--shadow-float)] focus:outline-none bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            dialogShellSizeClasses[size],
            className
          )}
          style={dialogSurfaceStyle}
          onPointerDownOutside={(event) => {
            if (preventClose) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (preventClose) event.preventDefault();
          }}
        >
          <div
            className={cn(
              "sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stroke-soft px-4 py-3 sm:px-6 sm:py-4",
              headerClassName
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {icon && (
                <div
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bg-soft text-text-sub sm:h-10 sm:w-10",
                    iconContainerClassName
                  )}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-title-lg font-semibold text-text-strong">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="text-body-lg text-text-soft">
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            {!hideCloseButton && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  aria-label={formatMessage({ id: "app.common.close" })}
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            )}
          </div>

          <div className={cn("max-h-[calc(90vh-80px)] overflow-y-auto p-4 sm:p-6", bodyClassName)}>
            {children}
          </div>

          <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
          role={isDestructive ? "alertdialog" : undefined}
          className="fixed z-modal w-full max-w-[calc(100vw-2rem)] sm:max-w-md overflow-hidden bg-[var(--color-material-solid)] border border-stroke-soft-200 shadow-[var(--shadow-float)] focus:outline-none bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95"
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
          <div className="flex gap-3 p-4">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancel}
                className="flex-1 rounded-lg bg-bg-weak px-4 py-3 text-sm font-medium text-text-strong transition hover:bg-bg-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
              >
                {resolvedCancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
                styles.confirmBtn
              )}
            >
              {isLoading && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {resolvedConfirmLabel}
            </button>
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
