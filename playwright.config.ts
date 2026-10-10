import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import {
  REPORTING_DRIVER_PORT,
  REPORTING_DRIVER_URL,
  resolvePlaywrightApps,
  selectedProjectNames,
  selectsProject,
  shouldUsePlaywrightIndexer,
} from "./tests/fixtures/playwright-services";

// In CI, Vite skips mkcert and runs on HTTP instead of HTTPS
const productionPreview = process.env.PLAYWRIGHT_PWA_PREVIEW === "true";
const isCI = process.env.CI === "true" || productionPreview;
const protocol = isCI ? "http" : "https";

// Environment configuration
const environments = {
  local: {
    client: `${protocol}://localhost:3001`,
    admin: `${protocol}://localhost:3002`,
    indexer: "http://localhost:3006/v1/graphql",
    chain: "sepolia",
  },
};

const currentEnv = environments.local;

function envFlag(name: string): boolean {
  return process.env[name]?.toLowerCase() === "true";
}

const requestedProjects = selectedProjectNames(process.argv);
const callerManagedFork = requestedProjects.includes("anvil-fork");
// The passkey project signs in against the passkey directory and walks the reporting ceremony.
const passkeyProject = selectsProject(requestedProjects, "passkey-mock");
// Workers reload the config without the runner's project-selection arguments.
const isWorkerProcess = process.env.TEST_WORKER_INDEX !== undefined;
if (
  !isWorkerProcess &&
  ((callerManagedFork && requestedProjects.some((project) => project !== "anvil-fork")) ||
    (envFlag("RUN_FORK_TESTS") && !callerManagedFork))
) {
  throw new Error("Run the anvil-fork project separately from owned test-server projects");
}

const selectedApps = resolvePlaywrightApps({ playwrightApp: process.env.PLAYWRIGHT_APP });
const shouldStartClient = selectedApps.client;
const shouldStartAdmin = selectedApps.admin;

// CI smoke / production-flows tests mock indexer GraphQL calls via Playwright
// route interception, so the live envio indexer (which needs Docker) is not
// required. SKIP_INDEXER=true (default in CI) keeps the webServer list lean.
const skipIndexer = !shouldUsePlaywrightIndexer();

const webServers: NonNullable<PlaywrightTestConfig["webServer"]> = [
  // Indexer (GraphQL)
  ...(skipIndexer
    ? []
    : [
        {
          command: "bun run dev -- indexer",
          port: 3006,
          reuseExistingServer: false,
          timeout: 60000,
          env: { NODE_ENV: "test" },
        },
      ]),
  // Reporting driver (Agent): the real ceremony API over fixture ports, for the passkey project's
  // account-step spec. The Client proxies /api/messaging to it, so it serves the Client's origin
  // and refuses any other.
  ...(passkeyProject
    ? [
        {
          command: "bun src/__tests__/reporting/driver/server.ts",
          cwd: "./packages/agent",
          url: `${REPORTING_DRIVER_URL}/__driver/outbox`,
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            APP_ENV: "test",
            NODE_ENV: "test",
            REPORTING_DRIVER_PORT: String(REPORTING_DRIVER_PORT),
            REPORTING_DRIVER_ORIGIN: currentEnv.client,
          },
        },
      ]
    : []),
  // Client (PWA) — `url` (not `port`) so Playwright waits for an actual HTTP
  // 200 before running tests; Vite binds the TCP socket before the HTTP route
  // handler is ready, which causes flaky page.goto timeouts in CI.
  // Local and CI runs own their servers and refuse occupied ports. Never reuse
  // a live-development server whose chain and auth profile are unverified.
  // Use the pinned CLI directly: package dev scripts force APP_ENV=development,
  // and the PM2 launcher also replaces the chain with its live Arbitrum profile.
  ...(shouldStartClient
    ? [
        {
          command: productionPreview
            ? "bun run build && bun ../../scripts/dev/node-cli.js vite preview --host 127.0.0.1 --port 3001 --strictPort"
            : "bun ../../scripts/dev/node-cli.js vite --mode test",
          cwd: "./packages/client",
          url: `${protocol}://localhost:3001`,
          reuseExistingServer: false,
          timeout: productionPreview ? 240000 : 120000,
          env: {
            APP_ENV: productionPreview ? "production" : "test",
            NODE_ENV: productionPreview ? "production" : "test",
            VITE_CHAIN_ID: "11155111",
            VITE_ENVIO_INDEXER_URL: currentEnv.indexer,
            VITE_POSTHOG_KEY: "",
            VITE_SENTRY_CLIENT_DSN: "",
            SENTRY_AUTH_TOKEN: "",
            GG_ENABLE_SOURCEMAPS: "false",
            VITE_USE_HASH_ROUTER: "false",
            VITE_API_BASE_URL: "http://localhost:3005",
            // CI exercises the installed-app/offline contract, so the client
            // test server must expose vite-plugin-pwa's development worker.
            VITE_ENABLE_SW_DEV: String(!productionPreview),
            VITE_PASSKEY_SERVER_ENABLED: String(productionPreview || passkeyProject),
            // The ceremony API is the owned driver or nothing: a root .env naming a running
            // Agent must not put it behind a test.
            REPORTING_AGENT_URL: "",
            REPORTING_DRIVER_URL,
          },
        },
      ]
    : []),
  // Admin (Dashboard)
  ...(shouldStartAdmin
    ? [
        {
          command: "bun ../../scripts/dev/node-cli.js vite --mode test",
          cwd: "./packages/admin",
          url: `${protocol}://localhost:3002`,
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            APP_ENV: "test",
            NODE_ENV: "test",
            VITE_CHAIN_ID: "11155111",
            VITE_ENVIO_INDEXER_URL: currentEnv.indexer,
          },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests/specs",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  maxFailures: process.env.CI ? 10 : undefined,

  outputDir: "tests/test-results",

  // Reporting
  reporter: [
    ["html", { outputFolder: "tests/playwright-report" }],
    ["json", { outputFile: "tests/test-results/results.json" }],
    process.env.CI ? ["github"] : ["list"],
  ],

  use: {
    // Default to client URL (individual tests override via test.use)
    baseURL: currentEnv.client,

    // Accept self-signed certificates from mkcert
    ignoreHTTPSErrors: true,

    // Trace/video/screenshot on failure
    trace: "on-first-retry",
    video: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",

    // Timeouts for wallet/blockchain interactions
    navigationTimeout: 30000,
    actionTimeout: 15000,

    // Viewport for consistent testing
    viewport: { width: 1280, height: 720 },

    // Emulate reduced motion to prevent animation issues
    // reducedMotion: "reduce",
  },

  // Browser matrix - streamlined for reliable CI testing
  // Mobile projects disabled by default - enable with --project flag for cross-browser testing
  projects: [
    // Client CI - smoke plus critical client flows owned by the client lane
    {
      name: "client-ci",
      testMatch: [/client\.smoke\.spec\.ts$/, /client\..*\.ci\.spec\.ts$/],
      use: { ...devices["Desktop Chrome"] },
    },

    // Admin CI - deterministic auth, smoke, and production-flow checks owned by the admin lane
    {
      name: "admin-ci",
      testMatch: [
        /admin\.auth\.spec\.ts$/,
        /admin\.smoke\.spec\.ts$/,
        /admin\.production-flows\.ci\.spec\.ts$/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },

    // Desktop Chrome - admin tests only
    {
      name: "chromium",
      testMatch: /admin.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Desktop Chrome - client smoke tests only (default for CI)
    // Uses wallet injection for auth (passkey e2e tests skipped - virtual authenticator
    // credentials are rejected by real Pimlico server)
    {
      name: "chromium-client",
      testMatch: /client\.smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Desktop Chrome - critical path CI tests (work submission, approval, offline sync)
    // Lightweight mock-based tests that validate core UI flows without real infrastructure
    {
      name: "critical-path",
      testMatch: /\.ci\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Performance tests - separate project for load time and resource checks
    {
      name: "performance",
      testMatch: /performance\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ========================================================================
    // OPTIONAL PROJECTS - Run with: npx playwright test --project=<name>
    // ========================================================================

    // Full client test suite (includes auth, navigation, etc.)
    // Many tests require real infrastructure and will be skipped
    {
      name: "client-full",
      testMatch: /client.*\.spec\.ts/,
      testIgnore: [/\.passkey\.spec\.ts$/, /\.exploration\.spec\.ts$/, /\.pwa-preview\.spec\.ts$/],
      use: { ...devices["Desktop Chrome"] },
    },

    // Mobile Chrome - for cross-browser testing
    {
      name: "mobile-chrome",
      testMatch: /client\.smoke\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },

    // Mobile Safari - for cross-browser testing
    {
      name: "mobile-safari",
      testMatch: /client\.smoke\.spec\.ts/,
      use: {
        ...devices["iPhone 13 Pro"],
        viewport: { width: 390, height: 844 },
      },
    },

    // iPhone 16 Pro diagnostic — layout/safe-area investigation via WebKit
    // Run with: bun x playwright test --project=iphone-16-pro
    {
      name: "iphone-16-pro",
      testMatch: /\.diagnostic\.spec\.ts$/,
      use: {
        ...devices["iPhone 15 Pro"],
        viewport: { width: 402, height: 874 },
        deviceScaleFactor: 3,
      },
    },

    // ========================================================================
    // INTEGRATION TESTING PROJECTS
    // ========================================================================

    // Anvil Fork - Tests with local Anvil fork of Sepolia
    // Run with: bun run browser e2e --preset fork
    {
      name: "anvil-fork",
      testMatch: /.*\.fork\.spec\.ts$/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
      timeout: 120000, // Includes lazy upstream state reads through the Anvil fork
    },

    // Qualified proof uses its named preset; production preview owns a separate server profile.
    {
      name: "pwa-preview",
      testMatch: /.*\.pwa-preview\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      name: "work-exploration",
      timeout: 90000, // Includes first compilation of the protected work route.
      testMatch: /.*\.exploration\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    // The passkey cases share one dev server and run one at a time, whatever --workers says. A
    // dependency the server has not pre-bundled is found when a route first asks for it; the
    // server then re-bundles and reloads every open page, so a case beside that load loses its
    // page mid-step. The Client's optimizeDeps list covers today's dependencies. This limit
    // covers the next one added to Shared and not to that list.
    {
      name: "passkey-mock",
      testMatch: /.*\.passkey\.spec\.ts$/,
      workers: 1,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },

    // Testnet - Tests against real Sepolia (manual only)
    // Run with: bun run browser e2e --preset testnet
    // Requires: TEST_WALLET_PRIVATE_KEY env var
    {
      name: "testnet",
      testMatch: /.*\.testnet\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      timeout: 120000, // Extra long timeout for real transactions
    },
  ],

  // WebServer configuration - starts services if not running
  // Anvil is owned by the fork fixture; its legacy Client smoke cases require
  // a caller-managed surface. Never silently replace it with the Sepolia profile.
  webServer: callerManagedFork || envFlag("SKIP_WEBSERVER") ? undefined : webServers,

  // Global setup/teardown (ESM-compatible paths)
  globalSetup: callerManagedFork ? undefined : "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
});
