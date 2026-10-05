/** CI Playwright, anonymous production shell; no production auth bypass or installed-profile claim. */
// TEST-QUALITY: allow-small-test-file - positive reload and missing-cache control share one worker installation
import { expect, test } from "@playwright/test";

test("production navigation cache restores the anonymous shell offline and is required", async ({
  page,
  context,
}, info) => {
  expect(
    process.env.PLAYWRIGHT_PWA_PREVIEW,
    "Use the pwa-preview preset to build production assets"
  ).toBe("true");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.goto("/home/login?presentation=pwa");
  await expect(page.getByTestId("login-button")).toHaveText("Create Account", { timeout: 30000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // This worker deliberately does not claim the already-open page.
  await page.reload();
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js")
  );
  await expect(page.getByTestId("login-button")).toHaveText("Create Account");
  // Block worker-originated fetches too; page offline emulation alone can leave them reachable.
  await context.route("**/*", (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("login-button")).toHaveText("Create Account");
  await expect(page).toHaveURL(/\/home\/login\?presentation=pwa$/);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await info.attach("production-offline-shell", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  // Delete just the navigation entry, keeping the worker and JS cache intact.
  const removed = await page.evaluate(async () => {
    let count = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname === "/index.html" && (await cache.delete(request)))
          count++;
      }
    }
    return count;
  });
  expect(removed, "The test must actually remove the worker's navigation document").toBeGreaterThan(
    0
  );
  await expect(
    page.goto("/home/login?presentation=pwa&cache-control=missing", {
      waitUntil: "domcontentloaded",
    })
  ).rejects.toThrow();
  await context.setOffline(false);
  await cdp.detach();
});
