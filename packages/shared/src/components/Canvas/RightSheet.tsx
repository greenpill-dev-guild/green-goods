import { animated, useSpring } from "@react-spring/web";
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
  getCanvasSheetTransform,
  useCanvasSheetContentSnapshot,
  useCanvasSheetLifecycle,
  useCanvasSheetMount,
} from "./CanvasSheetInternals";
import { SPRING_CONFIGS } from "./springConfig";

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
   * Width variant. `default` (clamp 320–480) for read-mostly panels;
   * `wide` (clamp 420–640) for form / multi-column workflows where the
   * default cramps inputs at desktop. The runtime value comes from
   * `--canvas-right-sheet-width` / `--canvas-right-sheet-width-wide`.
   */
  width?: RightSheetWidth;
}

/**
 * RightSheet — config and alerts panel that slides in from the right edge.
 *
 * Uses native <dialog> for focus trap + Escape handling, react-spring for
 * physics-based slide animation. The element stays mounted during close
 * animation so the spring can complete naturally.
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
      ? "var(--canvas-right-sheet-width-wide, clamp(420px, 36vw, 640px))"
      : "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))";
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { mounted, setMounted, latestOpenRef } = useCanvasSheetMount(open);
  const {
    title: renderedTitle,
    description: renderedDescription,
    children: renderedChildren,
  } = useCanvasSheetContentSnapshot(open, { title, description, children });

  // Spring: x=0 fully open, x=100 fully offscreen right
  const [springs, api] = useSpring(() => ({
    x: open ? 0 : 100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    immediate: prefersReducedMotion,
    onRest: (result) => {
      // Unmount after close animation completes
      if (!latestOpenRef.current && result.finished && result.value.x >= 99) {
        setMounted(false);
        dialogRef.current?.close();
      }
    },
  }));

  // Drive spring when open prop changes
  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    api.start({ x: open ? 0 : 100, overlay: open ? 1 : 0, immediate: prefersReducedMotion });
    if (prefersReducedMotion && !open) {
      setMounted(false);
      dialogRef.current?.close();
    }
  }, [open, api, mounted, prefersReducedMotion, setMounted]);

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
        api.start({ x: 0, immediate: false });
        return;
      }
      if (intent.kind === "dismiss") {
        onClose();
        return;
      }
      if (intent.kind === "snap") {
        api.start({ x: 0, immediate: false });
        return;
      }
      if (intent.kind === "drag") {
        api.start({ x: intent.offset, immediate: true });
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

      {/* Custom overlay — static blur, opacity fade only */}
      <animated.div
        className={cn("absolute inset-0", isBounded ? "bg-transparent" : "")}
        style={{
          opacity: isBounded ? 0 : springs.overlay,
          backgroundColor: isBounded ? undefined : "rgb(var(--m3-on-surface, 10 10 10) / 0.18)",
          backdropFilter: isBounded ? undefined : "blur(2px)",
          WebkitBackdropFilter: isBounded ? undefined : "blur(2px)",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        data-component="RightSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="right-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateX with handoff 24px overshoot */}
      <animated.div
        ref={contentRef}
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
          height: isBounded ? "auto" : "100%",
          maxHeight: isBounded ? "100%" : undefined,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          touchAction: "none",
          transform: springs.x.to((x) => getCanvasSheetTransform("right", x)),
          borderRadius: isBounded
            ? "var(--radius-sheet, 24px)"
            : "var(--radius-sheet, 16px) 0 0 var(--radius-sheet, 16px)",
          zIndex: isBounded ? 46 : 51,
        }}
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
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
