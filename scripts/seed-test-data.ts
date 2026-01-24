#!/usr/bin/env bun
/**
 * Seed Test Data Script
 *
 * Creates deterministic test data on an Anvil fork for E2E testing.
 * This script seeds:
 * - 2 test gardens with different configurations
 * - 2 test actions per garden
 * - Sample work submissions (pending and approved)
 *
 * Usage:
 *   bun scripts/seed-test-data.ts
 *
 * Prerequisites:
 *   - Anvil running: bun anvil:start
 *
 * The script outputs the created data addresses for use in tests.
 */

import {
  startAnvilFork,
  type AnvilForkContext,
} from "../tests/fixtures/anvil-fork";
import {
  createGarden,
  registerAction,
  submitWork,
  approveWork,
  deployMockERC20,
  createActionTimestamps,
  type GardenResult,
  type ActionResult,
  type WorkResult,
} from "../tests/fixtures/contract-helpers";

// ============================================================================
// TYPES
// ============================================================================

interface SeedDataResult {
  gardens: {
    communityGarden: GardenResult;
    privateGarden: GardenResult;
  };
  actions: {
    plantingAction: ActionResult;
    wateringAction: ActionResult;
    compostingAction: ActionResult;
    weedingAction: ActionResult;
  };
  works: {
    pendingWork: WorkResult;
    approvedWork: WorkResult;
  };
  communityToken: `0x${string}`;
}

// ============================================================================
// SEED DATA
// ============================================================================

async function seedTestData(context: AnvilForkContext): Promise<SeedDataResult> {
  console.log("\n🌱 Seeding test data...\n");

  // Get community token
  console.log("1️⃣ Setting up community token...");
  const communityToken = await deployMockERC20(context);
  console.log(`   Token: ${communityToken}\n`);

  // Create timestamps for actions
  const timestamps = await createActionTimestamps(context, 30);

  // ============================================================================
  // GARDENS
  // ============================================================================

  console.log("2️⃣ Creating test gardens...\n");

  // Garden 1: Community garden with open joining
  const communityGarden = await createGarden(context, {
    name: "Community Test Garden",
    description: "A test garden for E2E testing with open membership",
    bannerImage: "ipfs://QmTestBanner1",
    communityToken,
    operators: [context.accounts.operator.address],
    gardeners: [
      context.accounts.gardener1.address,
      context.accounts.gardener2.address,
    ],
    openJoining: true,
  });

  // Garden 2: Private garden (invite only)
  const privateGarden = await createGarden(context, {
    name: "Private Test Garden",
    description: "A test garden with restricted membership",
    bannerImage: "ipfs://QmTestBanner2",
    communityToken,
    operators: [context.accounts.operator.address],
    gardeners: [context.accounts.gardener1.address],
    openJoining: false,
  });

  console.log();

  // ============================================================================
  // ACTIONS
  // ============================================================================

  console.log("3️⃣ Registering test actions...\n");

  const plantingAction = await registerAction(context, {
    startTime: timestamps.startTime,
    endTime: timestamps.endTime,
    title: "Plant Native Species",
    instructions: "Plant at least 5 native plants in your garden section",
    mediaTypes: ["image/jpeg", "image/png"],
  });

  const wateringAction = await registerAction(context, {
    startTime: timestamps.startTime,
    endTime: timestamps.endTime,
    title: "Water Conservation",
    instructions: "Document water-saving practices in the garden",
    mediaTypes: ["image/jpeg"],
  });

  const compostingAction = await registerAction(context, {
    startTime: timestamps.startTime,
    endTime: timestamps.endTime,
    title: "Composting Initiative",
    instructions: "Add organic material to compost bins and document progress",
    mediaTypes: ["image/jpeg", "video/mp4"],
  });

  const weedingAction = await registerAction(context, {
    startTime: timestamps.startTime,
    endTime: timestamps.endTime,
    title: "Invasive Species Removal",
    instructions: "Remove and document invasive plant species",
    mediaTypes: ["image/jpeg"],
  });

  console.log();

  // ============================================================================
  // WORK SUBMISSIONS
  // ============================================================================

  console.log("4️⃣ Creating test work submissions...\n");

  // Pending work (not yet approved)
  const pendingWork = await submitWork(context, {
    gardenAddress: communityGarden.address,
    actionUID: plantingAction.uid,
    title: "Planted 10 native flowers",
    feedback: "Successfully planted native wildflowers near the entrance",
    metadata: JSON.stringify({ plantCount: 10, species: ["Echinacea", "Black-eyed Susan"] }),
    media: ["ipfs://QmTestMedia1"],
    gardenerAccount: context.accounts.gardener1,
  });

  // Approved work
  const approvedWork = await submitWork(context, {
    gardenAddress: communityGarden.address,
    actionUID: wateringAction.uid,
    title: "Installed drip irrigation",
    feedback: "Set up water-efficient drip system for vegetable beds",
    metadata: JSON.stringify({ waterSaved: "50%" }),
    media: ["ipfs://QmTestMedia2"],
    gardenerAccount: context.accounts.gardener2,
  });

  // Approve the second work submission
  await approveWork(context, {
    gardenAddress: communityGarden.address,
    actionUID: wateringAction.uid,
    workUID: approvedWork.uid,
    approved: true,
    feedback: "Excellent work on the irrigation system!",
    operatorAccount: context.accounts.operator,
  });

  console.log();

  // ============================================================================
  // SUMMARY
  // ============================================================================

  const result: SeedDataResult = {
    gardens: { communityGarden, privateGarden },
    actions: { plantingAction, wateringAction, compostingAction, weedingAction },
    works: { pendingWork, approvedWork },
    communityToken,
  };

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                     SEED DATA SUMMARY                          ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Gardens:");
  console.log(`  Community: ${communityGarden.address}`);
  console.log(`  Private:   ${privateGarden.address}\n`);

  console.log("Actions:");
  console.log(`  Planting:    UID ${plantingAction.uid}`);
  console.log(`  Watering:    UID ${wateringAction.uid}`);
  console.log(`  Composting:  UID ${compostingAction.uid}`);
  console.log(`  Weeding:     UID ${weedingAction.uid}\n`);

  console.log("Works:");
  console.log(`  Pending:  ${pendingWork.uid}`);
  console.log(`  Approved: ${approvedWork.uid}\n`);

  console.log("Token:");
  console.log(`  Community: ${communityToken}\n`);

  console.log("═══════════════════════════════════════════════════════════════\n");

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🚀 Starting test data seeding...\n");

  let context: AnvilForkContext | null = null;

  try {
    // Check if we should connect to existing Anvil or start new one
    const useExistingAnvil = process.env.ANVIL_RUNNING === "true";

    if (useExistingAnvil) {
      console.log("📡 Connecting to existing Anvil instance...\n");
    } else {
      console.log("🔨 Starting new Anvil fork...\n");
    }

    context = await startAnvilFork({
      timeout: 30000,
      autoStart: !useExistingAnvil,
    });

    const result = await seedTestData(context);

    // Export result as JSON for use in tests
    console.log("📄 Seed data JSON:");
    console.log(JSON.stringify(result, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));

    console.log("\n✅ Test data seeded successfully!\n");

    // Keep Anvil running if it was started for this script
    if (!useExistingAnvil) {
      console.log("⚠️  Anvil is running. Press Ctrl+C to stop.\n");
      // Don't cleanup - keep running
      await new Promise(() => {}); // Wait forever
    }

  } catch (error) {
    console.error("\n❌ Error seeding test data:", error);
    process.exit(1);
  }
}

main();
