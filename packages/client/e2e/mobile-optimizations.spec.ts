import { test, expect, type Page } from '@playwright/test';

test.describe('Mobile Optimizations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');
  });

  test('should have proper touch target sizes on mobile', async ({ page, isMobile }) => {
    if (!isMobile) return;

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check button touch targets are at least 44px
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('should have momentum scrolling enabled', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.waitForLoadState('networkidle');

    // Check for momentum scrolling CSS properties
    const scrollableElements = await page.locator('[class*="momentum-scroll"], [class*="scroll-container"]').all();
    
    for (const element of scrollableElements) {
      const styles = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          webkitOverflowScrolling: (computed as any).webkitOverflowScrolling || (el as any).style.webkitOverflowScrolling,
          overscrollBehavior: computed.overscrollBehavior,
        };
      });

      // Check for iOS momentum scrolling
      if (styles.webkitOverflowScrolling) {
        expect(styles.webkitOverflowScrolling).toBe('touch');
      }
    }
  });

  test('should prevent horizontal scrolling', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check that body doesn't allow horizontal overflow
    const bodyStyles = await page.evaluate(() => {
      const computed = getComputedStyle(document.body);
      return {
        overflowX: computed.overflowX,
      };
    });

    expect(bodyStyles.overflowX).toBe('hidden');
  });

  test('should have proper safe area handling', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.waitForLoadState('networkidle');

    // Check for safe area CSS custom properties
    const safeAreaElements = await page.locator('[class*="safe-area"]').all();
    
    if (safeAreaElements.length > 0) {
      const element = safeAreaElements[0];
      const styles = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom,
        };
      });

      // Safe area padding should be applied
      expect(styles.paddingTop || styles.paddingBottom).toBeTruthy();
    }
  });

  test('should have GPU-accelerated elements', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for GPU acceleration on performance-critical elements
    const acceleratedElements = await page.locator('[class*="gpu-accelerated"], [class*="performance-optimized"]').all();
    
    for (const element of acceleratedElements) {
      const transform = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return computed.transform;
      });

      // Should have translateZ(0) or other transform for GPU acceleration
      expect(transform).not.toBe('none');
    }
  });

  test('should disable tap highlights on interactive elements', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.waitForLoadState('networkidle');

    // Check buttons and interactive elements for tap highlight removal
    const interactiveElements = await page.locator('button, [class*="touch-button"], [class*="no-tap-highlight"]').all();
    
    for (const element of interactiveElements) {
      const tapHighlight = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return (computed as any).webkitTapHighlightColor || (el as any).style.webkitTapHighlightColor;
      });

      if (tapHighlight) {
        expect(tapHighlight).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
      }
    }
  });

  test('should handle touch gestures properly', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.waitForLoadState('networkidle');

    // Test touch interaction on buttons
    const buttons = await page.locator('button').all();
    
    if (buttons.length > 0) {
      const button = buttons[0];
      
      // Simulate touch interaction
      await button.tap();
      
      // Button should respond to touch (this is a basic test)
      await expect(button).toBeVisible();
    }
  });
});

test.describe('Performance Optimizations', () => {
  test('should have optimized bundle loading', async ({ page }) => {
    // Start performance measurement
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Measure performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        firstPaint: 0, // Will be filled below
        firstContentfulPaint: 0, // Will be filled below
      };
    });

    // Get paint timing
    const paintMetrics = await page.evaluate(() => {
      const paints = performance.getEntriesByType('paint');
      const fp = paints.find(paint => paint.name === 'first-paint');
      const fcp = paints.find(paint => paint.name === 'first-contentful-paint');
      
      return {
        firstPaint: fp?.startTime || 0,
        firstContentfulPaint: fcp?.startTime || 0,
      };
    });

    // Assert performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(3000); // Less than 3 seconds
    expect(paintMetrics.firstContentfulPaint).toBeLessThan(2000); // Less than 2 seconds

    console.log('Performance Metrics:', { ...metrics, ...paintMetrics });
  });

  test('should lazy load images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for images with loading="lazy"
    const lazyImages = await page.locator('img[loading="lazy"]').all();
    
    expect(lazyImages.length).toBeGreaterThan(0);

    // Check for intersection observer usage (optimized images)
    const hasIntersectionObserver = await page.evaluate(() => {
      return 'IntersectionObserver' in window;
    });

    expect(hasIntersectionObserver).toBe(true);
  });

  test('should have proper cache headers for static assets', async ({ page }) => {
    // Monitor network requests
    const requests: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.js') || url.includes('.css') || url.includes('.woff')) {
        const cacheControl = response.headers()['cache-control'];
        if (cacheControl) {
          requests.push(`${url}: ${cacheControl}`);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have some cached assets
    expect(requests.length).toBeGreaterThan(0);
    console.log('Cache headers:', requests);
  });

  test('should have efficient chunk loading', async ({ page }) => {
    // Monitor JavaScript chunks
    const jsRequests: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.js') && !url.includes('node_modules')) {
        jsRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have multiple chunks for code splitting
    expect(jsRequests.length).toBeGreaterThan(1);
    
    // Check for vendor chunks
    const hasVendorChunk = jsRequests.some(url => url.includes('vendor') || url.includes('react'));
    expect(hasVendorChunk).toBe(true);

    console.log('JavaScript chunks:', jsRequests);
  });

  test('should handle scroll performance', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find a scrollable container
    const scrollContainer = page.locator('[class*="scroll-container"], [class*="momentum-scroll"]').first();
    
    if (await scrollContainer.count() > 0) {
      // Measure scroll performance
      const scrollStartTime = Date.now();
      
      // Perform scroll action
      await scrollContainer.hover();
      await page.mouse.wheel(0, 500);
      
      const scrollEndTime = Date.now();
      const scrollDuration = scrollEndTime - scrollStartTime;
      
      // Scroll should be responsive (less than 100ms for basic scroll)
      expect(scrollDuration).toBeLessThan(100);
    }
  });
});

test.describe('Responsive Design', () => {
  test('should adapt to different screen sizes', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000); // Allow for responsive adjustments

    // Check that mobile navigation is visible
    const mobileNav = page.locator('[class*="fixed"], [class*="bottom-0"]');
    await expect(mobileNav).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    // Elements should still be properly sized
    const buttons = await page.locator('button').all();
    if (buttons.length > 0) {
      const box = await buttons[0].boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(32);
    }
  });

  test('should handle orientation changes', async ({ page, isMobile }) => {
    if (!isMobile) return;

    // Portrait mode
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Landscape mode
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1000);

    // Layout should still be functional
    const appBar = page.locator('[class*="fixed"][class*="bottom-0"]');
    await expect(appBar).toBeVisible();
  });
});

 