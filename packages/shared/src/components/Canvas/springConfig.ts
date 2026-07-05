/**
 * Shared motion tuning constants for the canvas drag/choreography gestures.
 *
 * These tune the drag-dismiss velocity threshold and the choreography stagger.
 * The former react-spring `SPRING_CONFIGS` were removed when the canvas moved to
 * CSS transitions.
 */

/** Velocity threshold (px/ms) for gesture-driven sheet dismiss */
export const DISMISS_VELOCITY_THRESHOLD = 0.75;

/** Stagger offset (ms) between choreographed elements */
export const CHOREOGRAPHY_STAGGER_MS = 60;
