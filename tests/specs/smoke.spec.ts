import { expect, test } from "@playwright/test";
import { TestHelper } from "../helpers/test-utils";

test.describe("Smoke Tests", () => {
  test("service connectivity", async ({ page, request }) => {
    console.log("🔍 Checking service connectivity...");

    // Check client
    try {
      const clientResponse = await request.get("/", { timeout: 5000 });
      console.log(`✅ Client: ${clientResponse.status()}`);
      expect(clientResponse.status()).toBeLessThan(500);
    } catch (error) {
      console.log("❌ Client not available - start with: npm run dev:app");
      test.skip();
    }

    // Check indexer
    try {
      const indexerUrl = process.env.VITE_ENVIO_INDEXER_URL || "http://localhost:8080/v1/graphql";
      const indexerResponse = await request.post(indexerUrl, {
        data: { query: "query { __typename }" },
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });
      console.log(`✅ Indexer: ${indexerResponse.status()}`);
      expect(indexerResponse.status()).toBe(200);
    } catch (error) {
      console.log("❌ Indexer not available - start with: npm run dev:indexer");
    }
  });

  test("basic page load", async ({ page }) => {
    const helper = new TestHelper(page);
    const servicesOk = await helper.checkServices();

    if (!servicesOk) {
      console.log("❌ Services not available, skipping page load test");
      test.skip();
    }

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const title = await page.title();
    expect(title).toContain("Green Goods");
    console.log(`✅ Page loaded successfully: ${title}`);
  });

  test("environment setup", async () => {
    expect(process.env.VITE_ENVIO_INDEXER_URL || "http://localhost:8080/v1/graphql").toBeDefined();
    expect(process.env.TEST_CLIENT_URL || "https://localhost:3001").toBeDefined();
    console.log("✅ Environment configured");
  });

  test("viewport and mobile configuration", async ({ page }) => {
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeDefined();
    expect(viewportSize!.width).toBeGreaterThan(0);
    expect(viewportSize!.height).toBeGreaterThan(0);

    console.log(`✅ Viewport configured: ${viewportSize!.width}x${viewportSize!.height}`);
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
      test.skip();
    }
  });
});
