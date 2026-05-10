#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

import {
  buildMarketplaceConfigurationCalls,
  type DeploymentRecord,
  isZeroAddress,
  type MarketplaceConfigurationCall,
  type MarketplaceStateReader,
  normalizeAddress,
  readMarketplaceLiveState,
  validateMarketplaceReadiness,
  ZERO_ADDRESS,
} from "./utils/marketplace-readiness";
import { CHAIN_ID_MAP, NetworkManager } from "./utils/network";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

type NetworkName = "localhost" | "mainnet" | "arbitrum" | "sepolia" | "celo";
type MarketplaceCommand = "status" | "configure";

interface MarketplaceOptions {
  command: MarketplaceCommand;
  network: NetworkName;
  chainId: string;
  rpcUrl: string;
  dryRun: boolean;
  broadcast: boolean;
  expectedOwner?: string;
}

function maskRpcApiKey(value: string): string {
  return value.replace(/(\/v\d+\/)[^\s/]+/g, "$1***");
}

function parseArgs(argv: string[]): MarketplaceOptions {
  let command: MarketplaceCommand = "status";
  let network: NetworkName = "arbitrum";
  let rpcUrl = "";
  let chainId = "";
  let dryRun = true;
  let broadcast = false;
  let expectedOwner = process.env.MARKETPLACE_EXPECTED_OWNER || process.env.HYPERCERT_MARKETPLACE_EXPECTED_OWNER;

  const first = argv[2];
  let index = 2;
  if (first === "status" || first === "configure") {
    command = first;
    index = 3;
  }

  for (let i = index; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--network":
      case "-n":
        network = (argv[++i] ?? network) as NetworkName;
        break;
      case "--rpc-url":
        rpcUrl = argv[++i] ?? rpcUrl;
        break;
      case "--chain-id":
        chainId = argv[++i] ?? chainId;
        break;
      case "--dry-run":
        dryRun = true;
        broadcast = false;
        break;
      case "--broadcast":
        broadcast = true;
        dryRun = false;
        break;
      case "--expected-owner":
        expectedOwner = argv[++i] ?? expectedOwner;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  if (command === "status") {
    dryRun = true;
    broadcast = false;
  }
  if (command === "configure" && broadcast && process.env.MARKETPLACE_CONFIGURE_APPROVED !== "true") {
    throw new Error(
      "Marketplace configure broadcast requires MARKETPLACE_CONFIGURE_APPROVED=true and fresh operator approval.",
    );
  }

  const networkManager = new NetworkManager();
  return {
    command,
    network,
    chainId: chainId || CHAIN_ID_MAP[network] || networkManager.getChainId(network).toString(),
    rpcUrl: rpcUrl || networkManager.getRpcUrl(network),
    dryRun,
    broadcast,
    expectedOwner,
  };
}

function showHelp(): void {
  console.log(`
Green Goods Hypercert marketplace readiness

Usage:
  bun script/marketplace-readiness.ts status --network arbitrum
  bun script/marketplace-readiness.ts configure --network arbitrum --dry-run
  MARKETPLACE_CONFIGURE_APPROVED=true bun script/marketplace-readiness.ts configure --network arbitrum --broadcast

Options:
  status                     Read readiness and exit non-zero if not ready
  configure                  Prepare or execute owner calls needed for readiness
  --network, -n <name>       Network to target (default: arbitrum)
  --rpc-url <url>            Override RPC URL
  --chain-id <id>            Override chain ID / deployment artifact selection
  --dry-run                  Print required owner calls without broadcasting
  --broadcast                Execute required owner calls; requires MARKETPLACE_CONFIGURE_APPROVED=true
  --expected-owner <address> Verify adapter/module owner when the operator declares one
  --help, -h                 Show this help
`);
}

function loadDeployment(chainId: string): DeploymentRecord {
  const deploymentPath = path.join(__dirname, "../deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
}

function castCall(rpcUrl: string, to: string, signature: string, args: string[] = []): string | null {
  try {
    return execFileSync("cast", ["call", to, signature, ...args, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function hasContractCode(rpcUrl: string, address: string): boolean {
  if (isZeroAddress(address)) return false;
  try {
    const output = execFileSync("cast", ["code", address, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output !== "" && output !== "0x";
  } catch {
    return false;
  }
}

function encodeCall(call: MarketplaceConfigurationCall): string {
  try {
    return execFileSync("cast", ["calldata", call.signature, ...call.args.map(String)], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unavailable";
  }
}

function printCalls(calls: MarketplaceConfigurationCall[]): void {
  if (calls.length === 0) {
    console.log("\nNo marketplace owner calls needed.");
    return;
  }

  console.log("\nRequired marketplace owner calls:");
  for (const [index, call] of calls.entries()) {
    console.log(`  ${index + 1}. ${call.contract}.${call.signature}`);
    console.log(`     target: ${call.target}`);
    console.log(`     args: ${call.args.map(String).join(", ")}`);
    console.log(`     calldata: ${encodeCall(call)}`);
    console.log(`     reason: ${call.reason}`);
  }
}

function configurableFailure(failure: string): boolean {
  return (
    failure.startsWith("marketplaceAdapter.exchange mismatch:") ||
    failure.startsWith("marketplaceAdapter.hypercertMinter mismatch:") ||
    failure.startsWith("hypercertsModule.hypercertMinter mismatch:") ||
    failure.startsWith("marketplaceAdapter.authorizedModules(")
  );
}

function executeCall(options: MarketplaceOptions, call: MarketplaceConfigurationCall): void {
  const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
  console.log(`\nBroadcasting ${call.contract}.${call.signature} via Foundry keystore: ${keystoreName}`);
  execFileSync(
    "cast",
    [
      "send",
      call.target,
      call.signature,
      ...call.args.map(String),
      "--rpc-url",
      options.rpcUrl,
      "--chain-id",
      options.chainId,
      "--account",
      keystoreName,
    ],
    {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
    },
  );
}

function printState(options: MarketplaceOptions, deployment: DeploymentRecord): void {
  console.log("\nHypercert marketplace readiness");
  console.log(`  network: ${options.network}`);
  console.log(`  chainId: ${options.chainId}`);
  console.log(`  rpcUrl: ${maskRpcApiKey(options.rpcUrl)}`);
  console.log(`  marketplaceAdapter: ${deployment.marketplaceAdapter ?? ZERO_ADDRESS}`);
  console.log(`  hypercertsModule: ${deployment.hypercertsModule ?? ZERO_ADDRESS}`);
  console.log(`  hypercertExchange: ${deployment.hypercertExchange ?? ZERO_ADDRESS}`);
  console.log(`  hypercertMinter: ${deployment.hypercertMinter ?? ZERO_ADDRESS}`);
  console.log(`  transferManager: ${deployment.transferManager ?? ZERO_ADDRESS}`);
  console.log(`  strategyHypercertFractionOffer: ${deployment.strategyHypercertFractionOffer ?? ZERO_ADDRESS}`);
  if (!isZeroAddress(options.expectedOwner)) {
    console.log(`  expectedOwner: ${options.expectedOwner}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const deployment = loadDeployment(options.chainId);
  const reader: MarketplaceStateReader = {
    call: (to, signature, args = []) => castCall(options.rpcUrl, to, signature, args),
    hasCode: (address) => hasContractCode(options.rpcUrl, address),
  };

  printState(options, deployment);

  const state = readMarketplaceLiveState(deployment, reader);
  const readiness = validateMarketplaceReadiness(deployment, state, {
    expectedOwner: options.expectedOwner,
  });
  const calls = buildMarketplaceConfigurationCalls(deployment, state);

  console.log("\nLive state:");
  console.log(`  adapter.exchange: ${state.adapter.exchange}`);
  console.log(`  adapter.hypercertMinter: ${state.adapter.hypercertMinter}`);
  console.log(`  adapter.paused: ${state.adapter.paused}`);
  console.log(`  adapter.owner: ${state.adapter.owner}`);
  console.log(`  adapter.authorizedModule: ${state.adapter.authorizedModule}`);
  console.log(`  module.hypercertMinter: ${state.module.hypercertMinter}`);
  console.log(`  module.marketplaceAdapter: ${state.module.marketplaceAdapter}`);
  console.log(`  module.paused: ${state.module.paused}`);
  console.log(`  module.owner: ${state.module.owner}`);
  console.log(`  exchange.transferManager: ${state.exchange.transferManager}`);
  console.log(
    `  exchange.strategy[1]: active=${state.exchange.strategy.isActive} implementation=${state.exchange.strategy.implementation}`,
  );

  printCalls(calls);

  if (options.command === "configure") {
    const blockingFailures = readiness.failures.filter((failure) => !configurableFailure(failure));
    if (blockingFailures.length > 0) {
      console.error("\nMarketplace configure preflight failed:");
      for (const failure of blockingFailures) console.error(`- ${failure}`);
      process.exit(1);
    }

    if (options.dryRun) {
      console.log("\nDry-run complete. No transactions sent.");
      return;
    }

    for (const call of calls) {
      executeCall(options, call);
    }
    console.log("\nBroadcast complete. Re-run status and post-deploy verification.");
    return;
  }

  if (readiness.failures.length > 0) {
    console.error("\nMarketplace readiness failed:");
    for (const failure of readiness.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  if (calls.length > 0) {
    console.error("\nMarketplace readiness failed: pending owner calls remain.");
    process.exit(1);
  }

  if (
    !isZeroAddress(deployment.hypercertExchange) &&
    normalizeAddress(state.adapter.exchange) === normalizeAddress(deployment.hypercertExchange as string)
  ) {
    console.log("\nMarketplace readiness passed.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Marketplace readiness command failed: ${maskRpcApiKey(message)}`);
  process.exit(1);
});
