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
export type ClientPresentationMode = "website" | "pwa";
type LocalPresentationOverride = ClientPresentationMode | "auto";

const LOCAL_PRESENTATION_QUERY_PARAM = "presentation";
const LOCAL_PRESENTATION_STORAGE_KEY = "gg-local-presentation-mode";

/**
 * Extended Navigator interface for Safari standalone property
 */
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
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
 * - display-mode: window-controls-overlay (desktop installed PWA)
 * - display-mode: fullscreen (Fullscreen PWA mode)
 * - navigator.standalone (iOS Safari "Add to Home Screen")
 *
 * @returns true if running as installed PWA, false otherwise
 */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as NavigatorWithStandalone;
  const matchesDisplayMode = (query: string) =>
    typeof window.matchMedia === "function" && window.matchMedia(query).matches;

  return (
    matchesDisplayMode("(display-mode: window-controls-overlay)") ||
    matchesDisplayMode("(display-mode: standalone)") ||
    matchesDisplayMode("(display-mode: fullscreen)") ||
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
 * Handles iPadOS 13+ which uses a "desktop" user agent containing "Macintosh"
 * instead of "iPad". Detection uses maxTouchPoints > 1 to identify iPads.
 *
 * @returns The detected platform
 */
export function getMobileOperatingSystem(): Platform {
  if (typeof navigator === "undefined") return "unknown";

  const win = typeof window !== "undefined" ? (window as WindowWithExtensions) : undefined;
  const nav = navigator as NavigatorWithStandalone;
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

  // iPadOS 13+ with "Request Desktop Website" enabled (or default behavior)
  // Reports as "Macintosh" but has touch support (maxTouchPoints > 1)
  if (/Macintosh/.test(userAgent) && nav.maxTouchPoints && nav.maxTouchPoints > 1) {
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

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function parseLocalPresentationOverride(value: string | null): LocalPresentationOverride | null {
  if (value === "website" || value === "pwa" || value === "auto") return value;
  return null;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function getCurrentLocationUrl(): URL | null {
  if (typeof window === "undefined") return null;

  try {
    if (window.location.href) return new URL(window.location.href);
  } catch {
    // Fall back to hostname below for test/mocked browser environments.
  }

  const hostname = window.location.hostname;
  if (!hostname) return null;

  try {
    const protocol = isLocalHostname(hostname) ? "http:" : "https:";
    return new URL(`${protocol}//${hostname}/`);
  } catch {
    return null;
  }
}

function getPresentationUrl(source?: string | URL): URL | null {
  if (source instanceof URL) return source;

  if (typeof source === "string") {
    try {
      return new URL(source, getCurrentLocationUrl()?.href || "https://greengoods.local/");
    } catch {
      return null;
    }
  }

  return getCurrentLocationUrl();
}

function getLocalPresentationOverride(url: URL | null): ClientPresentationMode | null {
  if (!url || !isLocalHostname(url.hostname)) return null;

  const storage = getSessionStorage();
  const queryOverride = parseLocalPresentationOverride(
    url.searchParams.get(LOCAL_PRESENTATION_QUERY_PARAM)
  );

  if (queryOverride === "auto") {
    storage?.removeItem(LOCAL_PRESENTATION_STORAGE_KEY);
    return null;
  }

  if (queryOverride) {
    storage?.setItem(LOCAL_PRESENTATION_STORAGE_KEY, queryOverride);
    return queryOverride;
  }

  const storedOverride = parseLocalPresentationOverride(
    storage?.getItem(LOCAL_PRESENTATION_STORAGE_KEY) ?? null
  );
  return storedOverride === "auto" ? null : storedOverride;
}

function hasMobileDeviceSignals(): boolean {
  if (typeof navigator === "undefined") return false;

  const nav = navigator as NavigatorWithStandalone;
  if (nav.userAgentData?.mobile === true) return true;

  const platform = nav.userAgentData?.platform || navigator.platform || "";
  if (/android|iphone|ipad|ipod/i.test(platform)) return true;

  return isMobilePlatform();
}

/**
 * Check whether localhost should preview the PWA presentation.
 *
 * Browsers do not expose "DevTools device mode is open", so this intentionally
 * uses localhost plus mobile/device-like browser signals such as UA Client Hints,
 * user agent, touch-backed iPadOS detection, or mobile platform values. Plain
 * viewport width is not part of this check, so resizing desktop Chrome to a
 * phone-sized width remains website mode. A real phone visiting localhost can
 * also match these signals and enter preview mode.
 */
export function isLocalDevicePreviewMode(source?: string | URL): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const url = getPresentationUrl(source);
  return Boolean(url && isLocalHostname(url.hostname) && hasMobileDeviceSignals());
}

export function getClientPresentationMode(source?: string | URL): ClientPresentationMode {
  const url = getPresentationUrl(source);
  const localOverride = getLocalPresentationOverride(url);
  if (localOverride) return localOverride;

  if (isAppInstalled() || isLocalDevicePreviewMode(url ?? undefined)) return "pwa";
  return "website";
}
