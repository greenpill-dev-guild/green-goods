/**
 * Browser Detection Utilities
 *
 * Detects the user's browser to provide optimized PWA installation guidance.
 * On mobile, only specific browsers support true PWA installation:
 * - iOS: Safari only (other browsers create shortcuts, not true PWAs)
 * - Android: Google Chrome only (other Chromium browsers have inconsistent support)
 *
 * @module utils/app/browser
 */

/**
 * Known mobile browsers with their PWA installation capabilities
 */
export type MobileBrowser =
  | "safari" // iOS only, full PWA support
  | "chrome" // Full PWA support on Android (THE ONLY reliable option)
  | "firefox" // No PWA support on either platform
  | "edge" // Chromium-based but inconsistent PWA support
  | "samsung" // Chromium-based but inconsistent PWA support
  | "opera" // No reliable PWA support
  | "brave" // Chromium-based but inconsistent PWA support
  | "duckduckgo" // No PWA support
  | "in-app" // WebView (Instagram, Facebook, Twitter, etc.) - no PWA support
  | "unknown";

/**
 * Browser detection result with PWA installation capabilities
 */
export interface BrowserInfo {
  /** Detected browser name */
  browser: MobileBrowser;
  /** Whether this browser supports native PWA installation */
  supportsNativePWA: boolean;
  /** Whether this is the recommended browser for the platform */
  isRecommendedBrowser: boolean;
  /** Whether running in an in-app browser (WebView) */
  isInAppBrowser: boolean;
  /** Human-readable browser name for UI */
  displayName: string;
}

/**
 * Detect if running in an in-app browser (WebView)
 * These browsers typically can't install PWAs at all
 */
function detectInAppBrowser(ua: string): boolean {
  const inAppPatterns = [
    /FBAN|FBAV/i, // Facebook
    /Instagram/i, // Instagram
    /Twitter/i, // Twitter/X
    /LinkedIn/i, // LinkedIn
    /Pinterest/i, // Pinterest
    /Snapchat/i, // Snapchat
    /TikTok/i, // TikTok
    /Line\//i, // LINE
    /KAKAOTALK/i, // KakaoTalk
    /WhatsApp/i, // WhatsApp (rare but possible)
    /Telegram/i, // Telegram
    /Discord/i, // Discord
    /Slack/i, // Slack
    /wv\)/i, // Generic Android WebView
    /WebView/i, // Generic WebView
  ];

  return inAppPatterns.some((pattern) => pattern.test(ua));
}

/**
 * Detect the mobile browser from user agent
 */
export function detectMobileBrowser(
  platform: "ios" | "android" | "windows" | "unknown"
): BrowserInfo {
  if (typeof navigator === "undefined") {
    return {
      browser: "unknown",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Unknown",
    };
  }

  const ua = navigator.userAgent;

  // Check for in-app browsers first (highest priority)
  if (detectInAppBrowser(ua)) {
    return {
      browser: "in-app",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: true,
      displayName: "In-App Browser",
    };
  }

  // iOS browser detection
  if (platform === "ios") {
    // On iOS, only Safari supports true PWA installation
    // All other browsers use WebKit but can't install PWAs

    // Chrome on iOS
    if (/CriOS/i.test(ua)) {
      return {
        browser: "chrome",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Chrome",
      };
    }

    // Firefox on iOS
    if (/FxiOS/i.test(ua)) {
      return {
        browser: "firefox",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Firefox",
      };
    }

    // Edge on iOS
    if (/EdgiOS/i.test(ua)) {
      return {
        browser: "edge",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Edge",
      };
    }

    // Opera on iOS
    if (/OPiOS/i.test(ua) || /OPT\//i.test(ua)) {
      return {
        browser: "opera",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Opera",
      };
    }

    // Brave on iOS
    if (/Brave/i.test(ua)) {
      return {
        browser: "brave",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Brave",
      };
    }

    // DuckDuckGo on iOS
    if (/DuckDuckGo/i.test(ua)) {
      return {
        browser: "duckduckgo",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "DuckDuckGo",
      };
    }

    // Safari (default on iOS if no other browser detected)
    // Safari doesn't have a unique identifier - it's the absence of others
    // Must exclude: CriOS (Chrome), FxiOS (Firefox), EdgiOS (Edge), OPiOS/OPT (Opera), Brave, DuckDuckGo
    if (/Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Brave|DuckDuckGo/i.test(ua)) {
      return {
        browser: "safari",
        supportsNativePWA: true,
        isRecommendedBrowser: true,
        isInAppBrowser: false,
        displayName: "Safari",
      };
    }

    return {
      browser: "unknown",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Unknown Browser",
    };
  }

  // Android browser detection
  // IMPORTANT: Only Google Chrome provides full PWA support on Android
  // Other Chromium-based browsers (Samsung, Edge, Brave) have partial/inconsistent support
  if (platform === "android") {
    // Samsung Internet - Chromium-based but NOT recommended for PWA
    if (/SamsungBrowser/i.test(ua)) {
      return {
        browser: "samsung",
        supportsNativePWA: false, // Partial support, not reliable
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Samsung Internet",
      };
    }

    // Edge on Android (Chromium-based) - NOT recommended for PWA
    if (/EdgA/i.test(ua)) {
      return {
        browser: "edge",
        supportsNativePWA: false, // Partial support, not reliable
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Edge",
      };
    }

    // Opera on Android - NOT recommended for PWA
    if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
      return {
        browser: "opera",
        supportsNativePWA: false, // Partial support, not reliable
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Opera",
      };
    }

    // Brave on Android - NOT recommended for PWA
    if (/Brave/i.test(ua)) {
      return {
        browser: "brave",
        supportsNativePWA: false, // Partial support, not reliable
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Brave",
      };
    }

    // Firefox on Android
    if (/Firefox/i.test(ua)) {
      return {
        browser: "firefox",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "Firefox",
      };
    }

    // DuckDuckGo on Android
    if (/DuckDuckGo/i.test(ua)) {
      return {
        browser: "duckduckgo",
        supportsNativePWA: false,
        isRecommendedBrowser: false,
        isInAppBrowser: false,
        displayName: "DuckDuckGo",
      };
    }

    // Google Chrome on Android - THE ONLY browser with full PWA support
    if (/Chrome/i.test(ua) && !/Edg|OPR|Brave|SamsungBrowser/i.test(ua)) {
      return {
        browser: "chrome",
        supportsNativePWA: true,
        isRecommendedBrowser: true,
        isInAppBrowser: false,
        displayName: "Chrome",
      };
    }

    return {
      browser: "unknown",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Unknown Browser",
    };
  }

  return {
    browser: "unknown",
    supportsNativePWA: false,
    isRecommendedBrowser: false,
    isInAppBrowser: false,
    displayName: "Unknown Browser",
  };
}

/**
 * Get the recommended browser for a platform
 */
export function getRecommendedBrowser(platform: "ios" | "android" | "windows" | "unknown"): {
  browser: MobileBrowser;
  displayName: string;
  storeUrl: string | null;
} {
  switch (platform) {
    case "ios":
      return {
        browser: "safari",
        displayName: "Safari",
        storeUrl: null, // Safari is built-in, no store URL
      };
    case "android":
      return {
        browser: "chrome",
        displayName: "Chrome",
        storeUrl: "https://play.google.com/store/apps/details?id=com.android.chrome",
      };
    default:
      return {
        browser: "unknown",
        displayName: "Browser",
        storeUrl: null,
      };
  }
}

/**
 * Generate a URL to open the current page in a different browser
 * Note: This only works reliably on Android. iOS has severe limitations.
 */
export function getOpenInBrowserUrl(
  platform: "ios" | "android" | "windows" | "unknown",
  targetBrowser: MobileBrowser,
  currentUrl?: string
): string | null {
  // Move window access inside function body for SSR safety
  const url = currentUrl ?? (typeof window !== "undefined" ? window.location.href : "");

  if (platform === "android") {
    // Detect the protocol from the current URL (preserve http vs https)
    const scheme = url.startsWith("https://") ? "https" : "http";
    const urlWithoutProtocol = url.replace(/^https?:\/\//, "");

    switch (targetBrowser) {
      case "chrome":
        // Android intent to open in Chrome
        return `intent://${urlWithoutProtocol}#Intent;scheme=${scheme};package=com.android.chrome;end`;
      case "samsung":
        return `intent://${urlWithoutProtocol}#Intent;scheme=${scheme};package=com.sec.android.app.sbrowser;end`;
      case "edge":
        return `intent://${urlWithoutProtocol}#Intent;scheme=${scheme};package=com.microsoft.emmx;end`;
      case "brave":
        return `intent://${urlWithoutProtocol}#Intent;scheme=${scheme};package=com.brave.browser;end`;
      default:
        return null;
    }
  }

  // iOS doesn't support opening URLs in specific browsers programmatically
  // The best we can do is instruct users to copy the URL
  return null;
}

/**
 * Check if the current browser can trigger the native install prompt
 * This is more specific than supportsNativePWA - it checks if beforeinstallprompt fires
 */
export function canTriggerInstallPrompt(browserInfo: BrowserInfo): boolean {
  // Only Google Chrome on Android reliably fires beforeinstallprompt
  if (browserInfo.isInAppBrowser) return false;

  // Only Chrome has reliable PWA install prompt support
  return browserInfo.browser === "chrome";
}
