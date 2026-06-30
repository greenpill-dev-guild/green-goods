/**
 * PWA Utilities Tests
 *
 * Tests for platform detection including iPadOS desktop UA variants.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPwaInstallCheckRequestId,
  getClientPresentationMode,
  getMobileOperatingSystem,
  isLocalDevicePreviewMode,
  isMobilePlatform,
  isPwaInstallCheckRequest,
  isStandaloneMode,
} from "../../utils/app/pwa";

// Mock navigator and window
const originalNavigator = global.navigator;
const originalWindow = global.window;

interface MockNavigator {
  userAgent: string;
  vendor?: string;
  maxTouchPoints?: number;
  platform?: string;
  standalone?: boolean;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
}

function mockNavigator(props: MockNavigator): void {
  Object.defineProperty(global, "navigator", {
    value: props,
    writable: true,
    configurable: true,
  });
}

function createMatchMedia(matcher: (query: string) => boolean = () => false): Window["matchMedia"] {
  return ((query: string) =>
    ({
      matches: matcher(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as Window["matchMedia"];
}

function createSessionStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage;
}

function mockWindow(
  props: Omit<Partial<Window>, "location" | "matchMedia"> & {
    location?: Partial<Location>;
    matchMedia?: Window["matchMedia"];
  } = {}
): void {
  Object.defineProperty(global, "window", {
    value: {
      location: { hostname: "localhost" },
      navigator: global.navigator,
      matchMedia: createMatchMedia(),
      sessionStorage: createSessionStorage(),
      ...props,
    },
    writable: true,
    configurable: true,
  });
}

describe("getMobileOperatingSystem", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockWindow({});
  });

  afterEach(() => {
    // Restore original navigator and window
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe("iOS detection", () => {
    it("detects iPhone via user agent", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });

      expect(getMobileOperatingSystem()).toBe("ios");
      expect(isMobilePlatform()).toBe(true);
    });

    it("detects iPad via user agent (pre-iPadOS 13)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 12_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1",
      });

      expect(getMobileOperatingSystem()).toBe("ios");
      expect(isMobilePlatform()).toBe(true);
    });

    it("detects iPod Touch via user agent", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      });

      expect(getMobileOperatingSystem()).toBe("ios");
      expect(isMobilePlatform()).toBe(true);
    });
  });

  describe("iPadOS 13+ desktop UA detection (BUG-005)", () => {
    it("detects iPadOS with Macintosh UA and maxTouchPoints > 1", () => {
      // iPadOS 13+ reports as Macintosh but has touch support
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        maxTouchPoints: 5, // iPads typically report 5
      });

      expect(getMobileOperatingSystem()).toBe("ios");
      expect(isMobilePlatform()).toBe(true);
    });

    it("detects iPadOS with Chrome on iPad (desktop UA mode)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 5,
      });

      expect(getMobileOperatingSystem()).toBe("ios");
      expect(isMobilePlatform()).toBe(true);
    });

    it("does NOT detect actual Mac as iOS (maxTouchPoints = 0)", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        maxTouchPoints: 0, // Real Macs have 0 or undefined
      });

      expect(getMobileOperatingSystem()).toBe("unknown");
      expect(isMobilePlatform()).toBe(false);
    });

    it("does NOT detect Mac as iOS when maxTouchPoints is 1", () => {
      // Magic Trackpad can report maxTouchPoints = 1
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        maxTouchPoints: 1,
      });

      expect(getMobileOperatingSystem()).toBe("unknown");
      expect(isMobilePlatform()).toBe(false);
    });

    it("does NOT detect Mac as iOS when maxTouchPoints is undefined", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        // maxTouchPoints not set
      });

      expect(getMobileOperatingSystem()).toBe("unknown");
      expect(isMobilePlatform()).toBe(false);
    });
  });

  describe("Android detection", () => {
    it("detects Android phone via user agent", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      });

      expect(getMobileOperatingSystem()).toBe("android");
      expect(isMobilePlatform()).toBe(true);
    });

    it("detects Android tablet via user agent", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      expect(getMobileOperatingSystem()).toBe("android");
      expect(isMobilePlatform()).toBe(true);
    });
  });

  describe("Windows Phone detection", () => {
    it("detects Windows Phone via user agent", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254",
      });

      expect(getMobileOperatingSystem()).toBe("windows");
      expect(isMobilePlatform()).toBe(true);
    });

    it("prioritizes Windows Phone over Android in UA", () => {
      // Windows Phone UA contains "Android" but should be detected as Windows
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Windows Phone 10.0; Android 4.2.1) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36",
      });

      expect(getMobileOperatingSystem()).toBe("windows");
    });
  });

  describe("Desktop/unknown detection", () => {
    it("returns unknown for Windows desktop", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      expect(getMobileOperatingSystem()).toBe("unknown");
      expect(isMobilePlatform()).toBe(false);
    });

    it("returns unknown for Linux desktop", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      expect(getMobileOperatingSystem()).toBe("unknown");
      expect(isMobilePlatform()).toBe(false);
    });

    it("returns unknown when navigator is undefined", () => {
      // @ts-expect-error - Testing undefined navigator
      delete global.navigator;

      expect(getMobileOperatingSystem()).toBe("unknown");
    });
  });

  describe("client presentation mode", () => {
    it("keeps desktop localhost browser visits in website mode", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "localhost" },
      });

      expect(isLocalDevicePreviewMode()).toBe(false);
      expect(getClientPresentationMode()).toBe("website");
    });

    it("does not use narrow desktop viewport width as a PWA signal", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        innerWidth: 375,
        location: { hostname: "localhost" },
      });

      expect(isLocalDevicePreviewMode()).toBe(false);
      expect(getClientPresentationMode()).toBe("website");
    });

    it("uses PWA mode for localhost mobile/device-like browser signals", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        maxTouchPoints: 5,
        platform: "Linux armv8l",
        userAgentData: { mobile: true, platform: "Android" },
      });
      mockWindow({
        location: { hostname: "localhost" },
      });

      expect(isLocalDevicePreviewMode()).toBe(true);
      expect(getClientPresentationMode()).toBe("pwa");
    });

    it("uses website override for localhost mobile/device-like browser signals", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        maxTouchPoints: 5,
        platform: "Linux armv8l",
        userAgentData: { mobile: true, platform: "Android" },
      });
      mockWindow({
        location: { hostname: "localhost" },
      });

      expect(getClientPresentationMode("http://localhost:3001/?presentation=website")).toBe(
        "website"
      );
      expect(getClientPresentationMode("http://localhost:3001/gardens")).toBe("website");
    });

    it("uses pwa override for localhost desktop browser visits", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "localhost" },
      });

      expect(getClientPresentationMode("http://localhost:3001/?presentation=pwa")).toBe("pwa");
      expect(getClientPresentationMode("http://localhost:3001/home")).toBe("pwa");
    });

    it("uses website override for localhost standalone preview", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "localhost" },
        matchMedia: createMatchMedia((query) => query === "(display-mode: standalone)"),
      });

      expect(getClientPresentationMode("http://localhost:3001/?presentation=website")).toBe(
        "website"
      );
    });

    it("uses PWA mode for standalone display mode", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "www.greengoods.app" },
        matchMedia: createMatchMedia((query) => query === "(display-mode: standalone)"),
      });

      expect(getClientPresentationMode()).toBe("pwa");
    });

    it("uses PWA mode for desktop window-controls-overlay display mode", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "www.greengoods.app" },
        matchMedia: createMatchMedia(
          (query) => query === "(display-mode: window-controls-overlay)"
        ),
      });

      expect(isStandaloneMode()).toBe(true);
      expect(getClientPresentationMode()).toBe("pwa");
    });

    it("ignores presentation override on production hosts", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "www.greengoods.app" },
      });

      expect(getClientPresentationMode("https://www.greengoods.app/?presentation=pwa")).toBe(
        "website"
      );
    });

    it("clears persisted local override when presentation is auto", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        platform: "MacIntel",
      });
      mockWindow({
        location: { hostname: "localhost" },
      });

      expect(getClientPresentationMode("http://localhost:3001/?presentation=pwa")).toBe("pwa");
      expect(getClientPresentationMode("http://localhost:3001/home")).toBe("pwa");
      expect(getClientPresentationMode("http://localhost:3001/?presentation=auto")).toBe("website");
      expect(getClientPresentationMode("http://localhost:3001/home")).toBe("website");
    });

    it("keeps production mobile browsers website-first when not standalone", () => {
      mockNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        maxTouchPoints: 5,
        platform: "iPhone",
      });
      mockWindow({
        location: { hostname: "www.greengoods.app" },
      });

      expect(isLocalDevicePreviewMode()).toBe(false);
      expect(getClientPresentationMode()).toBe("website");
    });
  });
});

describe("PWA install readiness frame marker", () => {
  beforeEach(() => {
    mockWindow({
      location: {
        href: "https://staging.greengoods.app/actions",
        hostname: "staging.greengoods.app",
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("detects scoped install-readiness iframe requests", () => {
    expect(
      getPwaInstallCheckRequestId("https://staging.greengoods.app/home?gg_pwa_install_check=abc")
    ).toBe("abc");
    expect(isPwaInstallCheckRequest("/home?gg_pwa_install_check=abc")).toBe(true);
    expect(isPwaInstallCheckRequest("/home")).toBe(false);
  });
});
