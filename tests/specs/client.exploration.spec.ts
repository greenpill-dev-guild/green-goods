/** CI Playwright: seeded mock-auth reads and recovery, never signing or dispatch. */
// TEST-QUALITY: allow-small-test-file - two generated journeys share the same bounded action runner
import { expect, test } from "@playwright/test";
import deployment from "../../packages/contracts/deployments/11155111-latest.json" with {
  type: "json",
};
import { assertExplorationNavigation, workExplorationCases } from "../fixtures/work-exploration";
import { MOCK_CLIENT_GARDEN } from "../helpers/mock-backend";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const garden = { ...MOCK_CLIENT_GARDEN, operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"] };
const uid = `0x${"42".repeat(32)}`;
const pathname = `/home/${garden.id}/work/${uid}`;

test.use({ baseURL: TEST_URLS.client, serviceWorkers: "block", reducedMotion: "reduce" });
for (const scenario of workExplorationCases(process.env.GG_BROWSER_SEED)) {
  test(`work inspection seed=${scenario.seed} recovery=${scenario.recovery}`, async ({
    page,
  }, info) => {
    const log: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date(scenario.now));
    await page.setViewportSize(scenario.viewport);
    // Registered first: the existing exact GraphQL/RPC fixtures take precedence.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === TEST_URLS.client && ["GET", "HEAD"].includes(request.method())) {
        if (request.isNavigationRequest())
          assertExplorationNavigation(url.href, TEST_URLS.client, pathname);
        return route.continue();
      }
      if (
        url.origin === "http://localhost:3005" &&
        request.method() === "GET" &&
        [
          "0x1234567890123456789012345678901234567890",
          "0x04d60647836bca09c37b379550038bdaafd82503",
        ].some((address) => url.pathname === `/public/profile-avatars/11155111/${address}`)
      ) {
        return route.fulfill({ status: 404, json: { error: "No avatar in this scenario" } });
      }
      if (url.hostname === "eth-mainnet.g.alchemy.com") {
        const { id, method, params } = request.postDataJSON();
        expect(method).toBe("eth_call");
        expect(params).toHaveLength(2);
        expect(params[1]).toBe("latest");
        expect(params[0].to).toBe("0xeeeeeeee14d718c2b47d9923deab1335e144eeee");
        expect(params[0].data.startsWith("0xb7d6ca64")).toBe(true);
        return route.fulfill({
          json: {
            jsonrpc: "2.0",
            id,
            error: { code: 3, message: "No reverse ENS name in this scenario" },
          },
        });
      }
      if (url.hostname === "fonts.googleapis.com" && url.pathname === "/css2") {
        return route.fulfill({ contentType: "text/css", body: "" });
      }
      if (
        ["us-assets.i.posthog.com", "eu-assets.i.posthog.com"].includes(url.hostname) &&
        request.method() === "GET" &&
        url.pathname.endsWith(".js")
      ) {
        return route.fulfill({ contentType: "application/javascript", body: "" });
      }
      if (url.hostname === "fonts.reown.com" && request.method() === "GET")
        return route.abort("blockedbyclient");
      // Vendor telemetry is not part of a work read and must never leave the test context.
      if (
        [
          "us-assets.i.posthog.com",
          "eu-assets.i.posthog.com",
          "pulse.walletconnect.org",
          "cca-lite.coinbase.com",
          "api.web3modal.org",
          "api.web3modal.com",
          "eu.i.posthog.com",
          "us.i.posthog.com",
        ].includes(url.hostname)
      ) {
        return route.fulfill({ json: {} });
      }
      throw new Error(`Unexpected exploration request: ${request.method()} ${url.origin}`);
    });
    const helper = await setupAuthenticatedClient(page, scenario.role, {
      garden,
      required: ["eas: Attestations", "eas: WorkListPage"],
      attestations: [
        {
          id: uid,
          schemaId: deployment.schemas.workSchemaUID,
          attester: "0x1234567890123456789012345678901234567890",
          recipient: garden.id,
          timeCreated: 1791158400,
          decodedDataJson: JSON.stringify(
            Object.entries({
              actionUID: 1,
              title: "Seeded planting evidence",
              feedback: scenario.feedback,
              metadata: "",
              media: [],
            }).map(([name, value]) => ({ name, value: { value } }))
          ),
        },
      ],
    });
    const outage = (value: boolean) => {
      helper.backend.setUnavailable("eas: Attestations", value);
      helper.backend.setUnavailable("eas: WorkListPage", value);
    };
    if (scenario.recovery) outage(true);
    try {
      for (const action of scenario.actions) {
        log.push(action);
        await test.step(action, async () => {
          if (action === "open")
            await page.goto(`${pathname}?presentation=pwa`, { waitUntil: "domcontentloaded" });
          if (action === "recover") {
            await expect(
              page.getByText("Couldn't load this work. Check your connection and try again.")
            ).toBeVisible({ timeout: 60000 });
            // The list cannot remove the retry control through background recovery.
            helper.backend.setUnavailable("eas: Attestations", false);
            await page.getByRole("button", { name: "Try Again", exact: true }).click();
            await expect(page.getByText(scenario.feedback, { exact: true })).toBeVisible({
              timeout: 60000,
            });
            outage(false);
          }
          if (action === "reload") await page.reload();
          if (action === "inspect" || action === "reload") {
            await expect(page.getByText(scenario.feedback, { exact: true })).toBeVisible({
              timeout: 60000,
            });
            assertExplorationNavigation(page.url(), TEST_URLS.client, pathname);
            // Same tolerance as route proof: sub-pixel layout rounding is not overflow.
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
            ).toBe(false);
          }
        });
      }
      helper.backend.assertSatisfied();
      expect(errors).toEqual([]);
      await info.attach("work-inspection", {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await info.attach("replay", {
        body: JSON.stringify(
          {
            ...scenario,
            attemptedActions: log,
            errors,
            command: `bun run browser e2e --preset explore --seed ${scenario.seed}`,
          },
          null,
          2
        ),
        contentType: "application/json",
      });
    }
  });
}
