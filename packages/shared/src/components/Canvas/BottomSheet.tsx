// packages/shared/src/components/Canvas/BottomSheet.tsx
import { RiCloseLine } from "@remixicon/react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

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
}: BottomSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const sheetState = open ? "open" : "closed";
  const sheetBoundary = isBounded ? "bounded" : "viewport";
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(open);

  // Spring: y=0 fully open, y=100 fully offscreen bottom (percentage)
  const [springs, api] = useSpring(() => ({
    y: open ? 0 : 100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onRest: (result) => {
      if (!open && result.finished && result.value.y >= 99) {
        setMounted(false);
        dialogRef.current?.close();
      }
    },
  }));

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    api.start({ y: open ? 0 : 100, overlay: open ? 1 : 0 });
  }, [open, api]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mounted && open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    }
  }, [mounted, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  // Drag dismiss gesture — drag down to dismiss
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel }) => {
      // Only allow dragging down (positive y)
      if (my < -20) {
        cancel();
        return;
      }
      if (dy > 0 && vy > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (my > 120) {
        onClose();
        return;
      }
      const sheetHeight = contentRef.current?.offsetHeight ?? 400;
      const pct = Math.max(0, (my / sheetHeight) * 100 * 0.86);
      api.start({ y: pct, immediate: true });
    },
    {
      from: () => [0, 0],
      axis: "y",
      filterTaps: true,
    }
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={title || closeLabel}
      aria-modal="true"
      className={cn(
        "fixed inset-0 m-0 h-full w-full max-h-full max-w-full",
        "bg-transparent p-0 outline-none",
        "backdrop:bg-transparent backdrop:backdrop-filter-none",
        isBounded && "absolute"
      )}
      style={{
        zIndex: isBounded ? 45 : 50,
      }}
      data-component="BottomSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
      data-testid="bottom-sheet-dialog"
    >
      {/* Custom overlay — static blur, opacity fade only */}
      <animated.div
        className={cn("absolute inset-0", isBounded ? "bg-transparent" : "")}
        style={{
          opacity: isBounded ? 0 : springs.overlay,
          backgroundColor: isBounded ? undefined : "rgb(var(--m3-on-surface, 10 10 10) / 0.18)",
          backdropFilter: isBounded ? undefined : "blur(2px)",
          WebkitBackdropFilter: isBounded ? undefined : "blur(2px)",
        }}
        onClick={handleOverlayClick}
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
          maxHeight: isBounded ? `${maxHeight}%` : `${maxHeight}dvh`,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          boxShadow: "var(--m3-elevation-4, var(--elevation-4))",
          transform: springs.y.to((y) => `translateY(${y}%)`),
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
          data-slot="drag-handle"
          data-state={sheetState}
          data-testid="bottom-sheet-drag-handle"
          {...bind()}
        >
          <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--ws-primary,var(--primary-base))/0.32)]" />
        </div>

        {/* Header */}
        {title ? (
          <div
            className="flex items-center justify-between border-b border-stroke-soft/80 px-4 pb-3"
            data-slot="header"
          >
            <h2 className="text-lg font-semibold text-text-strong" data-slot="title">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "text-text-soft transition-colors hover:bg-bg-soft",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
              )}
              aria-label={closeLabel}
              data-slot="close-button"
              data-testid="bottom-sheet-close"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <h2 className="sr-only">{closeLabel}</h2>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto" data-slot="body">
          <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );
}
