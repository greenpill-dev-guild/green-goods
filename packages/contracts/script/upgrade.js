#!/usr/bin/env node

const { execSync } = require("child_process");

const CONTRACT_FUNCTIONS = {
  "action-registry": "upgradeActionRegistry()",
  "garden-token": "upgradeGardenToken()",
  "work-resolver": "upgradeWorkResolver()",
  "work-approval-resolver": "upgradeWorkApprovalResolver()",
  "assessment-resolver": "upgradeAssessmentResolver()",
  "deployment-registry": "upgradeDeploymentRegistry()",
  all: "upgradeAll()",
};

function showHelp() {
  console.log(`
Green Goods Contract Upgrade Tool

Usage: node script/upgrade.js <contract> [options]

Contracts:
  action-registry          Upgrade ActionRegistry
  garden-token            Upgrade GardenToken
  work-resolver           Upgrade WorkResolver
  work-approval-resolver  Upgrade WorkApprovalResolver
  assessment-resolver     Upgrade AssessmentResolver
  deployment-registry     Upgrade DeploymentRegistry
  all                     Upgrade all contracts

Options:
  --network <name>        Network to upgrade on (default: localhost)
  --dry-run              Simulate upgrade without broadcasting
  --broadcast            Execute upgrade (default for non-localhost)
  --help                 Show this help

Examples:
  # Dry run on Base Sepolia
  node script/upgrade.js action-registry --network baseSepolia --dry-run
  
  # Execute upgrade
  node script/upgrade.js action-registry --network baseSepolia --broadcast
  
  # Upgrade all contracts
  node script/upgrade.js all --network baseSepolia --broadcast
  `);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const contract = args[0];
  const network = args.includes("--network") ? args[args.indexOf("--network") + 1] : "localhost";
  const dryRun = args.includes("--dry-run");
  const broadcast = args.includes("--broadcast") || (network !== "localhost" && !dryRun);

  if (!CONTRACT_FUNCTIONS[contract]) {
    console.error(`Unknown contract: ${contract}`);
    console.error("Run with --help to see available contracts");
    process.exit(1);
  }

  const forgeArgs = [
    "script",
    "script/Upgrade.s.sol:Upgrade",
    "--sig",
    `"${CONTRACT_FUNCTIONS[contract]}"`,
    "--rpc-url",
    network,
  ];

  if (broadcast) {
    forgeArgs.push("--broadcast");

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--account", keystoreName);

    console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
    console.log("💡 Password will be prompted interactively\n");
  } else {
    console.log("🔍 Dry run mode - no transactions will be broadcast\n");
  }

  const command = `forge ${forgeArgs.join(" ")}`;
  console.log(`Executing: ${command}\n`);

  try {
    execSync(command, { stdio: "inherit", cwd: process.cwd() });
    console.log("\n✅ Upgrade completed successfully");
  } catch (error) {
    console.error("\n❌ Upgrade failed", error);
    process.exit(1);
  }
}

main();
