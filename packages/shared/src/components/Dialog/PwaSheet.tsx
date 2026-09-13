/**
 * PwaSheet — gesture-capable bottom sheet for the installed Green Goods PWA.
 *
 * Every narrow-viewport dialog in the client renders through this sheet:
 * `DraftDialog` directly, and `ConfirmDialog` / `DialogShell` below
 * `PWA_SHEET_MEDIA_QUERY`. Passing `title` turns on the shared header
 * (title, optional description and icon, a 44px close button) above a
 * scrollable body, so those surfaces share one chrome. Without `title` the
 * consumer owns everything inside the panel.
 *
 * Layout lives in shared `utilities.css` as `[data-component="PwaSheet"]`
 * attribute rules, not as utility classes on this JSX: Tailwind v4 does not
 * scan `packages/shared/src/` from the admin/client builds, so utilities
 * authored here silently fail to generate in the installed app (the drag
 * handle tint and `touch-none` were measured missing from the client
 * bundle). The rules sit in `@layer components`, so a consumer's
 * `panelClassName` utilities and unlayered package CSS still override them;
 * inline `panelStyle` wins over everything.
 *
 * Open/close uses named CSS keyframes (`dialogSlideInFromBottom` /
 * `dialogSlideOutToBottom` for the panel, `scrimFadeIn` / `scrimFadeOut` for
 * the scrim) applied via attribute selectors on `data-state="open"|"closed"`.
 * Both keyframes and the driving `--spring-spatial-*` / `--spring-effects-*`
 * tokens live in shared (utilities.css + theme.css). The enter keyframe
 * carries a 2% overshoot waypoint at 60% — that's where the spring feel
 * comes from. A linear 2-point translate with any easing curve cannot
 * reproduce the same character, which is why we own the keyframe instead
 * of relying on Tailwind's `slide-in-from-bottom`.
 *
 * The scrim keyframes are shared with DialogShell, ConfirmDialog, and
 * ImagePreviewDialog, so all PWA dialog surfaces move with the same rhythm.
 *
 * CSS keyframes run on the browser's compositor and don't depend on
 * requestAnimationFrame, so the animation works even in backgrounded/hidden
 * tabs where RAF is throttled.
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
import { RiCloseLine } from "@remixicon/react";
import { useDrag } from "@use-gesture/react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { useDocumentScrollLock } from "../../hooks/ui/useDocumentScrollLock";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";
import { DISMISS_VELOCITY_THRESHOLD } from "../Canvas/springConfig";

const DRAG_DISMISS_DISTANCE_PX = 120;
const DRAG_PULL_RESISTANCE_FACTOR = 0.86;
const DEFAULT_CLOSE_DURATION_MS = 300;

/**
 * Viewport width below which the shared dialogs (`ConfirmDialog`,
 * `DialogShell`) render as this sheet. Matches Tailwind's `sm` breakpoint so
 * the centered surfaces and the sheet never overlap.
 */
export const PWA_SHEET_MEDIA_QUERY = "(max-width: 639px)";

export interface PwaSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Called when the sheet should close (drag dismiss, Escape, backdrop, X). */
  onClose: () => void;
  /**
   * Sheet contents. Rendered inside the shared scrollable body when `title`
   * is set; otherwise the consumer owns all header/footer chrome.
   */
  children: ReactNode;
  /** Accessible label for the dialog when no `title` is rendered. */
  ariaLabel?: string;
  /**
   * Renders the shared header (title, optional description and icon, close
   * button) above a scrollable body. The title labels the dialog.
   */
  title?: ReactNode;
  /** Secondary line under the title; becomes the dialog's accessible description. */
  description?: ReactNode;
  /** Leading block in the shared header, typically an icon in a tinted square. */
  icon?: ReactNode;
  /** Accessible name of the shared header's close button. Required whenever `title` is set. */
  closeLabel?: string;
  /** Omit the shared header's close button. */
  hideCloseButton?: boolean;
  /**
   * When true, Escape, the scrim, drag, and the close button stop dismissing
   * the sheet — use during in-flight work.
   */
  preventClose?: boolean;
  /** Dialog role. Use `alertdialog` for destructive confirmations. */
  role?: "dialog" | "alertdialog";
  /** Additional class name on the panel surface. */
  panelClassName?: string;
  /** Optional inline style on the panel (e.g. a fixed height for tabbed sheets). */
  panelStyle?: CSSProperties;
  /** Auto-focus selector on open. Defaults to the close button. */
  autoFocusSelector?: string;
  /** When true, render the drag handle. Default `true`. */
  showDragHandle?: boolean;
  /** Override the data-testid (panel, overlay, and drag handle inherit). */
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
 * Sheet primitive. With `title`, the sheet renders the shared header and body;
 * without it, consumers compose their own header / tabs / footer inside
 * `children` and call `onClose` from any surface that triggers dismissal.
 */
export function PwaSheet({
  open,
  onClose,
  children,
  ariaLabel,
  title,
  description,
  icon,
  closeLabel,
  hideCloseButton = false,
  preventClose = false,
  role = "dialog",
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
  const titleId = useId();
  const descriptionId = useId();
  const hasHeader = title !== undefined && title !== null;
  const canDrag = dragToDismiss && !preventClose;

  const sheetState = open ? "open" : "closed";

  useFocusTrap(dialogRef, { enabled: mounted && open, autoFocusSelector });
  useDocumentScrollLock(open || mounted);

  const requestClose = useCallback(() => {
    if (preventClose) return;
    onClose();
  }, [onClose, preventClose]);

  // Mount on open, keep mounted during the close keyframe so the slide-out
  // animation can play, then unmount after the animation completes.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    const finishClose = () => setMounted(false);
    if (prefersReducedMotion || document.visibilityState === "hidden") {
      finishClose();
      return;
    }

    const handlePageHide = () => finishClose();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") finishClose();
    };
    const duration = readCssDurationMs("--spring-spatial-duration");
    const timer = window.setTimeout(finishClose, duration + 40);

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [open, prefersReducedMotion]);

  // Escape closes.
  useEffect(() => {
    if (!mounted || !open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [mounted, open, requestClose]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) requestClose();
    },
    [requestClose]
  );

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel, last }) => {
      if (!canDrag) return;
      if (my < -20) {
        cancel();
        return;
      }
      if (last) {
        if (dy > 0 && vy > DISMISS_VELOCITY_THRESHOLD) {
          setDragOffset(null);
          requestClose();
          return;
        }
        if (my > DRAG_DISMISS_DISTANCE_PX) {
          setDragOffset(null);
          requestClose();
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
      enabled: canDrag,
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
      className={overlayClassName}
      style={{ pointerEvents: "auto" }}
      onClick={handleOverlayClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") requestClose();
      }}
      tabIndex={-1}
    >
      <div
        aria-hidden="true"
        data-component="PwaSheet"
        data-slot="scrim"
        data-state={sheetState}
        style={{ backgroundColor: "var(--color-scrim)" }}
      />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions -- dialog surface (role is a prop, so the linter cannot see it); handlers only stop propagation, Escape is handled on document */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={hasHeader ? undefined : ariaLabel}
        aria-labelledby={hasHeader ? titleId : undefined}
        aria-describedby={hasHeader && description ? descriptionId : undefined}
        data-component="PwaSheet"
        data-slot="surface"
        data-state={sheetState}
        data-testid={testId}
        className={panelClassName}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          ...dragStyle,
          ...panelStyle,
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {showDragHandle && (
          <div
            data-component="PwaSheet"
            data-slot="drag-handle"
            data-testid={`${testId}-drag-handle`}
            style={{ touchAction: "none" }}
            {...bind()}
          >
            <div data-component="PwaSheet" data-slot="grip" />
          </div>
        )}
        {hasHeader && (
          <header data-component="PwaSheet" data-slot="header">
            <div data-component="PwaSheet" data-slot="heading">
              {icon ? (
                <div data-component="PwaSheet" data-slot="icon">
                  {icon}
                </div>
              ) : null}
              <div data-component="PwaSheet" data-slot="text">
                <h2 id={titleId} data-component="PwaSheet" data-slot="title">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} data-component="PwaSheet" data-slot="description">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                data-component="PwaSheet"
                data-slot="close"
                data-testid="pwa-sheet-close"
                aria-label={closeLabel}
                disabled={preventClose}
                onClick={requestClose}
              >
                <RiCloseLine aria-hidden="true" />
              </button>
            )}
          </header>
        )}
        {hasHeader ? (
          <div data-component="PwaSheet" data-slot="body">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
