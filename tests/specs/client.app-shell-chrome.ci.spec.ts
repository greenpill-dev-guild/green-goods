/**
 * Installed-App Chrome CI Tests
 *
 * The installed app's fixed chrome (bottom AppBar, page headers) must stay
 * still while content scrolls, overscrolls, and cross-fades between tabs.
 *
 * - Android Chrome stretches every `position: fixed` element when the document
 *   overscrolls, so AppShell content scrolls inside `#app-scroll` and the
 *   document itself must never scroll. An absolutely positioned element that
 *   escapes `main`, such as a screen-reader status region, would make it
 *   scrollable again.
 * - Tab links cross-fade `main` with a view transition. Named snapshots paint
 *   above everything unnamed, so the AppBar carries its own transition name to
 *   stay above the page while it fades.
 */

import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

// The installed app on a Samsung Galaxy S22 reports a 360 x 705 CSS viewport.
test.use({ baseURL: TEST_URLS.client, viewport: { width: 360, height: 705 } });
// A cold dev server compiles each lazy route on first use.
test.describe.configure({ timeout: 120_000 });

type Clip = { x: number; y: number; width: number; height: number };
type TransitionWindow = Window & { __tabTransitionFrozen?: Promise<boolean> };

const TRANSITION_START_TIMEOUT_MS = 15_000;

/**
 * Document overflow once `readySelector` has rendered; null while the route is
 * still booting, so a boot screen can never pass for an unscrollable page.
 */
function documentOverflowOnceRendered(page: Page, readySelector: string) {
  return page.evaluate((selector) => {
    if (!document.querySelector(selector)) return null;
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollHeight - root.clientHeight;
  }, readySelector);
}

async function averageColor(page: Page, clip: Clip): Promise<number[]> {
  const png = await page.screenshot({ clip });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const totals = [0, 0, 0];
  for (let offset = 0; offset < data.length; offset += info.channels) {
    totals[0] += data[offset];
    totals[1] += data[offset + 1];
    totals[2] += data[offset + 2];
  }
  const pixels = data.length / info.channels;
  return totals.map((total) => Math.round(total / pixels));
}

function largestChannelDifference(a: number[], b: number[]) {
  return Math.max(...a.map((value, channel) => Math.abs(value - b[channel])));
}

/**
 * Vite reloads every open page when it optimizes a dependency it first meets
 * on a lazy route. Only that interruption is retried; assertion failures
 * surface on the first attempt.
 */
async function retryAfterDevServerReload(run: () => Promise<void>) {
  for (let attempt = 1; ; attempt++) {
    try {
      await run();
      return;
    } catch (error) {
      const interrupted = /Execution context was destroyed/.test(String(error));
      if (!interrupted || attempt === 3) throw error;
    }
  }
}

test.describe("Installed app chrome", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedClient(page);
  });

  test("keeps the document unscrollable on Home and on Profile account details", async ({
    page,
  }) => {
    await retryAfterDevServerReload(async () => {
      await page.goto("/home?presentation=pwa");
      await expect
        .poll(() => documentOverflowOnceRendered(page, "#app-scroll article"), { timeout: 60_000 })
        .toBe(0);

      await page.goto("/home/profile?presentation=pwa");
      // The address row renders a screen-reader status region below the fold.
      await expect
        .poll(
          () =>
            documentOverflowOnceRendered(
              page,
              '#profile-scroll [role="status"][aria-live="polite"]'
            ),
          { timeout: 60_000 }
        )
        .toBe(0);
    });
  });

  test("paints the app bar above the page cross-fade when switching tabs", async ({ page }) => {
    // Load Profile once so switching to it later compiles nothing new.
    await page.goto("/home/profile?presentation=pwa");
    await page.locator("#profile-scroll").waitFor({ timeout: 60_000 });

    await retryAfterDevServerReload(async () => {
      await page.goto("/home?presentation=pwa");
      const nav = page.getByTestId("authenticated-nav");
      await nav.waitFor({ timeout: 60_000 });

      // Sample the bar's own background, clear of its rounded corners and tabs.
      const clip = await nav.evaluate((element): Clip => {
        const bar = element.getBoundingClientRect();
        const firstTab = element.querySelector("a")?.getBoundingClientRect();
        const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
        const x = bar.left + radius + 2;
        const y = bar.top + radius + 2;
        return {
          x,
          y,
          width: Math.max(2, (firstTab?.left ?? bar.left + 40) - 2 - x),
          height: Math.max(2, bar.bottom - 8 - y),
        };
      });

      // A solid probe inside main stands in for page content behind the bar:
      // the live bar paints over it, and main's transition snapshot carries it.
      await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.cssText = "position:fixed;inset:0;background:rgb(255,0,0);pointer-events:none";
        document.querySelector("main")?.append(probe);
      });
      const idle = await averageColor(page, clip);
      expect(idle[0] - idle[1], "the idle bar should cover page content").toBeLessThan(40);

      // Freeze the tab transition partway through its cross-fade.
      await page.evaluate((startTimeoutMs) => {
        const startViewTransition = document.startViewTransition.bind(document);
        (window as TransitionWindow).__tabTransitionFrozen = new Promise<boolean>((resolve) => {
          window.setTimeout(() => resolve(false), startTimeoutMs);
          document.startViewTransition = ((...args: Parameters<typeof startViewTransition>) => {
            const transition = startViewTransition(...args);
            transition.ready.then(
              () => {
                for (const animation of document.getAnimations()) {
                  const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "";
                  if (!pseudo.startsWith("::view-transition")) continue;
                  animation.pause();
                  animation.currentTime = 100;
                }
                requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
              },
              () => resolve(false)
            );
            return transition;
          }) as typeof document.startViewTransition;
        });
      }, TRANSITION_START_TIMEOUT_MS);

      await nav.getByRole("link", { name: "Profile" }).click();
      const frozen = await page.evaluate(() => (window as TransitionWindow).__tabTransitionFrozen);
      expect(frozen, "the tab switch should run a view transition").toBe(true);

      const midTransition = await averageColor(page, clip);
      expect(
        largestChannelDifference(midTransition, idle),
        `bar color mid-transition ${midTransition} should match idle ${idle}`
      ).toBeLessThan(12);
    });
  });
});
