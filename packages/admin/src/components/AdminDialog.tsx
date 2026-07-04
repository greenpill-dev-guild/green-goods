import { RiAlertLine, RiCloseLine } from "@remixicon/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  type ComponentType,
  type KeyboardEventHandler,
  type ReactNode,
  isValidElement,
  useEffect,
  useState,
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
  size?: "sm" | "md" | "lg";
  variant?: "standard" | "confirm" | "palette" | "flow";
  bodyClassName?: string;
  actionsClassName?: string;
  hideCloseButton?: boolean;
  preventClose?: boolean;
  role?: "dialog" | "alertdialog";
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  className?: string;
  /**
   * Workspace tone for the portaled surface. The dialog portals to <body>,
   * escaping CanvasLayout's `[data-tone]` scope, so the per-view accent
   * (`--tone-*`) is otherwise unset inside the dialog and falls back to green.
   * Setting it re-establishes the tone in-portal — the action flows pass their
   * workspace so Hub flows read blue, Garden green, etc. Consumers must read
   * `--tone-action` / `--tone-on-surface-accent` (not `--m3-primary`).
   */
  tone?: "hub" | "garden" | "community" | "actions" | "home";
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

// Three tiers by action weight (not five — a modal's size should read as a
// signal of what kind of action it is, not an arbitrary per-modal choice):
//   sm — reserved for variant="confirm"/alert dialogs, which already get a
//        fixed width from variantClasses.confirm below, independent of size.
//   md — a simple, single-purpose action: one form, one concern (add a
//        member, deposit/withdraw, edit one field).
//   lg — richer single-view content: lists with per-item actions, multi-field
//        forms, or multi-column layouts. Multi-step flows (Submit Work,
//        Create Assessment, Create Hypercert) are a category of their own —
//        see ADMIN_FLOW_DIALOG_CLASS below, not this scale.
const sizeClasses: Record<NonNullable<AdminDialogProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl lg:max-w-4xl",
};

const variantClasses: Record<NonNullable<AdminDialogProps["variant"]>, string> = {
  standard: "",
  confirm: "sm:max-w-md",
  palette: "admin-dialog--palette sm:max-w-2xl p-0",
  // Full-surface action flow (Submit Work, Create Assessment, Create Hypercert):
  // the consumer (ActionFlowShell / wizard) owns the visible header + scrolling
  // body + pinned footer, so the structured header and inner padding are
  // suppressed. `overflow-hidden` clips the inner square chrome to the dialog's
  // corner radius. A centered, bounded card — not a fullscreen takeover.
  flow: "overflow-hidden",
};

// Shared sizing for the full-surface action-flow dialogs (Submit Work, Create
// Assessment, Create Hypercert): a ~90dvh bottom-sheet on mobile, a centered
// max-w-3xl→5xl card on desktop with a STABLE 85dvh height so async content
// (e.g. the hypercert attestation list resolving on step 1) can't resize the
// dialog mid-open — the body scrolls inside and the footer stays pinned, the way
// ActionFlowShell is designed. Centralized so the three flows can't drift (the
// literal lives here in admin/src so the Tailwind scan reaches it).
export const ADMIN_FLOW_DIALOG_CLASS =
  "min-h-[90dvh] sm:min-h-0 sm:h-[85dvh] sm:!max-w-3xl lg:!max-w-5xl";

const closeButtonClasses = cn(
  // Centered on the compact header title row (py-3 + text-lg leading-7).
  "absolute right-3 top-1.5 z-10",
  "flex h-10 w-10 items-center justify-center",
  "rounded-full",
  "m3-state-layer",
  "[--state-layer-color:var(--m3-on-surface)]",
  "text-[rgb(var(--m3-on-surface-variant))]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
);

// ============================================================================
// Component
// ============================================================================

/**
 * AdminDialog - M3 Basic Dialog, unified on the action-flow chrome
 *
 * Every variant shares the Submit Work reference anatomy (the flow dialogs'
 * ActionFlowShell grammar), so standard/confirm/palette dialogs read as the
 * same product as the flows:
 * - Shape: corner-extra-large (28dp) via --m3-shape-xl; surface-container-high;
 *   elevation 3; scrim on-surface/32%
 * - Header: hairline-bottom bar (px-4 py-3 sm:px-6, border-stroke-soft) with
 *   an optional inline icon, text-lg semibold title, text-sm description
 * - Body: the scrollable region between header and footer (px-4 py-4 sm:px-6)
 * - Actions: pinned footer bar — hairline top border on --surface-raised
 *   (the SheetFooter anatomy the flows use), buttons right-aligned
 * - Close button: absolute top-right, centered on the title row
 * - palette/flow suppress the structured header/padding and own their chrome
 * - Animations: sheet slide-up (mobile) / zoom (desktop) on open/close
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
  // Default to the neutral "home" tone so a dialog that omits `tone` still
  // renders a deliberate accent in-portal instead of falling back to green
  // (the portal escapes CanvasLayout's [data-tone] scope — see the prop doc).
  // Action flows pass their own workspace tone, so they are unaffected.
  tone = "home",
}: AdminDialogProps) {
  const { formatMessage } = useIntl();
  // Hidden tabs freeze CSS animations, so a close that happens while the tab
  // is backgrounded would never fire animationend — Radix Presence keeps the
  // exit node (and its body pointer-events lock) forever. Closing with
  // data-instant-exit set drops the exit animation entirely so Radix unmounts
  // synchronously. Reset on the next open.
  const [instantExit, setInstantExit] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && preventClose) return;
    setInstantExit(!nextOpen && document.visibilityState === "hidden");
    onOpenChange(nextOpen);
  };
  // Programmatic closes (parent flips `open` without a user gesture) bypass
  // handleOpenChange — catch those too when they happen in a hidden tab. The
  // attribute lands one commit after the closed state, where it cancels the
  // already-frozen animation (the CSS also display:none's the node).
  useEffect(() => {
    if (open) {
      setInstantExit(false);
    } else if (document.visibilityState === "hidden") {
      setInstantExit(true);
    }
  }, [open]);
  // Palette + flow let the consumer own the visible header chrome; the
  // structured header (icon/title/description) is suppressed and the title is
  // kept screen-reader-only for the Radix dialog a11y contract.
  const hasStructuredHeader = variant !== "palette" && variant !== "flow";
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
          data-instant-exit={instantExit || undefined}
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
          data-tone={tone}
          data-mobile="sheet"
          data-size={size}
          data-instant-exit={instantExit || undefined}
          role={role}
          className={cn(
            // Mobile sheet, desktop centered dialog.
            "fixed bottom-0 left-1/2 z-modal flex max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col",
            "rounded-t-[var(--m3-shape-xl)] sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:rounded-[var(--m3-shape-xl)]",
            // Surface
            "bg-[rgb(var(--m3-surface-container-high))]",
            // Elevation 3
            "shadow-[var(--m3-elevation-3)]",
            // Enter/exit motion (mobile sheet slide-up, desktop zoom) is driven by
            // the [data-component="AdminDialog"][data-slot="surface"][data-state]
            // rules in admin-m3-overrides.css. Those keyframes animate only
            // `transform`; the centering uses Tailwind's independent `translate`
            // property, which composes so the surface stays centered. Do NOT re-add
            // Tailwind animate-*/slide-in-*/zoom-* classes — tailwindcss-animate is
            // not loaded in this build, so they emit no CSS (dead classes).
            "focus:outline-none",
            // Structured regions own their padding (header/body/footer bars);
            // overflow-hidden clips the footer's raised background to the
            // rounded corners. Body scrolling happens inside the body slot.
            "overflow-hidden p-0",
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
            <header
              data-slot="header"
              className={cn(
                "shrink-0 border-b border-stroke-soft px-4 py-3 sm:px-6",
                // Clearance for the absolute close button on the title row.
                !hideCloseButton && "pr-14"
              )}
            >
              <div className="flex items-start gap-3">
                {iconNode ? (
                  <span className="mt-0.5 shrink-0" aria-hidden="true">
                    {iconNode}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <Dialog.Title className="text-lg font-semibold leading-7 text-[rgb(var(--m3-on-surface))]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description
                    className={cn(
                      description ? "mt-0.5 text-sm" : "sr-only",
                      "text-[rgb(var(--m3-on-surface-variant))]"
                    )}
                  >
                    {description ?? title}
                  </Dialog.Description>
                </div>
              </div>
            </header>
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
              variant === "palette" || variant === "flow" ? "" : "px-4 py-4 sm:px-6",
              bodyClassName
            )}
          >
            {children}
          </div>

          {/* Actions — pinned footer bar (the flows' SheetFooter anatomy):
              hairline top border on the raised surface, buttons right-aligned. */}
          {actions ? (
            <div
              data-slot="actions"
              data-testid="admin-dialog-actions"
              className={cn(
                // Hairline + raised tokens carry fallbacks so the footer stays
                // correct in contexts that don't load admin index.css (Storybook
                // renders stories without it — an unset var would fall back to
                // currentColor and paint a near-black border).
                "flex shrink-0 flex-col-reverse gap-2 border-t border-[color:var(--hairline,rgb(var(--stroke-soft-200)))] bg-[var(--surface-raised,rgb(var(--bg-white-0)))] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6",
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
        className={cn("h-6 w-6", isDanger ? "text-[rgb(var(--m3-error))]" : "text-warning-dark")}
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
