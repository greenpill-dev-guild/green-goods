/**
 * Admin Authentication E2E Tests
 *
 * Deterministic CI coverage for the admin auth boundary. CI exercises the
 * dev-only mock-auth seam; real wagmi connector behaviour runs on an anvil fork.
 */

import { expect, test } from "@playwright/test";
import { mockSepoliaRpc } from "../helpers/mock-backend";
import { AdminTestHelper, TEST_URLS } from "../helpers/test-utils";

const ADMIN_URL = TEST_URLS.admin;

test.describe("Admin Authentication", () => {
  test.use({ baseURL: ADMIN_URL });
  test.beforeEach(async ({ context }) => {
    await mockSepoliaRpc(context);
  });

  test("renders the current hub connect shell without mock auth", async ({ page }) => {
    const helper = new AdminTestHelper(page);
    await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 45000 });
    await helper.waitForPageLoad();

    await expect(page).toHaveURL(/\/hub(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Connect to continue" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  test.describe("Dev mock-auth flow", () => {
    // Each test boots the signed-in cockpit one to three times, and each boot shows "Opening
    // your workspace…" for 10 to 20 seconds on the clean-room dev server; the first also
    // compiles the signed-in module graph, which the global warm-up (a signed-out boot) never
    // reaches. The default 30s left the three-load reload test no headroom in CI.
    test.describe.configure({ timeout: 90_000 });

    // Real wagmi reconnection coverage belongs to the anvil-fork project. This
    // clean-room check exercises the deterministic dev-auth persistence seam.
    test("maintains mock auth state across page reloads", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      await page.goto(helper.buildMockAuthPath("/hub", "steward"), {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await helper.waitForPageLoad();
      await expect(page.getByText("Connect to continue")).toHaveCount(0);

      // DevAuthProvider persists the URL role, so the unparameterized reload
      // remains authenticated as the mocked steward.
      await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 45000 });
      await helper.waitForPageLoad();
      await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
      await helper.waitForPageLoad();

      await expect(page.getByText("Connect to continue")).toHaveCount(0);
      await expect(page.locator("#root")).not.toBeEmpty();
    });

    test("uses the persisted deployer mock role on the canonical hub route", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      await helper.enableMockAuth("deployer");
      await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 45000 });
      await helper.waitForPageLoad();

      await expect(page).toHaveURL(/\/hub(?:\?.*)?$/);
      await expect(page.getByText("Connect to continue")).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => window.sessionStorage.getItem("greengoods_dev_mock_auth")))
        .toBe("deployer");
    });

    test("can disconnect mock auth through the dev-auth URL", async ({ page }) => {
      const helper = new AdminTestHelper(page);

      await page.goto(helper.buildMockAuthPath("/hub", "steward"), {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await helper.waitForPageLoad();
      await expect(page.getByText("Connect to continue")).toHaveCount(0);

      await page.goto(helper.buildMockAuthPath("/hub", "disconnected"), {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await helper.waitForPageLoad();

      await expect(page.getByText("Connect to continue")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => window.sessionStorage.getItem("greengoods_dev_mock_auth")))
        .toBe("disconnected");
    });

    // Real wallet sharing remains an anvil-fork concern; this covers the
    // context-level dev-auth init script used by deterministic CI flows.
    test("maintains mock auth state across multiple tabs", async ({ context }) => {
      // Create first page and helper WITH context for multi-tab support
      const page1 = await context.newPage();
      const helper1 = new AdminTestHelper(page1, context);

      // Context-level mock auth applies to every page created in this context.
      await helper1.enableMockAuth("steward");

      await page1.goto("/hub", { waitUntil: "domcontentloaded", timeout: 45000 });
      await helper1.waitForPageLoad();
      await expect(page1.getByText("Connect to continue")).toHaveCount(0);

      // Open a second tab after context-level initialization.
      const page2 = await context.newPage();
      await page2.goto("/hub", { waitUntil: "domcontentloaded", timeout: 45000 });
      const helper2 = new AdminTestHelper(page2);
      await helper2.waitForPageLoad();
      await expect(page2.getByText("Connect to continue")).toHaveCount(0);

      // Close tabs
      await page1.close();
      await page2.close();
    });
  });
});
