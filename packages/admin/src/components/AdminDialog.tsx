import { RiCloseLine } from "@remixicon/react";
import * as Dialog from "@radix-ui/react-dialog";
import { type ComponentType, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminDialog — M3 Basic Dialog
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
  className,
}: AdminDialogProps) {
  const { formatMessage } = useIntl();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Scrim */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-overlay",
            "bg-[rgb(var(--m3-on-surface)/0.32)]",
            // Fade animation
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />

        {/* Dialog panel */}
        <Dialog.Content
          data-component="AdminDialog"
          className={cn(
            // Positioning: fixed centered
            "fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2",
            // Width constraints (Rule 14: mobile safety)
            "w-full max-w-[calc(100vw-2rem)] sm:max-w-md",
            // Height + flex layout — keeps headline + actions pinned and lets
            // the body scroll inside the panel instead of overflowing the viewport.
            "max-h-[calc(100dvh-2rem)] flex flex-col",
            // M3 shape: corner-extra-large (28dp)
            "rounded-[var(--m3-shape-xl)]",
            // Surface
            "bg-[rgb(var(--m3-surface-container-high))]",
            // Elevation 3
            "shadow-[var(--m3-elevation-3)]",
            // Padding: 24dp
            "p-6",
            // Open animations
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            // Close animations
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            // Focus outline suppression (handled per-element)
            "focus:outline-none",
            className
          )}
        >
          {/* Close button — absolute top-right */}
          <Dialog.Close
            className={cn(
              "absolute right-4 top-4",
              "flex h-10 w-10 items-center justify-center",
              "rounded-full",
              "m3-state-layer",
              "[--state-layer-color:var(--m3-on-surface)]",
              "text-[rgb(var(--m3-on-surface-variant))]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]"
            )}
            aria-label={formatMessage({ id: "app.common.close" })}
          >
            <RiCloseLine className="h-6 w-6" aria-hidden />
          </Dialog.Close>

          {/* Optional icon — centered above headline */}
          {Icon ? (
            <div className="mb-4 flex justify-center" aria-hidden="true">
              <Icon className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
            </div>
          ) : null}

          {/* Headline */}
          <Dialog.Title
            className={cn(
              "text-headline-sm font-semibold leading-tight",
              "text-[rgb(var(--m3-on-surface))]",
              // Right padding so text doesn't overlap close button
              "pr-10"
            )}
          >
            {title}
          </Dialog.Title>

          {/* Optional description */}
          {description ? (
            <Dialog.Description
              className={cn("mt-4 text-body-md", "text-[rgb(var(--m3-on-surface-variant))]")}
            >
              {description}
            </Dialog.Description>
          ) : null}

          {/* Body content — scrolls if the panel hits its max-height. The
              negative-margin + matching padding restores the panel's 24dp
              padding visually while allowing the scroll thumb to ride the edge. */}
          <div
            className={cn(
              "mt-4 min-h-0 flex-1 overflow-y-auto text-body-md",
              "text-[rgb(var(--m3-on-surface-variant))]",
              "-mx-6 px-6"
            )}
          >
            {children}
          </div>

          {/* Actions — right-aligned row, pinned below the scrollable body */}
          {actions ? <div className="mt-6 flex shrink-0 justify-end gap-2">{actions}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

AdminDialog.displayName = "AdminDialog";
