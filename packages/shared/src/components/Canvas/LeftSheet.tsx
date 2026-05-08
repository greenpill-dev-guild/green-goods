// packages/shared/src/components/Canvas/LeftSheet.tsx
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
      ? "var(--canvas-left-sheet-width-wide, clamp(420px, 36vw, 640px))"
      : "var(--canvas-left-sheet-width, clamp(320px, 28vw, 480px))";
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
    autoFocusSelector: '[data-testid="left-sheet-close"]',
  });

  useEffect(() => {
    latestOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) {
      latestContentRef.current = { title, description, children };
    }
  }, [children, description, open, title]);

  // Spring: x=0 fully open, x=-100 fully offscreen left
  const [springs, api] = useSpring(() => ({
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
  }));

  // Drive spring when open prop changes
  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    api.start({ x: open ? 0 : -100, overlay: open ? 1 : 0, immediate: prefersReducedMotion });
    if (prefersReducedMotion && !open) {
      setMounted(false);
      dialogRef.current?.close();
    }
  }, [open, api, mounted, prefersReducedMotion]);

  // Show native dialog when mounted
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

  // Drag dismiss gesture — drag left to dismiss
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      if (mx > 20) {
        cancel();
        return;
      }
      if (dx < 0 && vx > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (mx < -120) {
        onClose();
        return;
      }
      if (prefersReducedMotion) return;
      const sheetWidth = contentRef.current?.offsetWidth ?? 360;
      const pct = Math.min(0, (mx / sheetWidth) * 100 * 0.6);
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
      data-component="LeftSheet"
      data-slot="dialog"
      data-state={sheetState}
      data-boundary={sheetBoundary}
      data-testid="left-sheet-dialog"
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
          width: "100%",
          maxWidth: widthVar,
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          touchAction: "none",
          // Handoff: closed sits at translateX(calc(-100% - 24px)); open at translateX(0)
          transform: springs.x.to((x) => `translateX(calc(${x}% + ${(x / 100) * 24}px))`),
          borderRadius: "0 var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0",
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
        {/* Header — title on left, close on right (handoff sheet-system anatomy) */}
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
              data-testid="left-sheet-close"
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
                data-testid="left-sheet-close"
              >
                <RiCloseLine className="h-[18px] w-[18px]" />
              </button>
            </div>
          </>
        )}

        {/* Body container — flex column lets consumers compose `<SheetBody>`
            with optional `<SheetFooter>`. See RightSheet for full anatomy. */}
        <div className="flex min-h-0 flex-1 flex-col" data-slot="body">
          <SheetErrorBoundary onClose={onClose}>{renderedChildren}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );

  return isBounded && container ? createPortal(dialogElement, container) : dialogElement;
}
