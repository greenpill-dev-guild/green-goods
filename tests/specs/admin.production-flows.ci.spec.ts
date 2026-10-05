/**
 * Admin Production Flows CI Smoke Tests
 *
 * Validates that critical admin cockpit routes render without crashing:
 * - Create garden
 * - Create assessment
 * - Garden vault
 * - Mint hypercert
 *
 * These tests focus on route-level stability and are safe for CI.
 */

import { expect, type Page, test } from "@playwright/test";
import { mockClientBackend } from "../helpers/mock-backend";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";

const ADMIN_URL = TEST_URLS.admin;
const ROUTE_SMOKE_TEST_TIMEOUT_MS = 90_000;
const MOCK_DEPLOYER_ADDRESS = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
const MOCK_STEWARD_ADDRESS = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const TEST_GARDEN_ADDRESS = "0xabcd1234567890123456789012345678901234ef";
const TEST_GARDEN_ID = "0x1234567890123456789012345678901234567890";
const TEST_GARDEN_CONTEXT = `gardenId=${encodeURIComponent(TEST_GARDEN_ID)}`;

const MOCK_GARDEN = {
  id: TEST_GARDEN_ID,
  chainId: 11155111,
  tokenAddress: TEST_GARDEN_ADDRESS,
  tokenID: "1",
  name: "Mock CI Garden",
  description: "Fixture garden for admin production-flow route smoke",
  location: "Nairobi",
  bannerImage: "",
  gardeners: [MOCK_STEWARD_ADDRESS],
  // The indexer field keeps the deployed `operators` wire name.
  operators: [MOCK_STEWARD_ADDRESS, MOCK_DEPLOYER_ADDRESS],
  evaluators: [MOCK_STEWARD_ADDRESS, MOCK_DEPLOYER_ADDRESS],
  owners: [MOCK_DEPLOYER_ADDRESS],
  funders: [],
  communities: [],
  openJoining: false,
  createdAt: 1710000000,
};

async function setupAuthenticatedAdmin(page: Page) {
  const helper = new AdminTestHelper(page);
  const backend = await mockClientBackend(page, {
    garden: MOCK_GARDEN,
    required: ["indexer: Gardens"],
  });
  return Object.assign(helper, { backend });
}

async function expectRouteContent(
  page: Page,
  helper: AdminTestHelper,
  route: string,
  heading: string
) {
  await page.goto(helper.buildMockAuthPath(route, "deployer"), {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  expect(new URL(page.url()).origin).toBe(new URL(ADMIN_URL).origin);
  // Assessment and certification render in modal dialogs, which correctly hide
  // the background main landmark from the accessibility tree.
  await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("Unexpected Application Error", { exact: true })).toHaveCount(0);
}

test.describe("Admin Production Flows CI", () => {
  test.use({ baseURL: ADMIN_URL });

  test("critical flow routes render for authenticated deployers", async ({ page }) => {
    test.setTimeout(ROUTE_SMOKE_TEST_TIMEOUT_MS);
    const helper = await setupAuthenticatedAdmin(page);

    const criticalRoutes = [
      ["/garden/create", "Create Garden"],
      [`/hub/assess/create?${TEST_GARDEN_CONTEXT}`, "Create Assessment"],
      [`/community/endowment/vault?${TEST_GARDEN_CONTEXT}`, "Community"],
      [`/hub/certify/create?${TEST_GARDEN_CONTEXT}`, "Create Hypercert"],
    ];

    for (const [route, heading] of criticalRoutes) {
      await test.step(`route: ${route}`, async () => {
        await expectRouteContent(page, helper, route, heading);
        if (route.includes("/vault")) {
          await expect(page.getByText("No vault available yet", { exact: true })).toBeVisible();
        }
        const currentUrl = new URL(page.url());
        const expectedUrl = new URL(route, ADMIN_URL);
        expect(currentUrl.pathname).toBe(expectedUrl.pathname);
        for (const [key, value] of expectedUrl.searchParams) {
          expect(currentUrl.searchParams.get(key)).toBe(value);
        }
      });
    }
    helper.backend.assertSatisfied();
  });

  test("create garden rejects an incomplete profile and lets the deployer correct and cancel it", async ({
    page,
  }) => {
    const helper = await setupAuthenticatedAdmin(page);
    await page.goto(helper.buildMockAuthPath("/garden/create", "deployer"));
    await expect(page.getByRole("heading", { name: "Create Garden", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Deploy Garden", exact: true }).click();
    await expect(page.getByText("Garden name is required", { exact: true })).toBeVisible();
    await expect(page.getByText("Description is required", { exact: true })).toBeVisible();
    // A deliberately short name keeps the generated slug invalid: this scenario proves
    // local validation/cancel recovery and must never reach a wallet or a deployment.
    await page.getByLabel("Garden name", { exact: false }).fill("CI");
    await page.getByLabel("Description", { exact: false }).fill("A browser fixture garden");
    await page.getByLabel("Location", { exact: false }).fill("Nairobi");
    await expect(page.getByText("Garden name is required", { exact: true })).toBeHidden();
    await expect(page.getByText("Description is required", { exact: true })).toBeHidden();
    await test.info().attach("garden-validation-recovery", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(/\/garden(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Create Garden", exact: true })).toBeHidden();
    await expect(page.getByText(MOCK_GARDEN.name, { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    helper.backend.assertSatisfied();
  });
});
