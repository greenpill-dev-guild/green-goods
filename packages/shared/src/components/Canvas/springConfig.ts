import type { SpringConfig } from "@react-spring/web";

/**
 * Shared spring configuration tokens for the canvas animation system.
 *
 * - sheet: Sheet open/close, MainSheet recession
 * - snappy: FAB press, nav item tap, tooltips
 * - gentle: Choreographed stagger, background blur transitions
 */
export const SPRING_CONFIGS = {
  sheet: { mass: 1, tension: 170, friction: 26 } satisfies SpringConfig,
  snappy: { mass: 0.8, tension: 300, friction: 28 } satisfies SpringConfig,
  gentle: { mass: 1.2, tension: 120, friction: 20 } satisfies SpringConfig,
} as const;

/** Velocity threshold (px/ms) for gesture-driven sheet dismiss */
export const DISMISS_VELOCITY_THRESHOLD = 0.5;

/** Stagger offset (ms) between choreographed elements */
export const CHOREOGRAPHY_STAGGER_MS = 60;
