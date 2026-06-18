import { animated, useSpring } from "@react-spring/web";
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
  getCanvasSheetTransform,
  useCanvasSheetContentSnapshot,
  useCanvasSheetLifecycle,
  useCanvasSheetMount,
} from "./CanvasSheetInternals";
import { SPRING_CONFIGS } from "./springConfig";

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
 * Uses native <dialog> for focus trap + Escape handling, react-spring for
 * physics-based slide animation. Includes a drag handle that dismisses
 * the sheet when dragged down past threshold.
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
  const { mounted, setMounted, latestOpenRef } = useCanvasSheetMount(open);
  const { title: renderedTitle, children: renderedChildren } = useCanvasSheetContentSnapshot(open, {
    title,
    children,
  });

  // Spring: y=0 fully open, y=100 fully offscreen bottom (percentage).
  // The pose MUST be declared through the deps array: react-spring's
  // useSprings layout effect re-applies the declared update on every commit,
  // so the declared update has to track the current pose. With no deps it
  // stays the initial closed pose forever, and any commit landing after an
  // imperative open start re-targets the spring back offscreen.
  const [springs, api] = useSpring(
    () => ({
      y: open ? 0 : 100,
      overlay: open ? 1 : 0,
      config: SPRING_CONFIGS.sheet,
      immediate: prefersReducedMotion,
      onRest: (result) => {
        if (!latestOpenRef.current && result.finished && result.value.y >= 99) {
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

  const requestClose = useCallback(() => {
    if (preventClose) {
      api.start({ y: 0, immediate: false });
      return;
    }
    onClose();
  }, [api, onClose, preventClose]);

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
        api.start({ y: 0, immediate: false });
        return;
      }

      if (intent.kind === "cancel") {
        cancel();
        api.start({ y: 0, immediate: false });
        return;
      }
      if (intent.kind === "dismiss") {
        requestClose();
        return;
      }
      if (intent.kind === "snap") {
        api.start({ y: 0, immediate: false });
        return;
      }
      if (intent.kind === "drag") {
        api.start({ y: intent.offset, immediate: true });
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
      {/* Custom overlay — scrim that fades with the sheet. Bounded sheets dim
          the canvas pane behind them (no movement, no blur — depth via the
          scrim alone, per QA refinement); unbounded sheets keep the blurred
          viewport scrim. */}
      <animated.div
        style={{
          position: "absolute",
          inset: 0,
          opacity: springs.overlay,
          backgroundColor: isBounded
            ? "rgb(var(--m3-on-surface, 10 10 10) / 0.32)"
            : "rgb(var(--m3-on-surface, 10 10 10) / 0.18)",
          backdropFilter: isBounded ? undefined : "blur(2px)",
          WebkitBackdropFilter: isBounded ? undefined : "blur(2px)",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
        data-component="BottomSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="bottom-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateY from bottom */}
      <animated.div
        ref={contentRef}
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
          transform: springs.y.to((y) => getCanvasSheetTransform("bottom", y)),
          borderRadius: isBounded
            ? "var(--radius-sheet, 24px)"
            : "var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0 0",
          zIndex: isBounded ? 46 : 51,
        }}
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
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
