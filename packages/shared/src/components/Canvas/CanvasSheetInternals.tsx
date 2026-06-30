import { RiCloseLine } from "@remixicon/react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFocusTrap } from "../../hooks/utils/useFocusTrap";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

export type CanvasSheetEdge = "left" | "right" | "bottom";

export interface CanvasSheetContentSnapshot {
  title?: string;
  description?: string;
  children: ReactNode;
}

interface CanvasSheetMountState {
  mounted: boolean;
  setMounted: (mounted: boolean) => void;
  latestOpenRef: RefObject<boolean>;
}

export const CANVAS_SHEET_HANDOFF_PX = 24;
export const CANVAS_SHEET_DISMISS_DISTANCE_PX = 120;
export const CANVAS_SHEET_OPPOSITE_CANCEL_PX = 20;
export const CANVAS_SHEET_SIDE_DRAG_RESISTANCE = 0.6;
export const CANVAS_SHEET_BOTTOM_DRAG_RESISTANCE = 0.86;

export function useCanvasSheetMount(open: boolean): CanvasSheetMountState {
  const [mounted, setMounted] = useState(open);
  const latestOpenRef = useRef(open);

  useEffect(() => {
    latestOpenRef.current = open;
  }, [open]);

  return { mounted, setMounted, latestOpenRef };
}

export function useCanvasSheetContentSnapshot<TSnapshot extends CanvasSheetContentSnapshot>(
  open: boolean,
  snapshot: TSnapshot
): TSnapshot {
  const latestContentRef = useRef(snapshot);

  useEffect(() => {
    if (open) {
      latestContentRef.current = snapshot;
    }
  }, [open, snapshot]);

  return open ? snapshot : latestContentRef.current;
}

interface UseCanvasSheetLifecycleOptions {
  dialogRef: RefObject<HTMLDialogElement | null>;
  open: boolean;
  mounted: boolean;
  isBounded: boolean;
  onClose: () => void;
  autoFocusSelector: string;
}

export function useCanvasSheetLifecycle({
  dialogRef,
  open,
  mounted,
  isBounded,
  onClose,
  autoFocusSelector,
}: UseCanvasSheetLifecycleOptions) {
  useFocusTrap(dialogRef, {
    enabled: isBounded && mounted && open,
    autoFocusSelector,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || isBounded) return;

    if (mounted && open && !dialog.open) {
      dialog.showModal();
    }
  }, [dialogRef, isBounded, mounted, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [dialogRef, onClose]);

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
}

export function getCanvasSheetDialogClassName(isBounded: boolean) {
  return cn(
    "fixed inset-0 m-0 h-full w-full max-h-full max-w-full",
    "bg-transparent p-0 outline-none",
    "backdrop:bg-transparent backdrop:backdrop-filter-none",
    isBounded && "absolute"
  );
}

export function getCanvasSheetDialogStyle(isBounded: boolean): CSSProperties {
  return {
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
    // Layering contract: bounded sheets render INSIDE CanvasLayout's sheet
    // layer, which sits at --z-overlay (40, above the nav dock at 30) so the
    // scrim can dim the whole viewport. These values just stack locally within
    // that layer (surface above scrim). Unbounded sheets cover the viewport.
    zIndex: isBounded ? 45 : 50,
  };
}

export function getCanvasSheetTransform(edge: CanvasSheetEdge, offsetPct: number): string {
  if (edge === "bottom") {
    return `translateY(${offsetPct}%)`;
  }

  const handoffPx = (offsetPct / 100) * CANVAS_SHEET_HANDOFF_PX;
  const operator = handoffPx < 0 ? "-" : "+";

  return `translateX(calc(${offsetPct}% ${operator} ${Math.abs(handoffPx)}px))`;
}

export type CanvasSheetDragIntent =
  | { kind: "cancel" }
  | { kind: "dismiss" }
  | { kind: "snap" }
  | { kind: "drag"; offset: number }
  | { kind: "ignore" };

export interface CanvasSheetDragInput {
  edge: CanvasSheetEdge;
  movementX: number;
  movementY: number;
  velocityX: number;
  velocityY: number;
  directionX: number;
  directionY: number;
  sizePx: number;
  last: boolean;
  prefersReducedMotion: boolean;
}

export function getCanvasSheetDragIntent({
  edge,
  movementX,
  movementY,
  velocityX,
  velocityY,
  directionX,
  directionY,
  sizePx,
  last,
  prefersReducedMotion,
}: CanvasSheetDragInput): CanvasSheetDragIntent {
  const isBottom = edge === "bottom";
  const movement = isBottom ? movementY : movementX;
  const velocity = isBottom ? velocityY : velocityX;
  const direction = isBottom ? directionY : directionX;
  const movingAgainstDismiss =
    edge === "left"
      ? movement > CANVAS_SHEET_OPPOSITE_CANCEL_PX
      : movement < -CANVAS_SHEET_OPPOSITE_CANCEL_PX;

  if (movingAgainstDismiss) {
    return { kind: "cancel" };
  }

  const movingTowardDismiss = edge === "left" ? direction < 0 : direction > 0;
  const pastDistance =
    edge === "left"
      ? movement < -CANVAS_SHEET_DISMISS_DISTANCE_PX
      : movement > CANVAS_SHEET_DISMISS_DISTANCE_PX;
  const pastVelocity = movingTowardDismiss && velocity > DISMISS_VELOCITY_THRESHOLD;

  if (last) {
    if (pastDistance || pastVelocity) {
      return { kind: "dismiss" };
    }

    return prefersReducedMotion ? { kind: "ignore" } : { kind: "snap" };
  }

  if (prefersReducedMotion) {
    return { kind: "ignore" };
  }

  const resistance = isBottom
    ? CANVAS_SHEET_BOTTOM_DRAG_RESISTANCE
    : CANVAS_SHEET_SIDE_DRAG_RESISTANCE;
  const safeSize = Math.max(sizePx, 1);
  const rawOffset = (movement / safeSize) * 100 * resistance;
  const offset = edge === "left" ? Math.min(0, rawOffset) : Math.max(0, rawOffset);

  return { kind: "drag", offset };
}

// ── CSS slide motion (replaces react-spring) ────────────────────────────────
// Sheets slide via a CSS transition on `transform` driven by a declared pose
// (open/closed) plus imperative transform writes during drag. Tokens are the
// shared spatial spring easings; the overlay scrim cross-fades on the effects
// easing. All inline so it dodges the Tailwind-shared-scan gotcha.
const SHEET_SLIDE_TRANSITION =
  "transform var(--spring-spatial-duration) var(--spring-spatial-easing)";
const SHEET_OVERLAY_TRANSITION =
  "opacity var(--spring-effects-duration) var(--spring-effects-easing)";

function getCanvasSheetClosedOffset(edge: CanvasSheetEdge): number {
  // left slides off to the left (-100); right + bottom slide off positive (100).
  return edge === "left" ? -100 : 100;
}

interface CanvasSheetCssMotionOptions {
  edge: CanvasSheetEdge;
  open: boolean;
  mounted: boolean;
  setMounted: (mounted: boolean) => void;
  prefersReducedMotion: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
}

export interface CanvasSheetCssMotion {
  surfaceRef: RefObject<HTMLDivElement | null>;
  surfaceTransform: string;
  surfaceTransition: string;
  overlayOpacity: number;
  overlayTransition: string;
  /** Attach to the surface `onTransitionEnd`; unmounts once the close slide settles. */
  onSurfaceTransitionEnd: (event: { propertyName: string }) => void;
  /** Live drag — write the transform directly with no transition. */
  dragTo: (offsetPct: number) => void;
  /** Snap back to the open pose with the slide transition. */
  snapOpen: () => void;
  /** Restore the slide transition before a drag-driven close so the exit animates. */
  primeClose: () => void;
}

/**
 * useCanvasSheetCssMotion — CSS-transition slide + scrim cross-fade for the
 * canvas sheets, replacing react-spring. The pose is React-declared so the
 * surface enters on mount and exits on close; drag writes transforms directly
 * for finger-following, then snaps or hands off to the close transition. The
 * surface `transitionend` (transform) unmounts after a close; reduced motion
 * skips animation entirely (the caller unmounts immediately).
 */
export function useCanvasSheetCssMotion({
  edge,
  open,
  mounted,
  setMounted,
  prefersReducedMotion,
  dialogRef,
}: CanvasSheetCssMotionOptions): CanvasSheetCssMotion {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  // `pose` is the declared transform target. It starts closed so the first
  // mounted frame animates inward.
  const [pose, setPose] = useState<"closed" | "open">("closed");
  const openRef = useRef(open);
  openRef.current = open;

  // Enter: when open + mounted, flip to the open pose on the next frame (or
  // immediately under reduced motion). The rAF guarantees the closed pose paints
  // first so the transition has somewhere to animate from.
  useEffect(() => {
    if (!open || !mounted) return;
    if (prefersReducedMotion) {
      setPose("open");
      return;
    }
    setPose("closed");
    const raf = requestAnimationFrame(() => setPose("open"));
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, prefersReducedMotion]);

  // Exit: when closing (still mounted), flip to the closed pose; the surface
  // transitionend handler unmounts. Reduced-motion close is handled by the
  // caller (immediate unmount), so this is a no-op there.
  useEffect(() => {
    if (open || !mounted || prefersReducedMotion) return;
    setPose("closed");
  }, [open, mounted, prefersReducedMotion]);

  const onSurfaceTransitionEnd = useCallback(
    (event: { propertyName: string }) => {
      if (event.propertyName !== "transform") return;
      if (!openRef.current) {
        setMounted(false);
        dialogRef.current?.close();
      }
    },
    [setMounted, dialogRef]
  );

  const dragTo = useCallback(
    (offsetPct: number) => {
      const el = surfaceRef.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = getCanvasSheetTransform(edge, offsetPct);
    },
    [edge]
  );

  const snapOpen = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.transition = SHEET_SLIDE_TRANSITION;
    el.style.transform = getCanvasSheetTransform(edge, 0);
  }, [edge]);

  const primeClose = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    // React won't re-apply an unchanged `transition` value, so after a drag set
    // it to "none" we restore the slide transition here before the state-driven
    // close re-targets the transform.
    el.style.transition = SHEET_SLIDE_TRANSITION;
  }, []);

  const offsetPct = pose === "open" ? 0 : getCanvasSheetClosedOffset(edge);

  return {
    surfaceRef,
    surfaceTransform: getCanvasSheetTransform(edge, offsetPct),
    surfaceTransition: prefersReducedMotion ? "none" : SHEET_SLIDE_TRANSITION,
    overlayOpacity: pose === "open" ? 1 : 0,
    overlayTransition: prefersReducedMotion ? "none" : SHEET_OVERLAY_TRANSITION,
    onSurfaceTransitionEnd,
    dragTo,
    snapOpen,
    primeClose,
  };
}

export interface CanvasSheetHeaderProps {
  title?: string;
  closeLabel: string;
  closeTestId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  showCloseWhenUntitled?: boolean;
}

export function CanvasSheetHeader({
  title,
  closeLabel,
  closeTestId,
  onClose,
  closeDisabled = false,
  showCloseWhenUntitled = true,
}: CanvasSheetHeaderProps) {
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      disabled={closeDisabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        "text-text-soft transition-colors hover:bg-bg-soft",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
        closeDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
      )}
      aria-label={closeLabel}
      data-slot="close-button"
      data-testid={closeTestId}
    >
      <RiCloseLine className="h-[18px] w-[18px]" />
    </button>
  );

  if (!title) {
    return (
      <>
        <h2 className="sr-only">{closeLabel}</h2>
        {showCloseWhenUntitled ? (
          <div className="flex justify-end" style={{ padding: "16px 16px 0" }} data-slot="header">
            {closeButton}
          </div>
        ) : null}
      </>
    );
  }

  return (
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
          letterSpacing: "0",
          color: "var(--ink, rgb(var(--m3-on-surface)))",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {closeButton}
    </div>
  );
}

export interface CanvasSheetBodyProps {
  children: ReactNode;
  onClose: () => void;
  scrollable?: boolean;
}

export function CanvasSheetBody({ children, onClose, scrollable = false }: CanvasSheetBodyProps) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", scrollable && "overflow-y-auto")}
      data-slot="body"
    >
      <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
    </div>
  );
}
