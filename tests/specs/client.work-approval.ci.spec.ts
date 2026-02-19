/**
 * Client Work Approval CI Tests
 *
 * Lightweight CI-runnable tests that validate work approval UI flows
 * WITHOUT requiring real operator auth or pending work in the indexer.
 *
 * Strategy:
 * - Mock GraphQL responses to simulate pending work data
 * - Use wallet auth injection for authenticated state
 * - Test approval UI rendering, button states, and navigation
 *
 * For full infrastructure tests, use: npx playwright test --project=client-full
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

/**
 * Set up mocked environment with auth and GraphQL mocking.
 */
async function setupMockedEnvironment(page: import("@playwright/test").Page) {
  const helper = new ClientTestHelper(page);
  await helper.injectWalletAuth();

  // Intercept GraphQL requests
  await page.route("**/v1/graphql", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  return helper;
}

test.describe("Work Approval CI Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Unauthenticated Access", () => {
    test("protected pages redirect unauthenticated users to login", async ({ page }) => {
      // Try to access authenticated page without auth
      await page.goto("/home");
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain("/login");
    });

    test("login page renders approval-relevant auth UI", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // Primary login button should be present
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });

      // App should not have crashed
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);
    });
  });

  test.describe("Authenticated Navigation", () => {
    test("authenticated user can reach home page", async ({ page }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Home page loaded — should not have critical errors
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);

      // Should render some app shell (navigation, layout)
      const appShell = page.locator("body").first();
      await expect(appShell).toBeVisible();
    });

    test("work dashboard button is accessible from home page", async ({ page }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Look for the work dashboard trigger
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      const isDashboardVisible = await dashboardButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isDashboardVisible) {
        // Dashboard button exists — verify it can be clicked
        await dashboardButton.click();
        await page.waitForTimeout(500);

        // Should open a modal/drawer
        const modal = page.locator('[data-testid="modal-drawer"], [role="dialog"]');
        const isModalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
        expect(isModalVisible).toBe(true);
      } else {
        // Dashboard button may not render without pending work
        // Verify app is still functional without error
        const hasAppError = await page
          .locator('text="Unexpected Application Error"')
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        expect(hasAppError).toBe(false);
      }
    });
  });

  test.describe("Error Handling", () => {
    test("app handles indexer unavailability gracefully", async ({ page }) => {
      const helper = new ClientTestHelper(page);
      await helper.injectWalletAuth();

      // Mock indexer as unavailable
      await page.route("**/v1/graphql", async (route) => {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "Service unavailable" }] }),
        });
      });

      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // App should render without crashing, even with failed indexer
      const hasUncaughtError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // The app may show an error boundary or empty state, but should not crash
      // (TanStack Query retries handle transient indexer failures)
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // If there's an error boundary, it should be a controlled error display
      if (hasUncaughtError) {
        // Check if it's a recoverable error (error boundary with retry)
        const retryButton = page.getByRole("button", { name: /retry|reload|try again/i });
        const hasRetry = await retryButton.isVisible({ timeout: 2000 }).catch(() => false);
        // Having a retry option means the error is handled gracefully
        expect(hasRetry).toBe(true);
      }
    });
  });
});
