import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

const SPRING_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Width in px, default 400 */
  width?: number;
  /** Which edge the sheet opens from, default "right" */
  side?: "left" | "right";
}

/**
 * M3-style side sheet that opens from the left or right edge on desktop.
 *
 * Built on Radix Dialog for accessible focus trapping, Escape-to-close,
 * and overlay click dismiss. Content is wrapped in a SheetErrorBoundary
 * so errors never propagate to the parent toolbar.
 *
 * Use `side="left"` for creation flows (work submission, assessments).
 * Use `side="right"` (default) for detail/review panels.
 *
 * Animations use spring easing and respect `prefers-reduced-motion`.
 */
export function SideSheet({ open, onClose, title, children, width = 400, side = "right" }: SideSheetProps) {
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const isLeft = side === "left";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-300"
          )}
          style={{
            animationTimingFunction: SPRING_EASING,
          }}
          data-testid="side-sheet-overlay"
        />

        {/* Content panel */}
        <Dialog.Content
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "fixed top-0 z-50 flex h-full flex-col",
            "bg-bg-white shadow-2xl",
            "focus:outline-none",
            // Position + rounding
            isLeft ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl",
            // Slide animation direction
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            isLeft
              ? "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
              : "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-300",
            // Reduce motion: disable animations
            "motion-reduce:duration-0"
          )}
          style={{
            width: `min(${width}px, 100vw)`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          data-testid="side-sheet"
        >
          {/* Header */}
          {title && (
            <div className={cn(
              "flex items-center justify-between border-b border-stroke-soft px-4 py-3",
              isLeft && "flex-row-reverse"
            )}>
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="side-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Close button when no title */}
          {!title && (
            <div className={cn("flex px-4 pt-3", isLeft ? "justify-start" : "justify-end")}>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="side-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
