/**
 * useInstallGuidance Hook Tests
 *
 * Tests the PWA installation guidance hook which computes installation
 * scenarios, actions, and manual steps based on platform/browser/state.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock browser detection utilities
vi.mock("../../../utils/app/browser", () => ({
  detectMobileBrowser: vi.fn(),
  getRecommendedBrowser: vi.fn(),
  getOpenInBrowserUrl: vi.fn(),
  canTriggerInstallPrompt: vi.fn(),
}));

import type { InstallScenario } from "../../../hooks/app/useInstallGuidance";
import { useInstallGuidance } from "../../../hooks/app/useInstallGuidance";
import {
  canTriggerInstallPrompt,
  detectMobileBrowser,
  getOpenInBrowserUrl,
  getRecommendedBrowser,
} from "../../../utils/app/browser";

const mockDetect = vi.mocked(detectMobileBrowser);
const mockRecommended = vi.mocked(getRecommendedBrowser);
const mockOpenUrl = vi.mocked(getOpenInBrowserUrl);
const mockCanTrigger = vi.mocked(canTriggerInstallPrompt);

const safariBrowser = {
  browser: "safari" as const,
  supportsNativePWA: true,
  isRecommendedBrowser: true,
  isInAppBrowser: false,
  displayName: "Safari",
};

const chromeBrowser = {
  browser: "chrome" as const,
  supportsNativePWA: true,
  isRecommendedBrowser: true,
  isInAppBrowser: false,
  displayName: "Chrome",
};

const inAppBrowser = {
  browser: "in-app" as const,
  supportsNativePWA: false,
  isRecommendedBrowser: false,
  isInAppBrowser: true,
  displayName: "In-App Browser",
};

const firefoxBrowser = {
  browser: "firefox" as const,
  supportsNativePWA: false,
  isRecommendedBrowser: false,
  isInAppBrowser: false,
  displayName: "Firefox",
};

describe("hooks/app/useInstallGuidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecommended.mockReturnValue({
      browser: "chrome",
      displayName: "Chrome",
      storeUrl: null,
    });
  });

  describe("desktop scenario", () => {
    it("returns desktop scenario when not mobile", () => {
      const { result } = renderHook(() => useInstallGuidance("ios", false, false, null, false));

      expect(result.current.scenario).toBe("desktop");
      expect(result.current.primaryAction.type).toBe("continue-in-browser");
      expect(result.current.primaryAction.label).toBe("Open on Mobile");
      expect(result.current.secondaryAction).toBeNull();
      expect(result.current.showBrowserOption).toBe(false);
    });
  });

  describe("already installed scenario", () => {
    it("returns already-installed when isInstalled is true", () => {
      mockDetect.mockReturnValue(safariBrowser);

      const { result } = renderHook(() => useInstallGuidance("ios", true, false, null, true));

      expect(result.current.scenario).toBe("already-installed");
      expect(result.current.primaryAction.type).toBe("open-app");
      expect(result.current.primaryAction.label).toBe("Open App");
    });
  });

  describe("in-app browser scenario", () => {
    it("returns in-app-browser with open-in-browser for android", () => {
      mockDetect.mockReturnValue(inAppBrowser);
      mockOpenUrl.mockReturnValue(
        "intent://example.com#Intent;scheme=https;package=com.android.chrome;end"
      );

      const { result } = renderHook(() => useInstallGuidance("android", false, false, null, true));

      expect(result.current.scenario).toBe("in-app-browser");
      expect(result.current.primaryAction.type).toBe("open-in-browser");
      expect(result.current.showBrowserOption).toBe(true);
      expect(result.current.browserSwitchReason).toContain("In-app browsers cannot install apps");
      expect(result.current.openInBrowserUrl).toBeTruthy();
    });

    it("returns copy-url for iOS in-app browser", () => {
      mockDetect.mockReturnValue(inAppBrowser);
      mockOpenUrl.mockReturnValue(null);
      mockRecommended.mockReturnValue({
        browser: "safari",
        displayName: "Safari",
        storeUrl: null,
      });

      const { result } = renderHook(() => useInstallGuidance("ios", false, false, null, true));

      expect(result.current.scenario).toBe("in-app-browser");
      expect(result.current.primaryAction.type).toBe("copy-url");
      expect(result.current.browserSwitchReason).toContain("Safari");
    });
  });

  describe("wrong browser scenario", () => {
    it("suggests correct browser when in wrong one", () => {
      mockDetect.mockReturnValue(firefoxBrowser);
      mockOpenUrl.mockReturnValue("intent://test#Intent;end");

      const { result } = renderHook(() => useInstallGuidance("android", false, false, null, true));

      expect(result.current.scenario).toBe("wrong-browser");
      expect(result.current.primaryAction.type).toBe("open-in-browser");
      expect(result.current.secondaryAction?.type).toBe("continue-in-browser");
      expect(result.current.browserSwitchReason).toBeTruthy();
    });

    it("uses copy-url on iOS wrong browser", () => {
      mockDetect.mockReturnValue(firefoxBrowser);
      mockOpenUrl.mockReturnValue(null);
      mockRecommended.mockReturnValue({
        browser: "safari",
        displayName: "Safari",
        storeUrl: null,
      });

      const { result } = renderHook(() => useInstallGuidance("ios", false, false, null, true));

      expect(result.current.scenario).toBe("wrong-browser");
      expect(result.current.primaryAction.type).toBe("copy-url");
    });
  });

  describe("native prompt scenario", () => {
    it("returns native-prompt when deferredPrompt available and browser supports it", () => {
      mockDetect.mockReturnValue(chromeBrowser);
      mockCanTrigger.mockReturnValue(true);

      const mockPrompt = { prompt: vi.fn() } as unknown as BeforeInstallPromptEvent;

      const { result } = renderHook(() =>
        useInstallGuidance("android", false, false, mockPrompt, true)
      );

      expect(result.current.scenario).toBe("native-prompt-available");
      expect(result.current.primaryAction.type).toBe("native-install");
      expect(result.current.primaryAction.label).toBe("Install App");
      expect(result.current.secondaryAction?.type).toBe("continue-in-browser");
    });
  });

  describe("manual install scenario", () => {
    it("shows manual steps for Safari on iOS", () => {
      mockDetect.mockReturnValue(safariBrowser);
      mockCanTrigger.mockReturnValue(false);

      const { result } = renderHook(() => useInstallGuidance("ios", false, false, null, true));

      expect(result.current.scenario).toBe("manual-install-available");
      expect(result.current.primaryAction.type).toBe("show-manual-steps");
      expect(result.current.manualInstructions).toBeDefined();
      expect(result.current.manualInstructions!.length).toBe(2);
      expect(result.current.manualInstructions![0].icon).toBe("share");
    });

    it("shows open-app as primary when wasInstalled is true", () => {
      mockDetect.mockReturnValue(safariBrowser);
      mockCanTrigger.mockReturnValue(false);

      const { result } = renderHook(() => useInstallGuidance("ios", false, true, null, true));

      expect(result.current.scenario).toBe("manual-install-available");
      expect(result.current.primaryAction.type).toBe("open-app");
      expect(result.current.secondaryAction?.type).toBe("show-manual-steps");
      expect(result.current.secondaryAction?.label).toBe("Reinstall");
    });

    it("provides Android Chrome manual steps", () => {
      mockDetect.mockReturnValue(chromeBrowser);
      mockCanTrigger.mockReturnValue(false);

      const { result } = renderHook(() => useInstallGuidance("android", false, false, null, true));

      expect(result.current.scenario).toBe("manual-install-available");
      expect(result.current.manualInstructions).toBeDefined();
      expect(result.current.manualInstructions![0].icon).toBe("menu");
    });
  });

  describe("scenario type safety", () => {
    it("all scenarios are valid InstallScenario types", () => {
      const validScenarios: InstallScenario[] = [
        "native-prompt-available",
        "manual-install-available",
        "wrong-browser",
        "in-app-browser",
        "already-installed",
        "desktop",
        "unsupported",
      ];
      expect(validScenarios).toHaveLength(7);
    });
  });
});
