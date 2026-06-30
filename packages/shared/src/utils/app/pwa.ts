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

interface InstalledRelatedAppInfo {
  id?: string;
  platform?: string;
  url?: string;
  version?: string;
}

interface NavigatorWithInstalledRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<InstalledRelatedAppInfo[]>;
}

/**
 * Extended Window interface for non-standard properties
 */
interface WindowWithExtensions extends Window {
  opera?: string;
  MSStream?: unknown;
}

const PWA_INSTALL_CHECK_PARAM = "gg_pwa_install_check";
const PWA_INSTALL_CHECK_RESPONSE_TYPE = "green-goods:pwa-install-check-response";
const PWA_INSTALL_CHECK_FRAME_TIMEOUT_MS = 5000;

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

export function getPwaInstallCheckRequestId(source?: string | URL): string | null {
  const url = getPresentationUrl(source);
  const requestId = url?.searchParams.get(PWA_INSTALL_CHECK_PARAM)?.trim() || null;
  return requestId || null;
}

export function isPwaInstallCheckRequest(source?: string | URL): boolean {
  return getPwaInstallCheckRequestId(source) !== null;
}

function createPwaInstallCheckRequestId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPwaInstallCheckUrl(scopedCheckPath: string, requestId: string): string {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://greengoods.local";
  const url = new URL(scopedCheckPath, baseUrl);
  url.searchParams.set(PWA_INSTALL_CHECK_PARAM, requestId);
  return url.toString();
}

function isCurrentPathWithinScopedCheckPath(scopedCheckPath: string): boolean {
  if (typeof window === "undefined") return false;

  const scopedUrl = new URL(scopedCheckPath, window.location.origin);
  const scopePath = scopedUrl.pathname.endsWith("/")
    ? scopedUrl.pathname
    : `${scopedUrl.pathname}/`;

  return (
    window.location.pathname === scopedUrl.pathname ||
    window.location.pathname.startsWith(scopePath)
  );
}

async function readCurrentInstalledRelatedWebApp(): Promise<boolean | null> {
  if (typeof navigator === "undefined") return null;

  const nav = navigator as NavigatorWithInstalledRelatedApps;
  if (typeof nav.getInstalledRelatedApps !== "function") return null;

  try {
    const relatedApps = await nav.getInstalledRelatedApps();
    return relatedApps.some((app) => app.platform === "webapp");
  } catch {
    return null;
  }
}

export async function respondToPwaInstallCheckRequest(source?: string | URL): Promise<void> {
  if (typeof window === "undefined" || window.parent === window) return;

  const requestId = getPwaInstallCheckRequestId(source);
  if (!requestId) return;

  const installed = await readCurrentInstalledRelatedWebApp();
  window.parent.postMessage(
    {
      type: PWA_INSTALL_CHECK_RESPONSE_TYPE,
      requestId,
      installed,
    },
    window.location.origin
  );
}

async function queryScopedPwaInstallReadiness(scopedCheckPath: string): Promise<boolean | null> {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) {
    return null;
  }

  const requestId = createPwaInstallCheckRequestId();
  const iframe = document.createElement("iframe");
  iframe.src = createPwaInstallCheckUrl(scopedCheckPath, requestId);
  iframe.title = "PWA install readiness check";
  iframe.tabIndex = -1;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.clip = "rect(0 0 0 0)";
  iframe.style.clipPath = "inset(50%)";
  iframe.style.overflow = "hidden";

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      window.removeEventListener("message", handleMessage);
      iframe.remove();
    };

    const finish = (installed: boolean | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(installed);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;

      const data = event.data as {
        type?: string;
        requestId?: string;
        installed?: boolean | null;
      };
      if (data.type !== PWA_INSTALL_CHECK_RESPONSE_TYPE || data.requestId !== requestId) return;

      finish(typeof data.installed === "boolean" ? data.installed : null);
    };

    window.addEventListener("message", handleMessage);
    timeoutId = setTimeout(() => finish(null), PWA_INSTALL_CHECK_FRAME_TIMEOUT_MS);
    document.body.appendChild(iframe);
  });
}

export async function checkPwaInstallReadiness(scopedCheckPath?: string): Promise<boolean | null> {
  if (scopedCheckPath && !isCurrentPathWithinScopedCheckPath(scopedCheckPath)) {
    return queryScopedPwaInstallReadiness(scopedCheckPath);
  }

  return readCurrentInstalledRelatedWebApp();
}

export type PwaInstallReadinessResult = "confirmed" | "unsupported" | "timed-out";

export interface WaitForPwaInstallReadinessOptions {
  scopedCheckPath?: string;
  timeoutMs?: number;
  intervalMs?: number;
  unsupportedFallbackMs?: number;
}

function waitForDuration(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function waitForPwaInstallReadiness({
  scopedCheckPath,
  timeoutMs = 45000,
  intervalMs = 1500,
  unsupportedFallbackMs = 12000,
}: WaitForPwaInstallReadinessOptions = {}): Promise<PwaInstallReadinessResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const installed = await checkPwaInstallReadiness(scopedCheckPath);

    if (installed === true) return "confirmed";

    if (installed === null) {
      await waitForDuration(unsupportedFallbackMs);
      return "unsupported";
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    await waitForDuration(Math.min(intervalMs, remainingMs));
  }

  return "timed-out";
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
