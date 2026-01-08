/**
 * Performance E2E Tests
 *
 * Tests for page load times, resource usage, and performance metrics
 */

import { expect, test } from "@playwright/test";
import { TEST_URLS } from "../helpers/test-utils";
import { TIMEOUTS } from "../helpers/test-config";

test.describe("Performance Tests", () => {
  test.describe("Page Load Performance", () => {
    test("client app loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;

      // Page should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);

      // Check for Core Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          let lcp = 0;
          let fid = 0;
          let cls = 0;

          // LCP (Largest Contentful Paint)
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            lcp = lastEntry.startTime;
          }).observe({ entryTypes: ["largest-contentful-paint"] });

          // CLS (Cumulative Layout Shift)
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                cls += (entry as any).value;
              }
            }
          }).observe({ entryTypes: ["layout-shift"] });

          // Wait a bit for metrics to be collected
          setTimeout(() => {
            resolve({ lcp, cls, fid });
          }, 2000);
        });
      });

      // LCP should be under 2.5s (good), 4s (needs improvement)
      expect((metrics as any).lcp).toBeLessThan(4000);

      // CLS should be under 0.1 (good), 0.25 (needs improvement)
      expect((metrics as any).cls).toBeLessThan(0.25);
    });

    test("admin app loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto(TEST_URLS.admin);
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;

      // Page should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe("Resource Loading", () => {
    test("no failed resource requests on client", async ({ page }) => {
      const failedRequests: string[] = [];

      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.failure()?.errorText}: ${request.url()}`);
      });

      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // Should have no failed requests (or only expected ones)
      const criticalFailures = failedRequests.filter(
        (url) => !url.includes("favicon") && !url.includes("analytics") && !url.includes("error")
      );

      expect(criticalFailures).toHaveLength(0);
    });

    test("bundles are appropriately sized", async ({ page, request }) => {
      // Get the main page
      const response = await request.get(TEST_URLS.client);
      const html = await response.text();

      // Extract script and style URLs
      const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
      const styleMatches = html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g);

      const bundles: { url: string; size: number }[] = [];

      // Check script sizes
      for (const match of scriptMatches) {
        const url = new URL(match[1], TEST_URLS.client).toString();
        try {
          const response = await request.get(url);
          const size = (await response.body()).length;
          bundles.push({ url: match[1], size });
        } catch {
          // Ignore errors for external scripts
        }
      }

      // Check style sizes
      for (const match of styleMatches) {
        const url = new URL(match[1], TEST_URLS.client).toString();
        try {
          const response = await request.get(url);
          const size = (await response.body()).length;
          bundles.push({ url: match[1], size });
        } catch {
          // Ignore errors
        }
      }

      // Check bundle sizes
      const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
      const largestBundle = Math.max(...bundles.map((b) => b.size));

      // Total JS/CSS should be under 1MB for initial load
      expect(totalSize).toBeLessThan(1024 * 1024);

      // No single bundle should be over 500KB
      expect(largestBundle).toBeLessThan(500 * 1024);
    });
  });

  test.describe("Memory Usage", () => {
    test("no memory leaks during navigation", async ({ page }) => {
      // Navigate to client app
      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("networkidle");

      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Navigate around a few times
      for (let i = 0; i < 5; i++) {
        await page.goto(`${TEST_URLS.client}/login`);
        await page.waitForLoadState("networkidle");
        await page.goto(TEST_URLS.client);
        await page.waitForLoadState("networkidle");
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      await page.waitForTimeout(1000);

      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Memory should not have grown by more than 50%
      if (initialMemory > 0 && finalMemory > 0) {
        const growth = (finalMemory - initialMemory) / initialMemory;
        expect(growth).toBeLessThan(0.5);
      }
    });
  });

  test.describe("API Response Times", () => {
    test("GraphQL queries respond quickly", async ({ request }) => {
      const queries = [
        { query: "query { __typename }" },
        { query: "query { Garden(limit: 10) { id name } }" },
      ];

      for (const query of queries) {
        const startTime = Date.now();

        const response = await request.post(TEST_URLS.indexer, {
          data: query,
          headers: { "Content-Type": "application/json" },
        });

        const responseTime = Date.now() - startTime;

        expect(response.status()).toBe(200);
        // GraphQL queries should respond in under 1 second
        expect(responseTime).toBeLessThan(1000);
      }
    });
  });

  test.describe("PWA Performance", () => {
    test("service worker caches assets correctly", async ({ page }) => {
      // Navigate to client (PWA)
      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("networkidle");

      // Wait for service worker
      await page.waitForTimeout(2000);

      // Check if service worker is registered
      const swRegistered = await page.evaluate(async () => {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          return registrations.length > 0;
        }
        return false;
      });

      // PWA should have service worker
      expect(swRegistered).toBeTruthy();

      // Go offline
      await page.context().setOffline(true);

      // Reload page
      await page.reload();

      // Page should still load from cache
      const title = await page.title();
      expect(title).toContain("Green Goods");

      // Go back online
      await page.context().setOffline(false);
    });
  });
});
