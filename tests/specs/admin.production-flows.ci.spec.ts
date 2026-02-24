/**
 * Admin Production Flows CI Smoke Tests
 *
 * Validates that critical admin flow routes render without crashing:
 * - Create garden
 * - Create assessment
 * - Vault
 * - Mint hypercert
 *
 * These tests focus on route-level stability and are safe for CI.
 */

import { expect, test } from "@playwright/test";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";

const ADMIN_URL = TEST_URLS.admin;
const TEST_GARDEN_ID = "0x0000000000000000000000000000000000000001";

async function setupAuthenticatedAdmin(page: import("@playwright/test").Page) {
  const helper = new AdminTestHelper(page);
  await helper.injectWalletAuth();

  // Keep data deterministic for route smoke checks.
  await page.route("**/v1/graphql", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  return helper;
}

async function expectNoCrashOnRoute(page: import("@playwright/test").Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("domcontentloaded");

  const hasAppError = await page
    .locator('text="Unexpected Application Error"')
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  expect(hasAppError).toBe(false);
  await expect(page.locator("body")).toBeVisible();
}

test.describe("Admin Production Flows CI", () => {
  test.use({ baseURL: ADMIN_URL });

  test("critical flow routes render for authenticated users", async ({ page }) => {
    const helper = await setupAuthenticatedAdmin(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    const isAuthenticated = await helper.waitForAuthSettled({ timeout: 15000 });
    if (!isAuthenticated) {
      // SKIP: #312 owner:afo expiry:2026-06-01 - auth injection unstable in headless CI
      test.skip(true, "Auth injection did not persist - expected in headless CI");
      return;
    }

    const criticalRoutes = [
      "/gardens/create",
      `/gardens/${TEST_GARDEN_ID}/assessments/create`,
      `/gardens/${TEST_GARDEN_ID}/vault`,
      `/gardens/${TEST_GARDEN_ID}/hypercerts/create`,
    ];

    for (const route of criticalRoutes) {
      await test.step(`route: ${route}`, async () => {
        await expectNoCrashOnRoute(page, route);
        expect(page.url()).toContain(route);
      });
    }
  });
});
