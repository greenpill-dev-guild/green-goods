#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { NetworkManager } from "./utils/network";

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

const CONTRACTS_ROOT = path.join(__dirname, "..");

type Command = "deploy-sepolia" | "deploy-mainnet" | "update-l1-receiver" | "migrate";

interface Options {
  command: Command;
  network: string;
  broadcast: boolean;
  newReceiver?: string;
  sender?: string;
}

function showHelp(): void {
  console.log(`
ENS Receiver Migration Tool
============================

Redeploys GreenGoodsENSReceiver with NameWrapper support.

Commands:
  deploy-sepolia        Deploy new ENSReceiver on Sepolia (same-chain, unwrapped)
  deploy-mainnet        Deploy new ENSReceiver on Mainnet (cross-chain, NameWrapper)
  update-l1-receiver    Update l1Receiver on L2 GreenGoodsENS (run after mainnet deploy)
  migrate               Migrate registrations from old to new receiver

Options:
  --network <name>      Network (default: sepolia)
  --broadcast           Execute transactions (default: simulation only)
  --new-receiver <addr> New receiver address (required for update-l1-receiver)
  --sender <addr>       Override tx sender address
  --help                Show this help

Examples:
  # Dry-run Sepolia migration
  bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia

  # Execute Sepolia migration
  bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia --broadcast

  # Deploy on mainnet
  bun script/upgrade-ens-receiver.ts deploy-mainnet --network mainnet --broadcast

  # Update Arbitrum l1Receiver after mainnet deploy
  bun script/upgrade-ens-receiver.ts update-l1-receiver --network arbitrum \\
    --new-receiver 0x... --broadcast
  `);
}

const COMMAND_SIGS: Record<Command, string> = {
  "deploy-sepolia": "deploySepolia()",
  "deploy-mainnet": "deployMainnet()",
  "update-l1-receiver": "updateL1Receiver(address)",
  migrate: "migrateRegistrations(address,string[],address[],uint8[])",
};

function parseOptions(args: string[]): Options {
  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const command = args[0] as Command;
  if (!COMMAND_SIGS[command]) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  let network = "sepolia";
  let broadcast = false;
  let newReceiver: string | undefined;
  let sender: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--network": {
        const value = args[++i];
        if (!value || value.startsWith("-")) throw new Error("--network requires a value");
        network = value;
        break;
      }
      case "--broadcast":
        broadcast = true;
        break;
      case "--new-receiver": {
        const value = args[++i];
        if (!value || !value.startsWith("0x")) throw new Error("--new-receiver requires an address");
        newReceiver = value;
        break;
      }
      case "--sender": {
        const value = args[++i];
        if (!value || value.startsWith("-")) throw new Error("--sender requires an address");
        sender = value;
        break;
      }
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { command, network, broadcast, newReceiver, sender };
}

function buildForgeArgs(options: Options, rpcUrl: string, chainId: number): string[] {
  let sig = COMMAND_SIGS[options.command];
  const sigArgs: string[] = [];

  if (options.command === "update-l1-receiver") {
    if (!options.newReceiver) {
      throw new Error("--new-receiver is required for update-l1-receiver");
    }
    sigArgs.push(options.newReceiver);
  }

  const forgeArgs = [
    "script",
    "script/UpgradeENSReceiver.s.sol:UpgradeENSReceiver",
    "--sig",
    sig,
    ...sigArgs,
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
    console.log(`Using Foundry keystore: ${keystoreName}`);
  } else {
    console.log("Simulation mode - no transactions will be broadcast\n");
  }

  return forgeArgs;
}

function updateDeploymentArtifact(chainId: number, newReceiverAddress: string): void {
  const deploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.log(`\nDeployment artifact not found at ${deploymentPath} — update manually`);
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const oldReceiver = deployment.ensReceiver;
  deployment.ensReceiver = newReceiverAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");

  console.log(`\nDeployment artifact updated:`);
  console.log(`  ${deploymentPath}`);
  console.log(`  ensReceiver: ${oldReceiver} -> ${newReceiverAddress}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseOptions(args);

  const networkManager = new NetworkManager();
  const rpcUrl = networkManager.getRpcUrl(options.network);
  const chainId = networkManager.getChainId(options.network);

  console.log(`Network: ${options.network} (chainId: ${chainId})`);
  console.log(`Command: ${options.command}\n`);

  const forgeArgs = buildForgeArgs(options, rpcUrl, chainId);
  console.log(`Executing: forge ${forgeArgs.join(" ")}\n`);

  try {
    execFileSync("forge", forgeArgs, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
    });

    console.log("\nMigration step completed successfully");

    // Print next steps based on command
    if (options.command === "deploy-mainnet" && options.broadcast) {
      console.log("\nNEXT: Run update-l1-receiver on Arbitrum with the new receiver address");
    }
  } catch (error) {
    console.error("\nMigration step failed", error);
    process.exit(1);
  }
}

main();
