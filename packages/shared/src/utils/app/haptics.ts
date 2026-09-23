/**
 * Haptic Feedback Utility
 *
 * Provides tactile feedback for mobile PWA users via the Vibration API.
 * Haptic feedback improves mobile UX by providing physical confirmation of actions.
 *
 * Browser Support:
 * - Android: Full support in Chrome, Firefox, Edge
 * - iOS Safari: Limited/no support (vibrate is not available)
 * - Desktop: Generally not supported
 *
 * User Preferences:
 * - Haptics can be disabled via setHapticsEnabled(false)
 * - Setting persists to localStorage
 * - Check status with isHapticsEnabled()
 *
 * @module utils/app/haptics
 */

// Storage key for haptics preference persistence
const HAPTICS_ENABLED_KEY = "green-goods:haptics-enabled";

// Internal state for haptics enabled (default true)
let hapticsEnabledState: boolean | null = null;

/**
 * Reset the internal haptics state.
 * @internal For testing purposes only - allows tests to start with clean state.
 */
export function resetHapticsState(): void {
  hapticsEnabledState = null;
}

/**
 * Load the haptics enabled state from localStorage.
 * Defaults to true if not set.
 */
function loadHapticsEnabled(): boolean {
  if (hapticsEnabledState !== null) {
    return hapticsEnabledState;
  }

  if (typeof localStorage === "undefined") {
    hapticsEnabledState = true;
    return true;
  }

  try {
    const stored = localStorage.getItem(HAPTICS_ENABLED_KEY);
    hapticsEnabledState = stored === null ? true : stored === "true";
  } catch {
    // localStorage access may fail in private browsing or restricted contexts
    hapticsEnabledState = true;
  }

  return hapticsEnabledState;
}

/**
 * Check if haptics are enabled by user preference.
 * @returns true if haptics are enabled (default), false if disabled
 */
export function isHapticsEnabled(): boolean {
  return loadHapticsEnabled();
}

/**
 * Enable or disable haptic feedback.
 * @param enabled - Whether haptics should be enabled
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabledState = enabled;

  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(HAPTICS_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Check if the Vibration API is supported.
 * @returns true if navigator.vibrate is available
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/**
 * Internal helper to check if haptics should actually fire.
 */
function shouldVibrate(): boolean {
  return isHapticsSupported() && isHapticsEnabled();
}

/**
 * Light tap feedback for button presses and selections.
 * Duration: 10ms
 */
export function hapticLight(): void {
  if (shouldVibrate()) {
    navigator.vibrate(10);
  }
}

/**
 * Success feedback for completed actions.
 * Pattern: short-pause-short (10ms-50ms-10ms)
 */
export function hapticSuccess(): void {
  if (shouldVibrate()) {
    navigator.vibrate([10, 50, 10]);
  }
}

/**
 * Heavy/strong feedback for important confirmations.
 * Duration: 30ms
 */
export function hapticHeavy(): void {
  if (shouldVibrate()) {
    navigator.vibrate(30);
  }
}

/**
 * Error feedback with a distinct pattern.
 * Pattern: long-pause-long (50ms-100ms-50ms)
 */
export function hapticError(): void {
  if (shouldVibrate()) {
    navigator.vibrate([50, 100, 50]);
  }
}

/**
 * Warning feedback - gentler than error.
 * Pattern: medium-pause-short (30ms-80ms-15ms)
 */
export function hapticWarning(): void {
  if (shouldVibrate()) {
    navigator.vibrate([30, 80, 15]);
  }
}

/**
 * Selection feedback for toggles and radio buttons.
 * Duration: 5ms (very subtle)
 */
export function hapticSelection(): void {
  if (shouldVibrate()) {
    navigator.vibrate(5);
  }
}

/**
 * Controls that change a selection: tabs (the app bar's included), chips,
 * switches, radios and checkboxes (native or ARIA), and anything with a
 * pressed state.
 */
const SELECTION_CONTROLS = [
  '[data-pressable="tab"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
  'input[type="radio"]',
  'input[type="checkbox"]',
  "[aria-pressed]",
  ".gg-chip",
].join(", ");

/**
 * Everything else a finger can press: buttons, links, and every declared
 * pressable (card, row, media, trigger, fab).
 */
const PRESS_CONTROLS = ["button", "a[href]", '[role="button"]', "summary", "[data-pressable]"].join(
  ", "
);

/**
 * Controls that stay quiet whatever else they are: a dropdown trigger opens a
 * picker the way a field takes focus, and a scrim only closes the sheet above
 * it. They win over the lists above, even on a button or a declared pressable.
 */
const SILENT_CONTROLS = '[role="combobox"], [data-pressable="scrim"]';

/**
 * Give every press the same tactile answer, from one place.
 *
 * Anything a finger can press answers: selection controls with the subtler
 * selection tap, and buttons, links, cards, rows, and the rest with the light
 * tap. The rule reads what the markup already says (a button, a link, a
 * `data-pressable`), so a new control answers without asking and never calls
 * a haptic itself. Text fields, dropdowns, backdrops, disabled controls, and
 * clicks the app makes itself stay silent. A surface opts in by installing
 * this (the installed PWA does; the admin cockpit and the public website stay
 * silent). Returns the function that removes it.
 *
 * Outcome haptics (success, error, warning) stay with the code that knows the
 * outcome.
 */
export function installPressHaptics(root: Document = document): () => void {
  const handleClick = (event: Event) => {
    // Only a finger's press counts. A click the app makes itself (a download
    // link's `link.click()`, once per file) follows a press that already answered.
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest(
      `${SILENT_CONTROLS}, ${SELECTION_CONTROLS}, ${PRESS_CONTROLS}`
    );
    if (!control || control.matches(`${SILENT_CONTROLS}, :disabled, [aria-disabled="true"]`)) {
      return;
    }
    if (control.matches(SELECTION_CONTROLS)) hapticSelection();
    else hapticLight();
  };
  // Capture, so a control that stops propagation still answers the press.
  root.addEventListener("click", handleClick, true);
  return () => root.removeEventListener("click", handleClick, true);
}

/**
 * Haptic feedback object for convenient grouped access.
 *
 * @example
 * ```ts
 * import { haptics } from '@green-goods/shared';
 *
 * // On button click
 * haptics.light();
 *
 * // On successful submission
 * haptics.success();
 *
 * // On error
 * haptics.error();
 *
 * // Check support
 * if (haptics.isSupported()) {
 *   console.log('Haptic feedback available');
 * }
 *
 * // Disable haptics for user who prefers no vibration
 * haptics.setEnabled(false);
 *
 * // Check if haptics are enabled
 * if (haptics.isEnabled()) {
 *   console.log('Haptics are enabled');
 * }
 * ```
 */
export const haptics = {
  /** Light tap - for button presses, selections */
  light: hapticLight,

  /** Medium feedback - for successful actions */
  success: hapticSuccess,

  /** Strong feedback - for important confirmations */
  heavy: hapticHeavy,

  /** Error feedback - distinct pattern for errors */
  error: hapticError,

  /** Warning feedback - gentler than error */
  warning: hapticWarning,

  /** Selection feedback - for toggles and radio buttons */
  selection: hapticSelection,

  /** Check if haptics are supported by the browser */
  isSupported: isHapticsSupported,

  /** Check if haptics are enabled by user preference */
  isEnabled: isHapticsEnabled,

  /** Enable or disable haptic feedback */
  setEnabled: setHapticsEnabled,
} as const;
