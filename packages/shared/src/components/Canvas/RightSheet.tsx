import { useDrag } from "@use-gesture/react";
import { useEffect, useRef } from "react";
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

export type RightSheetWidth = "default" | "wide";

export interface RightSheetProps {
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
  /**
   * Width variant. Right sheets share ONE width at runtime — both variants
   * resolve to the same `--canvas-right-sheet-width*` token value (QA
   * refinement: per-content widths read as inconsistent chrome). The prop is
   * retained for API compatibility with left-sheet-style callers.
   */
  width?: RightSheetWidth;
}

/**
 * RightSheet — config and alerts panel that slides in from the right edge.
 *
 * Uses native <dialog> for focus trap + Escape handling, and a CSS transition
 * for the slide animation (see useCanvasSheetCssMotion). The element stays
 * mounted during the close animation so the exit can complete naturally.
 */
export function RightSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
  width = "default",
}: RightSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const sheetState = open ? "open" : "closed";
  const sheetBoundary = isBounded ? "bounded" : "viewport";
  const widthVar =
    width === "wide"
      ? "var(--canvas-right-sheet-width-wide, clamp(380px, 30vw, 560px))"
      : "var(--canvas-right-sheet-width, clamp(380px, 30vw, 560px))";
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
    edge: "right",
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

  useCanvasSheetLifecycle({
    dialogRef,
    open,
    mounted,
    isBounded,
    onClose,
    autoFocusSelector: '[data-testid="right-sheet-close"]',
  });

  // Drag dismiss gesture
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel, last }) => {
      const intent = getCanvasSheetDragIntent({
        edge: "right",
        movementX: mx,
        movementY: 0,
        velocityX: vx,
        velocityY: 0,
        directionX: dx,
        directionY: 0,
        sizePx: contentRef.current?.offsetWidth ?? 400,
        last,
        prefersReducedMotion,
      });

      if (intent.kind === "cancel") {
        cancel();
        motion.snapOpen();
        return;
      }
      if (intent.kind === "dismiss") {
        motion.primeClose();
        onClose();
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

  // Native dialog — ::backdrop is disabled via CSS, we render our own overlay.
  // Bounded sheets are portaled into the MainSheet overlay root and kept out of
  // the browser top layer so their geometry remains tied to the canvas pane.
  const dialogElement = (
    <dialog
      ref={dialogRef}
      aria-label={renderedTitle || closeLabel}
      aria-modal="true"
      open={isBounded ? mounted : undefined}
      tabIndex={-1}
      className={getCanvasSheetDialogClassName(isBounded)}
      style={getCanvasSheetDialogStyle(isBounded)}
      data-component="RightSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
      data-width={width}
      data-testid="right-sheet-dialog"
    >
      {renderedDescription ? <p className="sr-only">{renderedDescription}</p> : null}

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
        onClick={() => onClose()}
        data-component="RightSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="right-sheet-overlay"
      />

      {/* Sheet content — CSS translateX with handoff 24px overshoot */}
      <div
        ref={(node) => {
          contentRef.current = node;
          motion.surfaceRef.current = node;
        }}
        className={cn(
          "absolute top-0 right-0 flex h-full flex-col",
          "touch-none focus:outline-none will-change-transform",
          "glass-floating"
        )}
        style={{
          right: isBounded ? "var(--admin-sheet-side-inset, 1rem)" : 0,
          bottom: isBounded ? 0 : undefined,
          width: isBounded
            ? `min(${widthVar}, calc(100% - (var(--admin-sheet-side-inset, 1rem) * 2)))`
            : "100%",
          maxWidth: isBounded ? undefined : widthVar,
          // Fill the canvas pane so every right sheet is the same height as the
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
            : "var(--radius-sheet, 16px) 0 0 var(--radius-sheet, 16px)",
          zIndex: isBounded ? 46 : 51,
        }}
        onTransitionEnd={motion.onSurfaceTransitionEnd}
        data-component="RightSheet"
        data-slot="surface"
        data-state={sheetState}
        data-boundary={sheetBoundary}
        data-width={width}
        data-testid="right-sheet"
        {...bind()}
      >
        <CanvasSheetHeader
          title={renderedTitle}
          closeLabel={closeLabel}
          closeTestId="right-sheet-close"
          onClose={onClose}
        />
        <CanvasSheetBody onClose={onClose}>{renderedChildren}</CanvasSheetBody>
      </div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
