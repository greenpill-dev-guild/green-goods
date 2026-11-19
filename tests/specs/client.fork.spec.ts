/**
 * Client Fork Tests
 *
 * Contract-side checks run against an Anvil fork of Sepolia.
 * Legacy Client smoke cases require a caller-managed Client surface; the preset
 * does not start or retarget a Sepolia test server. These cases do not certify
 * browser-to-fork-to-indexer integration or authenticated-session behavior.
 *
 * Run with: bun run browser e2e --preset fork
 */
import { expect, test } from "@playwright/test";
import {
  type AnvilForkContext,
  revertToSnapshot,
  snapshotState,
  startAnvilFork,
} from "../fixtures/anvil-fork";
import { createGarden, isGardener, joinGarden } from "../fixtures/contract-helpers";
import { TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

let anvilContext: AnvilForkContext;
let snapshotId: string;

test.beforeAll(async () => {
  console.log("\n🔨 Starting Anvil fork for E2E tests...");

  try {
    anvilContext = await startAnvilFork({ timeout: 30000 });
    console.log(`   Chain ID: ${anvilContext.chain.id}`);
    console.log(`   GardenToken: ${anvilContext.deployment.gardenToken}`);

    snapshotId = await snapshotState(anvilContext.testClient);
    console.log(`   Snapshot: ${snapshotId}\n`);
  } catch (error) {
    console.error("Failed to start Anvil fork:", error);
    throw error;
  }
});

test.afterAll(async () => {
  if (anvilContext) {
    console.log("\n🧹 Cleaning up Anvil fork...");
    await anvilContext.cleanup();
  }
});

test.beforeEach(async () => {
  if (anvilContext && snapshotId) {
    await revertToSnapshot(anvilContext.testClient, snapshotId);
    // Anvil drops a snapshot once it is reverted to, so take a fresh one.
    snapshotId = await snapshotState(anvilContext.testClient);
  }
});

test.describe("Fork Integration Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Contract Interactions", () => {
    test("can read GardenToken contract state", async () => {
      expect(anvilContext).toBeDefined();
      expect(anvilContext.deployment.gardenToken).toBeDefined();

      const blockNumber = await anvilContext.publicClient.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0);
      console.log(`   Block number: ${blockNumber}`);

      const code = await anvilContext.publicClient.getCode({
        address: anvilContext.deployment.gardenToken,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe("0x");
      console.log(`   GardenToken has code: ${code?.length} bytes`);
    });

    test("can create a garden on fork", async () => {
      expect(anvilContext).toBeDefined();

      const garden = await createGarden(anvilContext, {
        name: "E2E Test Garden",
        description: "Garden created during E2E test",
        bannerImage: "ipfs://test-banner",
        stewards: [anvilContext.accounts.steward.address],
        gardeners: [anvilContext.accounts.gardener1.address],
      });

      expect(garden.address).toBeDefined();
      expect(garden.name).toBe("E2E Test Garden");
      console.log(`   Garden created: ${garden.address}`);

      const gardener1IsGardener = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener1.address
      );
      expect(gardener1IsGardener).toBe(true);
    });

    test("snapshot/revert provides test isolation", async () => {
      expect(anvilContext).toBeDefined();

      const initialBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });

      await anvilContext.testClient.setBalance({
        address: anvilContext.accounts.gardener1.address,
        value: BigInt(0),
      });

      const zeroBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });
      expect(zeroBalance).toBe(BigInt(0));

      // Unused: only checks that a second snapshot can be taken.
      await snapshotState(anvilContext.testClient);

      await revertToSnapshot(anvilContext.testClient, snapshotId);

      const restoredBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });
      expect(restoredBalance).toBe(initialBalance);
      console.log(`   Snapshot/revert works: ${restoredBalance} restored`);
    });
  });

  test.describe("Client with Fork Backend", () => {
    test("caller-managed client can load", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);

      const url = page.url();
      expect(url).toMatch(/\/(login|landing)?$/);
    });
  });

  test.describe("Gardener Operations", () => {
    test("can join an existing garden", async () => {
      expect(anvilContext).toBeDefined();

      const garden = await createGarden(anvilContext, {
        name: "Gardener Test Garden",
        description: "Testing gardener addition",
        bannerImage: "ipfs://test",
        stewards: [anvilContext.accounts.steward.address],
      });

      const before = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener2.address
      );
      expect(before).toBe(false);

      // Open gardens are joined by the gardener signing their own transaction.
      await joinGarden(anvilContext, garden.address, anvilContext.accounts.gardener2);

      const after = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener2.address
      );
      expect(after).toBe(true);
      console.log(`   Gardener2 joined ${garden.address}`);
    });
  });
});
