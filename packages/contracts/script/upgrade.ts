#!/usr/bin/env bun

import * as path from "node:path";
import { execSync } from "node:child_process";
import * as dotenv from "dotenv";
import { NetworkManager } from "./utils/network";

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

type ContractName =
  | "action-registry"
  | "garden-token"
  | "gardener-account"
  | "work-resolver"
  | "work-approval-resolver"
  | "assessment-resolver"
  | "deployment-registry"
  | "all";

const CONTRACT_FUNCTIONS: Record<ContractName, string> = {
  "action-registry": "upgradeActionRegistry()",
  "garden-token": "upgradeGardenToken()",
  "gardener-account": "upgradeGardenerAccount()",
  "work-resolver": "upgradeWorkResolver()",
  "work-approval-resolver": "upgradeWorkApprovalResolver()",
  "assessment-resolver": "upgradeAssessmentResolver()",
  "deployment-registry": "upgradeDeploymentRegistry()",
  all: "upgradeAll()",
};

function showHelp(): void {
  const networkManager = new NetworkManager();
  console.log(`
Green Goods Contract Upgrade Tool

Usage: bun script/upgrade.ts <contract> [options]

Contracts:
  action-registry          Upgrade ActionRegistry
  garden-token            Upgrade GardenToken
  gardener-account        Upgrade GardenerAccount (user smart account logic)
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

Available networks: ${networkManager.getAvailableNetworks().join(", ")}

Rollback (manual):
  # Get current implementation address first
  cast call <PROXY> "0x5c60da1b" --rpc-url <RPC>
  
  # Then upgrade to previous implementation
  forge script script/Upgrade.s.sol:Upgrade \\
    --sig "upgradeGardenProxy(address,address)" \\
    <PROXY> <PREVIOUS_IMPL> \\
    --network <network> --broadcast

Examples:
  # Dry run on Base Sepolia
  bun script/upgrade.ts action-registry --network baseSepolia --dry-run
  
  # Execute upgrade
  bun script/upgrade.ts action-registry --network baseSepolia --broadcast
  
  # Upgrade all contracts
  bun script/upgrade.ts all --network baseSepolia --broadcast
  `);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const contract = args[0] as ContractName;
  const networkIndex = args.indexOf("--network");
  const network = networkIndex !== -1 ? args[networkIndex + 1] : "localhost";
  // Only broadcast if explicitly requested - don't auto-enable for non-localhost
  const broadcast = args.includes("--broadcast");

  if (!CONTRACT_FUNCTIONS[contract]) {
    console.error(`Unknown contract: ${contract}`);
    console.error("Run with --help to see available contracts");
    process.exit(1);
  }

  // Resolve RPC URL from network config
  const networkManager = new NetworkManager();
  let rpcUrl: string;
  let chainId: number;

  try {
    rpcUrl = networkManager.getRpcUrl(network);
    chainId = networkManager.getChainId(network);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get network config: ${errorMsg}`);
    process.exit(1);
  }

  const forgeArgs = [
    "script",
    "script/Upgrade.s.sol:Upgrade",
    "--sig",
    `"${CONTRACT_FUNCTIONS[contract]}"`,
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    chainId.toString(),
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
    execSync(command, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
    });
    console.log("\n✅ Upgrade completed successfully");
  } catch (error) {
    console.error("\n❌ Upgrade failed", error);
    process.exit(1);
  }
}

main();
