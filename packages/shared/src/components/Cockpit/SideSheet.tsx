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
}

/**
 * M3-style side sheet that opens from the right edge on desktop.
 *
 * Built on Radix Dialog for accessible focus trapping, Escape-to-close,
 * and overlay click dismiss. Content is wrapped in a SheetErrorBoundary
 * so errors never propagate to the parent toolbar.
 *
 * Animations use spring easing and respect `prefers-reduced-motion`.
 */
export function SideSheet({ open, onClose, title, children, width = 400 }: SideSheetProps) {
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

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
            "fixed right-0 top-0 z-50 flex h-full flex-col",
            "rounded-l-2xl bg-bg-white shadow-2xl",
            "focus:outline-none",
            // Slide-in from right
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
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
            <div className="flex items-center justify-between border-b border-stroke-soft px-4 py-3">
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
            <div className="flex justify-end px-4 pt-3">
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
