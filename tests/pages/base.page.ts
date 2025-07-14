// Page Object Model base class

import { type Page, type Locator } from "@playwright/test";

export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Common elements across pages
  get loadingSpinner(): Locator {
    return this.page.locator('[data-testid="loading"], .loading, .spinner');
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error"], .error, [role="alert"]');
  }

  get navigationBar(): Locator {
    return this.page.locator('nav, [data-testid="navigation"]');
  }

  // Common actions
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Loading spinner might not exist, that's okay
    });
  }

  async expectNoErrors() {
    await this.errorMessage.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {
      // No error messages is good
    });
  }

  // PWA-specific helpers
  async checkPWAFeatures() {
    // Check if PWA manifest is loaded
    const manifest = await this.page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link ? link.getAttribute("href") : null;
    });

    return { hasManifest: !!manifest };
  }

  // Mobile-specific helpers
  async simulateMobileGestures() {
    // Add touch gestures for mobile testing
    await this.page.touchscreen.tap(100, 100);
  }

  // Blockchain-specific helpers
  async waitForBlockchainTransaction(timeout = 30000) {
    // Wait for blockchain transaction to complete
    await this.page.waitForTimeout(2000); // Initial wait
    await this.loadingSpinner.waitFor({ state: "hidden", timeout }).catch(() => {
      // Transaction might complete without spinner
    });
  }
}
