/**
 * Client Offline Sync CI Tests
 *
 * Lightweight CI-runnable tests that validate offline detection and
 * sync UI behavior WITHOUT requiring real auth or blockchain.
 *
 * Strategy:
 * - Use Playwright's context.setOffline() to toggle network state
 * - Use the sessionStorage mock-auth seam for authenticated state
 * - Test offline indicator rendering and state transitions
 * - Verify service worker registration
 *
 * For full infrastructure tests, use: npx playwright test --project=client-full
 */

import { expect, test } from "@playwright/test";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;
const PWA_DEV_SERVICE_WORKER_SCRIPT = "/dev-sw.js?dev-sw";
const PWA_APP_SCOPE = "/home";

/**
 * Set up mocked environment with auth and GraphQL mocking.
 */
async function setupMockedEnvironment(page: import("@playwright/test").Page) {
  return setupAuthenticatedClient(page);
}

/**
 * Wait until the PWA app shell (AppBar and its lazily imported route module)
 * is actually mounted. The boot fallback clears before the router resolves
 * the authed shell, so going offline any earlier turns the pending dynamic
 * import of AppShell.tsx into a chunk-load error and the update-recovery
 * screen — instead of the offline indicator these tests assert on.
 */
async function waitForAppShell(page: import("@playwright/test").Page) {
  await page.getByTestId("authenticated-nav").waitFor({ timeout: 30000 });
}

async function waitForActiveServiceWorker(page: import("@playwright/test").Page) {
  const prerequisites = await page.evaluate(() => ({
    secureContext: window.isSecureContext,
    supported: "serviceWorker" in navigator,
  }));

  expect(
    prerequisites,
    "Offline reload requires service-worker support on a secure localhost or HTTPS origin."
  ).toEqual({ secureContext: true, supported: true });

  // The app normally registers the dev worker during boot. If that has not
  // started yet, register once, then observe that worker's lifecycle instead
  // of racing repeated register/update calls against the app.
  await page.evaluate(
    async ({ scriptUrl, scope, timeoutMs }) => {
      let registration = await navigator.serviceWorker.getRegistration(scope);
      let registrationError: unknown;

      if (!registration) {
        try {
          registration = await navigator.serviceWorker.register(scriptUrl, {
            scope,
            updateViaCache: "none",
          });
        } catch (error) {
          registrationError = error;
          registration = await navigator.serviceWorker.getRegistration(scope);
        }
      }

      if (!registration) {
        const detail = registrationError instanceof Error ? `: ${registrationError.message}` : "";
        throw new Error(`Service worker registration failed${detail}`);
      }
      if (registration.active?.state === "activated") return;

      const worker = registration.installing ?? registration.waiting ?? registration.active;
      if (!worker) {
        throw new Error("Service worker registration has no installing, waiting, or active worker");
      }

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          window.clearTimeout(timeout);
          worker.removeEventListener("statechange", onStateChange);
        };
        const onStateChange = () => {
          if (worker.state === "activated" || registration.active?.state === "activated") {
            cleanup();
            resolve();
          } else if (worker.state === "redundant") {
            cleanup();
            reject(new Error("Service worker became redundant before activation"));
          }
        };
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error(`Service worker remained ${worker.state} after ${timeoutMs}ms`));
        }, timeoutMs);

        worker.addEventListener("statechange", onStateChange);
        onStateChange();
      });
    },
    {
      scriptUrl: PWA_DEV_SERVICE_WORKER_SCRIPT,
      scope: PWA_APP_SCOPE,
      timeoutMs: 20000,
    }
  );

  await expect
    .poll(
      () =>
        page.evaluate(async (scope) => {
          const registration = await navigator.serviceWorker.getRegistration(scope);
          return registration?.active?.state ?? null;
        }, PWA_APP_SCOPE),
      {
        message:
          "Expected vite-plugin-pwa's development service worker to activate for the /home app scope.",
        timeout: 15000,
      }
    )
    .toBe("activated");
}

async function ensureServiceWorkerControlsPage(page: import("@playwright/test").Page) {
  if (await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) return;

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      message: "Expected the active PWA service worker to control the reloaded app page.",
      timeout: 10000,
    })
    .toBe(true);
}

test.describe("Offline Sync CI Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Offline Detection", () => {
    test("shows offline indicator when network is disconnected", async ({ page, context }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();
      await waitForAppShell(page);

      await context.setOffline(true);
      await expect(page.getByRole("status", { name: "App is in offline mode" })).toBeVisible({
        timeout: 10000,
      });

      // Restore online state for cleanup
      await context.setOffline(false);
    });

    test("hides offline indicator when network reconnects", async ({ page, context }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();
      await waitForAppShell(page);

      await context.setOffline(true);
      const offlineStatus = page.getByRole("status", { name: "App is in offline mode" });
      await expect(offlineStatus).toBeVisible({ timeout: 10000 });

      // Go back online
      await context.setOffline(false);
      await expect(page.getByRole("status", { name: "App is back online" })).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("PWA Service Worker", () => {
    test("client app loads under an active service worker", async ({ page }) => {
      await page.goto("/home/login?presentation=pwa");
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByText("Unexpected Application Error", { exact: true })).toHaveCount(0);
      // The unauthenticated splash may open on either panel (sign-in exposes
      // login-button; create-account exposes its own primary button) — the
      // assertion is that an interactive auth screen rendered, not which panel.
      await expect(
        page.getByTestId("login-button").or(page.getByRole("button", { name: "Create Account" }))
      ).toBeVisible({ timeout: 10000 });
      await waitForActiveServiceWorker(page);

      const registrationScope = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.scope ?? "";
      });
      expect(new URL(registrationScope).pathname.replace(/\/$/, "")).toBe("/home");
    });

    test("reloads the authenticated app shell while offline", async ({ page, context }) => {
      // SKIP: #338 owner:afo expiry:2026-09-15 — Vite dev SW has no precached navigation shell.
      test.skip(
        process.env.PLAYWRIGHT_PWA_PREVIEW !== "true",
        "Offline reload requires a production PWA preview with a precached /home app shell; " +
          "the default CI Vite dev worker registers but does not precache index.html. " +
          "Set PLAYWRIGHT_PWA_PREVIEW=true only when serving a production preview."
      );

      await page.addInitScript(() => {
        const key = "__gg_e2e_navigation_count";
        const nextCount = Number(window.sessionStorage.getItem(key) ?? "0") + 1;
        window.sessionStorage.setItem(key, String(nextCount));
      });

      const helper = await setupMockedEnvironment(page);
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      const appMarker = page.getByTestId("work-dashboard-button");
      await expect(appMarker).toBeVisible({ timeout: 10000 });
      await waitForActiveServiceWorker(page);
      await ensureServiceWorkerControlsPage(page);
      await expect(appMarker).toBeVisible({ timeout: 10000 });

      const navigationCountBeforeOfflineReload = await page.evaluate(() =>
        Number(window.sessionStorage.getItem("__gg_e2e_navigation_count"))
      );

      await context.setOffline(true);
      await expect(page.getByRole("status", { name: "App is in offline mode" })).toBeVisible({
        timeout: 10000,
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/home(?:[/?#]|$)/);
      await expect(appMarker).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Unexpected Application Error", { exact: true })).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
        .toBe(true);

      const navigationCountAfterOfflineReload = await page.evaluate(() =>
        Number(window.sessionStorage.getItem("__gg_e2e_navigation_count"))
      );
      expect(navigationCountAfterOfflineReload).toBeGreaterThan(navigationCountBeforeOfflineReload);

      await context.setOffline(false);
    });
  });

  test.describe("Work Dashboard Offline Behavior", () => {
    test("work dashboard button remains functional during network changes", async ({
      page,
      context,
    }) => {
      const helper = await setupMockedEnvironment(page);
      await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
      await helper.waitForPageLoad();

      const dashboardButton = page.locator('[data-testid="work-dashboard-button"]');
      await expect(dashboardButton).toBeVisible({ timeout: 10000 });

      // Verify button is enabled while online
      await expect(dashboardButton).toBeEnabled();

      await context.setOffline(true);
      await expect(page.getByRole("status", { name: "App is in offline mode" })).toBeVisible({
        timeout: 10000,
      });

      // Button should still be interactive while offline
      // (offline work management is a core feature)
      await expect(dashboardButton).toBeEnabled();

      // Click it — should open the dashboard even offline
      await dashboardButton.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      // Restore online state
      await context.setOffline(false);
    });
  });
});
