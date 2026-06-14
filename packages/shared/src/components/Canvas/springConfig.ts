import type { SpringConfig } from "@react-spring/web";

/**
 * Shared spring configuration tokens for the canvas animation system.
 *
 * - sheet: Sheet slide open/close
 * - recession: MainSheet recession under an open sheet (slower, heavier than sheet)
 * - snappy: FAB press, nav item tap, tooltips
 * - gentle: Choreographed stagger, background transitions
 */
export const SPRING_CONFIGS = {
  // clamp: the sheet pose is slightly underdamped (ζ ≈ 0.96), so without it
  // the enter animation overshoots its rest position and visibly "settles
  // back" right at the end (QA refinement pass). Clamping stops the spring at
  // rest in both directions; the exit clamp is invisible (off-screen).
  sheet: { mass: 0.7, tension: 260, friction: 26, clamp: true } satisfies SpringConfig,
  recession: { mass: 0.9, tension: 180, friction: 24 } satisfies SpringConfig,
  snappy: { mass: 0.8, tension: 300, friction: 28 } satisfies SpringConfig,
  gentle: { mass: 1.2, tension: 120, friction: 20 } satisfies SpringConfig,
} as const;

/** Velocity threshold (px/ms) for gesture-driven sheet dismiss */
export const DISMISS_VELOCITY_THRESHOLD = 0.75;

/** Stagger offset (ms) between choreographed elements */
export const CHOREOGRAPHY_STAGGER_MS = 60;
