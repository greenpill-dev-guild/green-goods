/** Where the viewport drops its toasts: below the status bar's safe area (`ToastViewport`). */
export const TOAST_VIEWPORT_TOP = "calc(1.5rem + env(safe-area-inset-top, 0px))";

/**
 * How far a toast that keeps the installed app's top bar usable drops below the viewport's top:
 * to 8px under the bar (`--app-top-bar-height`, PRD-1505).
 */
export const BELOW_TOP_BAR_MARGIN = `calc(var(--app-top-bar-height) + 0.5rem - ${TOAST_VIEWPORT_TOP})`;
