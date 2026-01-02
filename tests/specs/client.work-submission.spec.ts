/**
 * Client Work Submission E2E Tests
 *
 * Comprehensive work submission flow testing:
 * - Online submission (direct to blockchain)
 * - Offline submission (queued)
 * - Image upload and preview
 * - Form validation
 * - Success/error handling
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS, hasGardens } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

function isIOS(projectName: string | undefined): boolean {
  return projectName === "mobile-safari";
}

test.describe("Work Submission Flows", () => {
  test.use({ baseURL: CLIENT_URL });

  test.beforeEach(async ({ page }, testInfo) => {
    // Authenticate before each test
    const helper = new ClientTestHelper(page);

    if (isIOS(testInfo.project.name)) {
      await helper.setupWalletAuth();
      await helper.authenticateWithWallet();
    } else {
      await helper.setupPasskeyAuth();
      await helper.createPasskeyAccount(`e2e_work_${Date.now()}`);
    }

    await helper.waitForPageLoad();
  });

  test.describe("Online Submission", () => {
    test("submits work when online", async ({ page }) => {
      // Navigate to a garden
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Check if gardens are available
      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Click first garden card
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      await expect(gardenCard).toBeVisible({ timeout: 10000 });
      await gardenCard.click();

      // Wait for garden detail page
      await page.waitForURL(/\/gardens\//);

      // Click first action to submit work
      const actionCard = page.locator('[data-testid="action-card"]').first();
      if (await actionCard.isVisible({ timeout: 5000 })) {
        await actionCard.click();

        // Fill work submission form
        await page.fill('[name="title"]', "E2E Test Work");
        await page.fill('[name="feedback"]', "Testing work submission flow");

        // Submit
        const submitButton = page.getByRole("button", { name: /submit/i });
        await expect(submitButton).toBeVisible();
        await submitButton.click();

        // Should show success message or redirect
        await page.waitForTimeout(2000);
      }
    });

    test("validates required fields before submission", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Navigate to work submission
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          // Try to submit without filling required fields
          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();

            // Should show validation errors
            await page.waitForTimeout(1000);
            // TODO: Assert specific validation messages
          }
        }
      }
    });

    test("uploads and previews images", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Navigate to work submission
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          // Upload image
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible({ timeout: 5000 })) {
            // TODO: Upload actual test image
            // await fileInput.setInputFiles('path/to/test-image.jpg');
            // await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Offline Submission", () => {
    test("queues work when offline", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Navigate to work submission
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          // Go offline
          await context.setOffline(true);

          // Fill and submit form
          await page.fill('[name="title"]', "Offline Test Work");
          await page.fill('[name="feedback"]', "Testing offline queue");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();

            // Should show queued message
            await page.waitForTimeout(2000);
            // TODO: Assert work was queued
          }

          // Go back online
          await context.setOffline(false);
        }
      }
    });

    test("syncs queued work when back online", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Queue work offline
      await context.setOffline(true);

      // Navigate and submit work
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          await page.fill('[name="title"]', "Sync Test Work");
          await page.fill('[name="feedback"]', "Testing sync");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // Go back online and trigger sync
      await context.setOffline(false);
      await page.waitForTimeout(3000);

      // TODO: Verify work was synced
    });

    test("shows offline indicator when disconnected", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);

      // Should show offline indicator
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      await expect(offlineIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Work Dashboard", () => {
    test("opens work dashboard and shows pending work", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Look for work dashboard icon/button
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      if (await dashboardButton.isVisible({ timeout: 5000 })) {
        await dashboardButton.click();

        // Should show dashboard modal
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    });

    test("retries failed work submission", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Open work dashboard
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      if (await dashboardButton.isVisible({ timeout: 5000 })) {
        await dashboardButton.click();

        // Look for retry button on failed work
        const retryButton = page.getByRole("button", { name: /retry/i });
        if (await retryButton.isVisible({ timeout: 5000 })) {
          await retryButton.click();
          await page.waitForTimeout(2000);
          // TODO: Verify retry was triggered
        }
      }
    });
  });

  test.describe("Form Validation", () => {
    test("shows validation error for empty title", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Navigate to work submission
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          // Submit without title
          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(1000);
            // TODO: Assert validation error message
          }
        }
      }
    });

    test("shows validation error for missing images when required", async ({ page }) => {
      // TODO: Implement when image requirements are enforced
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });
  });
});
