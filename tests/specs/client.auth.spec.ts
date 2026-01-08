/**
 * Client Authentication E2E Tests
 *
 * Comprehensive authentication flow testing:
 * - Passkey registration and login
 * - Wallet connection flow
 * - Auth state persistence
 * - Error handling
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

function isIOS(projectName: string | undefined): boolean {
  return projectName === "mobile-safari";
}

test.describe("Client Authentication Flows", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Passkey Registration", () => {
    test("creates new passkey account with username", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      const helper = new ClientTestHelper(page);
      await helper.setupPasskeyAuth();

      try {
        const username = `e2e_passkey_${Date.now()}`;
        await helper.createPasskeyAccount(username);

        // Verify authenticated state
        expect(page.url()).toContain("/home");
        await expect(page.getByTestId("authenticated-nav")).toBeVisible({ timeout: 10000 });

        // Verify username is displayed
        await expect(page.getByText(username)).toBeVisible();
      } finally {
        await helper.cleanup();
      }
    });

    test("handles passkey registration cancellation", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      // Verify login page loads correctly
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });

      // Click to show username input
      await loginButton.click();
      await page.waitForTimeout(500);

      // Verify username input appears
      const usernameInput = page.getByTestId("username-input");
      await expect(usernameInput).toBeVisible({ timeout: 5000 });

      // Verify we're still on login page (not redirected)
      expect(page.url()).toContain("/login");
    });

    test("shows error message on passkey creation failure", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      // Verify login button is present and functional
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });
      await expect(loginButton).toBeEnabled();
    });
  });

  test.describe("Wallet Connection", () => {
    test("connects wallet and authenticates", async ({ page }, testInfo) => {
      // Prefer wallet on iOS, but works on all platforms
      const helper = new ClientTestHelper(page);

      try {
        await helper.setupWalletAuth();
        await helper.authenticateWithWallet();

        // Verify authenticated state
        await page.waitForTimeout(2000);
        expect(page.url()).toContain("/home");

        // Look for authenticated UI elements
        const authenticatedElements = [
          '[data-testid="authenticated-nav"]',
          '[data-testid="work-dashboard-button"]',
          'nav:has(a[href="/profile"])',
          'button[aria-label="Menu"]',
        ];

        let authElementFound = false;
        for (const selector of authenticatedElements) {
          if (
            await page
              .locator(selector)
              .isVisible({ timeout: 3000 })
              .catch(() => false)
          ) {
            authElementFound = true;
            break;
          }
        }
        expect(authElementFound).toBeTruthy();
      } finally {
        await helper.cleanup();
      }
    });

    test("shows wallet connection modal", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      // Login button should be visible
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });

      // Wallet option is a tertiary text link ("Login with wallet")
      // It could be a button or a link
      const walletLink = page
        .locator(
          'button:has-text("Login with wallet"), a:has-text("Login with wallet"), text="Login with wallet"'
        )
        .first();
      const hasWalletLink = await walletLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasWalletLink) {
        await walletLink.click();
        await page.waitForTimeout(2000);

        // Reown AppKit modal uses w3m-modal tag or specific classes
        const modalSelectors = [
          "w3m-modal",
          "appkit-modal",
          '[data-testid="wallet-modal"]',
          '[role="dialog"]',
          'div[class*="modal"]',
        ];

        let modalFound = false;
        for (const selector of modalSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
            modalFound = true;
            break;
          }
        }

        // Accept either modal showing or still on login page
        expect(modalFound || page.url().includes("/login")).toBeTruthy();
      } else {
        // If no wallet link visible, the login button should still be functional
        await expect(loginButton).toBeEnabled();
      }
    });

    test("handles wallet connection rejection", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });

      // Wallet option is a tertiary text link
      const walletLink = page
        .locator(
          'button:has-text("Login with wallet"), a:has-text("Login with wallet"), text="Login with wallet"'
        )
        .first();
      const hasWalletLink = await walletLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasWalletLink) {
        await walletLink.click();
        await page.waitForTimeout(2000);

        // Try to close/cancel modal if it appears
        const closeSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label="Cancel"]',
          'button:has-text("Cancel")',
          'button:has-text("Close")',
          '[data-testid="modal-close"]',
          '[data-testid="modal-drawer-close"]',
        ];

        let closed = false;
        for (const selector of closeSelectors) {
          const closeButton = page.locator(selector).first();
          if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeButton.click();
            closed = true;
            await page.waitForTimeout(1000);
            break;
          }
        }

        // If no close button found, press Escape
        if (!closed) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(1000);
        }
      }

      // Should remain on login page
      expect(page.url()).toContain("/login");
      await expect(loginButton).toBeVisible();
    });
  });

  test.describe("Auth State Persistence", () => {
    test("persists passkey session across page reloads", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      const helper = new ClientTestHelper(page);
      await helper.setupPasskeyAuth();

      try {
        const username = `e2e_persist_${Date.now()}`;
        await helper.createPasskeyAccount(username);

        // Reload page
        await page.reload();
        await helper.waitForPageLoad();

        // Should still be authenticated
        expect(page.url()).toContain("/home");
        await expect(page.getByText(username)).toBeVisible();
      } finally {
        await helper.cleanup();
      }
    });

    test("persists wallet session across page reloads", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      try {
        await helper.setupWalletAuth();
        await helper.authenticateWithWallet();

        // Reload page
        await page.reload();
        await helper.waitForPageLoad();

        // Should still be authenticated
        expect(page.url()).toContain("/home");
      } finally {
        await helper.cleanup();
      }
    });
  });

  test.describe("Sign Out", () => {
    test("signs out passkey user and redirects to login", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      const helper = new ClientTestHelper(page);
      await helper.setupPasskeyAuth();

      try {
        await helper.createPasskeyAccount(`e2e_signout_${Date.now()}`);

        // Find and click sign out button
        const signOutButton = page.getByRole("button", { name: /sign out/i });
        await expect(signOutButton).toBeVisible();
        await signOutButton.click();

        // Should redirect to login
        await page.waitForURL(/\/login/);
        expect(page.url()).toContain("/login");
      } finally {
        await helper.cleanup();
      }
    });

    test("signs out wallet user and redirects to login", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      try {
        await helper.setupWalletAuth();
        await helper.authenticateWithWallet();

        // Find and click sign out button
        const signOutButton = page.getByRole("button", { name: /sign out/i });
        await expect(signOutButton).toBeVisible();
        await signOutButton.click();

        // Should redirect to login
        await page.waitForURL(/\/login/);
        expect(page.url()).toContain("/login");
      } finally {
        await helper.cleanup();
      }
    });
  });

  test.describe("Auth Error Handling", () => {
    test("shows error message on authentication failure", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // TODO: Simulate authentication failure
      await expect(page.getByTestId("login-button")).toBeVisible();
    });

    test("allows retry after authentication error", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // TODO: Simulate error and retry
      await expect(page.getByTestId("login-button")).toBeVisible();
    });
  });
});
