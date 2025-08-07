import { expect, Page } from "@playwright/test";

export interface TestAccount {
  email: string;
  otp: string;
}

export const getTestAccount = (): TestAccount => {
  const email = process.env.PRIVY_TEST_EMAIL || "test-5929@privy.io";
  const otp = process.env.PRIVY_TEST_OTP || "123456";

  if (!process.env.PRIVY_TEST_EMAIL) {
    console.warn(
      "⚠️ Using default test credentials. Set PRIVY_TEST_EMAIL and PRIVY_TEST_OTP in .env"
    );
  }

  return { email, otp };
};

export class TestHelper {
  constructor(public page: Page) {}

  // Simple authentication
  async login() {
    const { email, otp } = getTestAccount();

    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");

    // Email login
    await this.page.locator('button:has-text("Email"), [data-testid="email-login"]').click();
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('button[type="submit"], button:has-text("Continue")').click();

    // OTP
    await this.page.locator('input[placeholder*="code" i]').fill(otp);
    await this.page.locator('button:has-text("Verify"), button:has-text("Continue")').click();

    // Wait for login
    await this.page.waitForURL(/\/(home|dashboard)/, { timeout: 15000 });
  }

  // Simple work submission
  async submitWork(workData: { feedback: string; plantCount?: number }) {
    await this.page.goto("/home");

    // Find and click work submission button
    const submitButton = this.page.locator(
      'button:has-text("Submit Work"), [data-testid="submit-work"]'
    );
    await submitButton.click();

    // Fill form
    await this.page.locator('textarea[placeholder*="feedback"]').fill(workData.feedback);
    if (workData.plantCount) {
      await this.page.locator('input[type="number"]').fill(workData.plantCount.toString());
    }

    // Submit
    await this.page.locator('button:has-text("Submit")').click();
  }

  // Check for success or error
  async checkResult() {
    const success = await this.page
      .locator('.success, [data-testid="success"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const error = await this.page
      .locator('.error, [data-testid="error"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    let errorMessage = "";
    if (error) {
      errorMessage = (await this.page.locator('.error, [data-testid="error"]').textContent()) || "";
    }

    return { success, error, errorMessage };
  }

  // Offline helpers
  async goOffline() {
    await this.page.context().setOffline(true);
  }

  async goOnline() {
    await this.page.context().setOffline(false);
  }

  // Check service connectivity
  async checkServices() {
    try {
      const response = await this.page.request.get("/", { timeout: 5000 });
      return response.status() < 400;
    } catch {
      return false;
    }
  }

  // Wait for page to be ready
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    // Wait for any loading spinners to disappear
    await this.page
      .locator('[data-testid="loading"], .loading, .spinner')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // Loading spinner might not exist, that's okay
      });
  }
}
