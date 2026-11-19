/**
 * One walk through the gardener journey at desktop width, to prove the screens connect: no
 * mid-route crash, broken navigation or app error. Each screen has deeper coverage elsewhere.
 */

import { expect, test } from "@playwright/test";
import { MOCK_CLIENT_GARDEN } from "../helpers/mock-backend";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

async function expectNoAppError(page: import("@playwright/test").Page) {
  const hasAppError = await page
    .locator('text="Unexpected Application Error"')
    .isVisible({ timeout: 1500 })
    .catch(() => false);
  const hasQueryClientError = await page
    .locator('text="No QueryClient set"')
    .isVisible({ timeout: 1500 })
    .catch(() => false);
  expect(hasAppError, "Unexpected Application Error rendered").toBe(false);
  expect(hasQueryClientError, "No QueryClient set rendered").toBe(false);
}

test.describe("Client happy path", () => {
  test.use({ baseURL: CLIENT_URL });

  test("walks Login → Home → Garden detail → Wizard → Profile without crashing", async ({
    page,
  }) => {
    await page.goto("/home?presentation=pwa");
    await page.waitForURL(/\/home\/login/, { timeout: 15000 });
    await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });
    await expectNoAppError(page);

    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home?presentation=pwa");
    await helper.waitForPageLoad();
    await expect(page).not.toHaveURL(/\/home\/login/);
    await expectNoAppError(page);

    await page.goto(`/home/${MOCK_CLIENT_GARDEN.id}?presentation=pwa`);
    await helper.waitForPageLoad();
    await expect(page).toHaveURL(new RegExp(`/home/${MOCK_CLIENT_GARDEN.id}`));
    await expect(page.getByRole("heading", { name: MOCK_CLIENT_GARDEN.name })).toBeVisible();
    await expectNoAppError(page);

    await page.goto("/home/garden");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/home\/garden/);
    await expectNoAppError(page);

    await page.goto("/home/profile");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/home\/profile/);
    await expectNoAppError(page);
  });
});
