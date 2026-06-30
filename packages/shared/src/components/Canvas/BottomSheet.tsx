import { useDrag } from "@use-gesture/react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { cn } from "../../utils";
import {
  CanvasSheetBody,
  CanvasSheetHeader,
  getCanvasSheetDialogClassName,
  getCanvasSheetDialogStyle,
  getCanvasSheetDragIntent,
  useCanvasSheetContentSnapshot,
  useCanvasSheetCssMotion,
  useCanvasSheetLifecycle,
  useCanvasSheetMount,
} from "./CanvasSheetInternals";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as percentage, default 85 */
  maxHeight?: number;
  /**
   * Portal container element. When provided, uses absolute positioning
   * bounded to the container (canvas overlay root).
   */
  container?: HTMLElement | null;
  /** Prevent shell-level dismiss paths while protected sheet work is active. */
  preventClose?: boolean;
}

/**
 * Bottom sheet for mobile viewports (<600px).
 *
 * Uses native <dialog> for focus trap + Escape handling, and a CSS transition
 * for the slide animation (see useCanvasSheetCssMotion). Includes a drag handle
 * that dismisses the sheet when dragged down past threshold.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = 85,
  container,
  preventClose = false,
}: BottomSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const sheetState = open ? "open" : "closed";
  const sheetBoundary = isBounded ? "bounded" : "viewport";
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { mounted, setMounted } = useCanvasSheetMount(open);
  const { title: renderedTitle, children: renderedChildren } = useCanvasSheetContentSnapshot(open, {
    title,
    children,
  });

  const motion = useCanvasSheetCssMotion({
    edge: "bottom",
    open,
    mounted,
    setMounted,
    prefersReducedMotion,
    dialogRef,
  });

  // Mount bookkeeping: mount on open; under reduced motion, unmount immediately
  // on close (no exit transition to wait for).
  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    if (prefersReducedMotion && !open) {
      setMounted(false);
      dialogRef.current?.close();
    }
  }, [open, prefersReducedMotion, setMounted]);

  const requestClose = useCallback(() => {
    if (preventClose) {
      motion.snapOpen();
      return;
    }
    onClose();
  }, [motion, onClose, preventClose]);

  useCanvasSheetLifecycle({
    dialogRef,
    open,
    mounted,
    isBounded,
    onClose: requestClose,
    autoFocusSelector: '[data-testid="bottom-sheet-close"]',
  });

  // Drag dismiss gesture — drag down to dismiss
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel, last }) => {
      const intent = getCanvasSheetDragIntent({
        edge: "bottom",
        movementX: 0,
        movementY: my,
        velocityX: 0,
        velocityY: vy,
        directionX: 0,
        directionY: dy,
        sizePx: contentRef.current?.offsetHeight ?? 400,
        last,
        prefersReducedMotion,
      });

      if (preventClose) {
        if (intent.kind === "cancel") cancel();
        motion.snapOpen();
        return;
      }

      if (intent.kind === "cancel") {
        cancel();
        motion.snapOpen();
        return;
      }
      if (intent.kind === "dismiss") {
        motion.primeClose();
        requestClose();
        return;
      }
      if (intent.kind === "snap") {
        motion.snapOpen();
        return;
      }
      if (intent.kind === "drag") {
        motion.dragTo(intent.offset);
      }
    },
    {
      from: () => [0, 0],
      axis: "y",
      filterTaps: true,
    }
  );

  if (!mounted) return null;

  const dialogElement = (
    <dialog
      ref={dialogRef}
      aria-label={renderedTitle || closeLabel}
      aria-modal="true"
      open={isBounded ? mounted : undefined}
      tabIndex={-1}
      className={getCanvasSheetDialogClassName(isBounded)}
      style={getCanvasSheetDialogStyle(isBounded)}
      data-component="BottomSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
      data-testid="bottom-sheet-dialog"
    >
      {/* Custom overlay — scrim that cross-fades with the sheet. Bounded sheets
          use a fixed, full-viewport scrim that dims the whole screen (AppBar +
          nav included) like AdminDialog; it only intercepts pointer events while
          open so the exit fade never blocks the canvas. Unbounded sheets keep the
          blurred viewport scrim. */}
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        style={{
          position: isBounded ? "fixed" : "absolute",
          inset: 0,
          pointerEvents: open ? "auto" : "none",
          appearance: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "default",
          opacity: motion.overlayOpacity,
          transition: motion.overlayTransition,
          backgroundColor: isBounded
            ? "rgb(var(--m3-on-surface, 10 10 10) / 0.32)"
            : "rgb(var(--m3-on-surface, 10 10 10) / 0.18)",
          backdropFilter: isBounded ? undefined : "blur(2px)",
          WebkitBackdropFilter: isBounded ? undefined : "blur(2px)",
        }}
        onClick={() => requestClose()}
        data-component="BottomSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="bottom-sheet-overlay"
      />

      {/* Sheet content — CSS translateY from bottom */}
      <div
        ref={(node) => {
          contentRef.current = node;
          motion.surfaceRef.current = node;
        }}
        className={cn(
          "absolute bottom-0 left-0 right-0 flex w-full flex-col",
          "rounded-t-xl glass-floating",
          "focus:outline-none will-change-transform"
        )}
        style={{
          left: isBounded ? "var(--admin-sheet-mobile-side-inset, 0.75rem)" : 0,
          right: isBounded ? "var(--admin-sheet-mobile-side-inset, 0.75rem)" : 0,
          width: isBounded ? "auto" : "100%",
          maxHeight: isBounded ? `min(${maxHeight}%, 100%)` : `${maxHeight}dvh`,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          boxShadow: "var(--m3-elevation-4, var(--elevation-4))",
          willChange: "transform",
          transform: motion.surfaceTransform,
          transition: motion.surfaceTransition,
          borderRadius: isBounded
            ? "var(--radius-sheet, 24px)"
            : "var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0 0",
          zIndex: isBounded ? 46 : 51,
        }}
        onTransitionEnd={motion.onSurfaceTransitionEnd}
        data-component="BottomSheet"
        data-slot="surface"
        data-state={sheetState}
        data-boundary={sheetBoundary}
        data-testid="bottom-sheet"
      >
        {/* Drag handle */}
        <div
          className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          data-slot="drag-handle"
          data-state={sheetState}
          data-testid="bottom-sheet-drag-handle"
          {...bind()}
        >
          <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--tone-primary,var(--primary-base))/0.32)]" />
        </div>

        <CanvasSheetHeader
          title={renderedTitle}
          closeLabel={closeLabel}
          closeTestId="bottom-sheet-close"
          onClose={requestClose}
          closeDisabled={preventClose}
          showCloseWhenUntitled={false}
        />
        <CanvasSheetBody onClose={requestClose} scrollable>
          {renderedChildren}
        </CanvasSheetBody>
      </div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
