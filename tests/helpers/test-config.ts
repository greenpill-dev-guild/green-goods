/**
 * E2E Test Configuration and Constants
 *
 * Centralized configuration for timeouts, retries, and test behavior
 */

// Timeout configurations (in milliseconds)
export const TIMEOUTS = {
  // Page load and navigation
  navigation: 30000,
  pageLoad: 10000,
  networkIdle: 5000,

  // Element visibility
  elementVisible: 10000,
  elementClickable: 5000,
  modalAppear: 5000,

  // Authentication flows
  passkeyCreation: 45000, // Includes garden join
  passkeyLogin: 30000,
  walletConnection: 20000,

  // Offline/sync operations
  offlineDetection: 3000,
  syncOperation: 10000,
  autoSync: 15000,

  // Service health checks
  serviceStartup: 60000,
  healthCheck: 10000,

  // General waits
  shortWait: 500,
  mediumWait: 1000,
  longWait: 2000,
  extraLongWait: 5000,
};

// Retry configurations
export const RETRIES = {
  serviceHealth: 3,
  elementSearch: 3,
  networkRequest: 2,
};

// Selector strategies for common elements
export const SELECTORS = {
  // Authentication - Client
  loginButton: '[data-testid="login-button"]',
  secondaryActionButton: '[data-testid="secondary-action-button"]',
  usernameInput: '[data-testid="username-input"], input[placeholder*="username"]',

  // Authentication - Admin
  connectWalletButton: '[data-testid="connect-wallet-button"]',
  walletButton:
    '[data-testid="connect-wallet-button"], button:has-text("Connect Wallet"), button:has-text("wallet")',

  // Navigation
  authenticatedNav: [
    '[data-testid="authenticated-nav"]',
    '[data-testid="work-dashboard-button"]',
    'nav:has(a[href="/profile"])',
    'button[aria-label="Menu"]',
  ],

  // Offline indicators
  offlineIndicator: [
    '[data-testid="offline-indicator"]',
    '[data-testid="offline-banner"]',
    'div:has-text("Offline")',
    '[role="status"]:has-text("Offline")',
    ".offline-indicator",
  ],

  // Work dashboard
  workDashboard: [
    '[data-testid="work-dashboard-button"]',
    'button[aria-label*="dashboard"]',
    'button[aria-label*="work"]',
    'button:has([data-testid="dashboard-icon"])',
  ],

  // Modals
  modal: [
    "w3m-modal",
    '[data-testid="wallet-modal"]',
    ".walletconnect-modal",
    '[role="dialog"]',
    'div[class*="modal"]',
  ],

  // Close buttons
  closeButton: [
    'button[aria-label="Close"]',
    'button[aria-label="Cancel"]',
    'button:has-text("Cancel")',
    'button:has-text("Close")',
    '[data-testid="modal-close"]',
  ],

  // Error states
  errorAlert: '[role="alert"]',
  errorText: "text=/error|failed|unable|problem/i",

  // Loading states
  loadingSpinner: '[data-testid="loading"], .loading, .spinner, .animate-spin',
};

// Test data generators
export const generateTestData = {
  username: (prefix: string = "test") => `${prefix}_${Date.now()}`,
  workTitle: (prefix: string = "Work") => `${prefix} ${new Date().toISOString()}`,
  feedback: () => `Test feedback generated at ${new Date().toISOString()}`,
};

// Helper to wait for any selector from a list
export async function waitForAnySelector(
  page: any,
  selectors: string[],
  options: { timeout?: number } = {}
): Promise<{ selector: string; element: any } | null> {
  const timeout = options.timeout || TIMEOUTS.elementVisible;

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: timeout / selectors.length }).catch(() => false)) {
        return { selector, element };
      }
    } catch {
      // Continue to next selector
    }
  }

  return null;
}

// Helper to retry an action with exponential backoff
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = RETRIES.networkRequest,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || i === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Helper to wait for network idle with custom conditions
export async function waitForNetworkIdle(
  page: any,
  options: {
    timeout?: number;
    waitForLoadState?: boolean;
    additionalWait?: number;
  } = {}
): Promise<void> {
  const {
    timeout = TIMEOUTS.networkIdle,
    waitForLoadState = true,
    additionalWait = TIMEOUTS.shortWait,
  } = options;

  if (waitForLoadState) {
    await page.waitForLoadState("networkidle", { timeout });
  }

  // Additional wait for dynamic content
  if (additionalWait > 0) {
    await page.waitForTimeout(additionalWait);
  }

  // Wait for loading spinners to disappear
  try {
    await page
      .locator(SELECTORS.loadingSpinner)
      .waitFor({ state: "hidden", timeout: TIMEOUTS.elementVisible })
      .catch(() => {
        // No spinner is fine
      });
  } catch {
    // Ignore if no spinners found
  }
}

// Helper to check element stability (not moving/changing)
export async function waitForElementStability(
  element: any,
  options: {
    timeout?: number;
    checkInterval?: number;
    stabilityThreshold?: number;
  } = {}
): Promise<void> {
  const { timeout = 5000, checkInterval = 100, stabilityThreshold = 3 } = options;

  const startTime = Date.now();
  let previousBox = null;
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    try {
      const currentBox = await element.boundingBox();

      if (!currentBox) {
        await new Promise((r) => setTimeout(r, checkInterval));
        continue;
      }

      if (
        previousBox &&
        Math.abs(currentBox.x - previousBox.x) < 1 &&
        Math.abs(currentBox.y - previousBox.y) < 1 &&
        Math.abs(currentBox.width - previousBox.width) < 1 &&
        Math.abs(currentBox.height - previousBox.height) < 1
      ) {
        stableCount++;

        if (stableCount >= stabilityThreshold) {
          return;
        }
      } else {
        stableCount = 0;
      }

      previousBox = currentBox;
    } catch {
      // Element might not be ready yet
    }

    await new Promise((r) => setTimeout(r, checkInterval));
  }

  throw new Error(`Element did not stabilize within ${timeout}ms`);
}

// Export all helpers as a namespace for convenience
export const TestHelpers = {
  waitForAnySelector,
  retryWithBackoff,
  waitForNetworkIdle,
  waitForElementStability,
  generateTestData,
};
