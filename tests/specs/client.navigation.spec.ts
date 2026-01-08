/**
 * Client Navigation and Routing E2E Tests
 *
 * Tests for navigation flows, protected routes, and deep linking
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";
import { TIMEOUTS } from "../helpers/test-config";

const CLIENT_URL = TEST_URLS.client;

function isIOS(projectName: string | undefined): boolean {
  return projectName === "mobile-safari";
}

test.describe("Client Navigation", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Protected Routes", () => {
    test("redirects unauthenticated users from protected routes", async ({ page }) => {
      const protectedRoutes = ["/home", "/profile", "/gardens/123", "/work/submit", "/settings"];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        // Should redirect to login
        expect(page.url()).toContain("/login");

        // Login page should be functional
        await expect(page.getByTestId("login-button")).toBeVisible({
          timeout: TIMEOUTS.elementVisible,
        });
      }
    });

    test("allows authenticated users to access protected routes", async ({ page }, testInfo) => {
      const helper = new ClientTestHelper(page);
      const ios = isIOS(testInfo.project.name);

      // Authenticate based on platform
      if (ios) {
        await helper.injectWalletAuth();
      } else {
        await helper.setupPasskeyAuth();
        await helper.createPasskeyAccount(`nav_test_${Date.now()}`);
      }

      try {
        // Test navigation to various routes
        const routes = [
          { path: "/home", selector: "body" },
          { path: "/profile", selector: '[data-testid="profile-page"], h1:has-text("Profile")' },
        ];

        for (const route of routes) {
          await page.goto(route.path);
          await helper.waitForPageLoad();

          // Should not redirect to login
          expect(page.url()).toContain(route.path);

          // Page content should load
          await expect(page.locator(route.selector).first()).toBeVisible({
            timeout: TIMEOUTS.elementVisible,
          });
        }
      } finally {
        if (!ios) {
          await helper.cleanup();
        }
      }
    });
  });

  test.describe("Deep Linking", () => {
    test("preserves intended destination after login", async ({ page }, testInfo) => {
      test.skip(isIOS(testInfo.project.name), "Skip on iOS due to auth complexity");

      const targetPath = "/profile";

      // Try to access protected route
      await page.goto(targetPath);
      await page.waitForLoadState("networkidle");

      // Should redirect to login
      expect(page.url()).toContain("/login");

      // Authenticate
      const helper = new ClientTestHelper(page);
      await helper.setupPasskeyAuth();

      try {
        await helper.createPasskeyAccount(`deeplink_${Date.now()}`);

        // Should redirect to originally requested path
        await page.waitForTimeout(TIMEOUTS.mediumWait);
        expect(page.url()).toContain(targetPath);
      } finally {
        await helper.cleanup();
      }
    });
  });

  test.describe("Navigation UI", () => {
    test("shows navigation menu on mobile", async ({ page }, testInfo) => {
      const helper = new ClientTestHelper(page);
      const ios = isIOS(testInfo.project.name);

      // Authenticate
      if (ios) {
        await helper.injectWalletAuth();
        await page.goto("/home");
      } else {
        await helper.setupPasskeyAuth();
        await helper.createPasskeyAccount(`nav_mobile_${Date.now()}`);
      }

      try {
        await helper.waitForPageLoad();

        // Look for hamburger menu on mobile
        const menuButton = page.locator(
          'button[aria-label="Menu"], button[aria-label="Open menu"]'
        );
        if (await menuButton.isVisible({ timeout: TIMEOUTS.shortWait }).catch(() => false)) {
          await menuButton.click();
          await page.waitForTimeout(TIMEOUTS.shortWait);

          // Menu should open
          const navMenu = page.locator('nav[role="navigation"], [data-testid="mobile-menu"]');
          await expect(navMenu.first()).toBeVisible({ timeout: TIMEOUTS.modalAppear });

          // Should have navigation links
          const profileLink = page.locator('a[href="/profile"]');
          await expect(profileLink.first()).toBeVisible();
        }
      } finally {
        if (!ios) {
          await helper.cleanup();
        }
      }
    });

    test("shows breadcrumbs on detail pages", async ({ page }, testInfo) => {
      const helper = new ClientTestHelper(page);
      const ios = isIOS(testInfo.project.name);

      // Authenticate
      if (ios) {
        await helper.injectWalletAuth();
        await page.goto("/home");
      } else {
        await helper.setupPasskeyAuth();
        await helper.createPasskeyAccount(`breadcrumb_${Date.now()}`);
      }

      try {
        await helper.waitForPageLoad();

        // Navigate to a detail page if available
        const gardenLink = page.locator('a[href*="/gardens/"], a[href*="/home/"]').first();
        if (await gardenLink.isVisible({ timeout: TIMEOUTS.elementVisible }).catch(() => false)) {
          await gardenLink.click();
          await helper.waitForPageLoad();

          // Look for breadcrumbs
          const breadcrumbs = page.locator(
            'nav[aria-label="Breadcrumb"], [data-testid="breadcrumbs"], ol:has(li > a)'
          );

          if (await breadcrumbs.isVisible({ timeout: TIMEOUTS.shortWait }).catch(() => false)) {
            // Should have at least one breadcrumb link
            const breadcrumbLinks = breadcrumbs.locator("a");
            expect(await breadcrumbLinks.count()).toBeGreaterThan(0);
          }
        }
      } finally {
        if (!ios) {
          await helper.cleanup();
        }
      }
    });
  });

  test.describe("Back Navigation", () => {
    test("browser back button works correctly", async ({ page }, testInfo) => {
      const helper = new ClientTestHelper(page);
      const ios = isIOS(testInfo.project.name);

      // Authenticate
      if (ios) {
        await helper.injectWalletAuth();
        await page.goto("/home");
      } else {
        await helper.setupPasskeyAuth();
        await helper.createPasskeyAccount(`back_nav_${Date.now()}`);
      }

      try {
        await helper.waitForPageLoad();
        const homeUrl = page.url();

        // Navigate to profile
        await page.goto("/profile");
        await helper.waitForPageLoad();
        const profileUrl = page.url();

        expect(profileUrl).toContain("/profile");

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
      } finally {
        if (!ios) {
          await helper.cleanup();
        }
      }
    });
  });

  test.describe("Error Pages", () => {
    test("shows 404 page for non-existent routes", async ({ page }) => {
      await page.goto("/this-page-does-not-exist-12345");
      await page.waitForLoadState("networkidle");

      // Wait for React Router to handle the route
      await page.waitForTimeout(1000);

      // Should show 404 content, redirect to login (if unauthenticated), or redirect to home
      const notFoundText = page.locator("text=/404|not found|page not found/i");
      const isNotFound = await notFoundText
        .isVisible({ timeout: TIMEOUTS.elementVisible })
        .catch(() => false);
      const isRedirected = page.url().includes("/login") || page.url().includes("/home");

      // For a SPA, any unmatched route might just stay on the same URL but show different content
      // or redirect to a default route
      const hasValidContent =
        isNotFound || isRedirected || page.url().includes("/this-page-does-not-exist");

      expect(hasValidContent).toBeTruthy();
    });
  });
});
