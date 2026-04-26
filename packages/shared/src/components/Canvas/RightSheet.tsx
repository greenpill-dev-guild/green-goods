// packages/shared/src/components/Canvas/RightSheet.tsx
import { RiCloseLine } from "@remixicon/react";
import { useDrag } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

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
}: RightSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const sheetState = open ? "open" : "closed";
  const sheetBoundary = isBounded ? "bounded" : "viewport";
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const latestOpenRef = useRef(open);
  const latestContentRef = useRef({ title, description, children });

  // Track whether the sheet should be rendered (stays true during close animation)
  const [mounted, setMounted] = useState(open);
  useFocusTrap(dialogRef, {
    enabled: isBounded && mounted && open,
    autoFocusSelector: '[data-testid="right-sheet-close"]',
  });

  useEffect(() => {
    latestOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) {
      latestContentRef.current = { title, description, children };
    }
  }, [children, description, open, title]);

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
  }, [open, api, mounted, prefersReducedMotion]);

  // Show native dialog when mounted (provides focus trap + top layer)
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

  // Handle native dialog cancel (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault(); // Prevent instant close — let spring animate out
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

  // Drag dismiss gesture
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      if (mx < -20) {
        cancel();
        return;
      }
      if (dx > 0 && vx > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (mx > 120) {
        onClose();
        return;
      }
      if (prefersReducedMotion) return;
      const sheetWidth = contentRef.current?.offsetWidth ?? 400;
      const pct = Math.max(0, (mx / sheetWidth) * 100 * 0.6);
      api.start({ x: pct, immediate: true });
    },
    {
      from: () => [0, 0],
      axis: "x",
      filterTaps: true,
    }
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the overlay itself, not sheet content
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!mounted) return null;

  const renderedTitle = open ? title : latestContentRef.current.title;
  const renderedDescription = open ? description : latestContentRef.current.description;
  const renderedChildren = open ? children : latestContentRef.current.children;

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
      className={cn(
        // Reset native dialog styling
        "fixed inset-0 m-0 h-full w-full max-h-full max-w-full",
        "bg-transparent p-0 outline-none",
        // Disable native backdrop
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
      data-component="RightSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
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
        onClick={handleOverlayClick}
        data-component="RightSheet"
        data-slot="overlay"
        data-state={sheetState}
        data-testid="right-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateX */}
      <animated.div
        ref={contentRef}
        className={cn(
          "absolute top-0 right-0 flex h-full flex-col rounded-l-xl",
          "touch-none focus:outline-none will-change-transform",
          "glass-floating"
        )}
        style={{
          width: "100%",
          maxWidth: "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))",
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          touchAction: "none",
          transform: springs.x.to((x) => `translateX(${x}%)`),
          zIndex: isBounded ? 46 : 51,
        }}
        data-component="RightSheet"
        data-slot="surface"
        data-state={sheetState}
        data-boundary={sheetBoundary}
        data-testid="right-sheet"
        {...bind()}
      >
        {/* Header */}
        {renderedTitle ? (
          <div
            className="flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3"
            data-slot="header"
          >
            <h2 className="text-lg font-semibold text-text-strong" data-slot="title">
              {renderedTitle}
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
              data-testid="right-sheet-close"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="sr-only">{closeLabel}</h2>
            <div className="flex px-4 pt-3 justify-end" data-slot="header">
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
                data-testid="right-sheet-close"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto" data-slot="body">
          <SheetErrorBoundary onClose={onClose}>{renderedChildren}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
