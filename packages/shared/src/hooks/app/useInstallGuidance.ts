/**
 * PWA Installation Guidance Hook
 *
 * Provides smart installation guidance based on platform and browser detection.
 * Helps funnel users to the correct browser for optimal PWA installation.
 *
 * @module hooks/app/useInstallGuidance
 */

import { useMemo } from "react";

import {
  type BrowserInfo,
  type MobileBrowser,
  canTriggerInstallPrompt,
  detectMobileBrowser,
  getOpenInBrowserUrl,
  getRecommendedBrowser,
} from "../../utils/app/browser";
import type { Platform } from "../../utils/app/pwa";

/**
 * Browser info for desktop scenarios (non-mobile platforms)
 */
const DESKTOP_BROWSER_INFO: BrowserInfo = {
  browser: "unknown",
  supportsNativePWA: false,
  isRecommendedBrowser: false,
  isInAppBrowser: false,
  displayName: "Desktop Browser",
};

/**
 * Installation guidance result
 */
export interface InstallGuidance {
  /** Detected browser information */
  browserInfo: BrowserInfo;

  /** The current installation scenario */
  scenario: InstallScenario;

  /** Primary action to show the user */
  primaryAction: InstallAction;

  /** Optional secondary action */
  secondaryAction: InstallAction | null;

  /** Whether to show "Continue in Browser" option */
  showBrowserOption: boolean;

  /** Instructions for manual installation (if applicable) */
  manualInstructions: ManualInstallStep[] | null;

  /** Message explaining why browser switch is needed (if applicable) */
  browserSwitchReason: string | null;

  /** URL to open in recommended browser (Android only) */
  openInBrowserUrl: string | null;
}

/**
 * Possible installation scenarios
 */
export type InstallScenario =
  | "native-prompt-available" // Can trigger beforeinstallprompt
  | "manual-install-available" // Right browser, show manual steps
  | "wrong-browser" // Need to switch browsers
  | "in-app-browser" // In WebView, must open in real browser
  | "already-installed" // PWA is already installed
  | "desktop" // Desktop browser, show mobile prompt
  | "unsupported"; // Platform doesn't support PWA

/**
 * Action types for installation UI
 */
export interface InstallAction {
  type:
    | "native-install" // Trigger beforeinstallprompt
    | "show-manual-steps" // Show step-by-step guide
    | "open-in-browser" // Open URL in different browser
    | "copy-url" // Copy URL for manual paste
    | "continue-in-browser" // Skip install, use web
    | "open-app"; // Already installed, open the app
  label: string;
  description?: string;
}

/**
 * Step in manual installation instructions
 */
export interface ManualInstallStep {
  stepNumber: number;
  icon: "share" | "menu" | "add" | "install";
  title: string;
  description: string;
}

/**
 * Generate installation guidance based on platform, browser, and app state
 */
export function useInstallGuidance(
  platform: Platform,
  isInstalled: boolean,
  wasInstalled: boolean,
  deferredPrompt: BeforeInstallPromptEvent | null,
  isMobile: boolean
): InstallGuidance {
  return useMemo(() => {
    // Desktop scenario
    if (!isMobile) {
      return {
        browserInfo: DESKTOP_BROWSER_INFO,
        scenario: "desktop",
        primaryAction: {
          type: "continue-in-browser",
          label: "Open on Mobile",
          description: "Scan QR or visit on your phone",
        },
        secondaryAction: null,
        showBrowserOption: false,
        manualInstructions: null,
        browserSwitchReason: null,
        openInBrowserUrl: null,
      };
    }

    // Already installed
    if (isInstalled) {
      return {
        browserInfo: detectMobileBrowser(platform),
        scenario: "already-installed",
        primaryAction: {
          type: "open-app",
          label: "Open App",
        },
        secondaryAction: null,
        showBrowserOption: false,
        manualInstructions: null,
        browserSwitchReason: null,
        openInBrowserUrl: null,
      };
    }

    const browserInfo = detectMobileBrowser(platform);
    const recommendedBrowser = getRecommendedBrowser(platform);

    // In-app browser (WebView) - must escape to real browser
    if (browserInfo.isInAppBrowser) {
      const openUrl = getOpenInBrowserUrl(platform, recommendedBrowser.browser);

      return {
        browserInfo,
        scenario: "in-app-browser",
        primaryAction:
          platform === "android" && openUrl
            ? {
                type: "open-in-browser",
                label: `Open in ${recommendedBrowser.displayName}`,
                description: "For the best experience",
              }
            : {
                type: "copy-url",
                label: "Copy Link",
                description: `Then open in ${recommendedBrowser.displayName}`,
              },
        secondaryAction: {
          type: "continue-in-browser",
          label: "Continue Here",
          description: "Limited functionality",
        },
        showBrowserOption: true,
        manualInstructions: null,
        browserSwitchReason:
          platform === "ios"
            ? "In-app browsers cannot install apps. Copy this link and open it in Safari."
            : "In-app browsers cannot install apps. Tap below to open in Chrome.",
        openInBrowserUrl: openUrl,
      };
    }

    // Wrong browser for platform
    if (!browserInfo.isRecommendedBrowser && !browserInfo.supportsNativePWA) {
      const openUrl = getOpenInBrowserUrl(platform, recommendedBrowser.browser);

      return {
        browserInfo,
        scenario: "wrong-browser",
        primaryAction:
          platform === "android" && openUrl
            ? {
                type: "open-in-browser",
                label: `Open in ${recommendedBrowser.displayName}`,
                description: "Required for installation",
              }
            : {
                type: "copy-url",
                label: "Copy Link",
                description: `Open in ${recommendedBrowser.displayName}`,
              },
        secondaryAction: {
          type: "continue-in-browser",
          label: "Continue in Browser",
          description: "Use without installing",
        },
        showBrowserOption: true,
        manualInstructions: null,
        browserSwitchReason:
          platform === "ios"
            ? `${browserInfo.displayName} cannot install apps on iPhone. Please open this page in Safari.`
            : `${browserInfo.displayName} has limited app support. Open in ${recommendedBrowser.displayName} for the best experience.`,
        openInBrowserUrl: openUrl,
      };
    }

    // Native install prompt available (Chrome/Edge/Samsung on Android)
    if (deferredPrompt && canTriggerInstallPrompt(browserInfo)) {
      return {
        browserInfo,
        scenario: "native-prompt-available",
        primaryAction: {
          type: "native-install",
          label: "Install App",
        },
        secondaryAction: {
          type: "continue-in-browser",
          label: "Continue in Browser",
        },
        showBrowserOption: true,
        manualInstructions: null,
        browserSwitchReason: null,
        openInBrowserUrl: null,
      };
    }

    // Manual installation available (Safari on iOS, or Android without prompt)
    const manualInstructions = getManualInstallSteps(platform, browserInfo.browser);

    // Was previously installed - show "Open App" as primary
    if (wasInstalled) {
      return {
        browserInfo,
        scenario: "manual-install-available",
        primaryAction: {
          type: "open-app",
          label: "Open App",
        },
        secondaryAction: {
          type: "show-manual-steps",
          label: "Reinstall",
        },
        showBrowserOption: true,
        manualInstructions,
        browserSwitchReason: null,
        openInBrowserUrl: null,
      };
    }

    return {
      browserInfo,
      scenario: "manual-install-available",
      primaryAction: {
        type: "show-manual-steps",
        label: "Install App",
      },
      secondaryAction: {
        type: "continue-in-browser",
        label: "Continue in Browser",
      },
      showBrowserOption: true,
      manualInstructions,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    };
  }, [platform, isInstalled, wasInstalled, deferredPrompt, isMobile]);
}

/**
 * Get platform and browser-specific manual installation steps
 */
function getManualInstallSteps(platform: Platform, browser: MobileBrowser): ManualInstallStep[] {
  if (platform === "ios") {
    return [
      {
        stepNumber: 1,
        icon: "share",
        title: "Step 1",
        description: "Tap the **Share** button in your browser bar.",
      },
      {
        stepNumber: 2,
        icon: "add",
        title: "Step 2",
        description: "Scroll down and tap **Add to Home Screen**.",
      },
    ];
  }

  if (platform === "android") {
    // Different Android browsers have different UI
    switch (browser) {
      case "samsung":
        return [
          {
            stepNumber: 1,
            icon: "menu",
            title: "Step 1",
            description: "Tap the **Menu** button (three lines).",
          },
          {
            stepNumber: 2,
            icon: "install",
            title: "Step 2",
            description: "Tap **Add page to** then **Home screen**.",
          },
        ];

      case "edge":
        return [
          {
            stepNumber: 1,
            icon: "menu",
            title: "Step 1",
            description: "Tap the **Menu** button (three dots).",
          },
          {
            stepNumber: 2,
            icon: "install",
            title: "Step 2",
            description: "Tap **Add to phone** or **Install app**.",
          },
        ];

      case "chrome":
      default:
        return [
          {
            stepNumber: 1,
            icon: "menu",
            title: "Step 1",
            description: "Tap the **Menu** button (three dots).",
          },
          {
            stepNumber: 2,
            icon: "install",
            title: "Step 2",
            description: "Select **Add to Home Screen** or **Install App**.",
          },
        ];
    }
  }

  // Fallback for unknown platforms
  return [
    {
      stepNumber: 1,
      icon: "menu",
      title: "Step 1",
      description: "Open your browser menu.",
    },
    {
      stepNumber: 2,
      icon: "add",
      title: "Step 2",
      description: 'Look for "Add to Home Screen" or "Install".',
    },
  ];
}

/**
 * Declaration for BeforeInstallPromptEvent (not in standard TS types)
 */
declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
    prompt(): Promise<void>;
  }
}
