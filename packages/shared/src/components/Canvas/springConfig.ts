/**
 * Shared motion tuning constants for the canvas sheet system.
 *
 * The sheets animate via CSS transitions (see `useCanvasSheetCssMotion` in
 * CanvasSheetInternals); these constants tune the drag-dismiss gesture and the
 * choreography stagger. The former react-spring `SPRING_CONFIGS` were removed
 * when the sheets moved to CSS.
 */

/** Velocity threshold (px/ms) for gesture-driven sheet dismiss */
export const DISMISS_VELOCITY_THRESHOLD = 0.75;

/** Stagger offset (ms) between choreographed elements */
export const CHOREOGRAPHY_STAGGER_MS = 60;
