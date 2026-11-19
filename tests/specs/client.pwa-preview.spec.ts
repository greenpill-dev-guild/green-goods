/** CI Playwright, anonymous production shell; no production auth bypass or installed-profile claim. */
// TEST-QUALITY: allow-small-test-file - anonymous production recovery and offline-cache proof share the preview preset
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
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

/**
 * Register an app worker and wait for it to reach `until`. Installing copies the whole critical
 * shell, which takes as long as the machine is busy, so this follows the worker's own state
 * rather than a clock.
 */
function registerWorker(page: Page, scriptUrl: string, until: "installed" | "activated") {
  return page.evaluate(
    async ({ scriptUrl, until }) => {
      const order = ["installing", "installed", "activating", "activated"];
      const registration = await navigator.serviceWorker.register(scriptUrl, { scope: "/home" });
      const worker = registration.installing ?? registration.waiting ?? registration.active;
      if (!worker) throw new Error(`${scriptUrl} did not start installing`);
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (worker.state === "redundant") reject(new Error(`${scriptUrl} failed to install`));
          else if (order.indexOf(worker.state) >= order.indexOf(until)) resolve();
        };
        worker.addEventListener("statechange", check);
        check();
      });
    },
    { scriptUrl, until }
  );
}

/** The worker a browser profile kept from an older build, registered without running any app code. */
async function installOldBuildWorker(page: Page) {
  await page.goto("/robots.txt");
  await registerWorker(page, "/sw.js?old-build", "activated");
  expect(await workers(page)).toEqual({ active: "old", waiting: null });
}

/** A tab whose old build lost a chunk, as after a deploy removes the old build's files. */
async function openStuckTab(page: Page, path: string, blocked: string, recoveryText: string) {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", { urls: [blocked] });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(recoveryText)).toBeVisible({ timeout: 10_000 });
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    "The old build's worker must answer the stuck tab"
  ).toMatch(/\?old-build$/);
  return async () => {
    // The new build is whole; only the old worker still stands in the way.
    await session.send("Network.setBlockedURLs", { urls: [] });
    await session.detach();
  };
}

/** The current build's worker installs behind the open old-build tabs and waits. */
async function deployNewBuild(page: Page) {
  await registerWorker(page, "/sw.js", "installed");
  expect(await workers(page)).toEqual({ active: "old", waiting: "new" });
}

/**
 * Hold open the shell-tail downloads the old build's worker starts, as a slow connection would.
 * Any page that registers the app worker asks the active one for its tail, the website included,
 * and an update can activate only once that worker's open work settles. `started` settles once
 * the old worker is downloading; its held requests end only when the worker gives up on them.
 */
async function holdOldWorkerTail(context: BrowserContext): Promise<{ started: Promise<void> }> {
  const shell = JSON.parse(
    readFileSync(
      new URL("../../packages/client/dist/pwa-shell-assets.json", import.meta.url),
      "utf8"
    )
  ) as { tailAssets: string[] };
  expect(shell.tailAssets.length, "The build must defer a shell tail").toBeGreaterThan(0);
  const tail = new Set(shell.tailAssets);
  let started!: () => void;
  const downloading = new Promise<void>((resolve) => (started = resolve));
  await context.route(
    (url) => tail.has(url.pathname),
    (route) => {
      if (!route.request().serviceWorker()?.url().endsWith("?old-build")) return route.fallback();
      started();
    }
  );
  return { started: downloading };
}

function workers(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/home");
    const build = (worker?: ServiceWorker | null) =>
      worker ? (worker.scriptURL.endsWith("?old-build") ? "old" : "new") : null;
    return { active: build(registration?.active), waiting: build(registration?.waiting) };
  });
}

const WEBSITE_RECOVERY = "This page is taking longer than expected.";

test("a browser tab stuck on an old build lets the new build take over after one Reload", async ({
  page,
}, info) => {
  expect(
    process.env.PLAYWRIGHT_PWA_PREVIEW,
    "Use the pwa-preview preset to build production assets"
  ).toBe("true");
  await page.setViewportSize({ width: 390, height: 844 });
  await installOldBuildWorker(page);
  await page.evaluate(recoveryWorkStorage, true);
  const bootstrap = viteManifest()["src/bootstrapPublic.tsx"]?.file;
  expect(bootstrap, "The built public bootstrap chunk must exist").toBeTruthy();

  const unblock = await openStuckTab(page, "/home", `*/${bootstrap}`, WEBSITE_RECOVERY);
  await deployNewBuild(page);
  const stuck = info.outputPath("browser-tab-stale-build.png");
  await page.screenshot({ path: stuck });
  await info.attach("browser-tab-stale-build", { path: stuck });
  await unblock();

  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The website is its own document, outside the worker, so the old build has no tab left.
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  await expect.poll(() => workers(page)).toEqual({ active: "new", waiting: null });
  expect(await page.evaluate(recoveryWorkStorage, false)).toEqual({
    draft: "draft notes",
    upload: [1, 2, 3],
  });
  const recovered = info.outputPath("browser-tab-recovered.png");
  await page.screenshot({ path: recovered });
  await info.attach("browser-tab-recovered", { path: recovered });
});

test("a recovered browser tab no longer holds back the installed app's update", async ({
  page,
  context,
}, info) => {
  expect(
    process.env.PLAYWRIGHT_PWA_PREVIEW,
    "Use the pwa-preview preset to build production assets"
  ).toBe("true");
  // Two windows and two stuck boots outlast the project's budget on a busy runner.
  test.setTimeout(90_000);
  const oldWorkerTail = await holdOldWorkerTail(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await installOldBuildWorker(page);
  await page.evaluate(recoveryWorkStorage, true);
  const bootstrap = viteManifest()["src/bootstrapPublic.tsx"]?.file;
  const browserTab = page;
  const installedApp = await context.newPage();
  await installedApp.setViewportSize({ width: 390, height: 844 });
  const unblockTab = await openStuckTab(browserTab, "/home", `*/${bootstrap}`, WEBSITE_RECOVERY);
  const unblockApp = await openStuckTab(
    installedApp,
    "/home?presentation=pwa",
    "*/assets/index-*.js",
    "Taking longer to load."
  );
  await deployNewBuild(installedApp);
  await unblockTab();
  await unblockApp();

  // Both windows are on /home, so the app will not take the update over the browser tab.
  await installedApp.getByRole("button", { name: "Try Again" }).click();
  await expect(installedApp.getByText("An update is ready.")).toBeVisible({ timeout: 15_000 });
  const blocked = info.outputPath("installed-app-blocked-by-tab.png");
  await installedApp.screenshot({ path: blocked });
  await info.attach("installed-app-blocked-by-tab", { path: blocked });

  await browserTab.getByRole("button", { name: "Reload" }).click();
  await expect(browserTab).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(browserTab.getByRole("heading", { level: 1 })).toBeVisible();
  // The website registered the app worker and asked the old one for its shell tail, which a slow
  // connection keeps downloading. On a fast one the race goes either way.
  await oldWorkerTail.started;

  await installedApp.getByRole("button", { name: "Try Again" }).click();
  // No other app window is open, so the new worker asks the old one to put its download down and
  // takes over within the startup screen's 15-second budget. The website tab reads the workers:
  // it stays put while the app reloads.
  await expect
    .poll(() => workers(browserTab), { timeout: 15_000 })
    .toEqual({ active: "new", waiting: null });
  await expect(installedApp.getByTestId("login-button")).toBeVisible({ timeout: 30_000 });
  expect(await installedApp.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(
    /\/sw\.js$/
  );
  expect(
    await installedApp.evaluate(() => localStorage.getItem("gg-crash-reports") ?? ""),
    "The app must not have said the update is taking longer"
  ).not.toContain("activation_delayed");
  expect(await installedApp.evaluate(recoveryWorkStorage, false)).toEqual({
    draft: "draft notes",
    upload: [1, 2, 3],
  });
  const updated = info.outputPath("installed-app-updated.png");
  await installedApp.screenshot({ path: updated });
  await info.attach("installed-app-updated", { path: updated });
});

function viteManifest() {
  return JSON.parse(
    readFileSync(new URL("../../packages/client/dist/.vite/manifest.json", import.meta.url), "utf8")
  ) as Record<string, { file: string }>;
}

async function expectEvidenceFailureContained(page: Page) {
  let blocked = 0;
  const evidenceAsset = viteManifest()["src/views/Public/HomeEvidence.tsx"]?.file;
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
