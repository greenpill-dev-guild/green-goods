/** CI Playwright: navigation with the supported dev-auth seam and fictional garden data. */
import { expect, type Page, test } from "@playwright/test";
import { MOCK_CLIENT_GARDEN } from "../helpers/mock-backend";
import { ClientTestHelper, setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

// A full page load fetches about 1,000 modules from the dev server, which takes a CI runner 4 to 8
// seconds even when warm. A cold server also compiles each lazy route on first use, which can
// outlast the page-load helper's 30s on a busy machine. So every load waits for the app on this
// budget, as does the first visit to a lazy route, and each test has room for three loads.
const COLD_ROUTE_MS = 60_000;
// A whole load: the boot wait, plus the navigation and the helper's checks.
const FULL_LOAD_MS = COLD_ROUTE_MS + 20_000;
test.describe.configure({ timeout: 3 * FULL_LOAD_MS });

async function waitForAppBoot(helper: ClientTestHelper) {
  // Before the document parses there is no #boot-fallback, which would read as hidden.
  await helper.page.waitForLoadState("domcontentloaded");
  await helper.page.locator("#boot-fallback").waitFor({ state: "hidden", timeout: COLD_ROUTE_MS });
  await helper.waitForPageLoad();
}

// Home opens in the account's one garden, and its header chip names that garden.
async function expectHomeInGarden(page: Page) {
  const chip = page.locator('[data-component="HomeHeader"] [data-component="GardenChip"]');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(MOCK_CLIENT_GARDEN.name);
}

// Only a mounted app can redirect, so wait out the boot. The assertions keep their own timeouts.
async function expectLoginAfterBoot(helper: ClientTestHelper) {
  await waitForAppBoot(helper);
  await expect(helper.page).toHaveURL(/\/home\/login/);
  await expect(helper.page.getByTestId("login-button")).toBeVisible();
}

test.describe("Client Navigation", () => {
  test.use({ baseURL: TEST_URLS.client });

  test("redirects unauthenticated users from protected routes", async ({ page }) => {
    const helper = new ClientTestHelper(page);
    for (const route of ["/home?presentation=pwa", "/home/profile", "/home/garden"]) {
      await page.goto(route);
      await expectLoginAfterBoot(helper);
    }
  });

  test("opens Profile from the mobile navigation", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/home?presentation=pwa");
    await waitForAppBoot(helper);

    const nav = page.getByTestId("authenticated-nav");
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await nav.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/home\/profile/, { timeout: COLD_ROUTE_MS });
    await expect(nav.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(
      page
        .getByRole("group", { name: "Profile sections" })
        .getByRole("button", { name: "Account", exact: true })
    ).toHaveAttribute("aria-current", "true");
  });

  test("returns home from a garden detail page", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto(`/home/${MOCK_CLIENT_GARDEN.id}?presentation=pwa`);
    await waitForAppBoot(helper);
    await expect(page.getByRole("heading", { name: MOCK_CLIENT_GARDEN.name })).toBeVisible();

    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
    await expectHomeInGarden(page);
  });

  test("preserves Home and Profile through browser back and forward", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home?presentation=pwa");
    await waitForAppBoot(helper);
    await page
      .getByTestId("authenticated-nav")
      .getByRole("link", { name: "Profile", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Profile sections" })
        .getByRole("button", { name: "Account", exact: true })
    ).toHaveAttribute("aria-current", "true", { timeout: COLD_ROUTE_MS });

    await page.goBack();
    await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
    await expectHomeInGarden(page);
    await page.goForward();
    await expect(page).toHaveURL(/\/home\/profile/);
    await expect(
      page
        .getByRole("group", { name: "Profile sections" })
        .getByRole("button", { name: "Account", exact: true })
    ).toHaveAttribute("aria-current", "true");
  });
});

test.describe("Client mock-auth session", () => {
  test.use({ baseURL: TEST_URLS.client });

  test("renders authenticated navigation after reload", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home?presentation=pwa");
    await waitForAppBoot(helper);
    await expect(page.getByTestId("authenticated-nav")).toBeVisible();

    await page.reload();
    await waitForAppBoot(helper);
    await expect(page).not.toHaveURL(/\/home\/login/);
    await expect(
      page.getByTestId("authenticated-nav").getByRole("link", { name: "Profile" })
    ).toBeVisible();
  });

  test("logs out through the profile and returns to login", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home/profile?presentation=pwa");
    await waitForAppBoot(helper);

    // The dev-auth seam signs out with a full page load, and click() waits for it to start.
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expectLoginAfterBoot(helper);
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("greengoods_dev_mock_auth")))
      .toBe("disconnected");
  });
});
