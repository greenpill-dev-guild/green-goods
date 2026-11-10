/** CI Playwright, anonymous production shell; no production auth bypass or installed-profile claim. */
// TEST-QUALITY: allow-small-test-file - anonymous production recovery and offline-cache proof share the preview preset
import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";

type LogoBox = { top: number; width: number; height: number };
type LogoHandoffWindow = Window & { __pwaLogoHandoff: { boot?: LogoBox; react?: LogoBox } };

async function observeLogoHandoff(page: Page) {
  await page.addInitScript(() => {
    const state = {} as { boot?: LogoBox; react?: LogoBox };
    (window as LogoHandoffWindow).__pwaLogoHandoff = state;
    const observe = () => {
      const fallback = document.getElementById("boot-fallback");
      const phase = fallback && !fallback.hidden ? "boot" : "react";
      // The logo's slot, not the image: the loading screen's logo breathes (it
      // scales), and the hand-over must hold where the logo is laid out.
      const logo = document.querySelector(
        phase === "boot" ? ".boot-pwa-logo-slot img" : '#root img[src="/icon.png"]'
      )?.parentElement;
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

function recoveryWorkStorage(write: boolean): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Disposable IndexedDB fixtures stand in for locally saved work during the restart.
    const open = indexedDB.open("pwa-recovery-test");
    open.onupgradeneeded = () => open.result.createObjectStore("work");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("work", write ? "readwrite" : "readonly");
      const work = tx.objectStore("work");
      if (write) {
        work.put("draft notes", "draft");
        work.put(new Uint8Array([1, 2, 3]), "queued upload");
      }
      const draft = work.get("draft");
      const upload = work.get("queued upload");
      tx.oncomplete = () => {
        db.close();
        resolve({ draft: draft.result, upload: Array.from(upload.result ?? []) });
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
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
  await expect(page.getByTestId("login-button")).toHaveText("Continue with Passkey", {
    timeout: 30000,
  });
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
  await expect(page.getByTestId("login-button")).toHaveText("Continue with Passkey");
  await expectStableLogoHandoff(page, 254);
  await info.attach("phone-logo-handoff", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await test.step("apply a waiting update from the mobile startup screen", async () => {
    // A different script URL installs a genuine waiting worker for the same
    // scope. The worker and its precache come from the production build.
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js?recovery-proof=1", { scope: "/home" });
    });
    await page.waitForFunction(async () =>
      (await navigator.serviceWorker.getRegistration())?.waiting?.scriptURL.includes(
        "recovery-proof=1"
      )
    );
    await page.evaluate(recoveryWorkStorage, true);
    await cdp.send("Network.setBlockedURLs", { urls: ["*/assets/index-*.js"] });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Taking longer to load.")).toBeVisible({ timeout: 10_000 });
    const startupScreenshot = info.outputPath("mobile-startup-recovery.png");
    await page.screenshot({ path: startupScreenshot });
    await info.attach("mobile-startup-recovery", { path: startupScreenshot });
    await cdp.send("Network.setBlockedURLs", { urls: [] });
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByTestId("login-button")).toBeVisible({ timeout: 25_000 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          navigator.serviceWorker.controller?.scriptURL.includes("recovery-proof=1")
        )
      )
      .toBe(true);
    expect(await page.evaluate(recoveryWorkStorage, false)).toEqual({
      draft: "draft notes",
      upload: [1, 2, 3],
    });
    expect(await page.evaluate(() => localStorage.getItem("gg-crash-reports"))).toContain(
      "startup_module_failed"
    );
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expectStableLogoHandoff(page, 177);
  // Block worker-originated fetches too; page offline emulation alone can leave them reachable.
  await context.route("**/*", (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  // Chromium exposes page connectivity separately from request emulation.
  await cdp.send("Network.overrideNetworkState", {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("login-button")).toHaveText("Continue with Passkey");
  await expectStableLogoHandoff(page, 177);
  await expect(page).toHaveURL(/\/home\/login\?presentation=pwa$/);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  const fontResponses: { path: string; worker: boolean }[] = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (/\/fonts\/jakarta-(latin|vietnamese)-(normal|italic)\.woff2$/.test(path)) {
      fontResponses.push({ path, worker: response.fromServiceWorker() });
    }
  });
  // Decode fresh bytes rather than relying on a FontFace warmed online. The
  // page HTTP cache is disabled, network fetches are blocked, and each response
  // below must explicitly come from the worker.
  const decodedFonts = await page.evaluate(async () => {
    return Promise.all(
      ["normal", "italic"].map(async (style) => {
        const response = await fetch(`/fonts/jakarta-latin-${style}.woff2`, { cache: "reload" });
        const face = new FontFace(`offline-proof-${style}`, await response.arrayBuffer(), {
          style,
        });
        await face.load();
        return { style: face.style, status: face.status };
      })
    );
  });
  expect(decodedFonts).toEqual([
    { style: "normal", status: "loaded" },
    { style: "italic", status: "loaded" },
  ]);
  expect(fontResponses).toEqual(
    expect.arrayContaining([
      { path: "/fonts/jakarta-latin-normal.woff2", worker: true },
      { path: "/fonts/jakarta-latin-italic.woff2", worker: true },
    ])
  );
  const offlineFonts = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('400 16px "Plus Jakarta Sans"'),
      document.fonts.load('italic 800 16px "Plus Jakarta Sans"'),
    ]);
    return faces.map((group) => group.map((face) => ({ style: face.style, status: face.status })));
  });
  expect(
    offlineFonts,
    "The installed face must load with page and worker requests blocked"
  ).toEqual([[{ style: "normal", status: "loaded" }], [{ style: "italic", status: "loaded" }]]);
  // The vietnamese subset carries the dot-below letters of Yoruba and Igbo names
  // (ẹ, ọ, ị, ụ), which extended Latin skips; it comes from the precache too.
  const dotBelowRanges = await page.evaluate(async () =>
    (await document.fonts.load('400 16px "Plus Jakarta Sans"', "Ọmọ"))
      .filter((face) => face.status === "loaded")
      .map((face) => face.unicodeRange)
  );
  expect(
    dotBelowRanges.some((range) => /u\+1ea0-1ef9/i.test(range)),
    "The dot-below letters must draw in the installed face offline"
  ).toBe(true);
  expect(fontResponses).toContainEqual({
    path: "/fonts/jakarta-vietnamese-normal.woff2",
    worker: true,
  });
  await info.attach("production-offline-shell", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const removedFont = await page.evaluate(async () => {
    let count = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (
          new URL(request.url).pathname === "/fonts/jakarta-latin-normal.woff2" &&
          (await cache.delete(request))
        )
          count++;
      }
    }
    return count;
  });
  expect(removedFont, "The control must remove the cached font").toBeGreaterThan(0);
  await expect(
    page.evaluate(async () => {
      await fetch("/fonts/jakarta-latin-normal.woff2", { cache: "reload" });
    })
  ).rejects.toThrow();
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
  await cdp.send("Network.overrideNetworkState", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await context.unroute("**/*");
  await cdp.detach();
  await expectEvidenceFailureContained(page);
  await info.attach("public-home-evidence-failure", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await test.step("recover a browser app URL on a phone viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    // The preceding negative control removed this context's cached document.
    // Exercise the website's normal network entry in a plain browser visit.
    const websiteSession = await context.newCDPSession(page);
    await websiteSession.send("Network.enable");
    await websiteSession.send("Network.setBypassServiceWorker", { bypass: true });
    await page.goto("/home/profile?presentation=website");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await websiteSession.send("Network.setBlockedURLs", { urls: ["*/assets/index-*.js"] });
    await page.goto("/home/profile?presentation=website");
    const home = page.getByRole("link", { name: "Go to Homepage" });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");
    const websiteScreenshot = info.outputPath("mobile-website-homepage-recovery.png");
    await page.screenshot({ path: websiteScreenshot });
    await info.attach("mobile-website-homepage-recovery", { path: websiteScreenshot });
    await websiteSession.send("Network.setBlockedURLs", { urls: [] });
    await home.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await websiteSession.detach();
  });
});

async function expectEvidenceFailureContained(page: Page) {
  let blocked = 0;
  const manifest = JSON.parse(
    readFileSync(new URL("../../packages/client/dist/.vite/manifest.json", import.meta.url), "utf8")
  ) as Record<string, { file: string }>;
  const evidenceAsset = manifest["src/views/Public/HomeEvidence.tsx"]?.file;
  expect(evidenceAsset, "The built lazy evidence entry must exist").toBeTruthy();
  await page.route(`**/${evidenceAsset}`, (route) => {
    blocked++;
    return route.abort("internetdisconnected");
  });
  await page.goto("/?presentation=website");
  const hero = page.getByRole("heading", { level: 1 });
  await expect(hero).toBeVisible();
  const evidence = page.getByTestId("home-evidence");
  await evidence.scrollIntoViewIfNeeded();
  await expect(evidence.getByRole("alert")).toContainText("Live garden information is unavailable");
  expect(blocked, "The production lazy import must actually fail").toBeGreaterThan(0);
  await expect(hero).toBeAttached();
  await expect(page.locator("footer")).toContainText("Green Goods");
  await expect(evidence.getByRole("link", { name: "Explore Gardens" })).toHaveAttribute(
    "href",
    "/gardens"
  );
}
