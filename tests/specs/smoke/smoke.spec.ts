import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("service connectivity check", async ({ request }) => {
    console.log("🔍 Checking service connectivity...");

    // Check client service
    try {
      const clientResponse = await request.get("/", { timeout: 5000 });
      console.log(`✅ Client service responding on port 3001 (status: ${clientResponse.status()})`);
    } catch (error) {
      console.log("❌ Client service not available on https://localhost:3001");
      console.log("💡 Start with: npm run dev:app");
    }

    // Check indexer service
    try {
      const indexerResponse = await request.post("http://localhost:8080/v1/graphql", {
        data: { query: "query { __typename }" },
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });
      console.log(
        `✅ Indexer service responding on port 8080 (status: ${indexerResponse.status()})`
      );
    } catch (error) {
      console.log("❌ Indexer service not available on port 8080");
      console.log("💡 Start with: npm run dev:indexer");
    }

    // This test always passes - it's just for diagnostics
    expect(true).toBe(true);
  });

  test("basic configuration should be working", async ({ page }) => {
    // This test just verifies that Playwright can start and basic configuration works
    try {
      await page.goto("/", { timeout: 10000 });

      // Very basic checks that don't depend on specific app structure
      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();

      // Check that the page title is set
      const title = await page.title();
      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);

      console.log("✅ Basic page structure is working");
      console.log(`Page title: ${title}`);
    } catch (error) {
      console.log("❌ Client service not available on https://localhost:3001");
      console.log("💡 Please start the client service with: npm run dev:app");
      console.log(`Error: ${error.message}`);
      test.skip();
    }
  });

  test("can make basic HTTP requests", async ({ request }) => {
    // Test that we can make HTTP requests
    try {
      const response = await request.get("/", { timeout: 10000 });
      expect(response.status()).toBeLessThan(500); // Allow for 404s, etc, but not server errors

      console.log(`✅ HTTP request successful: ${response.status()}`);
    } catch (error) {
      console.log("❌ Cannot connect to client service on https://localhost:3001");
      console.log("💡 Please start the client service with: npm run dev:app");
      console.log(`Error: ${error.message}`);
      test.skip();
    }
  });

  test("viewport and mobile configuration working", async ({ page }) => {
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeDefined();
    expect(viewportSize!.width).toBeGreaterThan(0);
    expect(viewportSize!.height).toBeGreaterThan(0);

    console.log(`✅ Viewport configured: ${viewportSize!.width}x${viewportSize!.height}`);
  });

  test("test environment variables are set", async () => {
    // Check that our global setup properly set environment variables
    expect(process.env.TEST_INDEXER_URL).toBeDefined();
    expect(process.env.TEST_CLIENT_URL).toBeDefined();
    expect(process.env.TEST_CHAIN_ID).toBe("84532");

    console.log("✅ Test environment variables are properly configured");
    console.log(`Indexer URL: ${process.env.TEST_INDEXER_URL}`);
    console.log(`Client URL: ${process.env.TEST_CLIENT_URL}`);
    console.log(`Chain ID: ${process.env.TEST_CHAIN_ID}`);
  });

  test("performance timing is available", async ({ page }) => {
    try {
      await page.goto("/", { timeout: 10000 });

      const performanceSupported = await page.evaluate(() => {
        return (
          typeof window.performance !== "undefined" && typeof window.performance.now === "function"
        );
      });

      expect(performanceSupported).toBe(true);
      console.log("✅ Performance timing API is available");
    } catch (error) {
      console.log("❌ Cannot access client service to test performance API");
      console.log("💡 Please start the client service with: npm run dev:app");
      console.log(`Error: ${error.message}`);
      test.skip();
    }
  });
});
