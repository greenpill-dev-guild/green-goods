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
}

/**
 * LeftSheet — action-oriented panel that slides in from the left edge.
 *
 * Uses native <dialog> for focus trap + Escape handling, react-spring for
 * physics-based slide animation. Mirrors RightSheet architecture.
 */
export function LeftSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
  width = "default",
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
  const { mounted, setMounted, latestOpenRef } = useCanvasSheetMount(open);
  const {
    title: renderedTitle,
    description: renderedDescription,
    children: renderedChildren,
  } = useCanvasSheetContentSnapshot(open, { title, description, children });

  // Spring: x=0 fully open, x=-100 fully offscreen left.
  // The pose MUST be declared through the deps array: react-spring's
  // useSprings layout effect re-applies the declared update on every commit,
  // so the declared update has to track the current pose. With no deps it
  // stays the initial closed pose forever, and any commit landing after an
  // imperative open start re-targets the spring back offscreen — the sheet
  // then mounts parked at x=-100 (reproduced on /hub/work/submit).
  const [springs, api] = useSpring(
    () => ({
      x: open ? 0 : -100,
      overlay: open ? 1 : 0,
      config: SPRING_CONFIGS.sheet,
      immediate: prefersReducedMotion,
      onRest: (result) => {
        if (!latestOpenRef.current && result.finished && result.value.x <= -99) {
          setMounted(false);
          dialogRef.current?.close();
        }
      },
    }),
    [open, prefersReducedMotion]
  );

  // Mount bookkeeping when open changes; the spring pose itself is driven
  // declaratively by the deps above.
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

      {/* Custom overlay — scrim that fades with the sheet. Bounded sheets dim
          the canvas pane behind them (no movement, no blur — depth via the
          scrim alone, per QA refinement); unbounded sheets keep the blurred
          viewport scrim. */}
      <animated.div
        className="absolute inset-0"
        style={{
          opacity: springs.overlay,
          backgroundColor: isBounded
            ? "rgb(var(--m3-on-surface, 10 10 10) / 0.32)"
            : "rgb(var(--m3-on-surface, 10 10 10) / 0.18)",
          backdropFilter: isBounded ? undefined : "blur(2px)",
          WebkitBackdropFilter: isBounded ? undefined : "blur(2px)",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        data-component="LeftSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="left-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateX with handoff 24px overshoot */}
      <animated.div
        ref={contentRef}
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
          transform: springs.x.to((x) => getCanvasSheetTransform("left", x)),
          borderRadius: isBounded
            ? "var(--radius-sheet, 24px)"
            : "0 var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0",
          zIndex: isBounded ? 46 : 51,
        }}
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
          onClose={onClose}
        />
        <CanvasSheetBody onClose={onClose}>{renderedChildren}</CanvasSheetBody>
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
