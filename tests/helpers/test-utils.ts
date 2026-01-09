import { type BrowserContext, expect, type Page } from "@playwright/test";
import { TIMEOUTS, SELECTORS, TestHelpers } from "./test-config";

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceStatus {
  indexer: boolean;
  client: boolean;
  admin: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TEST_URLS = {
  client: process.env.TEST_CLIENT_URL ?? "https://localhost:3001",
  admin: process.env.TEST_ADMIN_URL ?? "https://localhost:3002",
  indexer: process.env.TEST_INDEXER_URL ?? "http://localhost:8080/v1/graphql",
};

// Storage keys used by Green Goods auth (from shared/src/modules/auth/session.ts)
const AUTH_STORAGE_KEYS = {
  authMode: "greengoods_auth_mode",
  username: "greengoods_username",
  rpId: "greengoods_rp_id",
};

// ============================================================================
// VIRTUAL WEBAUTHN AUTHENTICATOR (for passkey testing)
// ============================================================================

/**
 * Sets up a virtual WebAuthn authenticator using Chrome DevTools Protocol.
 * This allows automated passkey testing without user interaction.
 *
 * Only works in Chromium-based browsers.
 *
 * Configuration based on best practices from:
 * - https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator
 * - https://www.oursky.com/blogs/a-practical-guide-automating-passkey-testing-with-playwright-and-authgear
 *
 * @see https://playwright.dev/docs/api/class-cdpsession
 * @see https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/
 */
export async function setupVirtualAuthenticator(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page);

  await client.send("WebAuthn.enable");

  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      // CRITICAL: Auto-approves "touch" prompts - without this, tests will hang
      automaticPresenceSimulation: true,
    },
  });

  console.log(`✓ Virtual authenticator created: ${authenticatorId}`);
  return authenticatorId;
}

/**
 * Removes a virtual WebAuthn authenticator.
 */
export async function removeVirtualAuthenticator(page: Page, authenticatorId: string) {
  try {
    const client = await page.context().newCDPSession(page);
    await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  } catch {
    // Ignore errors (authenticator may already be removed)
  }
}

// ============================================================================
// CLIENT AUTH HELPERS (Passkey-based)
// ============================================================================

/**
 * Helper for client app testing with passkey authentication (Android/Chromium).
 * For iOS Safari, use wallet injection instead.
 */
export class ClientTestHelper {
  private cdpSession?: any;

  constructor(
    public page: Page,
    private authenticatorId?: string
  ) {}

  /**
   * Initialize virtual authenticator for passkey testing.
   * Call this before any passkey operations.
   *
   * Only works on Chromium-based browsers (Android Chrome, Desktop Chrome).
   * For iOS Safari, use injectWalletAuth() instead.
   */
  async setupPasskeyAuth() {
    // Create CDP session and store it for later use
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    await this.cdpSession.send("WebAuthn.enable");

    const { authenticatorId } = await this.cdpSession.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true, // Auto-approve touch prompts
      },
    });

    this.authenticatorId = authenticatorId;
    console.log(`✓ Virtual authenticator ready: ${authenticatorId}`);
    return this.authenticatorId;
  }

  /**
   * Manually set user verification state.
   * Useful for simulating approval/rejection of authentication attempts.
   *
   * @param isVerified - true to approve, false to reject
   */
  async setUserVerified(isVerified: boolean) {
    if (!this.authenticatorId || !this.cdpSession) {
      throw new Error("Virtual authenticator not initialized. Call setupPasskeyAuth() first.");
    }

    await this.cdpSession.send("WebAuthn.setUserVerified", {
      authenticatorId: this.authenticatorId,
      isUserVerified: isVerified,
    });

    console.log(`✓ User verification set to: ${isVerified}`);
  }

  /**
   * Clean up virtual authenticator.
   */
  async cleanup() {
    if (this.authenticatorId && this.cdpSession) {
      try {
        await this.cdpSession.send("WebAuthn.removeVirtualAuthenticator", {
          authenticatorId: this.authenticatorId,
        });
        console.log("✓ Virtual authenticator removed");
      } catch (error) {
        // Ignore errors (authenticator may already be removed)
        console.log("⚠️  Authenticator cleanup skipped (may already be removed)");
      }
    }
  }

  /**
   * Inject authenticated wallet state into localStorage (iOS Safari fallback).
   *
   * Since iOS Safari doesn't support virtual WebAuthn authenticators,
   * we simulate wallet-based authentication using storage injection.
   *
   * @param address - Wallet address to simulate (defaults to test address)
   */
  async injectWalletAuth(address: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") {
    await this.page.addInitScript(
      ({ address, authModeKey }) => {
        // Set auth mode to wallet
        localStorage.setItem(authModeKey, "wallet");

        // Mock wagmi storage (used by Reown AppKit)
        const wagmiState = {
          state: {
            connections: {
              __type: "Map",
              value: [
                [
                  "mock",
                  {
                    accounts: [address],
                    chainId: 84532, // Base Sepolia
                  },
                ],
              ],
            },
            current: "mock",
          },
        };
        localStorage.setItem("wagmi.store", JSON.stringify(wagmiState));

        // Also set reown/appkit state
        localStorage.setItem("@w3m/connected_connector", '"mock"');
        localStorage.setItem("@w3m/active_caip_network_id", '"eip155:84532"');
      },
      { address, authModeKey: AUTH_STORAGE_KEYS.authMode }
    );
  }

  /**
   * Navigate to login and create a new passkey account.
   *
   * Flow: Click "Sign Up" → Enter username → Click "Create Account"
   *       → WebAuthn registration → Garden join → Navigate to /home
   */
  async createPasskeyAccount(username: string = `test_${Date.now()}`) {
    console.log(`🔐 Creating passkey account: ${username}`);

    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for React app to fully mount and handle any errors
    await this.page.waitForTimeout(2000);

    // Check for application errors first - including QueryClient errors
    const errorSelectors = [
      'text="Unexpected Application Error"',
      'text="No QueryClient set"',
      'text="Application error"',
      '[data-testid="error-boundary"]',
    ];

    for (const selector of errorSelectors) {
      const hasError = await this.page
        .locator(selector)
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (hasError) {
        // App failed to load properly - log the error
        const errorText = await this.page
          .locator("body")
          .textContent()
          .catch(() => "Unable to get error text");
        console.error(`App error detected: ${errorText.substring(0, 500)}`);

        // Take a screenshot for debugging
        await this.page.screenshot({
          path: `test-results/app-error-${Date.now()}.png`,
          fullPage: true,
        });

        // Try reloading once
        await this.page.reload();
        await this.page.waitForLoadState("domcontentloaded");
        await this.page.waitForTimeout(3000);
        break;
      }
    }

    // Wait for login UI to be ready - with better error handling
    const loginButton = this.page.getByTestId("login-button");
    try {
      await expect(loginButton).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    } catch (error) {
      // If login button not found, check console for errors
      const consoleErrors: string[] = [];
      this.page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await this.page.waitForTimeout(1000);

      if (consoleErrors.length > 0) {
        console.error("Console errors detected:", consoleErrors.join("\n"));
      }

      // Take screenshot and re-throw
      await this.page.screenshot({
        path: `test-results/login-button-not-found-${Date.now()}.png`,
        fullPage: true,
      });

      throw error;
    }

    // Step 1: Click "Sign Up" button (shows username input)
    const initialButtonText = await loginButton.textContent();
    console.log(`✓ Initial button text: "${initialButtonText}"`);

    await loginButton.click();
    await this.page.waitForTimeout(500);

    // Step 2: Wait for username input to appear
    const usernameInput = this.page
      .locator('[data-testid="username-input"]')
      .or(this.page.locator('input[placeholder*="username"]'))
      .first();
    await usernameInput.waitFor({ state: "visible", timeout: TIMEOUTS.elementVisible });
    console.log("✓ Username input visible");

    // Step 3: Enter username
    await usernameInput.fill(username);
    await this.page.waitForTimeout(300);
    console.log(`✓ Username entered: ${username}`);

    // Step 4: Click "Create Account" button (triggers WebAuthn registration + garden join)
    // Button text should have changed from "Sign Up" to "Create Account"
    // Use whichever button we found earlier
    const submitButton = (await this.page
      .getByTestId("login-button")
      .isVisible()
      .catch(() => false))
      ? this.page.getByTestId("login-button")
      : this.page.locator('button:has-text("Create Account"), button:has-text("Login")').first();

    await submitButton.click();
    console.log("⏳ Waiting for passkey registration + garden join...");

    // Step 5: Wait for complex flow to complete:
    //   - WebAuthn credential creation (handled by virtual authenticator)
    //   - Garden join transaction (another passkey approval)
    //   - Navigation to /home
    try {
      // Longer timeout because this includes garden join
      await this.page.waitForURL(/\/home/, { timeout: TIMEOUTS.passkeyCreation });
      console.log(`✅ Passkey account created and joined garden: ${username}`);
      return username;
    } catch (error) {
      console.error("❌ Passkey registration failed:");
      console.error(`   Current URL: ${this.page.url()}`);
      const buttonText = await submitButton.textContent().catch(() => "unknown");
      console.error(`   Button text: "${buttonText}"`);

      // Check for loading states
      const isLoading = await this.page
        .locator(".animate-spin, .animate-pulse")
        .isVisible()
        .catch(() => false);
      console.error(`   Is loading: ${isLoading}`);

      // Check for error messages
      const errorText = await this.page
        .locator('[role="alert"]')
        .textContent()
        .catch(() => "none");
      console.error(`   Error message: ${errorText}`);

      // Take screenshot for debugging
      await this.page.screenshot({
        path: `test-results/passkey-registration-failed-${Date.now()}.png`,
      });
      throw error;
    }
  }

  /**
   * Navigate to login and authenticate with existing passkey.
   *
   * For new username: Click "Login" → Enter username → Submit → WebAuthn auth
   * For stored username: Just click primary button → WebAuthn auth
   */
  async loginWithPasskey(username?: string) {
    console.log(`🔐 Logging in with passkey${username ? `: ${username}` : " (stored)"}`);

    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for React app to fully mount
    await this.page.waitForTimeout(1500);

    // Check for application errors first - including QueryClient errors
    const errorSelectors = [
      'text="Unexpected Application Error"',
      'text="No QueryClient set"',
      'text="Application error"',
      '[data-testid="error-boundary"]',
    ];

    for (const selector of errorSelectors) {
      const hasError = await this.page
        .locator(selector)
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (hasError) {
        // App failed to load properly - log the error
        const errorText = await this.page
          .locator("body")
          .textContent()
          .catch(() => "Unable to get error text");
        console.error(`App error detected during login: ${errorText.substring(0, 500)}`);

        // Try reloading once
        await this.page.reload();
        await this.page.waitForLoadState("domcontentloaded");
        await this.page.waitForTimeout(2000);
        break;
      }
    }

    const loginButton = this.page.getByTestId("login-button");
    await expect(loginButton).toBeVisible({ timeout: TIMEOUTS.elementVisible });

    if (username) {
      // New username - need to enter it via login flow
      // Step 1: Click secondary "Login" button to show username input
      const secondaryButton = this.page.getByRole("button", { name: /^login$/i });
      if (await secondaryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await secondaryButton.click();
        await this.page.waitForTimeout(500);

        // Step 2: Enter username
        const usernameInput = this.page.locator(
          'input[placeholder*="username"], input[type="text"]'
        );
        await usernameInput.waitFor({ state: "visible", timeout: 5000 });
        await usernameInput.fill(username);
        console.log(`✓ Username entered: ${username}`);
        await this.page.waitForTimeout(300);
      }
    }

    // Submit (triggers WebAuthn authentication, no garden join for existing users)
    await loginButton.click();
    console.log("⏳ Waiting for WebAuthn authentication...");

    // Existing user login is faster (no garden join)
    try {
      await this.page.waitForURL(/\/home/, { timeout: TIMEOUTS.passkeyLogin });
      console.log("✅ Passkey login successful");
    } catch (error) {
      console.error("❌ Passkey login failed:");
      console.error(`   Current URL: ${this.page.url()}`);
      const buttonText = await loginButton.textContent().catch(() => "unknown");
      console.error(`   Button text: "${buttonText}"`);
      await this.page.screenshot({ path: `test-results/passkey-login-failed-${Date.now()}.png` });
      throw error;
    }
  }

  /**
   * Check if we're on an authenticated page.
   */
  async isAuthenticated(): Promise<boolean> {
    const url = this.page.url();
    return url.includes("/home") || url.includes("/profile") || url.includes("/garden");
  }

  /**
   * Set up wallet auth context (prepares for wallet injection).
   * This is a no-op for client - wallet auth uses storage injection.
   */
  async setupWalletAuth() {
    // Wallet auth uses storage injection, no CDP setup needed
    return;
  }

  /**
   * Authenticate using wallet injection and navigate to home.
   * Used as alternative to passkey auth for platforms that don't support WebAuthn.
   */
  async authenticateWithWallet(address: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") {
    await this.injectWalletAuth(address);
    await this.page.goto("/home");
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded (no spinners).
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .locator('[data-testid="loading"], .loading, .spinner, .animate-spin')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // No spinner is fine
      });
  }
}

// ============================================================================
// ADMIN AUTH HELPERS (Wallet-based)
// ============================================================================

/**
 * Helper for admin app testing with wallet authentication.
 *
 * Uses storage injection to simulate authenticated state
 * (light auth path - doesn't require actual wallet extension).
 *
 * NOTE: For multi-tab tests, use the context parameter to ensure
 * the init script applies to all pages in the context.
 */
export class AdminTestHelper {
  private context?: BrowserContext;

  constructor(
    public page: Page,
    context?: BrowserContext
  ) {
    this.context = context;
  }

  /**
   * Inject authenticated wallet state into localStorage.
   *
   * This simulates a connected wallet by setting the auth storage
   * that the app checks on load.
   *
   * IMPORTANT: This sets localStorage via addInitScript which runs before
   * page load. However, wagmi still needs to verify the connection with
   * an actual connector. In CI without a real wallet, the app may redirect
   * to login. Use waitForAuthSettled() after navigation to handle this.
   *
   * @param address - Wallet address to simulate (defaults to test address)
   */
  async injectWalletAuth(address: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") {
    const initScript = ({ address, authModeKey }: { address: string; authModeKey: string }) => {
      // Set auth mode to wallet
      localStorage.setItem(authModeKey, "wallet");

      // Mock wagmi storage (used by Reown AppKit)
      // This tells wagmi there's a connected account
      const wagmiState = {
        state: {
          connections: {
            __type: "Map",
            value: [
              [
                "mock",
                {
                  accounts: [address],
                  chainId: 84532, // Base Sepolia
                },
              ],
            ],
          },
          current: "mock",
        },
      };
      localStorage.setItem("wagmi.store", JSON.stringify(wagmiState));

      // Also set reown/appkit state
      localStorage.setItem("@w3m/connected_connector", '"mock"');
      localStorage.setItem("@w3m/active_caip_network_id", '"eip155:84532"');

      // Set a marker so we can detect if injection worked
      localStorage.setItem("__test_auth_injected", "true");
    };

    const scriptArgs = { address, authModeKey: AUTH_STORAGE_KEYS.authMode };

    // Use context.addInitScript if context is available (for multi-tab support)
    // Otherwise fall back to page.addInitScript
    if (this.context) {
      await this.context.addInitScript(initScript, scriptArgs);
    } else {
      await this.page.addInitScript(initScript, scriptArgs);
    }
  }

  /**
   * Wait for auth state to settle after navigation.
   *
   * In E2E tests with mocked wallet state, auth may not fully work
   * due to wagmi needing actual wallet connections. This method waits
   * for auth to settle and returns whether auth succeeded.
   *
   * @param options - Configuration options
   * @returns true if authenticated, false if redirected to login
   */
  async waitForAuthSettled(options: { timeout?: number } = {}): Promise<boolean> {
    const { timeout = 10000 } = options;

    try {
      // Wait for either authenticated UI OR login redirect
      await Promise.race([
        // Success case: nav element appears (authenticated)
        this.page.waitForSelector('nav, aside, [data-testid="sidebar"], [role="navigation"]', {
          state: "visible",
          timeout,
        }),
        // Failure case: redirected to login
        this.page.waitForURL(/\/login/, { timeout }),
      ]);

      // Check final state
      const url = this.page.url();
      return url.includes("/dashboard") || url.includes("/gardens") || url.includes("/actions");
    } catch {
      // Timeout - check where we ended up
      return !this.page.url().includes("/login");
    }
  }

  /**
   * Navigate to login and wait for wallet connect button.
   */
  async goToLogin() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for React app to mount
    await this.page.waitForTimeout(1000);

    // Admin uses "Connect Wallet" button
    await expect(this.page.getByRole("button", { name: /connect wallet/i })).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * Navigate to dashboard (requires auth or redirect to login).
   */
  async goToDashboard() {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Check if redirected to login (not authenticated).
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes("/login");
  }

  /**
   * Wait for page to be fully loaded.
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .locator('[data-testid="loading"], .loading, .spinner, .animate-spin')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // No spinner is fine
      });
  }
}

// ============================================================================
// SERVICE HEALTH CHECKS
// ============================================================================

/**
 * Check if all services are available.
 */
export async function checkServices(page: Page): Promise<ServiceStatus> {
  const status: ServiceStatus = {
    indexer: false,
    client: false,
    admin: false,
  };

  // Check indexer
  try {
    const response = await page.request.post(TEST_URLS.indexer, {
      data: { query: "query { __typename }" },
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    status.indexer = response.status() === 200;
  } catch {
    status.indexer = false;
  }

  // Check client
  try {
    const response = await page.request.get(TEST_URLS.client, { timeout: 5000 });
    status.client = response.status() < 500;
  } catch {
    status.client = false;
  }

  // Check admin
  try {
    const response = await page.request.get(TEST_URLS.admin, { timeout: 5000 });
    status.admin = response.status() < 500;
  } catch {
    status.admin = false;
  }

  return status;
}

/**
 * Skip test if required services are not available.
 */
export async function requireServices(
  page: Page,
  services: (keyof ServiceStatus)[]
): Promise<void> {
  const status = await checkServices(page);

  for (const service of services) {
    if (!status[service]) {
      throw new Error(
        `Required service "${service}" is not available. Start with: bun dev:${service}`
      );
    }
  }
}

// ============================================================================
// GRAPHQL HELPERS
// ============================================================================

/**
 * Query the indexer directly for test assertions.
 */
export async function queryIndexer<T = unknown>(
  page: Page,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await page.request.post(TEST_URLS.indexer, {
    data: { query, variables },
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(`Indexer query failed: ${response.status()}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}

/**
 * Check if gardens exist in the indexer.
 */
export async function hasGardens(page: Page): Promise<boolean> {
  try {
    const data = await queryIndexer<{ Garden: Array<{ id: string }> }>(
      page,
      `query { Garden(limit: 1) { id } }`
    );
    return data.Garden.length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// LEGACY EXPORTS (for backwards compatibility during migration)
// ============================================================================

/** @deprecated Use ClientTestHelper instead */
export class TestHelper extends ClientTestHelper {
  constructor(page: Page) {
    super(page);
  }

  /** @deprecated Use setupPasskeyAuth and createPasskeyAccount instead */
  async login() {
    await this.setupPasskeyAuth();
    await this.createPasskeyAccount();
  }

  /** @deprecated No longer needed - auth is passkey-based */
  async submitWork(_workData: { feedback: string; plantCount?: number }) {
    console.warn("TestHelper.submitWork is deprecated and not implemented");
  }

  /** @deprecated */
  async checkResult() {
    return { success: false, error: false, errorMessage: "" };
  }

  /** @deprecated Use page.context().setOffline(true) */
  async goOffline() {
    await this.page.context().setOffline(true);
  }

  /** @deprecated Use page.context().setOffline(false) */
  async goOnline() {
    await this.page.context().setOffline(false);
  }

  /** @deprecated Use checkServices instead */
  async checkServices() {
    const status = await checkServices(this.page);
    return status.client;
  }
}

/** @deprecated */
export interface TestAccount {
  email: string;
  otp: string;
}

/** @deprecated Privy is no longer used */
export const getTestAccount = (): TestAccount => ({
  email: "deprecated@test.com",
  otp: "000000",
});
