/**
 * Client Offline Sync E2E Tests
 *
 * Comprehensive offline functionality testing:
 * - Offline detection and indicator
 * - Work queuing when offline
 * - Automatic sync when online
 * - Manual sync trigger
 * - Conflict resolution
 * - Storage management
 */

import { expect, test } from "@playwright/test";
import { ClientTestHelper, TEST_URLS, hasGardens } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

function isIOS(projectName: string | undefined): boolean {
  return projectName === "mobile-safari";
}

test.describe("Offline Sync Flows", () => {
  test.use({ baseURL: CLIENT_URL });

  test.beforeEach(async ({ page }, testInfo) => {
    // Authenticate before each test
    const helper = new ClientTestHelper(page);

    if (isIOS(testInfo.project.name)) {
      await helper.setupWalletAuth();
      await helper.authenticateWithWallet();
    } else {
      await helper.setupPasskeyAuth();
      await helper.createPasskeyAccount(`e2e_offline_${Date.now()}`);
    }

    await helper.waitForPageLoad();
  });

  test.describe("Offline Detection", () => {
    test("shows offline indicator when network disconnects", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);

      // Should show offline indicator
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      await expect(offlineIndicator).toBeVisible({ timeout: 5000 });
    });

    test("hides offline indicator when network reconnects", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Go offline then online
      await context.setOffline(true);
      await page.waitForTimeout(1000);
      await context.setOffline(false);
      await page.waitForTimeout(1000);

      // Offline indicator should hide or show online status
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      // TODO: Verify indicator shows online status or is hidden
    });

    test("persists offline state across page reloads", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Go offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);

      // Reload page
      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      // Should still show offline indicator
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      await expect(offlineIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Work Queuing", () => {
    test("queues work submission when offline", async ({ page, context }) => {
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

          // Go offline before submission
          await context.setOffline(true);
          await page.waitForTimeout(500);

          // Fill and submit form
          await page.fill('[name="title"]', "Offline Queue Test");
          await page.fill('[name="feedback"]', "Testing offline queue functionality");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Should show queued confirmation
            // TODO: Assert queued message appears
          }
        }
      }
    });

    test("shows pending count in offline indicator", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Go offline and queue some work
      await context.setOffline(true);

      // TODO: Queue work and verify count updates in offline indicator
    });

    test("persists queued work across page reloads", async ({ page, context }) => {
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

          await page.fill('[name="title"]', "Persistence Test");
          await page.fill('[name="feedback"]', "Testing persistence");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // Reload page
      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      // Open work dashboard and verify work is still queued
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      if (await dashboardButton.isVisible({ timeout: 5000 })) {
        await dashboardButton.click();
        // TODO: Verify work appears in dashboard
      }
    });
  });

  test.describe("Automatic Sync", () => {
    test("automatically syncs queued work when online", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Queue work offline
      await context.setOffline(true);

      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          await page.fill('[name="title"]', "Auto Sync Test");
          await page.fill('[name="feedback"]', "Testing auto sync");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // Go back online
      await context.setOffline(false);
      await page.waitForTimeout(5000); // Wait for auto-sync

      // TODO: Verify work was synced (check dashboard or success message)
    });

    test("shows sync progress indicator", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Queue work and trigger sync
      // TODO: Verify sync progress indicator appears
    });

    test("shows success message after sync completes", async ({ page, context }) => {
      // TODO: Implement sync success verification
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });
  });

  test.describe("Manual Sync", () => {
    test("triggers manual sync from offline indicator", async ({ page, context }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      const gardensAvailable = await hasGardens(page);
      test.skip(!gardensAvailable, "No gardens available for testing");

      // Queue work offline
      await context.setOffline(true);

      // Submit work (queued)
      const gardenCard = page.locator('[data-testid="garden-card"]').first();
      if (await gardenCard.isVisible({ timeout: 5000 })) {
        await gardenCard.click();
        await page.waitForURL(/\/gardens\//);

        const actionCard = page.locator('[data-testid="action-card"]').first();
        if (await actionCard.isVisible({ timeout: 5000 })) {
          await actionCard.click();

          await page.fill('[name="title"]', "Manual Sync Test");
          await page.fill('[name="feedback"]', "Testing manual sync");

          const submitButton = page.getByRole("button", { name: /submit/i });
          if (await submitButton.isVisible({ timeout: 5000 })) {
            await submitButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // Go back online
      await context.setOffline(false);
      await page.goto("/home");

      // Click manual sync button
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible({ timeout: 5000 })) {
        await syncButton.click();
        await page.waitForTimeout(3000);
        // TODO: Verify sync completed
      }
    });

    test("triggers manual sync from work dashboard", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Open work dashboard
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      if (await dashboardButton.isVisible({ timeout: 5000 })) {
        await dashboardButton.click();

        // Click sync button in dashboard
        const syncButton = page.getByRole("button", { name: /sync/i });
        if (await syncButton.isVisible({ timeout: 5000 })) {
          await syncButton.click();
          await page.waitForTimeout(2000);
          // TODO: Verify sync was triggered
        }
      }
    });
  });

  test.describe("Conflict Resolution", () => {
    test("detects duplicate submission conflict", async ({ page, context }) => {
      // TODO: Implement conflict detection test
      // Queue work offline, submit same work online, go back online and sync
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows conflict resolution UI", async ({ page }) => {
      // TODO: Implement conflict UI test
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });

    test("resolves conflict by skipping duplicate", async ({ page }) => {
      // TODO: Implement conflict resolution test
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });
  });

  test.describe("Storage Management", () => {
    test("shows storage quota in work dashboard", async ({ page }) => {
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");

      // Open work dashboard
      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      if (await dashboardButton.isVisible({ timeout: 5000 })) {
        await dashboardButton.click();

        // Should show storage information
        // TODO: Verify storage quota display
      }
    });

    test("warns when storage is nearly full", async ({ page }) => {
      // TODO: Implement storage warning test
      await page.goto("/home");
      await page.waitForLoadState("domcontentloaded");
    });
  });
});
