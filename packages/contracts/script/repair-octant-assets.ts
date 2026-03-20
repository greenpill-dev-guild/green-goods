#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

import { NetworkManager } from "./utils/network";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

const CONTRACTS_ROOT = path.join(__dirname, "..");

interface RepairOptions {
  network: string;
  broadcast: boolean;
  pureSimulation: boolean;
  sender?: string;
}

function showHelp(): void {
  console.log(`
Green Goods Octant Template Repair Tool

Usage: bun script/repair-octant-assets.ts [options]

Options:
  --network <name>        Network to repair on (default: arbitrum)
  --sender <address>      Override tx sender address for simulation/broadcast
  --dry-run               Compile-only preflight (no RPC calls)
  --pure-simulation       Alias for --dry-run
  --broadcast             Execute repair transactions
  --help                  Show this help

Examples:
  bun script/repair-octant-assets.ts --network arbitrum
  bun script/repair-octant-assets.ts --network arbitrum --broadcast
  `);
}

function parseOptions(args: string[]): RepairOptions {
  let network = "arbitrum";
  let sender: string | undefined;
  let broadcast = false;
  let pureSimulation = false;

  for (let i = 0; i < args.length; i++) {
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
      case "--pure-simulation":
        pureSimulation = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return {
    network,
    broadcast,
    pureSimulation,
    sender,
  };
}

function runPureSimulation(): void {
  console.log("🧪 Pure simulation mode enabled (no RPC calls, no repair transactions)\n");
  console.log("🔨 Running forge build preflight...");
  execFileSync("forge", ["build", "--skip", "test"], {
    stdio: "inherit",
    cwd: CONTRACTS_ROOT,
    env: {
      ...process.env,
      FOUNDRY_PROFILE: "production",
    },
  });

  console.log("\nWould execute repair command:");
  console.log(
    'forge script script/RepairOctantAssets.s.sol:RepairOctantAssets --sig "repairArbitrumAssets()" --rpc-url <resolved at runtime> --chain-id 42161 --broadcast --account <keystore>',
  );
  console.log("\n✅ Pure simulation preflight completed successfully");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  let options: RepairOptions;
  try {
    options = parseOptions(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    showHelp();
    process.exit(1);
  }

  if (options.broadcast && options.pureSimulation) {
    console.error("Cannot use --broadcast with --dry-run/--pure-simulation");
    process.exit(1);
  }

  if (options.network !== "arbitrum") {
    console.error(`❌ Unsupported network ${options.network}. This repair script is only intended for arbitrum.`);
    process.exit(1);
  }

  const networkManager = new NetworkManager();

  if (options.pureSimulation) {
    try {
      runPureSimulation();
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
    rpcUrl = networkManager.getRpcUrl(options.network);
    chainId = networkManager.getChainId(options.network);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get network config: ${errorMsg}`);
    process.exit(1);
  }

  const forgeArgs = [
    "script",
    "script/RepairOctantAssets.s.sol:RepairOctantAssets",
    "--sig",
    "repairArbitrumAssets()",
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
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--broadcast", "--account", keystoreName);
    console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
    console.log("💡 Password will be prompted interactively\n");
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
        FORGE_BROADCAST: options.broadcast ? "true" : "false",
      },
    });
    console.log("\n✅ Octant asset repair completed successfully");
  } catch (error) {
    console.error("\n❌ Octant asset repair failed", error);
    process.exit(1);
  }
}

main();
