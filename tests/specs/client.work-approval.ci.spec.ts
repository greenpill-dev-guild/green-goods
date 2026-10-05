/** Clean-room proof of review navigation, offline decision persistence, and read recovery. */
import { expect, test } from "@playwright/test";
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
  zeroHash,
} from "viem";
import deployment from "../../packages/contracts/deployments/11155111-latest.json" with {
  type: "json",
};
import { MOCK_CLIENT_GARDEN, type MockAttestation } from "../helpers/mock-backend";
import { setupAuthenticatedClient, TEST_URLS } from "../helpers/test-utils";

const STEWARD = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const WORK_UID = `0x${"42".repeat(32)}`;
const garden = { ...MOCK_CLIENT_GARDEN, operators: [STEWARD] };
const work: MockAttestation = {
  id: WORK_UID,
  schemaId: deployment.schemas.workSchemaUID,
  attester: "0x1234567890123456789012345678901234567890",
  recipient: garden.id,
  timeCreated: Math.floor(Date.now() / 1000) - 3600,
  decodedDataJson: JSON.stringify(
    Object.entries({
      actionUID: 1,
      title: "CI planting evidence",
      feedback: "Three trees planted",
      metadata: "",
      media: [],
    }).map(([name, value]) => ({ name, value: { value } }))
  ),
};
const workPath = `/home/${garden.id}/work/${WORK_UID}?presentation=pwa`;
// Preparation may simulate this one decision. A broadcast is never supported by the fixture.
const approvalSimulation = {
  name: "approval simulation",
  to: deployment.eas.address,
  from: STEWARD,
  data: encodeFunctionData({
    abi: parseAbi([
      "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) payable returns (bytes32)",
    ]),
    functionName: "attest",
    args: [
      {
        schema: deployment.schemas.workApprovalSchemaUID as `0x${string}`,
        data: {
          recipient: garden.id as `0x${string}`,
          expirationTime: 0n,
          revocable: false,
          refUID: zeroHash,
          value: 0n,
          data: encodeAbiParameters(parseAbiParameters(deployment.schemas.workApprovalSchema), [
            1n,
            WORK_UID,
            true,
            "Evidence reviewed in the field",
            2,
            1,
            "",
          ]),
        },
      },
    ],
  }),
  result: zeroHash,
};

test.describe("Work approval CI", () => {
  test.use({ baseURL: TEST_URLS.client });
  test.beforeEach(({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });
  });

  test("protected work redirects an unauthenticated visitor", async ({ page }) => {
    await page.goto(workPath);
    await expect(page).toHaveURL(/\/home\/login/, { timeout: 15000 });
    await expect(page.getByTestId("login-button")).toBeVisible();
  });

  test("Your Work opens its required tabs and closes back to Home", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page, "user", { required: ["indexer: Gardens"] });
    await page.goto("/home?presentation=pwa");
    const trigger = page.getByTestId("work-dashboard-button");
    await expect(trigger).toBeEnabled({ timeout: 30000 });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Your Work" });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("tab-completed").click();
    await expect(dialog.getByText("Approved and rejected work will appear here")).toBeVisible();
    await dialog.getByTestId("app-sheet-close").click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeVisible();
    helper.backend.assertSatisfied();
  });

  test("a steward's offline approval is saved once and remains queued after reconnect", async ({
    page,
    context,
  }) => {
    const helper = await setupAuthenticatedClient(page, "steward", {
      garden,
      attestations: [work],
      rpcReads: [approvalSimulation],
      required: [
        "indexer: Gardens",
        "indexer: Actions",
        "eas: WorkListPage",
        "rpc: approval simulation",
      ],
    });
    await page.goto(workPath);
    const bar = page.getByTestId("work-approval-action-bar");
    await expect(bar.getByRole("button", { name: "Approve", exact: true })).toBeEnabled({
      timeout: 30000,
    });
    await context.setOffline(true);
    await expect(bar).toContainText("Your decision stays on this device");
    await bar.getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator("#approval-feedback-input").fill("Evidence reviewed in the field");
    await bar.getByRole("button", { name: "Submit", exact: true }).click();
    const upload = page.getByTestId("decision-upload-now");
    await expect(upload).toBeVisible({ timeout: 15000 });
    await expect(upload).toBeDisabled();
    await expect(bar).toBeHidden();
    await test
      .info()
      .attach("offline-decision", { body: await page.screenshot(), contentType: "image/png" });
    await context.setOffline(false);
    await expect(upload).toBeEnabled({ timeout: 15000 });
    // A reload proves durable persistence rather than a transient optimistic label.
    await page.reload();
    await expect(page.getByTestId("decision-upload-now")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("decision-upload-now")).toHaveCount(1);
    await expect(page.getByTestId("work-approval-action-bar")).toHaveCount(0);
    // The footer is singular even if storage has duplicates; inspect the durable
    // boundary too before claiming this decision was saved only once.
    const saved = await page.evaluate(async (workUID) => {
      const open = indexedDB.open("green-goods-job-queue");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      try {
        const read = db.transaction("jobs", "readonly").objectStore("jobs").getAll();
        const jobs = await new Promise<
          Array<{
            kind: string;
            synced: boolean;
            payload: { workUID?: string; approved?: boolean; feedback?: string };
          }>
        >((resolve, reject) => {
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        });
        return jobs
          .filter((job) => job.kind === "approval" && job.payload.workUID === workUID)
          .map((job) => ({
            synced: job.synced,
            approved: job.payload.approved,
            feedback: job.payload.feedback,
          }));
      } finally {
        db.close();
      }
    }, WORK_UID);
    expect(saved).toEqual([
      { synced: false, approved: true, feedback: "Evidence reviewed in the field" },
    ]);
    helper.backend.assertSatisfied();
  });

  test("a failed work read exposes retry and recovers the same work", async ({ page }) => {
    const helper = await setupAuthenticatedClient(page, "steward", {
      garden,
      attestations: [work],
      required: ["eas: Attestations", "eas: WorkListPage"],
    });
    helper.backend.setUnavailable("eas: Attestations", true);
    helper.backend.setUnavailable("eas: WorkListPage", true);
    await page.goto(workPath);
    await expect(
      page.getByText("Couldn't load this work. Check your connection and try again.")
    ).toBeVisible({ timeout: 30000 });
    helper.backend.setUnavailable("eas: Attestations", false);
    helper.backend.setUnavailable("eas: WorkListPage", false);
    await page.getByRole("button", { name: "Try Again", exact: true }).click();
    await expect(
      page
        .getByTestId("work-approval-action-bar")
        .getByRole("button", { name: "Approve", exact: true })
    ).toBeEnabled({ timeout: 15000 });
    await expect(page.getByText("Three trees planted")).toBeVisible();
    helper.backend.assertSatisfied();
  });
});
