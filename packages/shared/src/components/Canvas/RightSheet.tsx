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
        inset: isBounded
          ? "var(--admin-sheet-top, calc(var(--admin-appbar-height, 3.5rem) + 0.5rem)) 0 var(--admin-sheet-bottom, 6.25rem) 0"
          : 0,
        width: isBounded ? "auto" : "100%",
        height: isBounded ? "auto" : "100%",
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
        onClick={handleOverlayClick}
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
          // Handoff: closed sits at translateX(calc(100% + 24px)); open at translateX(0)
          transform: springs.x.to((x) => `translateX(calc(${x}% + ${(x / 100) * 24}px))`),
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
        {/* Header — handoff anatomy: title on left, close on right */}
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
                letterSpacing: "-0.01em",
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
              data-testid="right-sheet-close"
            >
              <RiCloseLine className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="sr-only">{closeLabel}</h2>
            <div className="flex justify-end" style={{ padding: "16px 16px 0" }} data-slot="header">
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
                data-testid="right-sheet-close"
              >
                <RiCloseLine className="h-[18px] w-[18px]" />
              </button>
            </div>
          </>
        )}

        {/* Body container — flex column lets consumers compose `<SheetBody>`
            (which carries `flex: 1; overflow-y: auto`) above an optional
            `<SheetFooter>` (which pins via `flex-shrink: 0`). Consumers without
            a SheetBody wrap the bare children in this fallback scroll layer
            so legacy panels still work. */}
        <div className="flex min-h-0 flex-1 flex-col" data-slot="body">
          <SheetErrorBoundary onClose={onClose}>{renderedChildren}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
