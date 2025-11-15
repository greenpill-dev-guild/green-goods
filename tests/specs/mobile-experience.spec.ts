import { expect, test } from "@playwright/test";
import { BasePage } from "../pages/base.page";

test.describe("Mobile PWA Experience", () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    basePage = new (class extends BasePage {})(page);
  });

  test("should work properly on mobile devices", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Check PWA features
    const pwaFeatures = await basePage.checkPWAFeatures();
    expect(pwaFeatures.hasManifest).toBe(true);

    // Test mobile interactions
    await basePage.simulateMobileGestures();

    // Verify page is still responsive after touch
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle responsive design", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Test different viewport sizes
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await expect(page.locator("body")).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet size
    await expect(page.locator("body")).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 }); // Desktop size
    await expect(page.locator("body")).toBeVisible();
  });

  test("should support offline functionality", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Ensure service worker is active for this flow (PWA tests run with SW enabled)
    const swReady = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg?.active;
    });
    expect(swReady).toBe(true);

    // Simulate offline
    await context.setOffline(true);

    // Test that cached content still works
    await page.reload();
    await expect(page.locator("body")).toBeVisible();

    // Re-enable network
    await context.setOffline(false);
  });

  test("should load PWA manifest correctly", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Check manifest properties
    const manifestInfo = await page.evaluate(async () => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) return null;

      try {
        const response = await fetch(manifestLink.getAttribute("href")!);
        const manifest = await response.json();
        return {
          name: manifest.name,
          shortName: manifest.short_name,
          display: manifest.display,
          startUrl: manifest.start_url,
          hasIcons: manifest.icons && manifest.icons.length > 0,
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(manifestInfo).toBeDefined();
    expect(manifestInfo?.name).toBe("Green Goods");
    expect(manifestInfo?.display).toBe("standalone");
    expect(manifestInfo?.hasIcons).toBe(true);
  });

  test("should handle touch gestures properly", async ({ page }) => {
    // Only run on mobile projects
    if (!page.viewportSize() || page.viewportSize()!.width > 768) {
      test.skip();
    }

    await page.goto("/");
    await basePage.waitForPageLoad();

    // Test swipe gestures
    await page.touchscreen.tap(200, 300);
    await page.touchscreen.tap(400, 300);

    // Verify app responds to touch
    await expect(page.locator("body")).toBeVisible();
  });

  test("should work in landscape and portrait modes", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Portrait mode
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("body")).toBeVisible();

    // Landscape mode
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.locator("body")).toBeVisible();
  });
});
