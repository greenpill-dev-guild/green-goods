/**
 * Client Offline Work Submission CI Tests
 *
 * Walks the whole work wizard with the network switched off and checks that
 * the submission lands in the durable queue instead of failing, that Your Work
 * does not offer an upload action while offline, and that a reconnect sends
 * nothing on its own: the queued work waits for Upload all.
 * Uses the same clean-room seam as the other client CI specs: dev mock auth
 * (wallet mode) plus mocked indexer, EAS, and RPC boundaries.
 */

import { expect, test } from "@playwright/test";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+ZSkdJwAAAABJRU5ErkJggg==",
  "base64"
);
const OFFLINE_STATUS = { name: "App is in offline mode" };

async function attachScreenshot(page: import("@playwright/test").Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

test.describe("Offline Work Submission CI Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test("completes every wizard step offline, queues the work, and leaves sending to Upload all", async ({
    page,
    context,
  }) => {
    const helper = await setupAuthenticatedClient(page);

    // Load the signed-in shell online first. Production precaches these route
    // modules in the offline shell; the Vite dev server can only serve them on
    // demand, so the dashboard launcher must have finished its preload.
    await page.goto("/home?presentation=pwa", { waitUntil: "domcontentloaded" });
    await helper.waitForPageLoad();
    await expect(page.getByTestId("work-dashboard-button")).toBeEnabled({ timeout: 15000 });
    await page.getByRole("link", { name: "Garden" }).click();

    const actionCard = page.getByTestId("action-card").first();
    const gardenCard = page.getByTestId("garden-card").first();
    // A cold dev server transforms the wizard route on first request.
    await expect(actionCard).toBeVisible({ timeout: 15000 });
    await expect(gardenCard).toBeVisible();
    await actionCard.click();
    await gardenCard.click();
    const startButton = page.getByRole("button", { name: "Start Gardening" });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // Warm the on-demand image compressor once while online for the same
    // reason, then return to the first step so every step below runs offline.
    const mediaInput = page.locator("#work-media-upload");
    await mediaInput.setInputFiles({
      name: "warm-up.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    const detailsButton = page.getByRole("button", { name: "Add Details" });
    await expect(detailsButton).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "Remove media 1" }).click();
    await expect(detailsButton).toBeDisabled();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(startButton).toBeEnabled();

    await context.setOffline(true);
    await expect(page.getByRole("status", OFFLINE_STATUS)).toBeVisible({ timeout: 10000 });

    // Step 1: action and garden.
    await startButton.click();

    // Step 2: media.
    await mediaInput.setInputFiles({
      name: "planting-proof.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(detailsButton).toBeEnabled({ timeout: 15000 });
    await detailsButton.click();

    // Step 3: details. The planting action requires both counts and a species.
    await page.getByRole("spinbutton", { name: /^Seedlings Planted/ }).fill("3");
    await page.getByRole("spinbutton", { name: /^Participants/ }).fill("2");
    await page.getByRole("button", { name: "Fruit tree" }).click();
    const reviewButton = page.getByRole("button", { name: "Review Work" });
    await expect(reviewButton).toBeEnabled();
    await reviewButton.click();

    // Step 4: review still opens offline and says what will happen.
    await expect(
      page.getByText(
        "You're offline. Your work stays on this device until you upload it from Your Work."
      )
    ).toBeVisible();
    const uploadButton = page.getByRole("button", { name: "Upload Work" });
    await expect(uploadButton).toBeEnabled();
    await attachScreenshot(page, "review-step-offline");
    await uploadButton.click();

    // The submission is queued, not failed: the dashboard opens on it and the
    // sync bar counts it while still offline.
    const dashboard = page.getByRole("dialog");
    await expect(dashboard).toBeVisible({ timeout: 15000 });
    // Exactly one queued submission. Offline the header line reads "Offline · {time}"
    // once any read has been saved, so count the work itself rather than the header.
    await expect(dashboard.getByText("You submitted")).toHaveCount(1, { timeout: 15000 });
    await expect(dashboard.getByText("You submitted")).toBeVisible();
    await expect(dashboard.getByText("To upload", { exact: true })).toBeVisible();
    // The dashboard is a modal sheet: while it is open the page, the offline bar
    // included, is hidden from assistive tech, so look for the bar itself.
    await expect(
      page.getByRole("status", { ...OFFLINE_STATUS, includeHidden: true })
    ).toBeVisible();

    // Pending still shows the queued work, but cannot offer upload while offline.
    await expect(dashboard.getByTestId("upload-all")).toHaveCount(0);
    await attachScreenshot(page, "queued-in-dashboard-offline");
    await dashboard.getByTestId("tab-completed").click();
    await expect(dashboard.getByTestId("upload-all")).toHaveCount(0);
    await dashboard.getByTestId("tab-pending").click();

    await dashboard.getByTestId("app-sheet-close").click();
    await expect(dashboard).toBeHidden();
    await expect(page.getByText("Offline: 1 item saved on this device")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review uploads" })).toBeEnabled();

    // Reconnect: nothing sends on its own. The work stays queued behind Upload all,
    // neither dropped nor duplicated, and Review uploads opens it.
    await context.setOffline(false);
    await expect(page.getByRole("status", { name: "App is back online" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("1 item waiting to upload")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Review uploads" }).click();
    await expect(dashboard).toBeVisible({ timeout: 15000 });
    await expect(dashboard.getByText("You submitted")).toHaveCount(1, { timeout: 15000 });
    await expect(dashboard.getByText("To upload", { exact: true })).toBeVisible();
    // Background preparation starts once the connection is confirmed; CI has no upload
    // signer, so the work keeps preparing unless the probe finds the connection unsteady.
    await expect(page.getByTestId("upload-all")).toHaveText(
      /^(Preparing uploads…|Upload all \(1\))$/
    );
    await attachScreenshot(page, "reconnect-review-uploads");
  });
});
