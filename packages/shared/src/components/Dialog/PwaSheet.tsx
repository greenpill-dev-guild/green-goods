/**
 * PwaSheet — gesture-capable bottom sheet for the installed Green Goods PWA.
 *
 * Reuses the same react-spring + use-gesture machinery as the admin canvas
 * `BottomSheet`, but ships the PWA's glass/thick chrome and is portal-free
 * (mounted at document.body so it always sits above the bottom `AppBar`).
 *
 * Intentional behavior:
 * - Drag down past 120px or above the velocity threshold dismisses.
 * - `prefers-reduced-motion: reduce` skips JS timers entirely (`immediate: true`).
 * - Backdrop click and Escape close, both routed through `onClose`.
 * - Focus trap and scroll-lock follow the same idioms used by the existing
 *   client `ModalDrawer`, so consumers can swap the implementation in place.
 *
 * @module components/Dialog/PwaSheet
 */
import { animated, useSpring } from "@react-spring/web";
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
import { DISMISS_VELOCITY_THRESHOLD, SPRING_CONFIGS } from "../Canvas/springConfig";

const DRAG_DISMISS_DISTANCE_PX = 120;
const DRAG_PULL_RESISTANCE_FACTOR = 0.86;
const PWA_SHEET_OVERLAY_BG = "rgb(var(--m3-on-surface, 10 10 10) / 0.18)";

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

/**
 * Render-prop sheet primitive. Consumers compose their own header / tabs /
 * footer inside `children` and call `onClose` from any surface that triggers
 * dismissal — the sheet animates out then unmounts the panel.
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const latestOpenRef = useRef(open);
  const sheetState = open ? "open" : "closed";

  useFocusTrap(dialogRef, { enabled: mounted && open, autoFocusSelector });

  useEffect(() => {
    latestOpenRef.current = open;
  }, [open]);

  const [springs, api] = useSpring(() => ({
    y: open ? 0 : 100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    immediate: prefersReducedMotion,
    onRest: (result) => {
      if (!latestOpenRef.current && result.finished && result.value.y >= 99) {
        setMounted(false);
      }
    },
  }));

  useEffect(() => {
    if (open) {
      setMounted(true);
      api.start({ y: 0, overlay: 1, immediate: prefersReducedMotion });
      return;
    }
    api.start({ y: 100, overlay: 0, immediate: prefersReducedMotion });
    if (prefersReducedMotion) {
      // Reduced-motion users get an instant unmount instead of waiting on a
      // JS timer that mirrors the now-zeroed CSS duration. Fixes the bug
      // where `getPwaDrawerCloseDelayMs()` still resolved to 300ms even when
      // the global `*` rule had snapped every transition to 0.01ms.
      setMounted(false);
    }
  }, [open, api, prefersReducedMotion]);

  // Body scroll lock while open — matches existing `modal-open` idiom so
  // shared CSS continues to work without changes.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, [mounted]);

  // Escape closes
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
          onClose();
          return;
        }
        if (my > DRAG_DISMISS_DISTANCE_PX) {
          onClose();
          return;
        }
        api.start({ y: 0, immediate: prefersReducedMotion });
        return;
      }
      if (prefersReducedMotion) return;
      const sheetHeight = contentRef.current?.offsetHeight ?? 400;
      const pct = Math.max(0, (my / sheetHeight) * 100 * DRAG_PULL_RESISTANCE_FACTOR);
      api.start({ y: pct, immediate: true });
    },
    {
      from: () => [0, 0],
      axis: "y",
      filterTaps: true,
      enabled: dragToDismiss,
    }
  );

  if (!mounted) return null;

  return (
    <div
      role="presentation"
      data-component="PwaSheet"
      data-slot="overlay"
      data-state={sheetState}
      data-testid={`${testId}-overlay`}
      className={cn(
        "fixed inset-0 z-modal flex items-end justify-center backdrop-blur-[var(--blur-material-thick)]",
        overlayClassName
      )}
      style={{ pointerEvents: "auto" }}
      onClick={handleOverlayClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      tabIndex={-1}
    >
      <animated.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          opacity: springs.overlay,
          backgroundColor: PWA_SHEET_OVERLAY_BG,
        }}
      />
      <animated.div
        ref={(node) => {
          dialogRef.current = node;
          contentRef.current = node;
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-component="PwaSheet"
        data-slot="surface"
        data-state={sheetState}
        data-testid={testId}
        className={cn(
          "relative w-full overflow-hidden",
          "bg-[var(--color-material-thick)] backdrop-blur-[var(--blur-material-thick)]",
          "rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)]",
          "border border-stroke-soft-200 border-b-0",
          "flex flex-col h-modal",
          "will-change-transform",
          panelClassName
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: springs.y.to((y) => `translateY(${y}%)`),
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
      </animated.div>
    </div>
  );
}
