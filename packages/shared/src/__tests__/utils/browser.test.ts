/**
 * Browser Detection Utilities Tests
 *
 * Tests for browser detection and PWA installation capability detection.
 * These utilities help guide users to the right browser for optimal PWA installation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type BrowserInfo,
  canTriggerInstallPrompt,
  detectMobileBrowser,
  getOpenInBrowserUrl,
  getRecommendedBrowser,
} from "../../utils/app/browser";

// Mock navigator
const originalNavigator = global.navigator;

interface MockNavigator {
  userAgent: string;
}

function mockNavigator(props: MockNavigator): void {
  Object.defineProperty(global, "navigator", {
    value: props,
    writable: true,
    configurable: true,
  });
}

// Restore navigator after each test to prevent cross-test contamination
afterEach(() => {
  Object.defineProperty(global, "navigator", {
    value: originalNavigator,
    writable: true,
    configurable: true,
  });
});

describe("detectMobileBrowser", () => {
  describe("iOS browser detection", () => {
    it("detects Safari on iOS as recommended browser with PWA support", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("safari");
      expect(result.supportsNativePWA).toBe(true);
      expect(result.isRecommendedBrowser).toBe(true);
      expect(result.isInAppBrowser).toBe(false);
      expect(result.displayName).toBe("Safari");
    });

    it("detects Chrome on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("chrome");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.displayName).toBe("Chrome");
    });

    it("detects Firefox on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("firefox");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.displayName).toBe("Firefox");
    });

    it("detects Edge on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.2210.150 Mobile/15E148 Safari/605.1.15",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("edge");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.displayName).toBe("Edge");
    });

    it("detects Brave on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 Brave/1.60",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("brave");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
    });

    it("detects DuckDuckGo on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 DuckDuckGo/7",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("duckduckgo");
      expect(result.supportsNativePWA).toBe(false);
    });

    it("detects Opera on iOS as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPiOS/16.0.14.122040 Mobile/15E148 Safari/9537.53",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("opera");
      expect(result.supportsNativePWA).toBe(false);
    });
  });

  describe("Android browser detection", () => {
    it("detects Chrome on Android as recommended browser with PWA support", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("chrome");
      expect(result.supportsNativePWA).toBe(true);
      expect(result.isRecommendedBrowser).toBe(true);
      expect(result.isInAppBrowser).toBe(false);
      expect(result.displayName).toBe("Chrome");
    });

    it("detects Samsung Internet as non-PWA capable (only Chrome supports PWA)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("samsung");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.displayName).toBe("Samsung Internet");
    });

    it("detects Edge on Android as non-PWA capable (only Chrome supports PWA)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.2210.150",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("edge");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
    });

    it("detects Brave on Android as non-PWA capable (only Chrome supports PWA)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Brave/1.60",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("brave");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
    });

    it("detects Firefox on Android as non-PWA capable", () => {
      mockNavigator({
        userAgent: "Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("firefox");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.displayName).toBe("Firefox");
    });

    it("detects Opera on Android as non-PWA capable (only Chrome supports PWA)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 OPR/76.2.4027.73374",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("opera");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
    });

    it("detects DuckDuckGo on Android as non-PWA capable", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) DuckDuckGo/5 Safari/537.36",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("duckduckgo");
      expect(result.supportsNativePWA).toBe(false);
    });
  });

  describe("In-app browser detection", () => {
    it("detects Facebook in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0.0.42.103;]",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("in-app");
      expect(result.supportsNativePWA).toBe(false);
      expect(result.isRecommendedBrowser).toBe(false);
      expect(result.isInAppBrowser).toBe(true);
      expect(result.displayName).toBe("In-App Browser");
    });

    it("detects Instagram in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.19.107",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });

    it("detects Twitter/X in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });

    it("detects LinkedIn in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 LinkedIn",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });

    it("detects TikTok in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok 32.5.0",
      });

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });

    it("detects Telegram in-app browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Telegram",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });

    it("detects generic Android WebView", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UPB4.230623.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
      });

      const result = detectMobileBrowser("android");

      expect(result.browser).toBe("in-app");
      expect(result.isInAppBrowser).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("returns unknown for undefined navigator", () => {
      // @ts-expect-error - Testing undefined navigator
      delete global.navigator;

      const result = detectMobileBrowser("ios");

      expect(result.browser).toBe("unknown");
      expect(result.supportsNativePWA).toBe(false);
    });

    it("returns unknown for non-mobile platforms", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      const result = detectMobileBrowser("unknown");

      expect(result.browser).toBe("unknown");
    });

    it("returns unknown for iOS with unrecognized browser", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) SomeUnknownBrowser/1.0",
      });

      const result = detectMobileBrowser("ios");

      // Should fall through to Safari detection since no other patterns match
      // and the generic Safari check won't match either due to missing Safari in UA
      expect(result.browser).toBe("unknown");
    });
  });
});

describe("getRecommendedBrowser", () => {
  it("recommends Safari for iOS", () => {
    const result = getRecommendedBrowser("ios");

    expect(result.browser).toBe("safari");
    expect(result.displayName).toBe("Safari");
    expect(result.storeUrl).toBeNull();
  });

  it("recommends Chrome for Android with store URL", () => {
    const result = getRecommendedBrowser("android");

    expect(result.browser).toBe("chrome");
    expect(result.displayName).toBe("Chrome");
    expect(result.storeUrl).toBe(
      "https://play.google.com/store/apps/details?id=com.android.chrome"
    );
  });

  it("returns unknown for unsupported platforms", () => {
    const result = getRecommendedBrowser("windows");

    expect(result.browser).toBe("unknown");
    expect(result.storeUrl).toBeNull();
  });
});

describe("getOpenInBrowserUrl", () => {
  it("generates Chrome intent URL for Android", () => {
    const result = getOpenInBrowserUrl("android", "chrome", "https://example.com/app");

    expect(result).toBe(
      "intent://example.com/app#Intent;scheme=https;package=com.android.chrome;end"
    );
  });

  it("generates Samsung Internet intent URL for Android", () => {
    const result = getOpenInBrowserUrl("android", "samsung", "https://example.com/app");

    expect(result).toBe(
      "intent://example.com/app#Intent;scheme=https;package=com.sec.android.app.sbrowser;end"
    );
  });

  it("generates Edge intent URL for Android", () => {
    const result = getOpenInBrowserUrl("android", "edge", "https://example.com/app");

    expect(result).toBe(
      "intent://example.com/app#Intent;scheme=https;package=com.microsoft.emmx;end"
    );
  });

  it("generates Brave intent URL for Android", () => {
    const result = getOpenInBrowserUrl("android", "brave", "https://example.com/app");

    expect(result).toBe(
      "intent://example.com/app#Intent;scheme=https;package=com.brave.browser;end"
    );
  });

  it("returns null for iOS (no programmatic browser switching)", () => {
    const result = getOpenInBrowserUrl("ios", "safari", "https://example.com/app");

    expect(result).toBeNull();
  });

  it("returns null for unsupported browsers on Android", () => {
    const result = getOpenInBrowserUrl("android", "firefox", "https://example.com/app");

    expect(result).toBeNull();
  });

  it("handles http URLs by preserving protocol scheme", () => {
    const result = getOpenInBrowserUrl("android", "chrome", "http://example.com/app");

    expect(result).toBe(
      "intent://example.com/app#Intent;scheme=http;package=com.android.chrome;end"
    );
  });
});

describe("canTriggerInstallPrompt", () => {
  it("returns true ONLY for Google Chrome on Android", () => {
    const browserInfo: BrowserInfo = {
      browser: "chrome",
      supportsNativePWA: true,
      isRecommendedBrowser: true,
      isInAppBrowser: false,
      displayName: "Chrome",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(true);
  });

  it("returns false for Edge on Android (only Chrome supports PWA)", () => {
    const browserInfo: BrowserInfo = {
      browser: "edge",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Edge",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for Samsung Internet (only Chrome supports PWA)", () => {
    const browserInfo: BrowserInfo = {
      browser: "samsung",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Samsung Internet",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for Brave (only Chrome supports PWA)", () => {
    const browserInfo: BrowserInfo = {
      browser: "brave",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Brave",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for Opera (only Chrome supports PWA)", () => {
    const browserInfo: BrowserInfo = {
      browser: "opera",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Opera",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for Safari (iOS uses manual install)", () => {
    const browserInfo: BrowserInfo = {
      browser: "safari",
      supportsNativePWA: true,
      isRecommendedBrowser: true,
      isInAppBrowser: false,
      displayName: "Safari",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for Firefox", () => {
    const browserInfo: BrowserInfo = {
      browser: "firefox",
      supportsNativePWA: false,
      isRecommendedBrowser: false,
      isInAppBrowser: false,
      displayName: "Firefox",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });

  it("returns false for in-app browsers even if they claim Chrome", () => {
    const browserInfo: BrowserInfo = {
      browser: "chrome",
      supportsNativePWA: true,
      isRecommendedBrowser: true,
      isInAppBrowser: true, // In-app browser flag overrides
      displayName: "Chrome",
    };

    expect(canTriggerInstallPrompt(browserInfo)).toBe(false);
  });
});
