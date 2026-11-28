// Read-only smoke of the installed Green Goods window in a dedicated QA profile. It attaches to the
// running profile over loopback CDP, opens an ordinary tab of the same site beside the window, and
// proves it finds the genuine installed window (display mode standalone) rather than the tab. In
// that window it checks Home with a garden entered and no sheet open, opens the configured garden
// and returns Home. Analytics and error reports are answered locally, and any request that would
// write (a send, a signature, a mutation, an upload) is refused and fails the run.
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import {
  KEPT_LOCAL,
  loadQaProfile,
  observeAppShim,
  observeBrowserApp,
  observeSessionType,
  pickAppWindow,
  readDeployedRelease,
  writeReason,
  writeReceipt,
} from "../fixtures/qa-cdp";

const profile = loadQaProfile();
const APP_NAME = "Green Goods";

async function isStandalone(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(
      () =>
        matchMedia("(display-mode: standalone)").matches ||
        matchMedia("(display-mode: window-controls-overlay)").matches
    );
  } catch {
    return false;
  }
}

test("installed Green Goods window: Home, a garden and back to Home, read-only", async () => {
  const startedAt = new Date();
  const steps: string[] = [];
  const writes: string[] = [];
  let keptLocal = 0;
  let browser: Browser | undefined;
  let tab: Page | undefined;
  let verdict = "fail";
  let failure: string | undefined;

  try {
    browser = await chromium.connectOverCDP(profile.cdpEndpoint);
    const context = browser.contexts()[0];
    expect(context, "the QA profile's default context").toBeTruthy();

    await context.route("**/*", async (route) => {
      const request = route.request();
      if (KEPT_LOCAL.test(request.url())) {
        keptLocal++;
        return route.fulfill({ status: 204, body: "" });
      }
      const reason = writeReason({
        method: request.method(),
        url: request.url(),
        postData: request.postData(),
      });
      if (reason) {
        writes.push(reason);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    // An ordinary tab of the same site, so the run proves it tells the window from a tab.
    tab = await context.newPage();
    await tab.goto(profile.appOrigin);
    steps.push("opened an ordinary tab of the site");

    const pages = await Promise.all(
      context.pages().map(async (page) => ({
        page,
        facts: { url: page.url(), standalone: await isStandalone(page) },
      }))
    );
    const { app, tabs } = pickAppWindow(pages, profile.appOrigin);
    expect(tabs, "the ordinary tab is not taken for the app").toContain(tab);
    expect(await isStandalone(tab), "the ordinary tab shows the website").toBe(false);
    steps.push(
      `found the installed window among ${pages.length} pages (${tabs.length} same-site tab(s))`
    );

    await app.bringToFront();
    await expect(app, "the window is inside the app's scope").toHaveURL(/\/home(\/|\?|$)/);
    expect(new URL(app.url()).pathname, "signed in (not the login screen)").not.toMatch(/\/login/);

    const nav = app.getByTestId("authenticated-nav");
    await expect(
      nav,
      "Home shows the bottom bar: a garden is entered and no sheet is open"
    ).not.toHaveAttribute("inert", { timeout: 30_000 });
    const homeTab = nav.locator(`a[href="/home"]`);
    const pending = ((await homeTab.textContent()) ?? "").replace(/\D/g, "");
    expect(pending, "the submission queue is empty").toBe("");
    steps.push("Home: signed in, garden entered, no sheet open, queue empty");

    if (profile.gardenAddress) {
      await app.goto(new URL(`/home/${profile.gardenAddress}`, profile.appOrigin).toString());
      await expect(app).toHaveURL(new RegExp(`/home/${profile.gardenAddress}`, "i"));
      if (profile.gardenName) {
        // Home's garden cards stay mounted, hidden, under the garden page, so match the visible
        // heading rather than the first text match.
        await expect(
          app
            .getByRole("heading", { name: profile.gardenName, exact: false })
            .filter({ visible: true })
            .first(),
          "the garden page shows the test garden's name"
        ).toBeVisible();
      }
      steps.push("opened the test garden in the window");
      const back = app
        .getByRole("button", { name: /^back$/i })
        .or(app.getByRole("link", { name: /^back$/i }));
      if (await back.first().isVisible()) {
        await back.first().click();
        steps.push("returned with the garden's Back control");
      } else {
        await app.goto(new URL("/home", profile.appOrigin).toString());
        steps.push("returned Home by address (no Back control found)");
      }
    } else {
      steps.push("no gardenAddress in the private profile: the garden step was skipped");
    }
    await expect(app).toHaveURL(/\/home\/?(\?.*)?$/);
    await expect(nav).not.toHaveAttribute("inert");
    expect(await isStandalone(app), "still the installed window").toBe(true);
    steps.push("back on Home in the installed window");

    expect(writes, "no request would have written").toEqual([]);
    verdict = profile.gardenAddress ? "pass" : "partial";
  } catch (error) {
    failure = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw error;
  } finally {
    if (tab && !tab.isClosed()) await tab.close().catch(() => undefined);
    const receipt = {
      kind: "installed-app-smoke",
      at: startedAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      machine: profile.machine,
      sessionType: observeSessionType(),
      browserChannel: profile.browserChannel,
      browserApp: observeBrowserApp(profile.cdpEndpoint),
      launchMethodDeclared: process.env.GREEN_GOODS_PWA_LAUNCH_METHOD ?? "not stated",
      appShim: observeAppShim(APP_NAME),
      origin: profile.appOrigin,
      deployedBuild: await readDeployedRelease(profile.appOrigin),
      steps,
      analyticsKeptLocal: keptLocal,
      refusedWrites: writes,
      verdict,
      failure,
    };
    const name = `installed-smoke-${profile.machine}-${startedAt.toISOString().replace(/[:.]/g, "-")}`;
    test.info().annotations.push({
      type: "receipt",
      description: writeReceipt(profile.evidenceDir, name, receipt),
    });
    // Disconnect only: closing a CDP-attached browser would quit the QA profile.
    if (browser) await disconnect(browser);
  }
});

async function disconnect(browser: Browser): Promise<void> {
  for (const context of browser.contexts()) await context.unrouteAll({ behavior: "ignoreErrors" });
  // Playwright's close() on a connectOverCDP browser disconnects without quitting the profile.
  await browser.close();
}
