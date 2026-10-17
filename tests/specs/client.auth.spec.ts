/**
 * Manual wallet-storage checks. These do not exercise a real wallet connector.
 * Qualified passkey rejection and reporting ceremonies live in the passkey preset.
 */
import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

test.describe("Client injected-wallet storage", () => {
  test.use({ baseURL: TEST_URLS.client });

  test("shows authenticated UI from injected wallet storage", async ({ page }) => {
    // Prefer wallet on iOS, but works on all platforms
    const helper = new ClientTestHelper(page);

    await helper.authenticateWithWallet();

    // Verify authenticated state
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/home");

    // Look for authenticated UI elements
    const authenticatedElements = [
      '[data-testid="authenticated-nav"]',
      '[data-testid="work-dashboard-button"]',
      'nav:has(a[href="/home/profile"])',
      'button[aria-label="Menu"]',
    ];

    let authElementFound = false;
    for (const selector of authenticatedElements) {
      if (
        await page
          .locator(selector)
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        authElementFound = true;
        break;
      }
    }
    expect(authElementFound).toBeTruthy();
  });

  test("signs out wallet user and redirects to login", async ({ page }) => {
    const helper = new ClientTestHelper(page);

    // Use wallet injection
    await helper.injectWalletAuth();
    await page.goto("/home");
    await helper.waitForPageLoad();

    const url = page.url();
    // SKIP: #338 owner:afo expiry:2027-01-16 — wallet injection may not persist in this manual lane
    test.skip(url.includes("/home/login"), "Wallet authentication did not persist");

    await page.goto("/home/profile");
    await helper.waitForPageLoad();

    const signOutButton = page.getByRole("button", { name: /logout|log out|sign out/i });
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();
    await expect(page).toHaveURL(/\/home\/login/);
  });
});
