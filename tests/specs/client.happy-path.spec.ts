/**
 * Client Happy Path Smoke
 *
 * One-spec walk through the full gardener journey at desktop width:
 * Login → Home → Garden → Wizard → Profile.
 *
 * Goal: prove the journey *connects* (no mid-route crashes, no broken
 * navigation, no app errors). Each individual screen is unit/component
 * tested elsewhere; this is the seam-test.
 *
 * Strategy:
 * - Mock the indexer GraphQL endpoint with minimal garden + action data so
 *   the journey can run without Docker / blockchain / live data.
 * - Use the DevAuthProvider seam plus schema-correct mocked backend data.
 *
 * Sister specs (each covers a single hop in deeper detail):
 * - client.smoke.spec.ts — auth + login UI
 * - client.work-submission.ci.spec.ts — wizard form validation
 * - client.work-approval.ci.spec.ts — steward approval flow
 * - client.offline-sync.ci.spec.ts — JobQueue offline-first behavior
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
    // 1. Unauthenticated /home redirects to /home/login
    await page.goto("/home?presentation=pwa");
    await page.waitForURL(/\/home\/login/, { timeout: 15000 });
    await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });
    await expectNoAppError(page);

    // 2. Set up the supported client CI seam and navigate to /home.
    const helper = await setupAuthenticatedClient(page);
    await page.goto("/home?presentation=pwa");
    await helper.waitForPageLoad();
    await expect(page).not.toHaveURL(/\/home\/login/);
    await expectNoAppError(page);

    // 3. Garden detail
    await page.goto(`/home/${MOCK_CLIENT_GARDEN.id}?presentation=pwa`);
    await helper.waitForPageLoad();
    await expect(page).toHaveURL(new RegExp(`/home/${MOCK_CLIENT_GARDEN.id}`));
    await expect(page.getByRole("heading", { name: MOCK_CLIENT_GARDEN.name })).toBeVisible();
    await expectNoAppError(page);

    // 4. Wizard at /home/garden — verify it renders without crash
    await page.goto("/home/garden");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/home\/garden/);
    await expectNoAppError(page);

    // 5. Profile — verify it renders without crash
    await page.goto("/home/profile");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/home\/profile/);
    await expectNoAppError(page);
  });
});
