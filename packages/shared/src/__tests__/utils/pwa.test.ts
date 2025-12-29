/**
 * PWA Utilities Tests
 *
 * Tests for platform detection including iPadOS desktop UA variants.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMobileOperatingSystem, isMobilePlatform } from "../../utils/app/pwa";

// Mock navigator and window
const originalNavigator = global.navigator;
const originalWindow = global.window;

interface MockNavigator {
  userAgent: string;
  vendor?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

function mockNavigator(props: MockNavigator): void {
  Object.defineProperty(global, "navigator", {
    value: props,
    writable: true,
    configurable: true,
  });
}

function mockWindow(props: Partial<Window> = {}): void {
  Object.defineProperty(global, "window", {
    value: { ...props },
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
});
