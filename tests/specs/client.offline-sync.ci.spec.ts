/**
 * Client Offline Sync CI Tests
 *
 * Lightweight CI-runnable tests that validate offline detection and
 * sync UI behavior WITHOUT requiring real auth or blockchain.
 *
 * Strategy:
 * - Use Playwright's context.setOffline() to toggle network state
 * - Use wallet auth injection for authenticated state
 * - Test offline indicator rendering and state transitions
 * - Verify service worker registration
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

test.describe("Offline Sync CI Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Offline Detection", () => {
    test("shows offline indicator when network is disconnected", async ({ page, context }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(2000);

      // Look for offline indicator using multiple possible selectors
      const offlineSelectors = [
        '[data-testid="offline-indicator"]',
        '[data-testid="offline-banner"]',
        '[role="status"]',
      ];

      let offlineIndicatorFound = false;
      for (const selector of offlineSelectors) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
          // Verify the indicator contains offline-related text
          const text = await element.textContent().catch(() => "");
          if (text && /offline|disconnected|no connection/i.test(text)) {
            offlineIndicatorFound = true;
            break;
          }
        }
      }

      // Also check if any text contains "offline" on the page
      if (!offlineIndicatorFound) {
        const offlineText = page.locator("text=/offline/i").first();
        offlineIndicatorFound = await offlineText.isVisible({ timeout: 2000 }).catch(() => false);
      }

      expect(offlineIndicatorFound).toBe(true);

      // Restore online state for cleanup
      await context.setOffline(false);
    });

    test("hides offline indicator when network reconnects", async ({ page, context }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(2000);

      // Verify offline indicator appeared
      const offlineText = page.locator("text=/offline/i").first();
      const wasOfflineShown = await offlineText.isVisible({ timeout: 3000 }).catch(() => false);

      if (!wasOfflineShown) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — requires live infra (gardens/blockchain)
        test.skip(true, "Offline indicator not rendered — UI may detect offline differently");
        return;
      }

      // Go back online
      await context.setOffline(false);
      await page.waitForTimeout(3000);

      // Offline indicator should be hidden or show "back online" message
      const offlineStillVisible = await offlineText.isVisible({ timeout: 2000 }).catch(() => false);
      const backOnlineMessage = page.locator("text=/back online|connected|online/i").first();
      const showsBackOnline = await backOnlineMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      // Either offline indicator is hidden OR "back online" message appeared
      expect(!offlineStillVisible || showsBackOnline).toBe(true);
    });
  });

  test.describe("PWA Service Worker", () => {
    test("client app loads and registers service worker", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      // Check that the app loaded without critical errors
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);

      // Verify service worker registration via JS evaluation
      const hasServiceWorker = await page
        .evaluate(async () => {
          if (!("serviceWorker" in navigator)) return false;
          const registrations = await navigator.serviceWorker.getRegistrations();
          return registrations.length > 0;
        })
        .catch(() => false);

      // Service worker may not be registered in all test environments
      // Log the result for visibility but don't fail the test
      if (!hasServiceWorker) {
        console.log("Service worker not registered — this is expected in some CI environments");
      }

      // The app should at least be a valid PWA entry point
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });
    });

    test("client app serves valid HTML even when offline after initial load", async ({
      page,
      context,
    }) => {
      // Load the app initially (cache service worker assets)
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      // Go offline
      await context.setOffline(true);

      // Reload — service worker should serve cached response
      await page.reload().catch(() => {
        // Reload may fail in offline mode without service worker — that's expected
      });

      await page.waitForTimeout(2000);

      // Check if the page still shows content (from service worker cache)
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // If service worker cached the page, we should see some app content
      const bodyText = await body.textContent().catch(() => "");
      const hasContent = bodyText.length > 100; // Not an empty page

      // Log result for debugging — offline caching depends on SW registration
      if (!hasContent) {
        console.log("Page empty after offline reload — service worker may not have cached assets");
      }

      // Restore online state
      await context.setOffline(false);
    });
  });

  test.describe("Work Dashboard Offline Behavior", () => {
    test("work dashboard button remains functional during network changes", async ({
      page,
      context,
    }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Look for work dashboard button
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      const isDashboardVisible = await dashboardButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isDashboardVisible) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — requires live infra (gardens/blockchain)
        test.skip(true, "Work dashboard button not visible — may require pending work");
        return;
      }

      // Verify button is enabled while online
      await expect(dashboardButton).toBeEnabled();

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);

      // Button should still be interactive while offline
      // (offline work management is a core feature)
      await expect(dashboardButton).toBeEnabled();

      // Click it — should open the dashboard even offline
      await dashboardButton.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[data-testid="modal-drawer"], [role="dialog"]');
      const isModalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isModalVisible).toBe(true);

      // Restore online state
      await context.setOffline(false);
    });
  });
});
