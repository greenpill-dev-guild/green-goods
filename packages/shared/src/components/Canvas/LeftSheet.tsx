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

export type LeftSheetWidth = "default" | "wide";

export interface LeftSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /**
   * Portal container element. When provided, uses absolute positioning
   * bounded to the container (canvas overlay root).
   */
  container?: HTMLElement | null;
  /** Width variant. Mirrors RightSheet sizing for consistent side-sheet anatomy. */
  width?: LeftSheetWidth;
  /** Prevent shell-level dismiss paths while protected sheet work is active. */
  preventClose?: boolean;
}

/**
 * LeftSheet — action-oriented panel that slides in from the left edge.
 *
 * Uses native <dialog> for focus trap + Escape handling, and a CSS transition
 * for the slide animation (see useCanvasSheetCssMotion). Mirrors RightSheet
 * architecture.
 */
export function LeftSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
  width = "default",
  preventClose = false,
}: LeftSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const sheetState = open ? "open" : "closed";
  const sheetBoundary = isBounded ? "bounded" : "viewport";
  const widthVar =
    width === "wide"
      ? "var(--canvas-left-sheet-width-wide, clamp(460px, 40vw, 720px))"
      : "var(--canvas-left-sheet-width, clamp(360px, 30vw, 540px))";
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { mounted, setMounted } = useCanvasSheetMount(open);
  const {
    title: renderedTitle,
    description: renderedDescription,
    children: renderedChildren,
  } = useCanvasSheetContentSnapshot(open, { title, description, children });

  const motion = useCanvasSheetCssMotion({
    edge: "left",
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
    autoFocusSelector: '[data-testid="left-sheet-close"]',
  });

  // Drag dismiss gesture — drag left to dismiss
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel, last }) => {
      const intent = getCanvasSheetDragIntent({
        edge: "left",
        movementX: mx,
        movementY: 0,
        velocityX: vx,
        velocityY: 0,
        directionX: dx,
        directionY: 0,
        sizePx: contentRef.current?.offsetWidth ?? 360,
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
      axis: "x",
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
      data-component="LeftSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
      data-testid="left-sheet-dialog"
    >
      {renderedDescription ? <p className="sr-only">{renderedDescription}</p> : null}

      {/* Custom overlay — scrim that cross-fades with the sheet. Bounded sheets
          dim the canvas pane behind them (no movement, no blur — depth via the
          scrim alone, per QA refinement); unbounded sheets keep the blurred
          viewport scrim. */}
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
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
        data-component="LeftSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="left-sheet-overlay"
      />

      {/* Sheet content — CSS translateX with handoff 24px overshoot */}
      <div
        ref={(node) => {
          contentRef.current = node;
          motion.surfaceRef.current = node;
        }}
        className={cn(
          "absolute top-0 left-0 flex h-full flex-col",
          "touch-none focus:outline-none will-change-transform",
          "glass-floating"
        )}
        style={{
          left: isBounded ? "var(--admin-sheet-side-inset, 1rem)" : 0,
          bottom: isBounded ? 0 : undefined,
          width: isBounded
            ? `min(${widthVar}, calc(100% - (var(--admin-sheet-side-inset, 1rem) * 2)))`
            : "100%",
          maxWidth: isBounded ? undefined : widthVar,
          // Fill the canvas pane so every side sheet is the same height as the
          // main container (QA: content-height sheets read as inconsistent chrome).
          height: "100%",
          maxHeight: isBounded ? "100%" : undefined,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          touchAction: "none",
          willChange: "transform",
          transform: motion.surfaceTransform,
          transition: motion.surfaceTransition,
          borderRadius: isBounded
            ? "var(--radius-sheet, 24px)"
            : "0 var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0",
          zIndex: isBounded ? 46 : 51,
        }}
        onTransitionEnd={motion.onSurfaceTransitionEnd}
        data-component="LeftSheet"
        data-slot="surface"
        data-state={sheetState}
        data-boundary={sheetBoundary}
        data-width={width}
        data-testid="left-sheet"
        {...bind()}
      >
        <CanvasSheetHeader
          title={renderedTitle}
          closeLabel={closeLabel}
          closeTestId="left-sheet-close"
          onClose={requestClose}
          closeDisabled={preventClose}
        />
        <CanvasSheetBody onClose={requestClose}>{renderedChildren}</CanvasSheetBody>
      </div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
