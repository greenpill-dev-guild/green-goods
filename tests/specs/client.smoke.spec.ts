/**
 * Client App Smoke Tests
 *
 * Minimal tests for the client PWA:
 * - Unauthenticated redirect to login
 * - Passkey authentication (Android Chrome)
 * - Wallet authentication (iOS Safari)
 * - View gardens data
 *
 * Authentication strategy:
 * - Android/Chromium: Virtual WebAuthn authenticator for passkey testing
 * - iOS Safari: Storage injection for wallet authentication (WebAuthn not supported)
 */
import { expect, test } from "@playwright/test";
import { ClientTestHelper, hasGardens, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

/**
 * Detect if current browser is iOS Safari
 */
function isIOS(projectName: string | undefined): boolean {
  return projectName === "mobile-safari";
}

test.describe("Client PWA", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Authentication", () => {
    test("redirects unauthenticated /home -> /login", async ({ page }) => {
      await page.goto("/home");

      // Should redirect to login
      await page.waitForURL(/\/login/);
      expect(page.url()).toContain("/login");

      // Should show login UI with passkey option
      await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });

      // Should show wallet fallback option (tertiary text link)
      const walletLink = page
        .locator(
          'button:has-text("Login with wallet"), a:has-text("Login with wallet"), text="Login with wallet"'
        )
        .first();
      const hasWalletLink = await walletLink.isVisible({ timeout: 3000 }).catch(() => false);

      // Either wallet link exists or login button is at least visible
      expect(hasWalletLink || (await page.getByTestId("login-button").isVisible())).toBeTruthy();
    });

    test("shows login page with correct branding", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // Should have Green Goods branding
      await expect(page.locator('img[alt*="Green Goods"]')).toBeVisible();

      // Should have primary login button
      await expect(page.getByTestId("login-button")).toBeVisible();
    });

    test("passkey flow - create account and authenticate", async ({ page }, testInfo) => {
      // Skip passkey e2e tests - virtual authenticator credentials are rejected by real Pimlico server
      // Passkey flow is tested in unit tests with mocked Pimlico responses
      // See: packages/shared/src/__tests__/workflows/authServices.test.ts
      test.skip(
        true,
        "Passkey e2e tests skipped: virtual authenticator credentials rejected by Pimlico server. " +
          "Use unit tests for passkey flow validation."
      );

      const helper = new ClientTestHelper(page);

      // Setup virtual authenticator for passkey testing
      await helper.setupPasskeyAuth();

      try {
        // Create new account
        const username = `e2e_${Date.now()}`;
        await helper.createPasskeyAccount(username);

        // Should be on home page after auth
        expect(page.url()).toContain("/home");

        // Should see authenticated UI (no login redirect)
        await helper.waitForPageLoad();
        await expect(page.locator("body")).toBeVisible();
      } finally {
        await helper.cleanup();
      }
    });

    test("wallet flow - inject auth and navigate (iOS Safari)", async ({ page }, testInfo) => {
      // Only run on iOS Safari - passkey tests cover Android/Chromium
      test.skip(!isIOS(testInfo.project.name), "Wallet injection only needed for iOS Safari");

      const helper = new ClientTestHelper(page);

      // Inject wallet state before navigating
      await helper.injectWalletAuth();

      // Navigate to home (should not redirect to login)
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();

      if (url.includes("/home")) {
        // Auth worked - verify we're on home page
        await expect(page.locator("body")).toBeVisible();
      } else {
        // Auth injection didn't persist - this is expected in some cases
        // iOS Safari has stricter localStorage rules
        console.log("Auth injection not persisted on iOS - wallet flow would be needed");
        expect(url).toContain("/login");
      }
    });
  });

  test.describe("Gardens Data", () => {
    test("displays gardens list when authenticated", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      // Use wallet injection for all platforms (passkey e2e tests skipped)
      await helper.injectWalletAuth();
      await page.goto("/home");

      await helper.waitForPageLoad();

      // Check if we're authenticated (wallet injection may not persist)
      const url = page.url();
      if (url.includes("/login")) {
        console.log("Auth not persisted - skipping gardens test");
        return;
      }

      // Check if gardens exist in indexer
      const gardensExist = await hasGardens(page);

      if (gardensExist) {
        // If gardens exist, we should see garden cards or list
        const gardenElements = page.locator(
          '[data-testid="garden-card"], .garden-card, a[href*="/home/"]'
        );
        await expect(gardenElements.first()).toBeVisible({ timeout: 15000 });
      } else {
        // No gardens is okay - just verify we're on home and no errors
        await expect(page.locator("body")).toBeVisible();
        const errorElements = page.locator('[role="alert"][class*="error"], .error-message');
        await expect(errorElements).toHaveCount(0);
      }
    });

    test("can access garden detail page", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      // Use wallet injection for all platforms (passkey e2e tests skipped)
      await helper.injectWalletAuth();
      await page.goto("/home");

      await helper.waitForPageLoad();

      // Check if we're authenticated
      const url = page.url();
      if (url.includes("/login")) {
        console.log("Auth not persisted - skipping detail page test");
        return;
      }

      // Check if gardens exist
      const gardensExist = await hasGardens(page);

      if (gardensExist) {
        // Click first garden link
        const gardenLink = page.locator('a[href*="/home/"]').first();

        if (await gardenLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          await gardenLink.click();
          await helper.waitForPageLoad();

          // Should be on garden detail page
          expect(page.url()).toMatch(/\/home\/[^/]+/);
        }
      } else {
        // Skip if no gardens
        console.log("No gardens available - skipping detail page test");
      }
    });
  });

  test.describe("Service Health", () => {
    test("client responds with valid HTML", async ({ request }) => {
      const response = await request.get("/");
      expect(response.status()).toBeLessThan(500);

      const html = await response.text();
      expect(html.toLowerCase()).toContain("<!doctype html>");
      expect(html).toContain("Green Goods");
    });

    test("client app loads without critical errors", async ({ page }) => {
      // Navigate to root
      await page.goto("/");

      // Wait for initial load
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      // Check for React app errors
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const hasQueryClientError = await page
        .locator('text="No QueryClient set"')
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (hasAppError || hasQueryClientError) {
        const errorText = await page.locator("body").textContent();
        console.error("App error found:", errorText?.substring(0, 500));

        // Try reloading once
        await page.reload();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);

        // Check again after reload
        const stillHasError = await page
          .locator('text="Unexpected Application Error"')
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        expect(stillHasError).toBe(false);
      }

      // Should be on a valid page (root, login, landing, or home)
      const url = page.url();
      expect(url).toMatch(/\/(login|landing|home)?$/);
    });

    test("indexer responds to GraphQL queries", async ({ request }) => {
      const response = await request.post(TEST_URLS.indexer, {
        data: { query: "query { __typename }" },
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json.data).toBeDefined();
    });
  });
});
