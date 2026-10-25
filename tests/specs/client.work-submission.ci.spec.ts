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

  test.describe("Work Form Validation", () => {
    test("blocks progress when required action details are empty", async ({ page }) => {
      const helper = await setupAuthenticatedClient(page);
      await page.goto("/home/garden?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      // The picker is a listbox of cards; a press chooses one. The account's one garden is its
      // active garden, so Start asks only for the action (decision 28).
      const actionCard = page
        .getByRole("listbox", { name: "Select Your Action" })
        .getByRole("option")
        .first();
      await expect(actionCard).toBeVisible();
      await expect(page.getByRole("listbox", { name: "Select Your Garden" })).toHaveCount(0);

      await actionCard.click();

      const startButton = page.getByRole("button", { name: "Start Gardening" });
      await expect(startButton).toBeEnabled();
      await startButton.click();

      await page.locator("#work-media-upload").setInputFiles({
        name: "planting-proof.png",
        mimeType: "image/png",
        buffer: ONE_PIXEL_PNG,
      });

      const detailsButton = page.getByRole("button", { name: "Details", exact: true });
      await expect(detailsButton).toBeEnabled({ timeout: 15000 });
      await detailsButton.click();

      await expect(page.getByRole("spinbutton", { name: /^Seedlings Planted/ })).toBeVisible();
      const reviewButton = page.getByRole("button", { name: "Review Work" });
      await expect(reviewButton).toBeDisabled();
    });
  });
});
