/** CI Playwright: navigation with the supported dev-auth seam and fictional garden data. */
import { expect, type Page, test } from "@playwright/test";
import { MOCK_CLIENT_GARDEN } from "../helpers/mock-backend";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

// Home opens in the account's one garden, and its header chip names that garden.
async function expectHomeInGarden(page: Page) {
  const chip = page.locator('[data-component="HomeHeader"] [data-component="GardenChip"]');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(MOCK_CLIENT_GARDEN.name);
}

test.describe("Client Navigation", () => {
  test.use({ baseURL: TEST_URLS.client });

  test("redirects unauthenticated users from protected routes", async ({ page }) => {
    for (const route of ["/home?presentation=pwa", "/home/profile", "/home/garden"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/home\/login/);
      await expect(page.getByTestId("login-button")).toBeVisible();
    }
  });

  test("opens Profile from the mobile navigation", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/home?presentation=pwa");
    await helper.waitForPageLoad();

    const nav = page.getByTestId("authenticated-nav");
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await nav.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/home\/profile/);
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
    await helper.waitForPageLoad();
    await expect(page.getByRole("heading", { name: MOCK_CLIENT_GARDEN.name })).toBeVisible();

    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
    await expectHomeInGarden(page);
  });

  test("preserves Home and Profile through browser back and forward", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home?presentation=pwa");
    await helper.waitForPageLoad();
    await page
      .getByTestId("authenticated-nav")
      .getByRole("link", { name: "Profile", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Profile sections" })
        .getByRole("button", { name: "Account", exact: true })
    ).toHaveAttribute("aria-current", "true");

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
    await helper.waitForPageLoad();
    await expect(page.getByTestId("authenticated-nav")).toBeVisible();

    await page.reload();
    await helper.waitForPageLoad();
    await expect(page).not.toHaveURL(/\/home\/login/);
    await expect(
      page.getByTestId("authenticated-nav").getByRole("link", { name: "Profile" })
    ).toBeVisible();
  });

  test("logs out through the profile and returns to login", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home/profile?presentation=pwa");
    await helper.waitForPageLoad();

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/home\/login/);
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("greengoods_dev_mock_auth")))
      .toBe("disconnected");
  });
});
