/**
 * Below the browser minimum (Chrome 111, Safari 16.4, Firefox 128) every Hub page shows the
 * update screen and the Hub never starts. PRD-1490. The minimum's features are taken away from
 * this Chromium before the page runs. Every other Hub spec loads the Hub on a current Chromium with
 * the gate in place, which is the proof that a browser at the minimum starts as before.
 */
import { expect, test } from "@playwright/test";
import { emulateChrome101, UPDATE_SCREEN_TITLE } from "../helpers/browser-minimum";
import { TEST_URLS } from "../helpers/test-utils";

test.describe("Browser minimum", () => {
  test.use({ baseURL: TEST_URLS.admin });

  test("the Hub below the minimum shows the update screen and does not start", async ({ page }) => {
    await emulateChrome101(page);
    await page.goto("/review");

    await expect(page.getByRole("heading", { name: UPDATE_SCREEN_TITLE })).toBeVisible();
    await expect(page.locator("#browser-update")).toHaveAttribute("data-surface", "hub");
    await page.waitForLoadState("networkidle");
    // The Hub's boot paints a shell into #root before anything else.
    await expect(page.locator("#root")).toBeEmpty();
  });
});
