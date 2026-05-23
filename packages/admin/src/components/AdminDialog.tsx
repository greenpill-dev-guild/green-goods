import { RiAlertLine, RiCloseLine } from "@remixicon/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  type ComponentType,
  type KeyboardEventHandler,
  type ReactNode,
  isValidElement,
} from "react";
import { useIntl } from "react-intl";
import { cn, logger } from "@green-goods/shared";
import { AdminButton } from "./AdminButton";

// ============================================================================
// Types
// ============================================================================

export interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }> | ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  variant?: "standard" | "confirm" | "palette";
  bodyClassName?: string;
  actionsClassName?: string;
  hideCloseButton?: boolean;
  preventClose?: boolean;
  role?: "dialog" | "alertdialog";
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  className?: string;
}

export interface AdminConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  onCancelError?: (error: unknown) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "warning" | "danger";
  isLoading?: boolean;
  icon?: ReactNode;
}

const sizeClasses: Record<NonNullable<AdminDialogProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl lg:max-w-5xl",
};

const variantClasses: Record<NonNullable<AdminDialogProps["variant"]>, string> = {
  standard: "",
  confirm: "sm:max-w-md",
  palette: "admin-dialog--palette sm:max-w-2xl p-0",
};

const closeButtonClasses = cn(
  "absolute right-4 top-4 z-10",
  "flex h-10 w-10 items-center justify-center",
  "rounded-full",
  "m3-state-layer",
  "[--state-layer-color:var(--m3-on-surface)]",
  "text-[rgb(var(--m3-on-surface-variant))]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--m3-primary)))]"
);

// ============================================================================
// Component
// ============================================================================

/**
 * AdminDialog - M3 Basic Dialog
 *
 * Implements Material Design 3 basic dialog anatomy:
 * - Shape: corner-extra-large (28dp) via --m3-shape-xl
 * - Surface: surface-container-high
 * - Elevation: shadow level 3
 * - Scrim: on-surface at 32% opacity
 * - Headline: text-headline-sm, on-surface
 * - Body: text-body-md, on-surface-variant
 * - Actions: right-aligned row of M3 text buttons
 * - Optional icon: centered above headline, on-surface-variant
 * - Close button: absolute top-right, circular state layer
 * - Animations: fade + zoom on open/close
 */
export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  actions,
  size = "md",
  variant = "standard",
  bodyClassName,
  actionsClassName,
  hideCloseButton = false,
  preventClose = false,
  role = "dialog",
  onKeyDown,
  className,
}: AdminDialogProps) {
  const { formatMessage } = useIntl();
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && preventClose) return;
    onOpenChange(nextOpen);
  };
  const hasStructuredHeader = variant !== "palette";
  const iconNode =
    typeof Icon === "function" ? (
      <Icon className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
    ) : isValidElement(Icon) ? (
      Icon
    ) : null;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Scrim */}
        <Dialog.Overlay
          data-component="AdminDialog"
          data-slot="overlay"
          className={cn(
            "fixed inset-0 z-overlay",
            "bg-[rgb(var(--m3-on-surface)/0.32)]"
            // Scrim fade is driven by the [data-component="AdminDialog"][data-slot="overlay"]
            // rules in admin-m3-overrides.css (keyed off Radix's data-state). Do NOT re-add
            // Tailwind `animate-*`/`fade-*` classes here — the tailwindcss-animate plugin is
            // not loaded in this build, so those utilities emit no CSS (dead classes).
          )}
        />

        {/* Dialog panel */}
        <Dialog.Content
          data-component="AdminDialog"
          data-slot="surface"
          data-variant={variant}
          data-mobile="sheet"
          role={role}
          className={cn(
            // Mobile sheet, desktop centered dialog.
            "fixed bottom-0 left-1/2 z-modal flex max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col",
            "rounded-t-[var(--m3-shape-xl)] sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:rounded-[var(--m3-shape-xl)]",
            // Surface
            "bg-[rgb(var(--m3-surface-container-high))]",
            // Elevation 3
            "shadow-[var(--m3-elevation-3)]",
            // Padding: 24dp by default; palette manages its own inner chrome.
            variant === "palette" ? "p-0" : "p-6",
            // Enter/exit motion (mobile sheet slide-up, desktop zoom) is driven by the
            // [data-component="AdminDialog"][data-slot="surface"][data-state] rules in
            // admin-m3-overrides.css. Those keyframes animate only `transform`; the
            // centering above uses Tailwind's independent `translate` property, which
            // composes with `transform` so the surface stays centered. Do NOT re-add
            // Tailwind `animate-*`/`slide-in-*`/`zoom-*` classes here — tailwindcss-animate
            // is not loaded in this build, so they emit no CSS (dead classes).
            // Focus outline suppression (handled per-element)
            "focus:outline-none",
            sizeClasses[size],
            variantClasses[variant],
            className
          )}
          onPointerDownOutside={(event) => {
            if (preventClose) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (preventClose) event.preventDefault();
          }}
          onKeyDown={onKeyDown}
        >
          {/* Close button - absolute top-right */}
          {!hideCloseButton ? (
            <Dialog.Close
              data-slot="close"
              className={closeButtonClasses}
              aria-label={formatMessage({ id: "app.common.close" })}
              disabled={preventClose}
            >
              <RiCloseLine className="h-6 w-6" aria-hidden />
            </Dialog.Close>
          ) : null}

          {hasStructuredHeader ? (
            <div data-slot="header" className="shrink-0">
              {/* Optional icon - centered above headline */}
              {iconNode ? (
                <div className="mb-4 flex justify-center" aria-hidden="true">
                  {iconNode}
                </div>
              ) : null}

              {/* Headline */}
              <Dialog.Title
                className={cn(
                  "text-headline-sm font-semibold leading-tight",
                  "text-[rgb(var(--m3-on-surface))]",
                  // Right padding so text doesn't overlap close button
                  !hideCloseButton && "pr-10"
                )}
              >
                {title}
              </Dialog.Title>

              <Dialog.Description
                className={cn(
                  description ? "mt-4 text-body-md" : "sr-only",
                  "text-[rgb(var(--m3-on-surface-variant))]"
                )}
              >
                {description ?? title}
              </Dialog.Description>
            </div>
          ) : (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
            </>
          )}

          <div
            data-slot="body"
            data-testid="admin-dialog-body"
            className={cn(
              "min-h-0 flex-1 overflow-y-auto text-body-md",
              "text-[rgb(var(--m3-on-surface-variant))]",
              variant === "palette" ? "" : "-mx-6 mt-4 px-6",
              bodyClassName
            )}
          >
            {children}
          </div>

          {/* Actions - right-aligned row, pinned below the scrollable body */}
          {actions ? (
            <div
              data-slot="actions"
              data-testid="admin-dialog-actions"
              className={cn(
                "mt-6 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                actionsClassName
              )}
            >
              {actions}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

AdminDialog.displayName = "AdminDialog";

export function AdminConfirmDialog({
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
}: AdminConfirmDialogProps) {
  const { formatMessage } = useIntl();
  const resolvedConfirmLabel = confirmLabel ?? formatMessage({ id: "app.common.confirm" });
  const resolvedCancelLabel = cancelLabel ?? formatMessage({ id: "app.common.cancel" });
  const isDanger = variant === "danger";
  const isWarning = variant === "warning";
  const iconNode =
    icon ??
    (isDanger || isWarning ? (
      <RiAlertLine
        className={cn("h-6 w-6", isDanger ? "text-[rgb(var(--m3-error))]" : "text-warning-base")}
      />
    ) : null);

  const handleCancel = async () => {
    try {
      await onCancel?.();
      onClose();
    } catch (error) {
      logger.error("[AdminConfirmDialog] cancel failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      if (onCancelError) onCancelError(error);
      else throw error;
    }
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      logger.error("[AdminConfirmDialog] confirm failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      if (onError) onError(error);
      else throw error;
    }
  };

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={description}
      icon={iconNode}
      variant="confirm"
      role={isDanger || isWarning ? "alertdialog" : "dialog"}
      preventClose={isLoading}
      hideCloseButton={isLoading}
      actions={
        <>
          <AdminButton type="button" variant="text" onClick={handleCancel} disabled={isLoading}>
            {resolvedCancelLabel}
          </AdminButton>
          <AdminButton
            type="button"
            variant={isDanger ? "danger" : "filled"}
            onClick={handleConfirm}
            disabled={isLoading}
            loading={isLoading}
          >
            {resolvedConfirmLabel}
          </AdminButton>
        </>
      }
    >
      {description ? null : (
        <p className="text-body-md text-[rgb(var(--m3-on-surface-variant))]">{title}</p>
      )}
    </AdminDialog>
  );
}

AdminConfirmDialog.displayName = "AdminConfirmDialog";
