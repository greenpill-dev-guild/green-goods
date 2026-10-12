/** CI Playwright, anonymous production shell; no production auth bypass or installed-profile claim. */
// TEST-QUALITY: allow-small-test-file - positive reload and missing-cache control share one worker installation
import { expect, type Page, test } from "@playwright/test";

type LogoBox = { top: number; width: number; height: number };
type LogoHandoffWindow = Window & { __pwaLogoHandoff: { boot?: LogoBox; react?: LogoBox } };

async function observeLogoHandoff(page: Page) {
  await page.addInitScript(() => {
    const state = {} as { boot?: LogoBox; react?: LogoBox };
    (window as LogoHandoffWindow).__pwaLogoHandoff = state;
    const observe = () => {
      const fallback = document.getElementById("boot-fallback");
      const phase = fallback && !fallback.hidden ? "boot" : "react";
      const logo = document.querySelector(
        phase === "boot" ? ".boot-pwa-logo-slot img" : '#root img[src="/icon.png"]'
      );
      const rect = logo?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        state[phase] = { top: rect.top, width: rect.width, height: rect.height };
      }
      if (!state.react) requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
}

async function expectStableLogoHandoff(page: Page, expectedTop: number) {
  await page.waitForFunction(() => (window as LogoHandoffWindow).__pwaLogoHandoff.react);
  const { boot, react } = await page.evaluate(() => (window as LogoHandoffWindow).__pwaLogoHandoff);
  expect(boot, "The real pre-React loading frame must have painted").toBeDefined();
  expect(react).toBeDefined();
  for (const metric of ["top", "width", "height"] as const) {
    expect(
      Math.abs(boot![metric] - react![metric]),
      `Logo ${metric} changed on handoff`
    ).toBeLessThanOrEqual(1);
  }
  expect(react!.top).toBeCloseTo(expectedTop, 0);
}

test("production navigation cache restores the anonymous shell offline and is required", async ({
  page,
  context,
}, info) => {
  expect(
    process.env.PLAYWRIGHT_PWA_PREVIEW,
    "Use the pwa-preview preset to build production assets"
  ).toBe("true");
  const cdp = await context.newCDPSession(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await observeLogoHandoff(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.goto("/home/login?presentation=pwa");
  await expect(page.getByTestId("login-button")).toHaveText("Create Account", { timeout: 30000 });
  await expectStableLogoHandoff(page, 177);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // This worker deliberately does not claim the already-open page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js")
  );
  await expect(page.getByTestId("login-button")).toHaveText("Create Account");
  await expectStableLogoHandoff(page, 254);
  await info.attach("phone-logo-handoff", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expectStableLogoHandoff(page, 177);
  // Block worker-originated fetches too; page offline emulation alone can leave them reachable.
  await context.route("**/*", (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("login-button")).toHaveText("Create Account");
  await expectStableLogoHandoff(page, 177);
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
