/**
 * Client Work Submission CI Tests
 *
 * Lightweight CI-runnable tests for the authenticated work wizard. The suite
 * deliberately mocks its indexer, EAS, and RPC boundaries rather than relying
 * on a live wallet or local Envio stack.
 */

import { expect, test } from "@playwright/test";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+ZSkdJwAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("Work Submission CI Tests", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ baseURL: CLIENT_URL });

  test.describe("Login Page Accessibility", () => {
    // Real-login splash behavior remains a separate headless CI debt. The
    // authenticated specs below use the supported DevAuthProvider seam.
    // SKIP: #564 owner:afo expiry:2026-08-12 — real-login splash needs its own headless fixture
    test.skip("login page loads and shows auth options", async ({ page }) => {
      await page.goto("/home/login?presentation=pwa", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Home Page with Mocked Data", () => {
    test("renders home page with garden list when authenticated", async ({ page }) => {
      const helper = await setupAuthenticatedClient(page);
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      expect(page.url()).not.toContain("/home/login");
      await expect(page.getByTestId("garden-card").first()).toBeVisible();
    });

    test("navigates to login when not authenticated", async ({ page }) => {
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/home\/login/, { timeout: 15000 });
      expect(page.url()).toContain("/home/login");
    });
  });

  test.describe("Work Form Validation", () => {
    test("blocks progress when required action details are empty", async ({ page }) => {
      const helper = await setupAuthenticatedClient(page);
      await page.goto("/home/garden?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      const actionCard = page.getByTestId("action-card").first();
      const gardenCard = page.getByTestId("garden-card").first();
      await expect(actionCard).toBeVisible();
      await expect(gardenCard).toBeVisible();

      await actionCard.click();
      await gardenCard.click();

      const startButton = page.getByRole("button", { name: "Start Gardening" });
      await expect(startButton).toBeEnabled();
      await startButton.click();

      await page.locator("#work-media-upload").setInputFiles({
        name: "planting-proof.png",
        mimeType: "image/png",
        buffer: ONE_PIXEL_PNG,
      });

      const detailsButton = page.getByRole("button", { name: "Add Details" });
      await expect(detailsButton).toBeEnabled({ timeout: 15000 });
      await detailsButton.click();

      await expect(page.getByText("Seedlings Planted", { exact: true })).toBeVisible();
      const reviewButton = page.getByRole("button", { name: "Review Work" });
      await expect(reviewButton).toBeDisabled();
    });
  });
});
