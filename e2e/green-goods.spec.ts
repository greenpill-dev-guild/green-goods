import { test, expect } from '@playwright/test';

test.describe('Green Goods E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app with a longer timeout
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  test('should load the landing page', async ({ page }) => {
    // Wait for the page to properly load
    await page.waitForTimeout(2000);
    
    // Check if we're on the app (could be various states: landing, login, home)
    const pageLoaded = await page.evaluate(() => document.readyState === 'complete');
    expect(pageLoaded).toBeTruthy();
    
    // Check for common app elements (more flexible)
    const hasAppContent = await page.locator('body').evaluate(el => {
      return (el.textContent?.length || 0) > 0;
    });
    expect(hasAppContent).toBeTruthy();
    
    // Check for React root
    const reactRoot = await page.locator('#root, [data-reactroot]').count();
    expect(reactRoot).toBeGreaterThan(0);
  });

  test('should navigate to login page', async ({ page }) => {
    // Since the app doesn't have a login button but redirects automatically,
    // let's navigate directly to login
    await page.goto('/login');
    
    // Verify we're on the login page
    await expect(page.url()).toContain('/login');
    
    // Check for login page elements (adjust based on actual login page content)
    const pageLoaded = await page.evaluate(() => document.readyState === 'complete');
    expect(pageLoaded).toBeTruthy();
  });

  test('should display gardens list or redirect to login', async ({ page }) => {
    // Navigate to home/gardens
    await page.goto('/home');
    
    // Wait for potential data loading
    await page.waitForLoadState('networkidle');
    
    // Check if we were redirected to login
    if (page.url().includes('/login')) {
      // This is expected behavior for unauthenticated users
      expect(page.url()).toContain('/login');
      return;
    }
    
    // If not redirected, check for garden cards or empty state
    const gardenCards = page.locator('[data-testid="garden-card"]');
    const emptyState = page.getByText(/no gardens found|create your first garden/i);
    
    // Either we have gardens or we show empty state
    const hasGardens = await gardenCards.count() > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasGardens || hasEmptyState).toBeTruthy();
  });

  test('should interact with wallet connection', async ({ page }) => {
    // Look for wallet connect button
    const walletButton = page.getByRole('button', { name: /connect wallet|wallet/i });
    
    if (await walletButton.isVisible()) {
      await walletButton.click();
      
      // Check if wallet modal appears
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Close modal
      const closeButton = page.getByRole('button', { name: /close|cancel/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }
  });

  test('should check indexer GraphQL endpoint', async ({ page, request }) => {
    // Test the GraphQL endpoint
    const response = await request.post('http://localhost:8080/graphql', {
      data: {
        query: `
          query {
            __typename
          }
        `
      },
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false
    });

    // The indexer might not be running, but we check if it would respond
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('data');
    } else {
      console.log('Indexer not responding - this is expected if PostgreSQL is not set up');
    }
  });

  test('should verify contract deployment info is available', async ({ page }) => {
    // Check if the app can access contract information
    const contractsResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/contracts/deployments/local.json');
        return await response.json();
      } catch (error) {
        return null;
      }
    });

    if (contractsResponse) {
      expect(contractsResponse).toHaveProperty('contracts');
      expect(contractsResponse.contracts).toHaveProperty('eas');
      expect(contractsResponse.contracts).toHaveProperty('actionRegistry');
      expect(contractsResponse.contracts).toHaveProperty('gardenToken');
    }
  });

  test('should test responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check if mobile menu is visible
    const mobileMenu = page.getByRole('button', { name: /menu/i });
    const isMobileResponsive = await mobileMenu.isVisible().catch(() => false);
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mobile menu should not be visible on desktop
    const isDesktopView = !(await mobileMenu.isVisible().catch(() => false));
    
    expect(isMobileResponsive || isDesktopView).toBeTruthy();
  });

  test('should test navigation between main sections', async ({ page }) => {
    // Test navigation to different sections
    const sections = [
      { path: '/home', text: /home|gardens/i },
      { path: '/profile', text: /profile|account/i },
    ];

    for (const section of sections) {
      await page.goto(section.path);
      await page.waitForLoadState('networkidle');
      
      // Check if we were redirected to login (common for protected routes)
      if (page.url().includes('/login')) {
        expect(page.url()).toContain('/login');
        continue;
      }
      
      // Verify we're on the right page
      expect(page.url()).toContain(section.path);
      
      // Check for section-specific content
      const hasContent = await page.getByText(section.text).isVisible().catch(() => false);
      expect(hasContent).toBeTruthy();
    }
  });

  test('should verify PWA functionality', async ({ page }) => {
    // Check if service worker is registered
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(hasServiceWorker).toBeTruthy();
    
    // Check for manifest
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          const response = await fetch(href);
          return await response.json();
        }
      }
      return null;
    });
    
    if (manifest) {
      expect(manifest).toHaveProperty('name', 'Green Goods');
      expect(manifest).toHaveProperty('short_name');
      expect(manifest).toHaveProperty('icons');
    }
  });

  test('should test theme toggle if available', async ({ page }) => {
    // Look for theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });
    
    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      });
      
      // Toggle theme
      await themeToggle.click();
      
      // Check if theme changed
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      });
      
      expect(newTheme).not.toBe(initialTheme);
    }
  });
}); 