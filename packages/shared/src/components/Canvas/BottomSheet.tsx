// packages/shared/src/components/Canvas/BottomSheet.tsx
import { RiCloseLine } from "@remixicon/react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";
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
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const latestOpenRef = useRef(open);
  const latestContentRef = useRef({ title, children });

  const [mounted, setMounted] = useState(open);
  useFocusTrap(dialogRef, {
    enabled: isBounded && mounted && open,
    autoFocusSelector: '[data-testid="bottom-sheet-close"]',
  });

  useEffect(() => {
    latestOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) {
      latestContentRef.current = { title, children };
    }
  }, [children, open, title]);

  // Spring: y=0 fully open, y=100 fully offscreen bottom (percentage)
  const [springs, api] = useSpring(() => ({
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
  }));

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    api.start({ y: open ? 0 : 100, overlay: open ? 1 : 0, immediate: prefersReducedMotion });
    if (prefersReducedMotion && !open) {
      setMounted(false);
      dialogRef.current?.close();
    }
  }, [open, api, mounted, prefersReducedMotion]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isBounded) {
      return;
    }

    if (mounted && open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    }
  }, [isBounded, mounted, open]);

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

  useEffect(() => {
    if (!isBounded || !mounted || !open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBounded, mounted, onClose, open]);

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
      if (prefersReducedMotion) return;
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

  const renderedTitle = open ? title : latestContentRef.current.title;
  const renderedChildren = open ? children : latestContentRef.current.children;

  const dialogElement = (
    <dialog
      ref={dialogRef}
      aria-label={renderedTitle || closeLabel}
      aria-modal="true"
      open={isBounded ? mounted : undefined}
      tabIndex={-1}
      className={cn(
        "fixed inset-0 m-0 h-full w-full max-h-full max-w-full",
        "bg-transparent p-0 outline-none",
        "backdrop:bg-transparent backdrop:backdrop-filter-none",
        isBounded && "absolute"
      )}
      style={{
        position: isBounded ? "absolute" : "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        maxWidth: "none",
        maxHeight: "none",
        margin: 0,
        pointerEvents: "auto",
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
          "glass-floating",
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
          style={{ touchAction: "none" }}
          data-slot="drag-handle"
          data-state={sheetState}
          data-testid="bottom-sheet-drag-handle"
          {...bind()}
        >
          <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--tone-primary,var(--primary-base))/0.32)]" />
        </div>

        {/* Header */}
        {renderedTitle ? (
          <div
            className="flex items-center justify-between"
            style={{
              padding: "16px 16px 14px",
              borderBottom: "1px solid var(--hairline, rgb(var(--m3-outline-variant) / 0.6))",
              flexShrink: 0,
            }}
            data-slot="header"
          >
            <h2
              data-slot="title"
              style={{
                fontSize: "15px",
                lineHeight: "1.2",
                fontWeight: 700,
                color: "var(--ink, rgb(var(--m3-on-surface)))",
                margin: 0,
              }}
            >
              {renderedTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                "text-text-soft transition-colors hover:bg-bg-soft",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
              )}
              aria-label={closeLabel}
              data-slot="close-button"
              data-testid="bottom-sheet-close"
            >
              <RiCloseLine className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <h2 className="sr-only">{closeLabel}</h2>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-slot="body">
          <SheetErrorBoundary onClose={onClose}>{renderedChildren}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
