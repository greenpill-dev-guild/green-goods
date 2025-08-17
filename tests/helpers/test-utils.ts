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

  private async findFrameWith(selector: string, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frames = this.page.frames();
      for (const frame of frames) {
        try {
          const count = await frame.locator(selector).count();
          if (count > 0) return frame;
        } catch {}
      }
      await this.page.waitForTimeout(200);
    }
    return null;
  }

  private async clickInAnyContext(selectors: string[], timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    const tryClick = async (ctx: any) => {
      for (const sel of selectors) {
        const loc = ctx.locator(sel).first();
        const count = await loc.count().catch(() => 0);
        if (count > 0) {
          try {
            await loc.scrollIntoViewIfNeeded().catch(() => {});
            await loc.click({ timeout: 2000, force: true });
            return true;
          } catch {}
          try {
            // Fallback to programmatic click
            const handle = await loc.elementHandle();
            if (handle) {
              await handle.evaluate((el: any) => el.click());
              return true;
            }
          } catch {}
        }
      }
      return false;
    };
    while (Date.now() < deadline) {
      const contexts: Array<Page | any> = [this.page, ...this.page.frames()];
      for (const ctx of contexts) {
        if (await tryClick(ctx)) return true;
      }
      await this.page.waitForTimeout(200);
    }
    return false;
  }

  private async openPrivyModal() {
    // Click Splash login button and wait for Privy modal container
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const splashLogin = this.page.getByTestId("login-button").first();
      if ((await splashLogin.count().catch(() => 0)) > 0) {
        await splashLogin.click({ timeout: 5000 }).catch(() => {});
      } else {
        await this.page
          .getByRole("button", { name: /login/i })
          .first()
          .click({ timeout: 5000 })
          .catch(() => {});
      }

      const modal = this.page.locator("#privy-modal-content");
      const visible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) return true;
      await this.page.waitForTimeout(1000);
    }
    return false;
  }

  // Simple authentication
  async login() {
    const { email, otp } = getTestAccount();

    // Early exit if already authenticated
    await this.page.goto("/home");
    const alreadyAuthed = await this.page
      .locator('[data-testid="user-menu"], [data-testid="profile"], .user-menu')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (alreadyAuthed) return;

    await this.page.goto("/login");
    // Be less strict than networkidle to avoid flakiness during dev
    await this.page.waitForLoadState("domcontentloaded");
    // Give the app a moment to bind the login handler
    await this.page.waitForTimeout(200);
    await this.page.locator("body").waitFor({ state: "visible", timeout: 10000 });
    // Reduce flakiness from transitions/animations
    await this.page
      .addStyleTag({
        content: "*,*::before,*::after{transition:none!important;animation:none!important}",
      })
      .catch(() => {});

    // If the Privy modal isn't open yet, click the app login button first
    const opened = await this.openPrivyModal();
    if (!opened) throw new Error("Privy modal did not open after clicking login");

    // Email login directly in the Privy modal
    const modal = this.page.locator("#privy-modal-content");
    await modal.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});

    const emailInput = modal.locator("#email-input");
    const emailInputExists = await emailInput.count().catch(() => 0);
    if (emailInputExists > 0) {
      await emailInput.fill(email, { timeout: 15000 });
      // Press Enter to submit the email (more reliable than clicking the embedded button)
      await emailInput.press("Enter").catch(() => {});
      const submitBtn = modal
        .locator('button:has-text("Submit"), button:has-text("Continue"), button:has-text("Next")')
        .first();
      // If button is present and enabled, click as a fallback
      if ((await submitBtn.count()) > 0) {
        try {
          await expect(submitBtn).toBeEnabled({ timeout: 5000 });
          await submitBtn.click({ timeout: 5000 });
        } catch {}
      }
    } else {
      // Fallback: choose the email method then fill the input
      const choseEmail = await this.clickInAnyContext(
        [
          '#privy-modal-content button.login-method-button:has-text("Email")',
          '#privy-modal-content button:has-text("Continue with Email")',
          'button.login-method-button:has-text("Email")',
        ],
        8000
      );
      if (!choseEmail) throw new Error("Email method not found in Privy modal");
      await modal.locator("#email-input").first().fill(email, { timeout: 15000 });
      const submitBtn = modal
        .locator('button:has-text("Submit"), button:has-text("Continue"), button:has-text("Next")')
        .first();
      await expect(submitBtn).toBeVisible({ timeout: 15000 });
      await expect(submitBtn).toBeEnabled({ timeout: 15000 });
      await submitBtn.click({ timeout: 15000 });
    }

    // OTP
    // OTP entry in the same Privy modal (supports single or multi-field)
    const otpCandidates = modal.locator(
      'input[id*="otp" i], input[name*="otp" i], input[autocomplete*="one-time" i], input[placeholder*="code" i], input[type="tel"]:not(#phone-number-input), input[maxlength="1"]'
    );
    await otpCandidates
      .first()
      .waitFor({ state: "visible", timeout: 20000 })
      .catch(() => {});
    const otpBoxCount = (await otpCandidates.count().catch(() => 0)) || 0;
    if (otpBoxCount > 1 && otp.length >= otpBoxCount) {
      for (let i = 0; i < otpBoxCount && i < otp.length; i++) {
        const box = otpCandidates.nth(i);
        try {
          await box.fill(otp[i]!, { timeout: 5000 });
        } catch {
          if (!this.page.isClosed()) {
            await box.type(otp[i]!, { timeout: 5000 }).catch(() => {});
          }
        }
      }
      if (!this.page.isClosed()) {
        await otpCandidates
          .nth(Math.min(otpBoxCount - 1, otp.length - 1))
          .press("Enter")
          .catch(() => {});
      }
    } else {
      const otpInput = otpCandidates.first();
      try {
        await otpInput.fill(otp, { timeout: 15000 });
      } catch {
        if (!this.page.isClosed() && (await modal.isVisible().catch(() => false))) {
          await otpInput.type(otp, { timeout: 15000 }).catch(() => {});
        }
      }
      if (!this.page.isClosed()) {
        await otpInput.press("Enter").catch(() => {});
      }
    }

    // If a confirm button is present, click it as a fallback
    const confirmBtn = modal
      .locator('button:has-text("Verify"), button:has-text("Continue"), button:has-text("Submit")')
      .first();
    if ((await confirmBtn.count().catch(() => 0)) > 0) {
      try {
        await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
        await confirmBtn.click({ timeout: 10000 });
      } catch {}
    }

    // Wait for login success (modal closes and/or redirect to home)
    const modalClosed = await modal
      .waitFor({ state: "hidden", timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const redirected = await this.page
      .waitForURL(/\/(home|dashboard)/, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const userMenu = this.page.locator(
      '[data-testid="user-menu"], [data-testid="profile"], .user-menu'
    );
    const userUiVisible = await userMenu
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!modalClosed || (!redirected && !userUiVisible)) {
      // As a safe fallback, navigate to home after auth and wait for UI
      await this.page.goto("/home").catch(() => {});
      await userMenu
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .catch(() => {});
    }
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
