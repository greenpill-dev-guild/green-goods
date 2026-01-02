import { type BrowserContext, expect, type Page } from "@playwright/test";

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
 * @see https://playwright.dev/docs/api/class-cdpsession
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
    },
  });

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
    this.authenticatorId = await setupVirtualAuthenticator(this.page);
    return this.authenticatorId;
  }

  /**
   * Clean up virtual authenticator.
   */
  async cleanup() {
    if (this.authenticatorId) {
      await removeVirtualAuthenticator(this.page, this.authenticatorId);
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
   */
  async createPasskeyAccount(username: string = `test_${Date.now()}`) {
    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for login UI to be ready
    await expect(this.page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });

    // Click "Sign Up" to show username input
    await this.page.getByTestId("login-button").click();

    // Enter username
    const usernameInput = this.page.locator('input[placeholder*="username"]');
    await usernameInput.waitFor({ state: "visible", timeout: 5000 });
    await usernameInput.fill(username);

    // Submit to create account (virtual authenticator handles WebAuthn)
    await this.page.getByTestId("login-button").click();

    // Wait for redirect to home (auth success)
    await this.page.waitForURL(/\/home/, { timeout: 30000 });

    return username;
  }

  /**
   * Navigate to login and authenticate with existing passkey.
   * Requires username to be stored or provided.
   */
  async loginWithPasskey(username?: string) {
    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for login UI
    await expect(this.page.getByTestId("login-button")).toBeVisible({ timeout: 10000 });

    // If username provided, we need to go through recovery flow
    if (username) {
      // Click "Login" secondary button to show username input
      const loginButton = this.page.getByRole("button", { name: /^login$/i });
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();

        // Enter username
        const usernameInput = this.page.locator('input[placeholder*="username"]');
        await usernameInput.waitFor({ state: "visible", timeout: 5000 });
        await usernameInput.fill(username);
      }
    }

    // Submit (virtual authenticator handles WebAuthn)
    await this.page.getByTestId("login-button").click();

    // Wait for redirect to home
    await this.page.waitForURL(/\/home/, { timeout: 30000 });
  }

  /**
   * Check if we're on an authenticated page.
   */
  async isAuthenticated(): Promise<boolean> {
    const url = this.page.url();
    return url.includes("/home") || url.includes("/profile") || url.includes("/garden");
  }

  /**
   * Wait for page to be fully loaded (no spinners).
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
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
 */
export class AdminTestHelper {
  constructor(public page: Page) {}

  /**
   * Inject authenticated wallet state into localStorage.
   *
   * This simulates a connected wallet by setting the auth storage
   * that the app checks on load.
   *
   * @param address - Wallet address to simulate (defaults to test address)
   */
  async injectWalletAuth(address: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") {
    await this.page.addInitScript(
      ({ address, authModeKey }) => {
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
      },
      { address, authModeKey: AUTH_STORAGE_KEYS.authMode }
    );
  }

  /**
   * Navigate to login and wait for wallet connect button.
   */
  async goToLogin() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");

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
    await this.page.waitForLoadState("networkidle");
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
