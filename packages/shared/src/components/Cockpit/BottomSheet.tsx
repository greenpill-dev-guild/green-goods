import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

const SPRING_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAG_DISMISS_THRESHOLD = 100;

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as percentage, default 85 */
  maxHeight?: number;
}

/**
 * M3-style bottom sheet for mobile viewports (<600px).
 *
 * Built on Radix Dialog for accessible focus trapping, Escape-to-close,
 * and overlay click dismiss. Includes a drag handle that dismisses the
 * sheet when dragged down past 100px. Content is wrapped in a
 * SheetErrorBoundary so errors never propagate to the parent.
 *
 * Animations use spring easing and respect `prefers-reduced-motion`.
 */
export function BottomSheet({ open, onClose, title, children, maxHeight = 85 }: BottomSheetProps) {
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const dragStartY = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null || !contentRef.current) return;
    const delta = e.clientY - dragStartY.current;
    // Only allow dragging downward
    if (delta > 0) {
      contentRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null || !contentRef.current) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;

      if (delta > DRAG_DISMISS_THRESHOLD) {
        onClose();
      }
      // Reset transform
      contentRef.current.style.transform = "";
    },
    [onClose]
  );

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
          data-testid="bottom-sheet-overlay"
        />

        {/* Content panel */}
        <Dialog.Content
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 flex flex-col",
            "rounded-t-2xl bg-bg-white shadow-2xl",
            "focus:outline-none",
            // Slide-in from bottom
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-300",
            // Reduce motion: disable animations
            "motion-reduce:duration-0"
          )}
          style={{
            maxHeight: `${maxHeight}vh`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          data-testid="bottom-sheet"
        >
          {/* Drag handle */}
          <div
            className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            data-testid="bottom-sheet-drag-handle"
          >
            <div className="h-1 w-8 rounded-full bg-stroke-sub" />
          </div>

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-stroke-soft px-4 pb-3">
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
                  data-testid="bottom-sheet-close"
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
