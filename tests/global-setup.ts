import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global test setup...");

  // Set up test environment variables
  process.env.TEST_INDEXER_URL = "http://localhost:8080/v1/graphql";
  process.env.TEST_CLIENT_URL = "https://localhost:3001"; // HTTPS because of mkcert
  process.env.TEST_CHAIN_ID = "84532"; // Base Sepolia
  // Enable dev SW only during PWA tests when runner opts in via env
  if (process.env.ENABLE_PWA_E2E === "true") {
    process.env.VITE_ENABLE_SW_DEV = "true";
  }

  // Optional service health check (only if services are expected to be running)
  if (!process.env.SKIP_HEALTH_CHECK) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, // Accept self-signed certificates from mkcert
    });
    const page = await context.newPage();

    try {
      console.log("📊 Checking if services are available...");

      // Try to check indexer (with timeout)
      try {
        const indexerResponse = await page.request.post("http://localhost:8080/v1/graphql", {
          data: { query: `query { __schema { types { name } } }` },
          headers: { "Content-Type": "application/json" },
          timeout: 5000, // Short timeout
        });

        if (indexerResponse.ok()) {
          console.log("✅ Indexer is available");
        } else {
          console.log("⚠️ Indexer responded but with error status");
        }
      } catch (error) {
        console.log("⚠️ Indexer not available, tests may start it automatically");
      }

      // Try to check client (with timeout)
      try {
        await page.goto("https://localhost:3001", { timeout: 5000 });
        console.log("✅ Client is available");
      } catch (error) {
        console.log("⚠️ Client not available, tests may start it automatically");
      }
    } catch (error) {
      console.log("⚠️ Health check failed, continuing anyway:", error.message);
    } finally {
      await browser.close();
    }
  }

  console.log("✅ Global setup complete");
}

export default globalSetup;
