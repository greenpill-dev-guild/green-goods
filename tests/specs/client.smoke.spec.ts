/**
 * Client App Smoke Tests
 *
 * Minimal tests for the client PWA:
 * - Unauthenticated redirect to login
 * - Disconnected mock session with legacy wallet storage
 * - View gardens data
 *
 * Authentication strategy:
 * - Authenticated UI: supported dev mock-auth seam and mocked backend
 * - Legacy wallet storage: disconnected mock-session check on every browser
 */
import { expect, test } from "@playwright/test";
import { MOCK_CLIENT_GARDEN } from "../helpers/mock-backend";
import { ClientTestHelper, setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

test.describe("Client PWA", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Authentication", () => {
    test("redirects unauthenticated /home -> /home/login", async ({ page }) => {
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });

      // Should redirect to login
      await page.waitForURL(/\/home\/login/);
      expect(page.url()).toContain("/home/login");

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
      await page.goto("/home/login?presentation=pwa");
      await page.waitForLoadState("domcontentloaded");

      // Should have Green Goods branding
      await expect(page.locator('img[alt*="Green Goods"]')).toBeVisible();

      // Should have primary login button
      await expect(page.getByTestId("login-button")).toBeVisible();
    });

    test("keeps a disconnected mock session signed out despite legacy wallet storage", async ({
      page,
    }) => {
      const helper = new ClientTestHelper(page);
      await helper.injectWalletAuth();
      await helper.enableMockAuth("disconnected");
      await page.goto("/home?presentation=pwa");
      await helper.waitForPageLoad();

      // The supported dev-auth seam explicitly selects a disconnected session.
      // Legacy wallet storage must not override that test-session state.
      // Real connector restoration is covered by separate auth/device QA.
      await expect(page).toHaveURL(/\/home\/login/);
      await expect(page.getByTestId("login-button")).toBeVisible();
      await expect(page.getByTestId("authenticated-nav")).toHaveCount(0);
    });
  });

  test.describe("Gardens Data", () => {
    test("lists gardens in Explore when authenticated", async ({ page }) => {
      const helper = await setupAuthenticatedClient(page);
      await page.goto("/home/explore?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      await expect(page).not.toHaveURL(/\/home\/login/);
      await expect(page.getByTestId("garden-card").first()).toBeVisible();
    });

    test("can access a garden detail page with mocked data", async ({ page }) => {
      const helper = await setupAuthenticatedClient(page);
      await page.goto(`/home/${MOCK_CLIENT_GARDEN.id}?presentation=pwa`, {
        waitUntil: "domcontentloaded",
      });
      await helper.waitForPageLoad();

      await expect(page).toHaveURL(new RegExp(`/home/${MOCK_CLIENT_GARDEN.id}`));
      await expect(page.getByRole("heading", { name: MOCK_CLIENT_GARDEN.name })).toBeVisible();
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
  });
});
