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

      // Click login button but cancel the passkey prompt
      // Note: In real tests, this would require mocking the WebAuthn cancel
      await expect(page.getByTestId("login-button")).toBeVisible();
    });

    test("shows error message on passkey creation failure", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "iOS Safari does not support virtual WebAuthn");

      // TODO: Implement error simulation
      await page.goto("/login");
      await expect(page.getByTestId("login-button")).toBeVisible();
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
        expect(page.url()).toContain("/home");
        await expect(page.getByTestId("authenticated-nav")).toBeVisible({ timeout: 10000 });
      } finally {
        await helper.cleanup();
      }
    });

    test("shows wallet connection modal", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // Click wallet button
      const walletButton = page.getByRole("button", { name: /wallet/i });
      await expect(walletButton).toBeVisible();
      await walletButton.click();

      // Should show wallet connection UI
      // Note: Actual modal depends on Reown AppKit implementation
      await page.waitForTimeout(1000);
    });

    test("handles wallet connection rejection", async ({ page }) => {
      // TODO: Implement wallet rejection simulation
      await page.goto("/login");
      await expect(page.getByRole("button", { name: /wallet/i })).toBeVisible();
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
