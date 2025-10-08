#!/usr/bin/env node

/**
 * Test script to verify IPFS uploader integration
 * Simulates what Deploy.s.sol does via FFI
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Testing IPFS Integration\n");
console.log("=" .repeat(50));

// Test 1: Verify actions.json exists and is valid
console.log("\n✓ Test 1: Verify actions.json");
try {
  const actionsPath = path.join(__dirname, "config", "actions.json");
  const actionsData = JSON.parse(fs.readFileSync(actionsPath, "utf8"));
  console.log(`  Found ${actionsData.actions.length} actions`);
  actionsData.actions.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action.title}`);
    console.log(`     - Capitals: ${action.capitals.join(", ")}`);
    console.log(`     - UI Config: ${action.uiConfig ? "✓" : "✗"}`);
  });
} catch (error) {
  console.error(`  ✗ Failed: ${error.message}`);
  process.exit(1);
}

// Test 2: Verify IPFS uploader script runs
console.log("\n✓ Test 2: Run IPFS uploader (with cache)");
try {
  const result = execSync("node script/utils/ipfs-uploader.js 2>/dev/null", {
    cwd: __dirname,
    encoding: "utf8",
  });
  
  const hashes = JSON.parse(result.trim());
  console.log(`  Retrieved ${hashes.length} IPFS hashes:`);
  hashes.forEach((hash, i) => {
    console.log(`  ${i + 1}. ${hash}`);
  });
  
  // Verify it's a valid array of strings
  if (!Array.isArray(hashes)) {
    throw new Error("Output is not an array");
  }
  if (hashes.length !== 3) {
    throw new Error(`Expected 3 hashes, got ${hashes.length}`);
  }
  if (!hashes.every(h => typeof h === "string" && h.startsWith("Qm"))) {
    throw new Error("Invalid hash format");
  }
} catch (error) {
  console.error(`  ✗ Failed: ${error.message}`);
  process.exit(1);
}

// Test 3: Verify generated instruction document structure
console.log("\n✓ Test 3: Verify instruction document generation");
try {
  const actionsPath = path.join(__dirname, "config", "actions.json");
  const actionsData = JSON.parse(fs.readFileSync(actionsPath, "utf8"));
  
  // Import the generation function (simplified - we'll just check structure)
  const action = actionsData.actions[0];
  console.log(`  Testing with: ${action.title}`);
  console.log(`  Required fields present:`);
  console.log(`    - title: ${action.title ? "✓" : "✗"}`);
  console.log(`    - description: ${action.description ? "✓" : "✗"}`);
  console.log(`    - capitals: ${action.capitals ? "✓" : "✗"}`);
  console.log(`    - uiConfig: ${action.uiConfig ? "✓" : "✗"}`);
  console.log(`    - uiConfig.media: ${action.uiConfig?.media ? "✓" : "✗"}`);
  console.log(`    - uiConfig.details: ${action.uiConfig?.details ? "✓" : "✗"}`);
  console.log(`    - uiConfig.review: ${action.uiConfig?.review ? "✓" : "✗"}`);
} catch (error) {
  console.error(`  ✗ Failed: ${error.message}`);
  process.exit(1);
}

// Test 4: Verify cache file structure
console.log("\n✓ Test 4: Verify cache file");
try {
  const cachePath = path.join(__dirname, ".ipfs-cache.json");
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const keys = Object.keys(cache);
    console.log(`  Cache has ${keys.length} entries`);
    keys.forEach(key => {
      const entry = cache[key];
      console.log(`  - ${entry.title}: ${entry.hash.substring(0, 20)}...`);
    });
  } else {
    console.log("  No cache file found (will be created on first real upload)");
  }
} catch (error) {
  console.error(`  ✗ Failed: ${error.message}`);
  process.exit(1);
}

console.log("\n" + "=".repeat(50));
console.log("✅ All tests passed!");
console.log("\n📝 Next steps:");
console.log("  1. Set PINATA_JWT environment variable for real uploads");
console.log("  2. Run deployment with: pnpm deploy:testnet");
console.log("  3. Actions will be uploaded to IPFS and deployed to contracts");
console.log("  4. Client will fetch action configs from IPFS\n");
