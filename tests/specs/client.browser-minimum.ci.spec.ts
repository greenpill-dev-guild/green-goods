/**
 * Below the browser minimum (Chrome 111, Safari 16.4, Firefox 128) the installed App and the
 * reporting pages show the update screen and the app never starts; the website stays open.
 * PRD-1490. The minimum's features are taken away from this Chromium before the page runs. Every
 * other client spec loads the app on a current Chromium with the gate in place, which is the proof
 * that a browser at the minimum starts as before.
 */
import { expect, test } from "@playwright/test";
import { emulateChrome101, UPDATE_SCREEN_TITLE } from "../helpers/browser-minimum";
import { TEST_URLS } from "../helpers/test-utils";

// A cold dev server compiles the app's modules on its first load, which can take a busy CI runner
// most of a minute (client.session-navigation.ci.spec.ts). Page loads wait for them, and the
// configured 30s navigation timeout would cut that short, so each wait names its own.
const COLD_START_MS = 60_000;
test.describe.configure({ timeout: COLD_START_MS + 30_000 });

test.describe("Browser minimum", () => {
  test.use({ baseURL: TEST_URLS.client });

  test("the App below the minimum shows the update screen and does not start", async ({ page }) => {
    await emulateChrome101(page);
    await page.goto("/home?presentation=pwa", { timeout: COLD_START_MS });

    await expect(page.getByRole("heading", { name: UPDATE_SCREEN_TITLE })).toBeVisible();
    await expect(page.locator("#browser-update")).toHaveAttribute("data-surface", "app");
    await page.waitForLoadState("networkidle", { timeout: COLD_START_MS });
    // A started app would have drawn into #root and sent /home on to /home/login.
    await expect(page.locator("#root")).toBeEmpty();
    expect(new URL(page.url()).pathname).toBe("/home");
  });

  test("a reporting page below the minimum shows the update screen", async ({ page }) => {
    await emulateChrome101(page);
    await page.goto("/agent/reporting/permissions", { timeout: COLD_START_MS });

    await expect(page.getByRole("heading", { name: UPDATE_SCREEN_TITLE })).toBeVisible();
    await expect(page.locator("#browser-update")).toHaveAttribute("data-surface", "signing");
  });

  test("the website stays open below the minimum", async ({ page }) => {
    await emulateChrome101(page);
    await page.goto("/", { timeout: COLD_START_MS });

    await expect(page.locator("#root")).not.toBeEmpty({ timeout: COLD_START_MS });
    await expect(page.locator("#browser-update")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-browser-update", /.*/);
  });
});
