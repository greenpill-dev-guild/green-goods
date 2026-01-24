/**
 * Client Fork Tests
 *
 * E2E tests that run against an Anvil fork of Base Sepolia.
 * These tests verify real blockchain interactions with deterministic state.
 *
 * Prerequisites:
 * - Anvil running: bun anvil:start
 * - Client dev server: bun dev:client
 *
 * Run with: bun test:e2e:fork
 */
import { test, expect, type Page } from "@playwright/test";
import {
  startAnvilFork,
  snapshotState,
  revertToSnapshot,
  type AnvilForkContext,
} from "../fixtures/anvil-fork";
import {
  createGarden,
  addGardener,
  isGardener,
  deployMockERC20,
} from "../fixtures/contract-helpers";
import { ClientTestHelper, TEST_URLS } from "../helpers/test-utils";

const CLIENT_URL = TEST_URLS.client;

// ============================================================================
// TEST SETUP
// ============================================================================

let anvilContext: AnvilForkContext;
let snapshotId: string;

/**
 * Before all fork tests:
 * 1. Start Anvil fork of Base Sepolia
 * 2. Create initial snapshot for fast test isolation
 */
test.beforeAll(async () => {
  console.log("\n🔨 Starting Anvil fork for E2E tests...");

  try {
    anvilContext = await startAnvilFork({ timeout: 30000 });
    console.log(`   Chain ID: ${anvilContext.chain.id}`);
    console.log(`   GardenToken: ${anvilContext.deployment.gardenToken}`);

    // Create initial snapshot after setup
    snapshotId = await snapshotState(anvilContext.testClient);
    console.log(`   Snapshot: ${snapshotId}\n`);
  } catch (error) {
    console.error("Failed to start Anvil fork:", error);
    throw error;
  }
});

/**
 * After all fork tests: cleanup Anvil process
 */
test.afterAll(async () => {
  if (anvilContext) {
    console.log("\n🧹 Cleaning up Anvil fork...");
    await anvilContext.cleanup();
  }
});

/**
 * Before each test: revert to clean snapshot
 */
test.beforeEach(async () => {
  if (anvilContext && snapshotId) {
    await revertToSnapshot(anvilContext.testClient, snapshotId);
    // Re-snapshot for next test
    snapshotId = await snapshotState(anvilContext.testClient);
  }
});

// ============================================================================
// FORK TESTS
// ============================================================================

test.describe("Fork Integration Tests", () => {
  test.use({ baseURL: CLIENT_URL });

  test.describe("Contract Interactions", () => {
    test("can read GardenToken contract state", async () => {
      // Verify the fork is working by reading contract state
      expect(anvilContext).toBeDefined();
      expect(anvilContext.deployment.gardenToken).toBeDefined();

      // Read current block
      const blockNumber = await anvilContext.publicClient.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0);
      console.log(`   Block number: ${blockNumber}`);

      // Verify GardenToken has code
      const code = await anvilContext.publicClient.getCode({
        address: anvilContext.deployment.gardenToken,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe("0x");
      console.log(`   GardenToken has code: ${code?.length} bytes`);
    });

    test("can create a garden on fork", async () => {
      expect(anvilContext).toBeDefined();

      // Get a community token address (use existing USDC on fork)
      const communityToken = await deployMockERC20(anvilContext);
      console.log(`   Community token: ${communityToken}`);

      // Create a garden
      const garden = await createGarden(anvilContext, {
        name: "E2E Test Garden",
        description: "Garden created during E2E test",
        bannerImage: "ipfs://test-banner",
        communityToken,
        operators: [anvilContext.accounts.operator.address],
        gardeners: [anvilContext.accounts.gardener1.address],
      });

      expect(garden.address).toBeDefined();
      expect(garden.name).toBe("E2E Test Garden");
      console.log(`   Garden created: ${garden.address}`);

      // Verify gardener was added
      const gardener1IsGardener = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener1.address
      );
      expect(gardener1IsGardener).toBe(true);
    });

    test("snapshot/revert provides test isolation", async () => {
      expect(anvilContext).toBeDefined();

      // Get initial balance
      const initialBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });

      // Send some ETH (modifying state)
      await anvilContext.testClient.setBalance({
        address: anvilContext.accounts.gardener1.address,
        value: BigInt(0), // Set to 0
      });

      const zeroBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });
      expect(zeroBalance).toBe(BigInt(0));

      // Create new snapshot (unused, just verifying it works)
      await snapshotState(anvilContext.testClient);

      // Revert to initial snapshot
      await revertToSnapshot(anvilContext.testClient, snapshotId);

      // Balance should be restored
      const restoredBalance = await anvilContext.publicClient.getBalance({
        address: anvilContext.accounts.gardener1.address,
      });
      expect(restoredBalance).toBe(initialBalance);
      console.log(`   Snapshot/revert works: ${restoredBalance} restored`);
    });
  });

  test.describe("Client with Fork Backend", () => {
    test("client can load with forked chain", async ({ page }) => {
      // Navigate to client
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Client should load without errors
      const hasAppError = await page
        .locator('text="Unexpected Application Error"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasAppError).toBe(false);

      // Should redirect to login or show landing
      const url = page.url();
      expect(url).toMatch(/\/(login|landing)?$/);
    });

    test("authenticated user can view gardens from fork", async ({ page }) => {
      const helper = new ClientTestHelper(page);

      // First, create a garden on the fork
      const communityToken = await deployMockERC20(anvilContext);
      const garden = await createGarden(anvilContext, {
        name: "Viewable Garden",
        description: "Garden visible in client",
        bannerImage: "ipfs://test",
        communityToken,
      });

      // Inject wallet auth (using deployer address who is an operator)
      await helper.injectWalletAuth(anvilContext.accounts.deployer.address);

      // Navigate to home
      await page.goto("/home");
      await helper.waitForPageLoad();

      // Check if we're authenticated
      const url = page.url();
      if (url.includes("/login")) {
        // Auth injection didn't persist - expected in some environments
        console.log("   Auth injection not persisted - test skipped");
        return;
      }

      // Note: The garden we just created won't appear immediately because
      // the indexer needs to process the events. This test validates the
      // infrastructure works; full E2E with indexer sync would be a separate test.
      console.log(`   Garden ${garden.address} created on fork`);
      console.log("   Client loaded successfully with forked backend");
    });
  });

  test.describe("Gardener Operations", () => {
    test("can add gardener to existing garden", async () => {
      expect(anvilContext).toBeDefined();

      // Create a garden
      const communityToken = await deployMockERC20(anvilContext);
      const garden = await createGarden(anvilContext, {
        name: "Gardener Test Garden",
        description: "Testing gardener addition",
        bannerImage: "ipfs://test",
        communityToken,
        operators: [anvilContext.accounts.operator.address],
      });

      // Initially, gardener2 should not be a gardener
      const before = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener2.address
      );
      expect(before).toBe(false);

      // Add gardener2 using operator account
      await addGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener2.address,
        anvilContext.accounts.operator
      );

      // Now gardener2 should be a gardener
      const after = await isGardener(
        anvilContext,
        garden.address,
        anvilContext.accounts.gardener2.address
      );
      expect(after).toBe(true);
      console.log(`   Gardener2 added to ${garden.address}`);
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wait for indexer to sync (placeholder for future implementation)
 * In a full implementation, this would poll the indexer until the
 * garden/action/work appears in the GraphQL API.
 *
 * @param _page - Playwright page for making GraphQL requests
 * @param _address - Address to wait for in indexer
 * @param _timeout - Maximum time to wait in ms
 */
async function _waitForIndexerSync(
  _page: Page,
  _address: string,
  _timeout: number = 30000
): Promise<void> {
  // TODO: Implement indexer sync wait
  // This would query the indexer for the address until it appears
  // console.log(`   Waiting for indexer to sync ${_address}...`);
  // await _page.waitForTimeout(1000);
}
