import { RiCloseLine } from "@remixicon/react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
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
    // layer (z: var(--z-sheet-layer, 25) — above sticky chrome at 20, below
    // the nav dock at 30), so these values stack locally within that layer.
    // Unbounded sheets cover the viewport and sit just under z-overlay (40).
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

export interface CanvasSheetHeaderProps {
  title?: string;
  closeLabel: string;
  closeTestId: string;
  onClose: () => void;
  showCloseWhenUntitled?: boolean;
}

export function CanvasSheetHeader({
  title,
  closeLabel,
  closeTestId,
  onClose,
  showCloseWhenUntitled = true,
}: CanvasSheetHeaderProps) {
  const closeButton = (
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
