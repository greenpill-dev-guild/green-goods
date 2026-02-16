import { chromium, type FullConfig } from "@playwright/test";

/**
 * Global setup for E2E tests
 *
 * - Sets environment variables for test configuration
 * - Performs health checks on services (client, admin, indexer)
 * - Can be extended to set up virtual WebAuthn authenticator state
 */
async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global test setup...\n");

  // In CI, Vite skips mkcert and runs on HTTP instead of HTTPS
  const isCI = process.env.CI === "true";
  const protocol = isCI ? "http" : "https";

  // Set test environment variables
  process.env.TEST_INDEXER_URL = "http://localhost:8080/v1/graphql";
  process.env.TEST_CLIENT_URL = `${protocol}://localhost:3001`;
  process.env.TEST_ADMIN_URL = `${protocol}://localhost:3002`;
  process.env.TEST_CHAIN_ID = "11155111"; // Sepolia

  // Enable service worker only for PWA tests
  if (process.env.ENABLE_PWA_E2E === "true") {
    process.env.VITE_ENABLE_SW_DEV = "true";
  }

  // Skip health check if requested
  if (process.env.SKIP_HEALTH_CHECK) {
    console.log("⏭️  Skipping health check (SKIP_HEALTH_CHECK=true)\n");
    console.log("✅ Global setup complete\n");
    return;
  }

  // Run health checks
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true, // Accept self-signed certs from mkcert
  });
  const page = await context.newPage();

  try {
    console.log("📊 Checking service availability...\n");

    // Check indexer
    try {
      const indexerResponse = await page.request.post("http://localhost:8080/v1/graphql", {
        data: { query: `query { __schema { types { name } } }` },
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });

      if (indexerResponse.ok()) {
        console.log("  ✅ Indexer (port 8080) - available");
      } else {
        console.log("  ⚠️  Indexer (port 8080) - responded with error");
      }
    } catch {
      console.log("  ⚠️  Indexer (port 8080) - not available (will be started by webServer)");
    }

    // Check client
    try {
      await page.goto(`${protocol}://localhost:3001`, { timeout: 5000 });
      console.log("  ✅ Client (port 3001) - available");
    } catch {
      console.log("  ⚠️  Client (port 3001) - not available (will be started by webServer)");
    }

    // Check admin
    try {
      await page.goto(`${protocol}://localhost:3002`, { timeout: 5000 });
      console.log("  ✅ Admin (port 3002) - available");
    } catch {
      console.log("  ⚠️  Admin (port 3002) - not available (will be started by webServer)");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\n⚠️  Health check failed: ${message}`);
    console.log("   Tests will attempt to start services via webServer config\n");
  } finally {
    await browser.close();
  }

  console.log("\n✅ Global setup complete\n");
}

export default globalSetup;
