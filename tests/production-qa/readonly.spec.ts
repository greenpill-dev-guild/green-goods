// Read-only production checks in ordinary tabs of the QA profile. They prove what every later case
// relies on: the production origins answer, the profile's wallet is the expected identity on the
// expected chain, and the Hub opens signed in. Nothing here signs, uploads or enqueues; a request
// that would write is refused and fails the case.
import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  KEPT_LOCAL,
  loadQaProfile,
  observeBrowserApp,
  observeSessionType,
  readDeployedRelease,
  writeReason,
  writeReceipt,
} from "../fixtures/qa-cdp";

const profile = loadQaProfile();
const expectedChainId = Number(process.env.GREEN_GOODS_QA_CHAIN_ID ?? Number.NaN);
const expectedSigner = process.env.GREEN_GOODS_QA_SIGNER?.toLowerCase();

let browser: Browser;
let context: BrowserContext;
const writes: string[] = [];
let keptLocal = 0;

test.beforeAll(async () => {
  browser = await chromium.connectOverCDP(profile.cdpEndpoint);
  context = browser.contexts()[0];
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
});

test.afterAll(async () => {
  await context?.unrouteAll({ behavior: "ignoreErrors" });
  // Disconnects; a CDP-attached profile keeps running.
  await browser?.close();
});

async function withTab<T>(name: string, url: string, check: (tab: Page) => Promise<T>): Promise<T> {
  const startedAt = new Date();
  const tab = await context.newPage();
  const before = writes.length;
  let verdict = "fail";
  let failure: string | undefined;
  try {
    await tab.goto(url);
    const result = await check(tab);
    expect(writes.slice(before), "no request would have written").toEqual([]);
    verdict = "pass";
    return result;
  } catch (error) {
    failure = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw error;
  } finally {
    await tab.close().catch(() => undefined);
    writeReceipt(
      profile.evidenceDir,
      `${name}-${profile.machine}-${startedAt.toISOString().replace(/[:.]/g, "-")}`,
      {
        kind: name,
        at: startedAt.toISOString(),
        machine: profile.machine,
        sessionType: observeSessionType(),
        browserChannel: profile.browserChannel,
        browserApp: observeBrowserApp(profile.cdpEndpoint),
        url,
        deployedBuild: await readDeployedRelease(new URL(url).origin),
        analyticsKeptLocal: keptLocal,
        refusedWrites: writes.slice(before),
        verdict,
        failure,
      }
    );
  }
}

test("QA-PREFLIGHT the App origin answers and the wallet is the expected signer on the expected chain", async () => {
  await withTab("qa-preflight", profile.appOrigin, async (tab) => {
    await expect(tab).toHaveURL(new RegExp(`^${profile.appOrigin.replace(/[.]/g, "\\.")}/`));
    // eth_accounts and eth_chainId only read: they never open the wallet's prompt.
    const wallet = await tab.evaluate(async () => {
      const ethereum = (
        window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<unknown> } }
      ).ethereum;
      if (!ethereum) return null;
      const [chainId, accounts] = await Promise.all([
        ethereum.request({ method: "eth_chainId" }),
        ethereum.request({ method: "eth_accounts" }),
      ]);
      return {
        chainId: Number(chainId),
        accounts: (accounts as string[]).map((a) => a.toLowerCase()),
      };
    });
    expect(wallet, "a wallet extension is enabled in the QA profile").not.toBeNull();
    if (Number.isFinite(expectedChainId)) {
      expect(wallet?.chainId, "the wallet is on the case's chain").toBe(expectedChainId);
    }
    if (expectedSigner) {
      expect(wallet?.accounts, "the wallet exposes the expected signer").toContain(expectedSigner);
    }
  });
});

test("QA-HUB-SIGNED-IN the Hub opens signed in for the profile's steward", async () => {
  await withTab("qa-hub-signed-in", profile.hubOrigin, async (tab) => {
    // Absence proves nothing until the Hub has booted: wait for its requests to settle first.
    await tab.waitForLoadState("networkidle", { timeout: 45_000 });
    await expect(tab.locator("body")).not.toBeEmpty();
    await expect(tab.getByText("Connect to continue")).toHaveCount(0);
  });
});
