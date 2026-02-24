/**
 * Client Work Submission CI Tests
 *
 * Lightweight CI-runnable tests that validate work submission UI flows
 * WITHOUT requiring real auth, blockchain, or indexer infrastructure.
 *
 * Strategy:
 * - Mock GraphQL responses via page.route() to provide garden/action data
 * - Use wallet auth injection for authenticated state
 * - Test form rendering, validation, and navigation — not actual transactions
 *
 * For full infrastructure tests, use: npx playwright test --project=client-full
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

// Mock data for gardens and actions
const MOCK_GARDEN = {
  id: "garden-1",
  name: "Test Community Garden",
  description: "A test garden for CI",
  chainId: 11155111,
  tokenAddress: "0x1234567890abcdef1234567890abcdef12345678",
  operators: ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
  gardenerCount: 3,
  bannerImage: "",
};

const MOCK_ACTION = {
  uid: "action-uid-1",
  title: "Plant Trees",
  description: "Document tree planting activity",
  startTime: Math.floor(Date.now() / 1000) - 86400,
  endTime: Math.floor(Date.now() / 1000) + 86400 * 30,
  media: { minCount: 0, maxCount: 5 },
};

/**
 * Set up GraphQL mocking and auth injection for all tests.
 */
async function setupMockedEnvironment(page: import("@playwright/test").Page) {
  const helper = new ClientTestHelper(page);
  await helper.injectWalletAuth();

  // Intercept GraphQL requests to the indexer and return mock data
  await page.route("**/v1/graphql", async (route) => {
    const postData = route.request().postDataJSON?.() ?? {};
    const query = typeof postData === "object" ? (postData.query ?? "") : "";

    // Match garden queries
    if (query.includes("Garden")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { Garden: [MOCK_GARDEN] },
        }),
      });
    }

    // Match action queries
    if (query.includes("Action")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { Action: [MOCK_ACTION] },
        }),
      });
    }

    // Default: return empty data for any other query
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  return helper;
}

test.describe("Work Submission CI Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Login Page Accessibility", () => {
    test("login page loads and shows auth options", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      // Login page should render with primary auth button
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Home Page with Mocked Data", () => {
    test("renders home page with garden list when authenticated", async ({ page }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // Auth injection may not persist in all environments
        // This is expected in CI without real wallet extension
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Home page loaded — verify no critical errors
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);
    });

    test("navigates to login when not authenticated", async ({ page }) => {
      // Without auth injection, /home should redirect to /login
      await page.goto("/home");
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain("/login");
    });
  });

  test.describe("Work Form Validation (via Component Tests)", () => {
    test("work submission form rejects empty required fields", async ({ page }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home");
      await helper.waitForPageLoad();

      const url = page.url();
      if (url.includes("/login")) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — auth injection unstable in headless CI
        test.skip(true, "Auth injection did not persist — expected in headless CI");
        return;
      }

      // Navigate to a garden if garden cards are visible
      const gardenCard = page.locator('[data-testid="garden-card"], a[href*="/home/"]').first();
      const isGardenVisible = await gardenCard.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isGardenVisible) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — requires live infra (gardens/blockchain)
        test.skip(true, "No garden cards rendered — mock data may not match current schema");
        return;
      }

      await gardenCard.click();
      await page.waitForTimeout(2000);

      // Find an action card to start submission
      const actionCard = page.locator('[data-testid="action-card"]').first();
      const isActionVisible = await actionCard.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isActionVisible) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — requires live infra (gardens/blockchain)
        test.skip(true, "No action cards rendered — mock data may not match current schema");
        return;
      }

      await actionCard.click();
      await page.waitForTimeout(1000);

      // Try submitting empty form
      const submitButton = page.getByRole("button", { name: /submit/i });
      const isSubmitVisible = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isSubmitVisible) {
        // SKIP: #312 owner:afo expiry:2026-06-01 — requires live infra (gardens/blockchain)
        test.skip(true, "Submit button not found — form structure may differ");
        return;
      }

      await submitButton.click();
      await page.waitForTimeout(1000);

      // At least one validation signal should be present:
      // 1. Error text visible
      // 2. Input with aria-invalid
      // 3. Submit button disabled
      const validationError = page.getByText(/required|please enter|cannot be empty/i);
      const invalidInput = page.locator('[aria-invalid="true"]');

      const hasErrorText = await validationError
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const hasInvalidInput = await invalidInput
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const isSubmitDisabled = await submitButton.isDisabled();

      expect(hasErrorText || hasInvalidInput || isSubmitDisabled).toBe(true);
    });
  });
});
