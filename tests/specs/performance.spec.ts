import { test, expect } from "@playwright/test";
import { BasePage } from "../pages/base.page";

test.describe("Performance Monitoring", () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    basePage = new (class extends BasePage {})(page);
  });

  test("should load homepage within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await basePage.waitForPageLoad();

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    console.log(`Homepage loaded in ${loadTime}ms`);
  });

  test("should have acceptable Core Web Vitals", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Measure Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: any = {};

          entries.forEach((entry) => {
            if (entry.name === "first-contentful-paint") {
              metrics.fcp = entry.startTime;
            }
            if (entry.name === "largest-contentful-paint") {
              metrics.lcp = entry.startTime;
            }
          });

          resolve(metrics);
        });

        observer.observe({ entryTypes: ["paint", "largest-contentful-paint"] });

        // Fallback timeout
        setTimeout(() => resolve({}), 3000);
      });
    });

    console.log("Core Web Vitals:", metrics);

    // Basic performance expectations
    if ((metrics as any).fcp) {
      expect((metrics as any).fcp).toBeLessThan(2000); // FCP should be under 2s
    }
    if ((metrics as any).lcp) {
      expect((metrics as any).lcp).toBeLessThan(4000); // LCP should be under 4s
    }
  });

  test("should handle GraphQL queries efficiently", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    const startTime = Date.now();

    // Test GraphQL query performance
    const response = await page.evaluate(async () => {
      const start = performance.now();

      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query {
                Garden(limit: 5) {
                  id
                  name
                  tokenAddress
                }
              }
            `,
          }),
        });

        const data = await res.json();
        const end = performance.now();

        return {
          duration: end - start,
          success: res.ok,
          dataSize: JSON.stringify(data).length,
        };
      } catch (error) {
        return {
          duration: performance.now() - start,
          success: false,
          error: error.message,
        };
      }
    });

    expect(response.success).toBe(true);
    expect(response.duration).toBeLessThan(2000); // Should respond within 2s

    console.log(`GraphQL query completed in ${response.duration}ms`);
  });

  test("should maintain performance on mobile devices", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const startTime = Date.now();

    await page.goto("/");
    await basePage.waitForPageLoad();

    const loadTime = Date.now() - startTime;

    // Mobile should load within 6 seconds (allowing for slower devices)
    expect(loadTime).toBeLessThan(6000);
    console.log(`Mobile page loaded in ${loadTime}ms`);
  });

  test("should handle memory usage efficiently", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Get initial memory usage
    const memoryInfo = await page.evaluate(() => {
      return (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
          }
        : null;
    });

    if (memoryInfo) {
      console.log("Memory usage:", memoryInfo);

      // Basic memory checks (values in bytes)
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // Under 50MB
      expect(memoryInfo.usedJSHeapSize).toBeGreaterThan(0);
    }
  });

  test("should handle network timeouts gracefully", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Test with slow network conditions
    await page.route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Add 1s delay
      route.continue();
    });

    const startTime = Date.now();

    // Navigate to another page
    await page.click("a").catch(() => {
      // Might not have navigation links, that's okay
    });

    const responseTime = Date.now() - startTime;

    // Should handle delays gracefully
    expect(responseTime).toBeLessThan(10000); // Within 10s even with delays
  });
});
