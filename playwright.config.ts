import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env so tests can access test variables
loadEnv({ path: path.resolve(__dirname, ".env") });

// Environment configuration
const environments = {
  local: {
    client: "https://localhost:3001", // HTTPS via mkcert
    admin: "https://localhost:3002", // HTTPS via mkcert
    indexer: "http://localhost:8080/v1/graphql",
    chain: "base-sepolia",
  },
};

const currentEnv = environments.local;

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
    reducedMotion: "reduce",
  },

  // Browser matrix - streamlined for reliable CI testing
  // Mobile projects disabled by default - enable with --project flag for cross-browser testing
  projects: [
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
  ],

  // WebServer configuration - starts services if not running
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : [
        // Indexer (GraphQL)
        {
          command: "bun dev:indexer",
          port: 8080,
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
          env: { NODE_ENV: "test" },
        },
        // Client (PWA)
        {
          command: "bun dev:client",
          port: 3001,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          env: {
            NODE_ENV: "test",
            VITE_CHAIN_ID: "84532",
            VITE_ENVIO_INDEXER_URL: currentEnv.indexer,
          },
        },
        // Admin (Dashboard)
        {
          command: "bun dev:admin",
          port: 3002,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          env: {
            NODE_ENV: "test",
            VITE_CHAIN_ID: "84532",
            VITE_ENVIO_INDEXER_URL: currentEnv.indexer,
          },
        },
      ],

  // Global setup/teardown (ESM-compatible paths)
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
});
