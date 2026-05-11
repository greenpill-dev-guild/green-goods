/**
 * PwaSheet — gesture-capable bottom sheet for the installed Green Goods PWA.
 *
 * Open/close uses Tailwind CSS keyframe animations (`animate-in slide-in-from-bottom`
 * for opening, `animate-out slide-out-to-bottom` for closing) driven by the
 * `data-state="open"|"closed"` attribute. CSS keyframes run on the browser's
 * compositor and don't depend on requestAnimationFrame, so the animation works
 * even in backgrounded/hidden tabs where RAF is throttled.
 *
 * Drag-to-dismiss uses use-gesture + React state to write an inline transform
 * that overrides the keyframe-set transform while the finger is down.
 *
 * History: an earlier implementation used react-spring with an imperative
 * api.start in a useEffect. In the `ModalDrawer` consumer pattern (component
 * always mounted, `isOpen` toggles) the api.start raced the conditional
 * `return null` — animated.divs were not in the DOM when api.start fired,
 * so the spring stayed at its initial `y=100`. CSS keyframes sidestep the
 * race entirely.
 *
 * @module components/Dialog/PwaSheet
 */
import { useDrag } from "@use-gesture/react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";
import { cn } from "../../utils/styles/cn";
import { DISMISS_VELOCITY_THRESHOLD } from "../Canvas/springConfig";

const DRAG_DISMISS_DISTANCE_PX = 120;
const DRAG_PULL_RESISTANCE_FACTOR = 0.86;
const PWA_SHEET_OVERLAY_BG = "rgb(var(--m3-on-surface, 10 10 10) / 0.18)";
const DEFAULT_CLOSE_DURATION_MS = 300;

export interface PwaSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Called when the sheet should close (drag dismiss, Escape, backdrop, X). */
  onClose: () => void;
  /** Sheet contents. Header/footer chrome is owned by the consumer. */
  children: ReactNode;
  /** Accessible label for the dialog when no header `<h2>` is rendered. */
  ariaLabel?: string;
  /** Additional class name on the panel surface. */
  panelClassName?: string;
  /** Optional inline style on the panel (e.g. maxHeight overrides). */
  panelStyle?: CSSProperties;
  /** Auto-focus selector on open. Defaults to the close button. */
  autoFocusSelector?: string;
  /** When true, render the drag handle. Default `true`. */
  showDragHandle?: boolean;
  /** Override the data-testid (panel + overlay both inherit). */
  testId?: string;
  /** Optional class for the overlay (typically not needed). */
  overlayClassName?: string;
  /** When false, dragging the sheet down does not dismiss it. */
  dragToDismiss?: boolean;
}

function readCssDurationMs(varName: string): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_CLOSE_DURATION_MS;
  }
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return DEFAULT_CLOSE_DURATION_MS;
  if (value.endsWith("ms")) return numeric;
  if (value.endsWith("s")) return numeric * 1000;
  return numeric || DEFAULT_CLOSE_DURATION_MS;
}

/**
 * Render-prop sheet primitive. Consumers compose their own header / tabs /
 * footer inside `children` and call `onClose` from any surface that triggers
 * dismissal.
 */
export function PwaSheet({
  open,
  onClose,
  children,
  ariaLabel,
  panelClassName,
  panelStyle,
  autoFocusSelector = '[data-testid="pwa-sheet-close"]',
  showDragHandle = true,
  testId = "pwa-sheet",
  overlayClassName,
  dragToDismiss = true,
}: PwaSheetProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [mounted, setMounted] = useState(open);
  // Active drag offset in percent (0 = at rest, 100 = fully off-screen below).
  // null means "not actively dragging" — CSS keyframe drives the transform.
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const sheetState = open ? "open" : "closed";

  useFocusTrap(dialogRef, { enabled: mounted && open, autoFocusSelector });

  // Mount on open, keep mounted during the close keyframe so the slide-out
  // animation can play, then unmount after the animation completes.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (prefersReducedMotion) {
      setMounted(false);
      return;
    }
    const duration = readCssDurationMs("--spring-spatial-duration");
    const timer = window.setTimeout(() => setMounted(false), duration + 40);
    return () => window.clearTimeout(timer);
  }, [open, prefersReducedMotion]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, [mounted]);

  // Escape closes.
  useEffect(() => {
    if (!mounted || !open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mounted, onClose, open]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel, last }) => {
      if (!dragToDismiss) return;
      if (my < -20) {
        cancel();
        return;
      }
      if (last) {
        if (dy > 0 && vy > DISMISS_VELOCITY_THRESHOLD) {
          setDragOffset(null);
          onClose();
          return;
        }
        if (my > DRAG_DISMISS_DISTANCE_PX) {
          setDragOffset(null);
          onClose();
          return;
        }
        // Snap back — clearing `dragOffset` removes the inline transform so
        // the keyframe's final state (translateY(0)) re-applies.
        setDragOffset(null);
        return;
      }
      if (prefersReducedMotion) return;
      const sheetHeight = dialogRef.current?.offsetHeight ?? 400;
      const pct = Math.max(0, (my / sheetHeight) * 100 * DRAG_PULL_RESISTANCE_FACTOR);
      setDragOffset(pct);
    },
    {
      from: () => [0, 0],
      axis: "y",
      filterTaps: true,
      enabled: dragToDismiss,
    }
  );

  if (!mounted) return null;

  // Inline transform during drag overrides the keyframe transform. When
  // not dragging, leave it unset so the keyframe's final state applies.
  const dragStyle: CSSProperties =
    dragOffset !== null ? { transform: `translateY(${dragOffset}%)` } : {};

  return (
    <div
      role="presentation"
      data-component="PwaSheet"
      data-slot="overlay"
      data-state={sheetState}
      data-testid={`${testId}-overlay`}
      className={cn("fixed inset-0 z-modal flex items-end justify-center", overlayClassName)}
      style={{ pointerEvents: "auto" }}
      onClick={handleOverlayClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      tabIndex={-1}
    >
      <div
        aria-hidden="true"
        data-state={sheetState}
        className={cn(
          "absolute inset-0",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        )}
        style={{
          backgroundColor: PWA_SHEET_OVERLAY_BG,
          animationDuration: prefersReducedMotion ? "0ms" : "var(--spring-effects-duration)",
          animationTimingFunction: "var(--spring-effects-easing)",
          animationFillMode: "both",
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-component="PwaSheet"
        data-slot="surface"
        data-state={sheetState}
        data-testid={testId}
        className={cn(
          "relative w-full overflow-hidden",
          "bg-[var(--color-material-solid)]",
          "rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)]",
          "border border-stroke-soft-200 border-b-0",
          "flex flex-col h-modal",
          "will-change-transform",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          panelClassName
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          animationDuration: prefersReducedMotion ? "0ms" : "var(--spring-spatial-duration)",
          animationTimingFunction: "var(--spring-spatial-easing)",
          animationFillMode: "both",
          ...dragStyle,
          ...panelStyle,
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {showDragHandle && (
          <div
            className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
            data-slot="drag-handle"
            data-testid={`${testId}-drag-handle`}
            style={{ touchAction: "none" }}
            {...bind()}
          >
            <div className="h-1.5 w-10 rounded-full bg-[rgb(var(--tone-primary,var(--primary-base))/0.32)]" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
