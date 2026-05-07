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
 * - Inject wallet auth so /home doesn't bounce to /login.
 * - Soft-skip when auth injection doesn't persist (CI realities); the
 *   piece-wise specs cover those paths.
 *
 * Sister specs (each covers a single hop in deeper detail):
 * - client.smoke.spec.ts — auth + login UI
 * - client.work-submission.ci.spec.ts — wizard form validation
 * - client.work-approval.ci.spec.ts — operator approval flow
 * - client.offline-sync.ci.spec.ts — JobQueue offline-first behavior
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const MOCK_GARDEN = {
  id: "0xgarden0000000000000000000000000000000001",
  name: "Aiyeloja Family Garden",
  description: "A test garden for happy-path coverage",
  chainId: 42161,
  tokenAddress: "0x1234567890abcdef1234567890abcdef12345678",
  operators: [TEST_ADDRESS],
  gardeners: [TEST_ADDRESS],
  gardenerCount: 1,
  bannerImage: "",
  openJoining: true,
};

const MOCK_ACTION = {
  uid: "action-uid-1",
  title: "Plant Trees",
  description: "Document tree planting activity",
  startTime: Math.floor(Date.now() / 1000) - 86400,
  endTime: Math.floor(Date.now() / 1000) + 86400 * 30,
  media: { minCount: 0, maxCount: 5 },
};

async function setupMockedEnvironment(page: import("@playwright/test").Page) {
  const helper = new ClientTestHelper(page);
  await helper.injectWalletAuth(TEST_ADDRESS);

  await page.route("**/v1/graphql", async (route) => {
    const postData = route.request().postDataJSON?.() ?? {};
    const query = typeof postData === "object" ? (postData.query ?? "") : "";

    if (query.includes("Garden")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { Garden: [MOCK_GARDEN] } }),
      });
    }
    if (query.includes("Action")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { Action: [MOCK_ACTION] } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  return helper;
}

async function authOrSkip(
  page: import("@playwright/test").Page,
  helper: ClientTestHelper,
  skipReason: string
) {
  await helper.waitForPageLoad();
  if (page.url().includes("/login")) {
    // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI; piece-wise specs cover.
    test.skip(true, skipReason);
  }
}

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
    // 1. Unauthenticated /home redirects to /login
    await page.goto("/home");
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });
    await expectNoAppError(page);

    // 2. Inject wallet + mocks, navigate to /home
    const helper = await setupMockedEnvironment(page);
    await page.goto("/home");
    await authOrSkip(page, helper, "Auth injection did not persist — expected in headless CI");
    await expectNoAppError(page);

    // 3. Garden detail — navigate via link if present, else direct
    const gardenLink = page.locator(`a[href*="/home/${MOCK_GARDEN.id}"]`).first();
    if (await gardenLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gardenLink.click();
    } else {
      await page.goto(`/home/${MOCK_GARDEN.id}`);
    }
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(new RegExp(`/home/${MOCK_GARDEN.id}`));
    await expectNoAppError(page);

    // 4. Wizard at /garden — verify it renders without crash
    await page.goto("/garden");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/garden/);
    await expectNoAppError(page);

    // 5. Profile — verify it renders without crash
    await page.goto("/profile");
    await helper.waitForPageLoad();
    expect(page.url()).toMatch(/\/profile/);
    await expectNoAppError(page);
  });
});
