/**
 * iPhone 16 Pro Bottom Gap Diagnostic
 *
 * Reproduces and measures the visible gap below the bottom nav on
 * iPhone 16 Pro (issue #468 part C). Uses WebKit which properly simulates
 * iOS safe-area-inset-bottom, unlike Chrome desktop.
 *
 * Hypothesis to test: the gap is NOT extra padding — it's a height/layout
 * bug where the app's layout box doesn't extend to the full screen bottom,
 * leaving a visible dead zone.
 *
 * Run with:
 *   bun x playwright test tests/specs/ios-bottom-gap.diagnostic.spec.ts \
 *     --project=iphone-16-pro
 */
import { devices, test } from "@playwright/test";

// iPhone 16 Pro CSS viewport — 402 x 874, DPR 3
test.use({
  ...devices["iPhone 15 Pro"], // base WebKit device descriptor
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
});

test.describe("#468 C — iPhone 16 Pro bottom gap", () => {
  test("measure layout box vs viewport on login page (public route)", async ({ page }) => {
    // The gap is a LAYOUT problem — any fixed-bottom element on iOS PWA
    // would show it. No auth needed; we can measure on /login too.

    // Force display-mode: standalone BEFORE the app mounts
    await page.addInitScript(() => {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => {
        if (q && q.includes("display-mode: standalone")) {
          return {
            matches: true,
            media: q,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return false;
            },
          } as unknown as MediaQueryList;
        }
        return orig(q);
      };
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const layout = await page.evaluate(() => {
      const body = document.body;
      const root = document.getElementById("root")!;
      const html = document.documentElement;

      // Probe 1: env(safe-area-inset-bottom) via a fixed-height probe
      const probeSafe = document.createElement("div");
      probeSafe.style.cssText =
        "position:fixed;bottom:0;right:0;height:env(safe-area-inset-bottom);width:1px;background:red;";
      body.appendChild(probeSafe);
      const safeBottom = probeSafe.getBoundingClientRect().height;

      // Probe 2: fixed bottom:0 element — does it reach the viewport bottom?
      // This is the isomorphism of the AppBar's positioning (position:fixed; bottom:0)
      const probeFixedBottom = document.createElement("div");
      probeFixedBottom.style.cssText =
        "position:fixed;bottom:0;left:0;height:4px;width:100%;background:blue;";
      body.appendChild(probeFixedBottom);
      const probeFixedRect = probeFixedBottom.getBoundingClientRect();

      // Probe 3: element with bottom:0 inside BODY (uses body as reference)
      const probeBodyBottom = document.createElement("div");
      probeBodyBottom.style.cssText =
        "position:absolute;bottom:0;left:0;height:4px;width:100%;background:green;";
      body.appendChild(probeBodyBottom);
      const probeBodyRect = probeBodyBottom.getBoundingClientRect();

      // Probe 4: 100dvh vs 100vh vs 100svh vs 100lvh
      const unitsProbe = document.createElement("div");
      unitsProbe.style.cssText = "position:fixed;top:0;left:-100px;width:1px;visibility:hidden;";
      body.appendChild(unitsProbe);
      unitsProbe.style.height = "100vh";
      const vh = unitsProbe.getBoundingClientRect().height;
      unitsProbe.style.height = "100dvh";
      const dvh = unitsProbe.getBoundingClientRect().height;
      unitsProbe.style.height = "100svh";
      const svh = unitsProbe.getBoundingClientRect().height;
      unitsProbe.style.height = "100lvh";
      const lvh = unitsProbe.getBoundingClientRect().height;

      probeSafe.remove();
      probeFixedBottom.remove();
      probeBodyBottom.remove();
      unitsProbe.remove();

      const bodyRect = body.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();

      return {
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          visualViewportH: window.visualViewport?.height ?? null,
          devicePixelRatio: window.devicePixelRatio,
        },
        standalone: window.matchMedia("(display-mode: standalone)").matches,
        safeAreaInsetBottom: safeBottom,
        viewportUnits: { vh, dvh, svh, lvh },
        probes: {
          fixedBottomZero: {
            rectBottom: probeFixedRect.bottom,
            rectTop: probeFixedRect.top,
            gapToViewportBottom: window.innerHeight - probeFixedRect.bottom,
          },
          bodyBottomZero: {
            rectBottom: probeBodyRect.bottom,
            rectTop: probeBodyRect.top,
            gapToViewportBottom: window.innerHeight - probeBodyRect.bottom,
          },
        },
        html: {
          clientH: html.clientHeight,
          scrollH: html.scrollHeight,
          height: getComputedStyle(html).height,
          position: getComputedStyle(html).position,
        },
        body: {
          rect: { top: bodyRect.top, bottom: bodyRect.bottom, height: bodyRect.height },
          height: getComputedStyle(body).height,
          position: getComputedStyle(body).position,
          inset: getComputedStyle(body).inset,
          distanceFromViewportBottom: window.innerHeight - bodyRect.bottom,
        },
        root: {
          rect: { top: rootRect.top, bottom: rootRect.bottom, height: rootRect.height },
          height: getComputedStyle(root).height,
          distanceFromViewportBottom: window.innerHeight - rootRect.bottom,
        },
      };
    });

    console.log("\n===== iPhone 16 Pro layout diagnostic =====");
    console.log(JSON.stringify(layout, null, 2));
    console.log("===========================================\n");

    // Screenshot for visual confirmation
    await page.screenshot({
      path: "tests/test-results/ios-gap-login.png",
      fullPage: false,
    });

    // Headlines
    console.log(
      `safe-area-inset-bottom in WebKit iPhone 16 Pro sim: ${layout.safeAreaInsetBottom}px`
    );
    console.log(
      `fixed bottom:0 probe reaches viewport bottom? gap=${layout.probes.fixedBottomZero.gapToViewportBottom}px (0 = reaches)`
    );
    console.log(
      `body reaches viewport bottom? gap=${layout.body.distanceFromViewportBottom}px (0 = reaches)`
    );
    console.log(
      `root reaches viewport bottom? gap=${layout.root.distanceFromViewportBottom}px (0 = reaches)`
    );
    console.log(
      `viewport units: vh=${layout.viewportUnits.vh} dvh=${layout.viewportUnits.dvh} svh=${layout.viewportUnits.svh} lvh=${layout.viewportUnits.lvh}`
    );
  });
});
