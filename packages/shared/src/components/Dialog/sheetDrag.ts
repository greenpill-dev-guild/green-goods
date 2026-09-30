/**
 * Drag-to-dismiss for the bottom sheet (DL-033): the pointer mechanics behind
 * `PwaSheet`, kept out of the component so the sheet file reads as chrome and
 * lifecycle.
 *
 * The gesture has its own channels. The open/close keyframes own the panel's
 * `transform` and the scrim's `opacity`, and a finished keyframe animation
 * outranks inline styles in the cascade, so a drag written to `transform`
 * would be ignored: the sheet moves on `translate` and the scrim dims through
 * the `drag-dim` wrapper instead. Both are written straight to the DOM, so a
 * pointer move never re-renders the sheet's content. Letting go clears them
 * and hands both back to the CSS transitions in `utilities.css`, which settle
 * an open sheet and carry a closing one out on its exit keyframe's token.
 *
 * @module components/Dialog/sheetDrag
 */
import { useDrag } from "@use-gesture/react";
import { type DOMAttributes, type RefObject, useCallback } from "react";
import { DISMISS_VELOCITY_THRESHOLD } from "../Canvas/springConfig";

/** Share of the sheet's height a slow drag covers before letting go dismisses it. */
const DRAG_DISMISS_HEIGHT_RATIO = 0.25;

/** Where a drag picked the panel up, and the height it travels over. */
interface SheetGrab {
  offset: number;
  height: number;
}

/**
 * The panel's drag offset in pixels. `translate` computes to "none" at rest
 * and to "0px 12.5px" while the panel settles from an earlier release, so a
 * finger landing on a moving sheet picks it up where it is.
 */
function readDragOffset(surface: HTMLElement): number {
  const [, y] = (window.getComputedStyle(surface).translate ?? "").split(" ");
  return Number.parseFloat(y) || 0;
}

/**
 * A quick flick decides on its own, in either direction; a slow release
 * dismisses once the panel is a quarter of its height down. `velocity` is in
 * px/ms, positive downward.
 */
function releaseDismisses(offset: number, velocity: number, height: number): boolean {
  if (Math.abs(velocity) > DISMISS_VELOCITY_THRESHOLD) return velocity > 0;
  return offset > height * DRAG_DISMISS_HEIGHT_RATIO;
}

export interface SheetDragOptions {
  /** The sheet's overlay, surface, and scrim-dimming wrapper. */
  overlayRef: RefObject<HTMLElement | null>;
  surfaceRef: RefObject<HTMLElement | null>;
  dragDimRef: RefObject<HTMLElement | null>;
  /** Whether the gesture is live at all: a closed sheet and `preventClose` turn it off. */
  enabled: boolean;
  /** Dismiss the sheet. A flicked sheet keeps its speed as it leaves. */
  onDismiss: (release?: "flick") => void;
}

/**
 * Binds the sheet's drag gesture. Spread the result on the grip and on any
 * other part of the sheet that should join its grab area — never on a button:
 * use-gesture's tap filter would swallow the click whenever the gesture
 * missed the press.
 */
export function useSheetDrag({
  overlayRef,
  surfaceRef,
  dragDimRef,
  enabled,
  onDismiss,
}: SheetDragOptions): () => DOMAttributes<HTMLElement> {
  // Holds the panel `offset` pixels under its resting position and lifts the
  // scrim's dimming by the same share; `null` lets go, and the CSS transitions
  // settle both back to rest.
  const holdSheetAt = useCallback(
    (offset: number | null, height = 1) => {
      const overlay = overlayRef.current;
      const surface = surfaceRef.current;
      const dragDim = dragDimRef.current;
      if (!overlay || !surface || !dragDim) return;
      overlay.toggleAttribute("data-dragging", offset !== null);
      surface.style.translate = offset === null ? "" : `0 ${offset}px`;
      dragDim.style.opacity = offset === null ? "" : `${1 - Math.min(offset / height, 1)}`;
    },
    [overlayRef, surfaceRef, dragDimRef]
  );

  return useDrag(
    ({ last, tap, canceled, movement: [, my], velocity: [, vy], direction: [, dy], memo }) => {
      const surface = surfaceRef.current;
      if (tap || !surface) return memo;
      // use-gesture clears `memo` when a gesture starts, so the grab is read once per drag.
      const grab: SheetGrab = memo ?? {
        offset: readDragOffset(surface),
        height: surface.offsetHeight || 1,
      };
      // The sheet follows the finger one to one and stops at its resting
      // position, so it never lifts off the viewport's bottom edge.
      const offset = Math.max(0, grab.offset + my);
      if (!last) {
        holdSheetAt(offset, grab.height);
        return grab;
      }
      holdSheetAt(null);
      const velocity = vy * dy;
      if (!canceled && releaseDismisses(offset, velocity, grab.height)) {
        onDismiss(velocity > DISMISS_VELOCITY_THRESHOLD ? "flick" : undefined);
      }
      return grab;
    },
    {
      axis: "y",
      filterTaps: true,
      // Escape and the close button are the keyboard's ways out; arrow keys
      // pressed on a focused control must not drag the sheet.
      pointer: { keys: false },
      enabled,
    }
  );
}
