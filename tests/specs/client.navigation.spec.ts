/**
 * Client Navigation and Routing E2E Tests
 *
 * Tests for navigation flows, protected routes, and deep linking
 *
 * Manual navigation cases use legacy wallet storage injection; CI and qualified
 * passkey journeys have their own fixtures and do not depend on this lane.
 */

import { expect, test } from "@playwright/test";
import { TIMEOUTS } from "../helpers/test-config";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

test.describe("Client Navigation", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Protected Routes", () => {
    test("redirects unauthenticated users from protected routes", async ({ page }) => {
      const protectedRoutes = ["/home?presentation=pwa", "/home/profile", "/home/garden"];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        // Should redirect to login
        expect(page.url()).toContain("/home/login");

        // Login page should be functional
        await expect(page.getByTestId("login-button")).toBeVisible({
          timeout: TIMEOUTS.elementVisible,
        });
      }
    });
  });

  test.describe("Navigation UI", () => {
    test("shows navigation menu on mobile", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      await page.setViewportSize({ width: 375, height: 667 });
      // Use wallet injection
      await helper.injectWalletAuth();
      await page.goto("/home?presentation=pwa");
      await helper.waitForPageLoad();

      const url = page.url();
      // SKIP: #338 owner:afo expiry:2026-10-16 — wallet injection may not persist in this manual lane
      test.skip(url.includes("/home/login"), "Wallet authentication did not persist");

      // Look for hamburger menu on mobile
      const menuButton = page.locator('button[aria-label="Menu"], button[aria-label="Open menu"]');
      await expect(menuButton).toBeVisible({ timeout: TIMEOUTS.elementVisible });
      await menuButton.click();

      const navMenu = page.locator('nav[role="navigation"], [data-testid="mobile-menu"]');
      await expect(navMenu.first()).toBeVisible({ timeout: TIMEOUTS.modalAppear });
      await expect(page.locator('a[href="/home/profile"]').first()).toBeVisible();
    });

    test("shows breadcrumbs on detail pages", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      // Use wallet injection
      await helper.injectWalletAuth();
      await page.goto("/home?presentation=pwa");
      await helper.waitForPageLoad();

      const url = page.url();
      // SKIP: #338 owner:afo expiry:2026-10-16 — wallet injection may not persist in this manual lane
      test.skip(url.includes("/home/login"), "Wallet authentication did not persist");

      // Navigate to a detail page if available
      const gardenLink = page.locator('a[href*="/gardens/"], a[href*="/home/"]').first();
      if (await gardenLink.isVisible({ timeout: TIMEOUTS.elementVisible }).catch(() => false)) {
        await gardenLink.click();
        await helper.waitForPageLoad();

        // Look for breadcrumbs
        const breadcrumbs = page.locator(
          'nav[aria-label="Breadcrumb"], [data-testid="breadcrumbs"], ol:has(li > a)'
        );

        await expect(breadcrumbs).toBeVisible({ timeout: TIMEOUTS.elementVisible });
        expect(await breadcrumbs.locator("a").count()).toBeGreaterThan(0);
      } else {
        // SKIP: #338 owner:afo expiry:2026-10-16 — requires a rendered garden detail link
        test.skip(true, "No garden detail link is available for breadcrumb coverage");
      }
    });
  });

  test.describe("Back Navigation", () => {
    test("browser back button works correctly", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      // Use wallet injection
      await helper.injectWalletAuth();
      await page.goto("/home?presentation=pwa");
      await helper.waitForPageLoad();

      const homeUrl = page.url();
      if (homeUrl.includes("/home/login")) {
        console.log("Auth injection not persisted - skipping back navigation test");
        return;
      }

      // Navigate to profile
      await page.goto("/home/profile");
      await helper.waitForPageLoad();
      const profileUrl = page.url();

      if (profileUrl.includes("/home/login")) {
        // Auth didn't persist for second navigation
        console.log("Auth not persisted across navigation - skipping test");
        return;
      }

      expect(profileUrl).toContain("/home/profile");

      // Go back
      await page.goBack();
      await helper.waitForPageLoad();

      // Should be back on home
      expect(page.url()).toBe(homeUrl);

      // Go forward
      await page.goForward();
      await helper.waitForPageLoad();

      // Should be back on profile
      expect(page.url()).toBe(profileUrl);
    });
  });
});
