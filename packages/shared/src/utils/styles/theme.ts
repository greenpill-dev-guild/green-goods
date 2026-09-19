/**
 * Theme Controller API
 * Manages theme state using [data-theme] attribute on document root
 * Supports light, dark, and system (follows OS preference) modes
 */

export type Theme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

const KEY = "theme";

/**
 * Get system theme preference
 */
function systemTheme(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Point the browser chrome (Android status bar, installed-app title bar) at the
 * resolved theme. The colors live on the document's `theme-color` meta as
 * `data-light` / `data-dark`, which keeps per-build branding (production vs the
 * beta build's single pinned color) out of this module.
 */
function syncThemeColor(resolved: Resolved): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const color = meta?.dataset[resolved];
  if (meta && color) meta.content = color;
}

/**
 * Apply theme to DOM by setting data-theme attribute
 */
function apply(theme: Theme): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const resolved: Resolved = theme === "system" ? systemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
  syncThemeColor(resolved);
}

/**
 * Get current theme from localStorage
 * Defaults to 'system' if not set
 */
export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";

  try {
    const stored = localStorage.getItem(KEY) as Theme | null;
    return stored ?? "system";
  } catch {
    return "system";
  }
}

/**
 * Get resolved theme (actual light or dark)
 * Resolves 'system' to actual OS preference
 */
export function getResolvedTheme(theme: Theme = getTheme()): Resolved {
  return theme === "system" ? systemTheme() : theme;
}

/**
 * Set theme and persist to localStorage
 */
export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Fail silently if localStorage is unavailable
  }

  apply(theme);
}

/**
 * Listen to system theme changes and update when in system mode
 * Returns cleanup function
 */
export function listenToSystemChanges(): (() => void) | undefined {
  if (typeof window === "undefined") return undefined;

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = (): void => {
    if (getTheme() === "system") {
      apply("system");
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }

  // Legacy browsers
  if (mediaQuery.addListener) {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener?.(handler);
  }

  return undefined;
}

/**
 * Initialize theme system
 * Call once after app mounts
 * Returns cleanup function for unmount
 */
export function initTheme(): (() => void) | undefined {
  apply(getTheme());
  return listenToSystemChanges();
}
