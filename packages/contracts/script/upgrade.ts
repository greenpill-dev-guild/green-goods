#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as dotenv from "dotenv";
import { NetworkManager } from "./utils/network";
import { assertSepoliaGate, writeSepoliaCheckpoint } from "./utils/release-gate";

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
  "deployment-registry": "upgradeDeployment()",
  all: "upgradeAll()",
};

const ALL_CONTRACTS_FOR_UPGRADE_ALL: readonly ContractName[] = [
  "action-registry",
  "garden-token",
  "work-resolver",
  "work-approval-resolver",
  "assessment-resolver",
  "deployment-registry",
];

const DEPLOYMENT_KEYS: Record<Exclude<ContractName, "all">, string> = {
  "action-registry": "actionRegistry",
  "garden-token": "gardenToken",
  "gardener-account": "accountProxy",
  "work-resolver": "workResolver",
  "work-approval-resolver": "workApprovalResolver",
  "assessment-resolver": "assessmentResolver",
  "deployment-registry": "deploymentRegistry",
};

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0+$/i.test(value);
}

function resolveUpgradeTargets(contract: ContractName, deployment: Record<string, unknown>) {
  const contractsToResolve = contract === "all" ? ALL_CONTRACTS_FOR_UPGRADE_ALL : [contract];
  const resolved: Array<{ contractName: ContractName; deploymentKey: string; address: string }> = [];
  const missing: Array<{ contractName: ContractName; deploymentKey: string }> = [];

  contractsToResolve.forEach((contractName) => {
    const deploymentKey = DEPLOYMENT_KEYS[contractName as Exclude<ContractName, "all">];
    const address = deployment[deploymentKey];
    if (!isAddress(address)) {
      missing.push({ contractName, deploymentKey });
      return;
    }

    resolved.push({ contractName, deploymentKey, address });
  });

  if (contract !== "all" && missing.length > 0) {
    throw new Error(`Missing or invalid ${missing[0].deploymentKey} in deployment artifact`);
  }

  if (resolved.length === 0) {
    throw new Error("No upgrade targets resolved from deployment artifact");
  }

  return { resolved, missing };
}

function runPureSimulation(contract: ContractName, network: string, networkManager: NetworkManager): void {
  const chainId = networkManager.getChainIdString(network);
  const deploymentPath = path.join(__dirname, "..", "deployments", `${chainId}-latest.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Record<string, unknown>;
  const { resolved: targets, missing } = resolveUpgradeTargets(contract, deployment);

  console.log("🧪 Pure simulation mode enabled (no RPC calls, no upgrade transactions)\n");
  console.log(`Network: ${network} (chainId: ${chainId})`);
  console.log(`Deployment artifact: ${deploymentPath}\n`);

  targets.forEach((target) => {
    console.log(`  - ${target.contractName}: ${target.address}`);
  });

  if (missing.length > 0) {
    console.log("\n⚠️  Skipping targets missing in deployment artifact:");
    missing.forEach((target) => {
      console.log(`  - ${target.contractName} (${target.deploymentKey})`);
    });
  }

  console.log("\n🔨 Running forge build preflight...");
  execSync("forge build --skip test", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      FOUNDRY_PROFILE: "production",
    },
  });

  const command = [
    "forge",
    "script",
    "script/Upgrade.s.sol:Upgrade",
    "--sig",
    `"${CONTRACT_FUNCTIONS[contract]}"`,
    "--rpc-url",
    "<resolved at runtime>",
    "--chain-id",
    chainId,
    "--broadcast",
    "--account",
    "<keystore>",
  ].join(" ");

  console.log("\nWould execute upgrade command:");
  console.log(command);
  console.log("\n✅ Pure simulation preflight completed successfully");
}

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
  deployment-registry     Upgrade Deployment
  all                     Upgrade all contracts

Options:
  --network <name>        Network to upgrade on (default: localhost)
  --dry-run              Run preflight checks without RPC calls
  --pure-simulation      Run compile + deployment preflight only (no RPC calls)
  --broadcast            Execute upgrade (default for non-localhost)
  --override-sepolia-gate  Bypass Sepolia gate for Arbitrum/Celo broadcast
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
  # Dry run on Sepolia
  bun script/upgrade.ts action-registry --network sepolia --dry-run
  
  # Execute upgrade
  bun script/upgrade.ts action-registry --network sepolia --broadcast
  
  # Upgrade all contracts
  bun script/upgrade.ts all --network sepolia --broadcast
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
  const dryRun = args.includes("--dry-run");
  const pureSimulation = args.includes("--pure-simulation") || dryRun;
  const overrideSepoliaGate = args.includes("--override-sepolia-gate");

  if (!CONTRACT_FUNCTIONS[contract]) {
    console.error(`Unknown contract: ${contract}`);
    console.error("Run with --help to see available contracts");
    process.exit(1);
  }

  if (broadcast && pureSimulation) {
    console.error("Cannot use --broadcast with --dry-run/--pure-simulation");
    process.exit(1);
  }

  // Resolve RPC URL from network config
  const networkManager = new NetworkManager();
  let rpcUrl: string;
  let chainId: number;

  try {
    if (pureSimulation) {
      runPureSimulation(contract, network, networkManager);
      process.exit(0);
    }

    assertSepoliaGate({
      network,
      broadcast,
      operation: "upgrade",
      overrideSepoliaGate,
    });

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

    if (broadcast && network === "sepolia") {
      const checkpoint = writeSepoliaCheckpoint({
        chainId: networkManager.getChainIdString(network),
        operation: "upgrade",
      });
      console.log(
        `✅ Wrote Sepolia checkpoint (${checkpoint.timestamp}, commit ${checkpoint.commitHash.slice(0, 12)})`,
      );
    }
    console.log("\n✅ Upgrade completed successfully");
  } catch (error) {
    console.error("\n❌ Upgrade failed", error);
    process.exit(1);
  }
}

main();
