// packages/shared/src/components/Canvas/BottomSheet.tsx
import { RiCloseLine } from "@remixicon/react";
import { animated, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS } from "./springConfig";

const DRAG_DISMISS_THRESHOLD = 120;

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
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

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

  // Pointer-based drag handle
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.clientY - dragStartY.current;
      if (delta > 0) {
        const sheetHeight = contentRef.current?.offsetHeight ?? 400;
        const pct = Math.min(100, (delta / sheetHeight) * 100 * 0.86);
        api.start({ y: pct, immediate: true });
      }
    },
    [api],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;

      if (delta > DRAG_DISMISS_THRESHOLD) {
        onClose();
      } else {
        api.start({ y: 0 });
      }
    },
    [onClose, api],
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
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
        isBounded && "absolute",
      )}
      style={{
        zIndex: isBounded ? 45 : 50,
      }}
      data-testid="bottom-sheet-dialog"
    >
      {/* Custom overlay */}
      <animated.div
        className={cn("absolute inset-0", isBounded ? "bg-transparent" : "")}
        style={{
          opacity: isBounded ? 0 : springs.overlay,
          backgroundColor: isBounded ? undefined : "rgba(10, 10, 10, 0.18)",
          backdropFilter: isBounded
            ? undefined
            : springs.overlay.to((o) => `blur(${o * 4}px)`),
          WebkitBackdropFilter: isBounded
            ? undefined
            : springs.overlay.to((o) => `blur(${o * 4}px)`),
        }}
        onClick={handleOverlayClick}
        data-testid="bottom-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateY from bottom */}
      <animated.div
        ref={contentRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 flex w-full flex-col",
          "rounded-t-xl glass-floating",
          "focus:outline-none will-change-transform",
        )}
        style={{
          maxHeight: isBounded ? `${maxHeight}%` : `${maxHeight}dvh`,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          boxShadow: "var(--elevation-4)",
          transform: springs.y.to((y) => `translateY(${y}%)`),
          zIndex: isBounded ? 46 : 51,
        }}
        data-testid="bottom-sheet"
      >
        {/* Drag handle */}
        <div
          className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => api.start({ y: 0 })}
          data-testid="bottom-sheet-drag-handle"
        >
          <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--ws-primary,var(--primary-base))/0.32)]" />
        </div>

        {/* Header */}
        {title ? (
          <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 pb-3">
            <h2 className="text-lg font-semibold text-text-strong">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "text-text-soft transition-colors hover:bg-bg-soft",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
              )}
              aria-label={closeLabel}
              data-testid="bottom-sheet-close"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <h2 className="sr-only">{closeLabel}</h2>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );
}
