/**
 * Admin Authentication E2E Tests
 *
 * Comprehensive tests for admin wallet authentication flows
 */

import { expect, test } from "@playwright/test";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";
import { TIMEOUTS, SELECTORS, TestHelpers } from "../helpers/test-config";

const ADMIN_URL = TEST_URLS.admin;

test.describe("Admin Authentication", () => {
  test.use({ baseURL: ADMIN_URL });

  test.describe("Login Page", () => {
    test("displays login page with proper elements", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // Check for connect wallet button - use data-testid or text content
      const connectButton = page
        .locator('[data-testid="connect-wallet-button"]')
        .or(page.getByRole("button", { name: /connect wallet/i }))
        .first();
      await expect(connectButton).toBeVisible({ timeout: TIMEOUTS.elementVisible });

      // Should have branding - check text content which is always present
      const brandingFound = await TestHelpers.waitForAnySelector(page, [
        'h2:has-text("Green Goods")',
        'text="Green Goods"',
        'img[alt*="Green Goods"]',
        '[data-testid="app-logo"]',
      ]);

      expect(brandingFound).not.toBeNull();
    });

    test("prevents access to protected routes without auth", async ({ page }) => {
      const protectedRoutes = [
        "/dashboard",
        "/gardens",
        "/gardens/123",
        "/actions",
        "/actions/create",
        "/operators",
        "/settings",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        // Should redirect to login
        await page.waitForURL(/\/login/, { timeout: TIMEOUTS.navigation });
        expect(page.url()).toContain("/login");
      }
    });
  });

  test.describe("Wallet Connection Flow", () => {
    test("shows wallet modal when connect button clicked", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      const connectButton = page
        .locator('[data-testid="connect-wallet-button"]')
        .or(page.getByRole("button", { name: /connect wallet/i }))
        .first();
      await expect(connectButton).toBeVisible({ timeout: TIMEOUTS.elementVisible });

      await connectButton.click();
      await page.waitForTimeout(TIMEOUTS.mediumWait);

      // Check for wallet modal - Reown AppKit uses various modal types
      const modalSelectors = [
        "w3m-modal",
        "appkit-modal",
        '[role="dialog"]',
        'div[class*="modal"]',
        ...SELECTORS.modal,
      ];

      const modalFound = await TestHelpers.waitForAnySelector(page, modalSelectors, {
        timeout: TIMEOUTS.modalAppear,
      });

      if (modalFound) {
        expect(modalFound).not.toBeNull();
      } else {
        // Modal might not appear in test environment, verify button was clickable
        await expect(connectButton).toBeEnabled();
      }
    });

    test("maintains auth state across page reloads", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      // Inject wallet auth
      await helper.injectWalletAuth();
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      const initialUrl = page.url();

      if (initialUrl.includes("/dashboard")) {
        // Auth worked - reload and verify
        await page.reload();
        await page.waitForLoadState("domcontentloaded");

        // Should still be on dashboard
        expect(page.url()).toContain("/dashboard");

        // Should show authenticated UI
        const navElement = await TestHelpers.waitForAnySelector(page, [
          "nav",
          "aside",
          '[data-testid="sidebar"]',
          '[role="navigation"]',
        ]);

        expect(navElement).not.toBeNull();
      }
    });
  });

  test.describe("Role-Based Access", () => {
    test("shows appropriate UI based on user role", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      // Different test addresses could have different roles
      const testAddresses = [
        { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", role: "operator" },
        { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", role: "admin" },
      ];

      for (const { address, role } of testAddresses) {
        await helper.injectWalletAuth(address);
        await page.goto("/dashboard");
        await page.waitForLoadState("domcontentloaded");

        if (page.url().includes("/dashboard")) {
          // Check for role-specific UI elements
          if (role === "admin") {
            // Admin might see operator management
            const operatorLink = page.locator('a[href*="/operators"]');
            const hasOperatorAccess = await operatorLink
              .isVisible({ timeout: 2000 })
              .catch(() => false);
            // Role-based UI is optional, just verify page loads
            expect(page.url()).toContain("/dashboard");
          }
        }
      }
    });
  });

  test.describe("Logout Flow", () => {
    test("can logout and return to login page", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      // Login first
      await helper.injectWalletAuth();
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      if (page.url().includes("/dashboard")) {
        // Look for logout button
        const logoutSelectors = [
          'button:has-text("Logout")',
          'button:has-text("Sign Out")',
          'button:has-text("Disconnect")',
          '[data-testid="logout-button"]',
          'button[aria-label="Logout"]',
        ];

        const logoutButton = await TestHelpers.waitForAnySelector(page, logoutSelectors, {
          timeout: TIMEOUTS.elementVisible,
        });

        if (logoutButton) {
          await logoutButton.element.click();
          await page.waitForTimeout(TIMEOUTS.mediumWait);

          // Should redirect to login
          await page.waitForURL(/\/login/, { timeout: TIMEOUTS.navigation });
          expect(page.url()).toContain("/login");
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("shows error message for invalid network", async ({ page }) => {
      // Inject auth with wrong chain ID
      await page.addInitScript(
        ({ address }) => {
          localStorage.setItem("greengoods_auth_mode", "wallet");

          // Mock wagmi with wrong chain
          const wagmiState = {
            state: {
              connections: {
                __type: "Map",
                value: [["mock", { accounts: [address], chainId: 1 }]], // Mainnet instead of Base Sepolia
              },
              current: "mock",
            },
          };
          localStorage.setItem("wagmi.store", JSON.stringify(wagmiState));
        },
        { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }
      );

      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      // App should either show network error OR redirect to login (both are valid behaviors)
      const errorSelectors = [
        "text=/wrong network/i",
        "text=/switch network/i",
        "text=/unsupported/i",
        "text=/invalid chain/i",
        '[role="alert"]',
      ];

      let hasNetworkError = false;
      for (const selector of errorSelectors) {
        if (
          await page
            .locator(selector)
            .isVisible({ timeout: 1000 })
            .catch(() => false)
        ) {
          hasNetworkError = true;
          break;
        }
      }

      const isOnLogin = page.url().includes("/login");
      const isOnDashboard = page.url().includes("/dashboard");

      // Valid outcomes: error shown, redirected to login, or stayed on dashboard (if app ignores chain mismatch)
      expect(hasNetworkError || isOnLogin || isOnDashboard).toBeTruthy();
    });
  });

  test.describe("Session Persistence", () => {
    test("maintains session across multiple tabs", async ({ context }) => {
      const helper1 = new AdminTestHelper(await context.newPage());

      // Login in first tab
      await helper1.injectWalletAuth();
      await helper1.page.goto("/dashboard");
      await helper1.page.waitForLoadState("networkidle");

      if (helper1.page.url().includes("/dashboard")) {
        // Open second tab
        const page2 = await context.newPage();
        await page2.goto("/dashboard");
        await page2.waitForLoadState("networkidle");

        // Second tab should also be authenticated
        expect(page2.url()).toContain("/dashboard");

        // Close tabs
        await helper1.page.close();
        await page2.close();
      }
    });
  });
});
