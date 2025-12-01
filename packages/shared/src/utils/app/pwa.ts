/**
 * PWA Utilities
 *
 * Provides utilities for Progressive Web App detection and platform identification.
 * Used by AppProvider and other components that need to detect PWA state.
 *
 * @module utils/app/pwa
 */

/**
 * Platform types supported by the application
 */
export type Platform = "ios" | "android" | "windows" | "unknown";

/**
 * Extended Navigator interface for Safari standalone property
 */
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

/**
 * Extended Window interface for non-standard properties
 */
interface WindowWithExtensions extends Window {
  opera?: string;
  MSStream?: unknown;
}

/**
 * Check if the app is running in standalone (PWA) mode.
 *
 * Detects:
 * - display-mode: standalone (Chrome, Firefox, Edge PWA)
 * - display-mode: fullscreen (Fullscreen PWA mode)
 * - navigator.standalone (iOS Safari "Add to Home Screen")
 *
 * @returns true if running as installed PWA, false otherwise
 */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as NavigatorWithStandalone;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

/**
 * Check if app should be treated as installed.
 *
 * Considers:
 * - VITE_MOCK_PWA_INSTALLED env var for testing
 * - Actual standalone mode detection
 *
 * @returns true if app is installed or mocked as installed
 */
export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;

  const mockInstalled = import.meta.env.VITE_MOCK_PWA_INSTALLED === "true";
  return mockInstalled || isStandaloneMode();
}

/**
 * Detect the mobile operating system based on user agent.
 *
 * @returns The detected platform
 */
export function getMobileOperatingSystem(): Platform {
  if (typeof navigator === "undefined") return "unknown";

  const win = typeof window !== "undefined" ? (window as WindowWithExtensions) : undefined;
  const userAgent = navigator.userAgent || navigator.vendor || win?.opera || "";

  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return "windows";
  }

  if (/android/i.test(userAgent)) {
    return "android";
  }

  // iOS detection - check for iPad|iPhone|iPod and exclude MSStream (IE specific)
  if (/iPad|iPhone|iPod/.test(userAgent) && !win?.MSStream) {
    return "ios";
  }

  return "unknown";
}

/**
 * Check if running on a mobile platform.
 *
 * @returns true if on iOS, Android, or Windows Phone
 */
export function isMobilePlatform(): boolean {
  const platform = getMobileOperatingSystem();
  return platform === "ios" || platform === "android" || platform === "windows";
}
