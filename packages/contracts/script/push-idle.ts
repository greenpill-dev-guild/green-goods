#!/usr/bin/env bun

/**
 * Push Idle Vault Funds to Aave Strategies
 *
 * One-off script for 3 gardens where deposits arrived before strategies
 * were attached. Calls OctantModule.pushIdleToStrategy() for each.
 *
 * Usage:
 *   bun script/push-idle.ts                    # Dry run (simulation)
 *   bun script/push-idle.ts --broadcast        # Execute on Arbitrum
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

import { NetworkManager } from "./utils/network";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

const CONTRACTS_ROOT = path.join(__dirname, "..");

function showHelp(): void {
  console.log(`
Push Idle Vault Funds to Aave Strategies

Deploys idle WETH from 3 gardens into their Aave V3 strategies.
These gardens received deposits before strategies were attached.

Usage:
  bun script/push-idle.ts                    Simulate (no transactions)
  bun script/push-idle.ts --broadcast        Execute on Arbitrum
  bun script/push-idle.ts --help             Show this help

Environment:
  ARBITRUM_RPC_URL              Arbitrum RPC endpoint
  FOUNDRY_KEYSTORE_ACCOUNT      Keystore name (default: green-goods-deployer)
  `);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  const broadcast = args.includes("--broadcast");
  const networkManager = new NetworkManager();

  let rpcUrl: string;
  let chainId: number;

  try {
    rpcUrl = networkManager.getRpcUrl("arbitrum");
    chainId = networkManager.getChainId("arbitrum");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed to get Arbitrum RPC: ${errorMsg}`);
    console.error("Set ARBITRUM_RPC_URL in your .env file.\n");
    process.exit(1);
  }

  console.log("\n  Push Idle Vault Funds to Aave Strategies");
  console.log("  =========================================\n");
  console.log(`  Network:   Arbitrum (${chainId})`);
  console.log(`  RPC:       ${rpcUrl.slice(0, 40)}...`);
  console.log(`  Mode:      ${broadcast ? "BROADCAST" : "Simulation (dry run)"}\n`);

  const forgeArgs = [
    "script",
    "script/PushIdleToStrategy.s.sol:PushIdleToStrategy",
    "--sig",
    "run()",
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    chainId.toString(),
  ];

  if (process.env.SENDER_ADDRESS) {
    forgeArgs.push("--sender", process.env.SENDER_ADDRESS);
  }

  if (broadcast) {
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--broadcast", "--account", keystoreName);
    console.log(`  Keystore:  ${keystoreName}`);
    console.log("  Password will be prompted interactively\n");
  } else {
    console.log("  Add --broadcast to execute transactions\n");
  }

  try {
    execFileSync("forge", forgeArgs, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: {
        ...process.env,
        FOUNDRY_PROFILE: "production",
      },
    });

    if (broadcast) {
      console.log("\n  Idle funds pushed to Aave strategies.");
    } else {
      console.log("\n  Simulation complete. Run with --broadcast to execute.");
    }
  } catch (error) {
    console.error("\nScript failed. Check output above for details.");
    process.exit(1);
  }
}

main();
