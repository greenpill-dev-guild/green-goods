import { expect, test } from "@playwright/test";
import { TEST_URLS } from "../helpers/test-utils";

test.describe("Performance Tests", () => {
  test.describe("Page Load Performance", () => {
    test("client app loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("domcontentloaded");

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000);

      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          let lcp = 0;
          const fid = 0;
          let cls = 0;

          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            lcp = lastEntry.startTime;
          }).observe({ entryTypes: ["largest-contentful-paint"] });

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                cls += (entry as any).value;
              }
            }
          }).observe({ entryTypes: ["layout-shift"] });

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
      await page.waitForLoadState("domcontentloaded");

      const loadTime = Date.now() - startTime;

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
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const criticalFailures = failedRequests.filter((failure) => {
        const isExpected =
          failure.includes("favicon") ||
          failure.includes("analytics") ||
          failure.includes("error") ||
          failure.includes("ERR_ABORTED") || // Navigation aborted during redirect
          failure.includes("service-worker") ||
          failure.includes("sw.js");
        return !isExpected;
      });

      expect(criticalFailures).toHaveLength(0);
    });

    test("bundles are appropriately sized", async ({ request }) => {
      const response = await request.get(TEST_URLS.client);
      const html = await response.text();

      const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
      const styleMatches = html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g);

      const bundles: { url: string; size: number }[] = [];

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

      for (const match of styleMatches) {
        const url = new URL(match[1], TEST_URLS.client).toString();
        try {
          const response = await request.get(url);
          const size = (await response.body()).length;
          bundles.push({ url: match[1], size });
        } catch {
          // A bundle that fails to load is left out of the size total.
        }
      }

      const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
      const largestBundle = Math.max(...bundles.map((b) => b.size));

      expect(totalSize).toBeLessThan(1024 * 1024);

      expect(largestBundle).toBeLessThan(500 * 1024);
    });
  });

  test.describe("Memory Usage", () => {
    test("no memory leaks during navigation", async ({ page }) => {
      await page.goto(TEST_URLS.client);
      await page.waitForLoadState("domcontentloaded");

      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      for (let i = 0; i < 5; i++) {
        await page.goto(`${TEST_URLS.client}/home/login?presentation=pwa`);
        await page.waitForLoadState("domcontentloaded");
        await page.goto(TEST_URLS.client);
        await page.waitForLoadState("domcontentloaded");
      }

      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      await page.waitForTimeout(1000);

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

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
        expect(responseTime).toBeLessThan(1000);
      }
    });
  });
});
