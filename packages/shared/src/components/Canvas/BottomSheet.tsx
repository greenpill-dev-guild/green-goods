import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

const SPRING_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const DRAG_DISMISS_THRESHOLD = 120;

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as percentage, default 85 */
  maxHeight?: number;
  /**
   * Portal container element. When provided, the sheet portals into this
   * element instead of document.body, and uses absolute positioning
   * (bounded to the container). Used by the canvas shell to scope
   * sheets within the main-sheet content zone.
   */
  container?: HTMLElement | null;
}

/**
 * Bottom sheet for mobile viewports (<600px).
 *
 * Built on Radix Dialog for accessible focus trapping, Escape-to-close,
 * and overlay click dismiss. Includes a drag handle that dismisses the
 * sheet when dragged down past 100px. Content is wrapped in a
 * SheetErrorBoundary so errors never propagate to the parent.
 *
 * Animations use spring easing and respect `prefers-reduced-motion`.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = 85,
  container,
}: BottomSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const dragStartY = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const settleSheet = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.style.transition = `transform 420ms ${SPRING_EASING}`;
    contentRef.current.style.transform = "translateY(0px) scale(1)";
    window.setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.style.transition = "";
      }
    }, 420);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null || !contentRef.current) return;
    const delta = e.clientY - dragStartY.current;
    // Only allow dragging downward
    if (delta > 0) {
      const resistedDelta = Math.round(delta * 0.86);
      const scale = Math.max(0.985, 1 - resistedDelta / 2600);
      contentRef.current.style.transition = "none";
      contentRef.current.style.transform = `translateY(${resistedDelta}px) scale(${scale})`;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null || !contentRef.current) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;

      if (delta > DRAG_DISMISS_THRESHOLD) {
        onClose();
      } else {
        settleSheet();
      }
    },
    [onClose, settleSheet]
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal container={container ?? undefined}>
        {/* Overlay — no dark scrim in bounded mode (depth comes from main-sheet recession) */}
        <Dialog.Overlay
          className={cn(
            isBounded ? "absolute inset-0" : "fixed inset-0",
            isBounded ? "z-[45] bg-transparent" : "z-overlay bg-neutral-950/18 backdrop-blur-sm",
            isBounded && "pointer-events-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[260ms] motion-reduce:duration-0"
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
            isBounded ? "absolute bottom-0 left-0 right-0" : "fixed bottom-0 left-0 right-0",
            isBounded ? "z-[46]" : "z-modal",
            "flex w-full flex-col",
            "rounded-t-xl glass-floating",
            "focus:outline-none",
            "border-b-0 will-change-transform",
            isBounded && "pointer-events-auto",
            // Slide-in from bottom
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[var(--spring-slow-duration,400ms)]",
            // Reduce motion: disable animations
            "motion-reduce:duration-0"
          )}
          style={{
            maxHeight: isBounded ? `${maxHeight}%` : `${maxHeight}dvh`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
            boxShadow: "var(--elevation-4)",
          }}
          data-testid="bottom-sheet"
        >
          {/* Drag handle */}
          <div
            className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={settleSheet}
            data-testid="bottom-sheet-drag-handle"
          >
            <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--ws-primary,var(--primary-base))/0.32)]" />
          </div>

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 pb-3">
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
