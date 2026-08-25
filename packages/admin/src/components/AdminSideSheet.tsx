import { RiCloseLine } from "@remixicon/react";
import * as Dialog from "@radix-ui/react-dialog";
import { type KeyboardEventHandler, type ReactNode, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "@green-goods/shared/utils/styles/cn";

// ============================================================================
// Types
// ============================================================================

export interface AdminSideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  preventClose?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  className?: string;
  /**
   * Workspace tone for the portaled surface. The sheet portals to <body>,
   * escaping CanvasLayout's `[data-tone]` scope, so the per-view accent
   * (`--tone-*`) is otherwise unset inside the sheet. The three global
   * surfaces are account chrome, not workspace content — they pass the
   * neutral steward "hub" accent.
   */
  tone?: "hub" | "garden" | "community" | "actions" | "home";
}

const closeButtonClasses = cn(
  // Centered on the compact header title row (py-3 + text-lg leading-7) —
  // identical anatomy to the AdminDialog close button.
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
 * AdminSideSheet — M3 modal side sheet for the three global AppBar surfaces
 * (Profile, Settings, Notifications). AdminDialog's sibling, not the retired
 * canvas-sheet system's revival: it shares the dialog's chrome (scrim,
 * hairline header, absolute close button, tone re-establishment, instant-exit
 * hidden-tab handling) and swaps only the geometry.
 *
 * - ≥640px: right-docked below AppBar and extended to the viewport bottom,
 *   rounded all around, and slides in from the right edge.
 *   Width reuses the `--canvas-right-sheet-width` token (one width for every
 *   sheet — per-content widths read as inconsistent chrome).
 * - <640px: compact inset bottom sheet, so the notification bell keeps today's
 *   glance-and-dismiss behavior while workspace AdminDialogs can use full width.
 *
 * Content contract: children own the body — panels compose `SheetBody`
 * (scrolling middle) and optionally `SheetFooter` (pinned bottom bar) inside
 * the sheet's flex column. The sheet itself does not pad or scroll, so panel
 * padding never compounds with shell padding.
 *
 * Scope contract: workspace action/detail/inspection overlays stay in
 * `AdminDialog`s. Side sheets are reserved for the three global surfaces —
 * enforced by AdminSideSheetStandard.guard.test.ts.
 */
export function AdminSideSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  preventClose = false,
  onKeyDown,
  className,
  tone = "hub",
}: AdminSideSheetProps) {
  const { formatMessage } = useIntl();
  // Hidden tabs freeze CSS animations, so a close that happens while the tab
  // is backgrounded would never fire animationend — Radix Presence would keep
  // the exit node (and its body pointer-events lock) forever. Closing with
  // data-instant-exit set drops the exit animation entirely so Radix unmounts
  // synchronously. Reset on the next open. (Same mechanism as AdminDialog.)
  const [instantExit, setInstantExit] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && preventClose) return;
    setInstantExit(!nextOpen && document.visibilityState === "hidden");
    onOpenChange(nextOpen);
  };
  useEffect(() => {
    if (open) {
      setInstantExit(false);
    } else if (document.visibilityState === "hidden") {
      setInstantExit(true);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Scrim — same dim layer as AdminDialog */}
        <Dialog.Overlay
          data-component="AdminSideSheet"
          data-slot="overlay"
          data-instant-exit={instantExit || undefined}
          style={{ background: "var(--admin-modal-scrim, rgb(0 0 0 / 0.32))" }}
          className={cn(
            "fixed inset-0 z-overlay"
            // Scrim fade is driven by the [data-component="AdminSideSheet"]
            // [data-slot="overlay"] rules in admin-m3-components.css (keyed off
            // Radix's data-state) — same convention as AdminDialog.
          )}
        />

        {/* Sheet panel */}
        <Dialog.Content
          data-component="AdminSideSheet"
          data-slot="surface"
          data-tone={tone}
          data-mobile="sheet"
          data-instant-exit={instantExit || undefined}
          className={cn(
            // Mobile: compact inset bottom sheet. Desktop ≥640px:
            // right-docked below AppBar and extended to the viewport bottom.
            "fixed bottom-0 left-1/2 z-modal flex max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col",
            "rounded-t-[var(--m3-shape-lg)]",
            "sm:top-[var(--admin-sheet-top)] sm:right-[var(--admin-sheet-side-inset)] sm:bottom-[var(--admin-sheet-bottom)] sm:left-auto sm:max-h-none sm:max-w-none sm:translate-x-0",
            "sm:w-[var(--admin-side-sheet-width)]",
            "sm:rounded-[var(--m3-shape-lg)]",
            // Solid surface + elevation 2 — dense surfaces stay solid; glass
            // remains Navigation/FAB-only.
            "bg-[rgb(var(--m3-surface-container-high))]",
            "shadow-[var(--m3-elevation-2)]",
            // Enter/exit motion (mobile slide-up, desktop slide-in-from-right)
            // is driven by the [data-component="AdminSideSheet"][data-slot="surface"]
            // [data-state] rules in admin-m3-components.css.
            "focus:outline-none",
            // Structured regions own their padding; panels bring SheetBody /
            // SheetFooter. overflow-hidden clips them to the rounded corners.
            "overflow-hidden p-0",
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
          <Dialog.Close
            data-slot="close"
            className={closeButtonClasses}
            aria-label={formatMessage({ id: "app.common.close" })}
            disabled={preventClose}
          >
            <RiCloseLine className="h-6 w-6" aria-hidden />
          </Dialog.Close>

          <header
            data-slot="header"
            className="shrink-0 border-b border-stroke-soft px-4 py-3 pr-14 sm:px-6 sm:pr-14"
          >
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
          </header>

          {/* Content column — panels own scrolling (SheetBody) and any pinned
              footer (SheetFooter), so shell and panel padding never stack. */}
          <div
            data-slot="content"
            data-testid="admin-side-sheet-content"
            className="flex min-h-0 flex-1 flex-col text-body-md text-[rgb(var(--m3-on-surface-variant))]"
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

AdminSideSheet.displayName = "AdminSideSheet";
