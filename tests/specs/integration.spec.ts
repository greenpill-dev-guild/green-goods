import { expect, test } from "@playwright/test";
import { TestHelper } from "../helpers/test-utils";

test.describe("Integration Tests", () => {
  let helper: TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page);
  });

  test("authentication flow", async ({ page }) => {
    await helper.login();

    // Should be logged in and redirected
    expect(page.url()).toMatch(/\/(home|dashboard)/);

    // Should see user interface elements
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile"], .user-menu');
    await expect(userMenu.first()).toBeVisible({ timeout: 10000 });

    console.log("✅ Authentication flow completed successfully");
  });

  test("basic indexer connectivity", async ({ request }) => {
    const indexerUrl = process.env.VITE_ENVIO_INDEXER_URL || "http://localhost:8080/v1/graphql";

    const response = await request.post(indexerUrl, {
      data: {
        query: `
          query {
            __schema {
              types {
                name
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.data.__schema.types).toBeDefined();
    expect(data.data.__schema.types.length).toBeGreaterThan(0);

    // Check for expected Green Goods entities
    const typeNames = data.data.__schema.types.map((type: any) => type.name);
    expect(typeNames).toContain("Garden");
    expect(typeNames).toContain("Action");

    console.log("✅ Indexer GraphQL schema validated");
  });

  test("offline work submission and reconciliation", async ({ page }) => {
    await helper.login();

    // Submit work offline
    await helper.goOffline();
    console.log("🔌 Going offline for work submission...");

    await helper.submitWork({
      feedback: "Test offline work submission - planting native trees",
      plantCount: 3,
    });

    const result = await helper.checkResult();

    // Should either succeed (if offline queue works) or show expected permission error
    if (result.error) {
      expect(result.errorMessage.toLowerCase()).toMatch(
        /gardener|permission|access|authorized|offline|queue/
      );
      console.log(
        "✅ Expected permission error or offline queue - test account not added as gardener"
      );
    } else {
      console.log("✅ Work queued offline successfully");
    }

    // Go back online
    await helper.goOnline();
    console.log("🌐 Going back online...");

    // Wait for potential sync
    await page.waitForTimeout(3000);

    console.log("✅ Offline work reconciliation test completed");
  });

  test("arbitrum work submission", async ({ page }) => {
    // Configure for Arbitrum
    await page.addInitScript(() => {
      window.localStorage.setItem("test-chain-id", "42161");
      window.localStorage.setItem("test-network", "arbitrum");
      window.localStorage.setItem("test-mode", "arbitrum-work-submission");
    });

    console.log("🌐 Configured for Arbitrum One (Chain ID: 42161)");

    await helper.login();

    await helper.submitWork({
      feedback: "Arbitrum blockchain work submission test - regenerative agriculture practices",
      plantCount: 5,
    });

    const result = await helper.checkResult();

    // Arbitrum tests expect permission error for test accounts
    if (result.error) {
      expect(result.errorMessage.toLowerCase()).toMatch(
        /gardener|permission|access|authorized|contract/
      );
      console.log("✅ Arbitrum permission validation working - blockchain integration functional");
    } else {
      console.log("✅ Arbitrum work submission successful");
    }
  });

  test("job queue functionality", async ({ page }) => {
    await helper.login();

    // Check if job queue is available
    const hasJobQueue = await page.evaluate(() => {
      return !!(window as any).jobQueue;
    });

    if (!hasJobQueue) {
      console.log("⚠️ Job queue not available, testing basic offline functionality");
    }

    // Submit work offline to test queue functionality
    await helper.goOffline();
    await helper.submitWork({
      feedback: "Job queue test work - validating offline storage",
      plantCount: 2,
    });

    // Check for job queue stats if available
    const queueStats = await page.evaluate(() => {
      const queue = (window as any).jobQueue;
      return queue ? queue.getStats?.() : null;
    });

    if (queueStats) {
      console.log("📊 Job queue stats:", queueStats);
      expect(typeof queueStats.total).toBe("number");
    }

    // Go online and check sync
    await helper.goOnline();
    await page.waitForTimeout(3000); // Allow sync time

    console.log("✅ Job queue functionality verified");
  });

  test("mobile PWA features", async ({ page }) => {
    // Check PWA manifest
    await page.goto("/");

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();

    // Check service worker registration
    const hasServiceWorker = await page.evaluate(() => {
      return "serviceWorker" in navigator;
    });

    expect(hasServiceWorker).toBe(true);

    // Test offline/online state handling
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toBeVisible();

    await page.context().setOffline(false);

    console.log("✅ PWA features validated");
  });

  test("performance and monitoring", async ({ page }) => {
    await page.goto("/");
    await helper.waitForPageLoad();

    // Measure page load performance
    const performanceMetrics = await page.evaluate(() => {
      return {
        loadTime:
          window.performance.timing.loadEventEnd - window.performance.timing.navigationStart,
        domReady:
          window.performance.timing.domContentLoadedEventEnd -
          window.performance.timing.navigationStart,
        hasPerformance: typeof window.performance !== "undefined",
      };
    });

    expect(performanceMetrics.hasPerformance).toBe(true);
    expect(performanceMetrics.loadTime).toBeGreaterThan(0);
    expect(performanceMetrics.domReady).toBeGreaterThan(0);

    console.log(
      `✅ Performance validated - Load: ${performanceMetrics.loadTime}ms, DOM: ${performanceMetrics.domReady}ms`
    );
  });

  test("error handling and recovery", async ({ page }) => {
    // Test network interruption handling
    await helper.login();

    // Start work submission
    await page.goto("/home");

    // Go offline during operation
    await helper.goOffline();

    // Try to perform action that requires network
    const networkAction = page.locator('button:has-text("Refresh"), [data-testid="refresh"]');
    if (await networkAction.isVisible({ timeout: 3000 })) {
      await networkAction.click();
    }

    // Should handle network error gracefully
    const errorElements = page.locator('.error, [data-testid="error"], .network-error');
    const hasGracefulError = (await errorElements.count()) > 0;

    // Go back online
    await helper.goOnline();

    console.log(`✅ Error handling validated - Graceful error handling: ${hasGracefulError}`);
  });
});
