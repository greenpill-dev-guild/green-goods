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
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Reporting
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
    process.env.CI ? ["github"] : ["list"],
  ],

  use: {
    // Default to client URL (individual tests override via test.use)
    baseURL: currentEnv.client,

    // Accept self-signed certificates from mkcert
    ignoreHTTPSErrors: true,

    // Trace/video/screenshot on failure
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",

    // Timeouts for wallet/blockchain interactions
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },

  // Browser matrix - Chromium for admin, mobile for client PWA
  projects: [
    // Desktop Chrome - primary for development and admin dashboard
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Android Chrome - PWA + passkey testing (WebAuthn support)
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },

    // iOS Safari - PWA testing with wallet auth (no WebAuthn virtual authenticator)
    // Uses storage injection for authentication (same pattern as admin)
    {
      name: "mobile-safari",
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
