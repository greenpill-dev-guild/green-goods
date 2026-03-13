#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { NetworkManager } from "./utils/network";
import { assertSepoliaGate } from "./utils/release-gate";

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

type ContractName =
  | "action-registry"
  | "garden-token"
  | "yield-resolver"
  | "octant-module"
  | "work-resolver"
  | "work-approval-resolver"
  | "assessment-resolver"
  | "deployment-registry"
  | "all";

const CONTRACT_FUNCTIONS: Record<ContractName, string> = {
  "action-registry": "upgradeActionRegistry()",
  "garden-token": "upgradeGardenToken()",
  "yield-resolver": "upgradeYieldResolver()",
  "octant-module": "upgradeOctantModule()",
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
  "yield-resolver",
  "octant-module",
];

const DEPLOYMENT_KEYS: Record<Exclude<ContractName, "all">, string> = {
  "action-registry": "actionRegistry",
  "garden-token": "gardenToken",
  "yield-resolver": "yieldSplitter",
  "octant-module": "octantModule",
  "work-resolver": "workResolver",
  "work-approval-resolver": "workApprovalResolver",
  "assessment-resolver": "assessmentResolver",
  "deployment-registry": "deploymentRegistry",
};

const CONTRACTS_ROOT = path.join(__dirname, "..");

interface UpgradeOptions {
  contract: ContractName;
  network: string;
  broadcast: boolean;
  dryRun: boolean;
  pureSimulation: boolean;
  txPlan: boolean;
  overrideSepoliaGate: boolean;
  sender?: string;
}

interface ForgeBroadcastTransaction {
  transactionType?: string;
  contractName?: string | null;
  function?: string | null;
  transaction?: {
    from?: string;
    to?: string;
    gas?: string;
    value?: string;
    input?: string;
    nonce?: string;
    chainId?: string;
  };
}

interface ForgeBroadcastArtifact {
  transactions?: ForgeBroadcastTransaction[];
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0+$/i.test(value);
}

function resolveDeploymentOutputDir(): string {
  const configured = process.env.DEPLOYMENT_OUTPUT_DIR?.trim();
  const outputDir = configured && configured.length > 0 ? configured : "deployments";
  return path.isAbsolute(outputDir) ? outputDir : path.join(CONTRACTS_ROOT, outputDir);
}

function resolveDeploymentArtifactPath(fileName: string): string {
  return path.join(resolveDeploymentOutputDir(), fileName);
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
  const deploymentPath = resolveDeploymentArtifactPath(`${chainId}-latest.json`);

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
  execFileSync("forge", ["build", "--skip", "test"], {
    stdio: "inherit",
    cwd: CONTRACTS_ROOT,
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
    CONTRACT_FUNCTIONS[contract],
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
  yield-resolver          Upgrade YieldResolver
  octant-module           Upgrade OctantModule (vault treasury module)
  work-resolver           Upgrade WorkResolver
  work-approval-resolver  Upgrade WorkApprovalResolver
  assessment-resolver     Upgrade AssessmentResolver
  deployment-registry     Upgrade Deployment
  all                     Upgrade all contracts

Options:
  --network <name>        Network to upgrade on (default: localhost)
  --sender <address>      Override tx sender address for simulation/broadcast
  --dry-run               Run preflight checks without RPC calls
  --pure-simulation       Run compile + deployment preflight only (no RPC calls)
  --tx-plan               Simulate upgrade and persist a transaction plan artifact
  --broadcast             Execute upgrade
  --override-sepolia-gate  Bypass Sepolia gate for Arbitrum/Celo broadcast
  --help                  Show this help

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
  
  # Generate transaction plan
  bun script/upgrade.ts action-registry --network sepolia --tx-plan --sender 0x1234...

  # Execute upgrade
  bun script/upgrade.ts action-registry --network sepolia --broadcast

  # Upgrade all contracts
  bun script/upgrade.ts all --network sepolia --broadcast
  `);
}

function parseOptions(args: string[]): UpgradeOptions {
  const contract = args[0] as ContractName;
  let network = "localhost";
  let sender: string | undefined;
  let broadcast = false;
  let dryRun = false;
  let pureSimulation = false;
  let txPlan = false;
  let overrideSepoliaGate = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--network": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) {
          throw new Error("--network requires a value");
        }
        network = value;
        i++;
        break;
      }
      case "--sender": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) {
          throw new Error("--sender requires an address value");
        }
        sender = value;
        i++;
        break;
      }
      case "--broadcast":
        broadcast = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--pure-simulation":
        pureSimulation = true;
        break;
      case "--tx-plan":
        txPlan = true;
        break;
      case "--override-sepolia-gate":
        overrideSepoliaGate = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return {
    contract,
    network,
    broadcast,
    dryRun,
    pureSimulation: pureSimulation || dryRun,
    txPlan,
    overrideSepoliaGate,
    sender,
  };
}

function findLatestUpgradeArtifact(chainId: number): string {
  const baseDir = path.join(CONTRACTS_ROOT, "broadcast", "Upgrade.s.sol", chainId.toString());
  const candidates = [path.join(baseDir, "dry-run", "run-latest.json"), path.join(baseDir, "run-latest.json")];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Upgrade artifact not found under ${baseDir}`);
}

function persistTxPlan(options: UpgradeOptions, chainId: number): string {
  const artifactPath = findLatestUpgradeArtifact(chainId);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ForgeBroadcastArtifact;
  const transactions = (artifact.transactions ?? []).map((entry, index) => ({
    index,
    transactionType: entry.transactionType ?? null,
    contractName: entry.contractName ?? null,
    function: entry.function ?? null,
    from: entry.transaction?.from ?? null,
    to: entry.transaction?.to ?? null,
    value: entry.transaction?.value ?? "0x0",
    gas: entry.transaction?.gas ?? null,
    nonce: entry.transaction?.nonce ?? null,
    data: entry.transaction?.input ?? null,
  }));

  const plansDir = path.join(resolveDeploymentOutputDir(), "tx-plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const plan = {
    generatedAt: new Date().toISOString(),
    network: options.network,
    chainId,
    contract: options.contract,
    functionSignature: CONTRACT_FUNCTIONS[options.contract],
    sender: options.sender ?? process.env.SENDER_ADDRESS ?? null,
    sourceArtifact: artifactPath,
    transactionCount: transactions.length,
    transactions,
  };

  const fileName = `${chainId}-${options.contract}-${Date.now()}-plan.json`;
  const planPath = path.join(plansDir, fileName);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return planPath;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  let options: UpgradeOptions;
  try {
    options = parseOptions(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    showHelp();
    process.exit(1);
  }

  if (!CONTRACT_FUNCTIONS[options.contract]) {
    console.error(`Unknown contract: ${options.contract}`);
    console.error("Run with --help to see available contracts");
    process.exit(1);
  }

  if (options.broadcast && options.pureSimulation) {
    console.error("Cannot use --broadcast with --dry-run/--pure-simulation");
    process.exit(1);
  }

  if (options.broadcast && options.txPlan) {
    console.error("Cannot use --broadcast with --tx-plan");
    process.exit(1);
  }

  if (options.txPlan && options.pureSimulation) {
    console.error("Cannot use --tx-plan with --dry-run/--pure-simulation");
    process.exit(1);
  }

  const networkManager = new NetworkManager();

  if (options.pureSimulation) {
    try {
      runPureSimulation(options.contract, options.network, networkManager);
      process.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${errorMsg}`);
      process.exit(1);
    }
  }

  let rpcUrl: string;
  let chainId: number;

  try {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    rpcUrl = networkManager.getRpcUrl(options.network);
    chainId = networkManager.getChainId(options.network);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get network config: ${errorMsg}`);
    process.exit(1);
  }

  const forgeArgs = [
    "script",
    "script/Upgrade.s.sol:Upgrade",
    "--sig",
    CONTRACT_FUNCTIONS[options.contract],
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    chainId.toString(),
  ];

  if (options.sender) {
    forgeArgs.push("--sender", options.sender);
  } else if (process.env.SENDER_ADDRESS) {
    forgeArgs.push("--sender", process.env.SENDER_ADDRESS);
  }

  if (options.broadcast) {
    forgeArgs.push("--broadcast");

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--account", keystoreName);

    console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
    console.log("💡 Password will be prompted interactively\n");
  } else if (options.txPlan) {
    console.log("🗂️ Transaction plan mode enabled (no broadcast, artifacts persisted)\n");
  } else {
    console.log("🔍 Simulation mode - no transactions will be broadcast\n");
  }

  console.log(`Executing: forge ${forgeArgs.join(" ")}\n`);

  try {
    execFileSync("forge", forgeArgs, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: {
        ...process.env,
        FOUNDRY_PROFILE: "production",
        FORGE_BROADCAST: options.broadcast || options.txPlan ? "true" : "false",
      },
    });

    if (options.txPlan) {
      const planPath = persistTxPlan(options, chainId);
      console.log(`\n✅ Upgrade transaction plan saved to ${planPath}`);
    } else {
      console.log("\n✅ Upgrade completed successfully");
    }
  } catch (error) {
    console.error("\n❌ Upgrade failed", error);
    process.exit(1);
  }
}

main();
