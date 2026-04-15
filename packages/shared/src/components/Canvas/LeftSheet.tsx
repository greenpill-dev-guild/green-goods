// packages/shared/src/components/Canvas/LeftSheet.tsx
import { RiCloseLine } from "@remixicon/react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

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
}: LeftSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track whether the sheet should be rendered (stays true during close animation)
  const [mounted, setMounted] = useState(open);

  // Spring: x=0 fully open, x=-100 fully offscreen left
  const [springs, api] = useSpring(() => ({
    x: open ? 0 : -100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onRest: (result) => {
      if (!open && result.finished && result.value.x <= -99) {
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
    api.start({ x: open ? 0 : -100, overlay: open ? 1 : 0 });
  }, [open, api]);

  // Show native dialog when mounted
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mounted && open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    }
  }, [mounted, open]);

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
      data-testid="left-sheet-dialog"
    >
      {description ? (
        <p className="sr-only">{description}</p>
      ) : null}

      {/* Custom overlay */}
      <animated.div
        className={cn(
          "absolute inset-0",
          isBounded ? "bg-transparent" : "",
        )}
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
        data-testid="left-sheet-overlay"
      />

      {/* Sheet content — spring-driven translateX from left */}
      <animated.div
        ref={contentRef}
        className={cn(
          "absolute top-0 left-0 flex h-full flex-col rounded-r-xl",
          "focus:outline-none will-change-transform",
          "glass-floating"
        )}
        style={{
          width: "100%",
          maxWidth: "clamp(260px, 25vw, 360px)",
          paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          transform: springs.x.to((x) => `translateX(${x}%)`),
          zIndex: isBounded ? 46 : 51,
        }}
        data-testid="left-sheet"
        {...bind()}
      >
        {/* Header — close button on left, title on right (mirrored from RightSheet) */}
        {title ? (
          <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3 flex-row-reverse">
            <h2 className="text-lg font-semibold text-text-strong">
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
              data-testid="left-sheet-close"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="sr-only">{closeLabel}</h2>
            <div className="flex px-4 pt-3 justify-start">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  "text-text-soft transition-colors hover:bg-bg-soft",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                )}
                aria-label={closeLabel}
                data-testid="left-sheet-close"
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
        </div>
      </animated.div>
    </dialog>
  );
}
