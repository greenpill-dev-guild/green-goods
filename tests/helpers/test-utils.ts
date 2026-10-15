import { type BrowserContext, type Page } from "@playwright/test";
import { type MockClientBackendOptions, mockClientBackend } from "./mock-backend";

// ============================================================================
// TYPES
// ============================================================================

/** `operator` is the steward role's former name; DevAuthProvider still resolves it. */
export type AdminMockRole = "deployer" | "steward" | "operator" | "user" | "disconnected";

// ============================================================================
// CONSTANTS
// ============================================================================

// In CI, Vite skips mkcert and runs on HTTP instead of HTTPS
const isCI = process.env.CI === "true";
const protocol = isCI ? "http" : "https";

export const TEST_URLS = {
  client: process.env.TEST_CLIENT_URL ?? `${protocol}://localhost:3001`,
  admin: process.env.TEST_ADMIN_URL ?? `${protocol}://localhost:3002`,
  indexer: process.env.TEST_INDEXER_URL ?? "http://localhost:3006/v1/graphql",
};

// Storage keys used by Green Goods auth (from shared/src/modules/auth/session.ts)
const AUTH_STORAGE_KEYS = {
  authMode: "greengoods_auth_mode",
};
const DEV_MOCK_AUTH_STORAGE_KEY = "greengoods_dev_mock_auth";

// ============================================================================
// CLIENT AUTH HELPERS
// ============================================================================

/**
 * Client CI mock-auth and legacy wallet-storage helpers.
 * Qualified passkey specs own their virtual authenticators.
 */
export class ClientTestHelper {
  constructor(public page: Page) {}

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
                    chainId: 11155111, // Sepolia
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
        localStorage.setItem("@w3m/active_caip_network_id", '"eip155:11155111"');
      },
      { address, authModeKey: AUTH_STORAGE_KEYS.authMode }
    );
  }

  /**
   * Persist dev mock auth before the app boots (mirrors AuthGate / DevAuthProvider).
   *
   * Seeds the same sessionStorage key the app reads, so auth survives route
   * changes and redirects without appending `?mockAuth=` to every navigation.
   * Only active in dev mode — the Vite dev server the Playwright webServer runs;
   * tree-shaken from production builds. Preferred over injectWalletAuth(), which
   * depends on wagmi verifying a real connector and is flaky in headless CI.
   */
  async enableMockAuth(role: AdminMockRole = "user") {
    await this.page.addInitScript(
      ({ role, storageKey }) => {
        window.sessionStorage.setItem(storageKey, role);
      },
      { role, storageKey: DEV_MOCK_AUTH_STORAGE_KEY }
    );
  }

  /**
   * Open the manual wallet-storage diagnostic at home.
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
    // The index.html boot fallback stays visible until the app shell actually
    // mounts (window.__GG_CLEAR_BOOT_FALLBACK). Waiting it out closes two
    // wedges: toggling offline while AppShell.tsx is still a pending lazy
    // import (chunk-load error -> update-recovery loop instead of the offline
    // indicator), and CI cold-start transforms outrunning a spinner-only wait.
    // An absent or detached #boot-fallback already satisfies "hidden", so this
    // only rejects when the fallback is genuinely stuck visible — i.e. the app
    // failed to mount. Let that propagate: a URL- or body-only assertion must
    // never pass against the boot fallback.
    await this.page.locator("#boot-fallback").waitFor({ state: "hidden", timeout: 30000 });
    await this.page
      .locator('[data-testid="loading"], .loading, .spinner, .animate-spin')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // No spinner is fine
      });
  }
}

/**
 * Set up the client CI seam before navigation: persisted dev mock auth plus
 * schema-correct route mocks for the indexer, EAS, and RPC boundaries.
 */
export async function setupAuthenticatedClient(
  page: Page,
  role: AdminMockRole = "user",
  backend?: MockClientBackendOptions
) {
  const helper = new ClientTestHelper(page);
  await helper.enableMockAuth(role);
  const scenario = await mockClientBackend(page, backend);
  return Object.assign(helper, { backend: scenario });
}

// ============================================================================
// ADMIN AUTH HELPERS (Dev mockAuth)
// ============================================================================

/**
 * Helper for admin app testing with deterministic dev auth.
 *
 * Prefer `mockAuth` URL/session overrides for cockpit verification.
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

  buildMockAuthPath(path: string, role: AdminMockRole = "steward") {
    const url = new URL(path, TEST_URLS.admin);
    url.searchParams.set("mockAuth", role);
    return `${url.pathname}${url.search}`;
  }

  /**
   * Persist dev mock auth before the app boots.
   *
   * This mirrors the app's `AuthGate` / `DevAuthProvider` path and survives
   * route changes and reloads during a browser session.
   */
  async enableMockAuth(role: AdminMockRole = "steward") {
    const initScript = ({ role, storageKey }: { role: AdminMockRole; storageKey: string }) => {
      window.sessionStorage.setItem(storageKey, role);
    };

    const scriptArgs = { role, storageKey: DEV_MOCK_AUTH_STORAGE_KEY };

    if (this.context) {
      await this.context.addInitScript(initScript, scriptArgs);
    } else {
      await this.page.addInitScript(initScript, scriptArgs);
    }
  }

  async goToCockpit(path: string = "/hub", role: AdminMockRole = "steward") {
    await this.page.goto(this.buildMockAuthPath(path, role));
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Wait for page to be fully loaded.
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
    // The index.html boot fallback stays visible until the app shell actually
    // mounts (window.__GG_CLEAR_BOOT_FALLBACK). Waiting it out closes two
    // wedges: toggling offline while AppShell.tsx is still a pending lazy
    // import (chunk-load error -> update-recovery loop instead of the offline
    // indicator), and CI cold-start transforms outrunning a spinner-only wait.
    // An absent or detached #boot-fallback already satisfies "hidden", so this
    // only rejects when the fallback is genuinely stuck visible — i.e. the app
    // failed to mount. Let that propagate: a URL- or body-only assertion must
    // never pass against the boot fallback.
    await this.page.locator("#boot-fallback").waitFor({ state: "hidden", timeout: 30000 });
    // React boot and router hydration can outlive the HTML fallback. Waiting
    // for real route content also prevents absence assertions passing on a spinner.
    await this.page.getByRole("main").waitFor({ state: "visible", timeout: 30000 });
    await this.page
      .locator('[data-component="AdminBootShell"]')
      .waitFor({ state: "hidden", timeout: 30000 });
    // A failed lazy boot replaces the shell with AdminBootRecovery, which also
    // satisfies "hidden" above. Fail here rather than assert against that screen.
    if ((await this.page.locator('[data-component="AdminBootRecovery"]').count()) > 0) {
      throw new Error("Admin failed to boot: the boot recovery screen replaced the app shell.");
    }
    await this.page
      .locator('[data-testid="loading"], .loading, .spinner, .animate-spin')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {
        // No spinner is fine
      });
  }
}
