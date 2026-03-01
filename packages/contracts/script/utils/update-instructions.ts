#!/usr/bin/env node

/**
 * Temporary script to update on-chain ActionRegistry instruction CIDs.
 *
 * After re-uploading IPFS instructions with the fixed Storacha client,
 * run this to call updateActionInstructions() for each action.
 *
 * Features:
 * - Reads current on-chain CID via `cast call` before sending — skips already-updated actions
 * - Safe to re-run: only sends transactions for actions that still need updating
 *
 * Usage:
 *   cd packages/contracts
 *   npx tsx script/utils/update-instructions.ts [--dry-run]
 *
 * Environment:
 *   ARBITRUM_RPC_URL or VITE_ALCHEMY_API_KEY — Arbitrum RPC endpoint
 *   FOUNDRY_KEYSTORE_ACCOUNT — Foundry keystore name (default: green-goods-deployer)
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// --- env loading (same as ipfs-uploader.ts) ---
function loadEnvFile(envPath: string): void {
  try {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.startsWith('"')) {
        const close = value.indexOf('"', 1);
        if (close !== -1) value = value.slice(1, close);
      } else if (value.startsWith("'")) {
        const close = value.indexOf("'", 1);
        if (close !== -1) value = value.slice(1, close);
      } else {
        const ci = value.indexOf("#");
        if (ci !== -1) value = value.slice(0, ci).trim();
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // env vars may already be set
  }
}

loadEnvFile(path.join(__dirname, "../../../../", ".env"));

// --- config ---
const CHAIN_ID = 42161; // Arbitrum One
const DEPLOYMENT_FILE = path.join(process.cwd(), `deployments/${CHAIN_ID}-latest.json`);
const CACHE_FILE = path.join(process.cwd(), ".ipfs-cache.json");
const ACTIONS_FILE = path.join(process.cwd(), "config", "actions.json");

interface ActionConfig {
  title: string;
  description: string;
  capitals: string[];
  startTime: number;
  endTime: number;
  uiConfig: Record<string, unknown>;
}

interface CacheEntry {
  hash: string;
  title: string;
  uploadedAt: string;
}

function buildCacheKey(action: ActionConfig, index: number): string {
  const serialized = JSON.stringify(action);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `${index}-${hash}`;
}

function getRpcUrl(): string {
  const explicit = process.env.ARBITRUM_RPC_URL;
  if (explicit) return explicit;

  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY || process.env.VITE_ALCHEMY_API_KEY;
  if (alchemyKey) return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;

  throw new Error("No Arbitrum RPC URL found. Set ARBITRUM_RPC_URL or VITE_ALCHEMY_API_KEY in .env");
}

/**
 * Read the current on-chain instructions CID for a given action UID.
 * Calls getAction(uint256) and checks if the expected CID is present in the raw hex output.
 * This avoids fragile tuple-decoding by hex-encoding the expected CID and matching directly.
 */
function readOnChainCid(actionRegistry: string, uid: number, expectedCid: string, rpcUrl: string): boolean {
  try {
    const rawHex = execFileSync(
      "cast",
      ["call", actionRegistry, "getAction(uint256)", uid.toString(), "--rpc-url", rpcUrl],
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
      },
    )
      .toString()
      .trim();
    // Hex-encode the expected CID and check if it appears in the raw ABI output
    const cidHex = Buffer.from(expectedCid, "utf8").toString("hex");
    return rawHex.includes(cidHex);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️  cast call failed for action ${uid}: ${reason}`);
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Load deployment
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    console.error(`Deployment file not found: ${DEPLOYMENT_FILE}`);
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const actionRegistry = deployment.actionRegistry as string;
  console.log(`ActionRegistry: ${actionRegistry}`);

  // Load actions
  if (!fs.existsSync(ACTIONS_FILE)) {
    console.error(`Actions file not found: ${ACTIONS_FILE}`);
    process.exit(1);
  }
  const actionsData = JSON.parse(fs.readFileSync(ACTIONS_FILE, "utf8"));
  const actions: ActionConfig[] = actionsData.actions;
  console.log(`Actions: ${actions.length}`);

  // Load cache
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Cache file not found: ${CACHE_FILE}. Run ipfs-uploader.ts first.`);
    process.exit(1);
  }
  const cache: Record<string, CacheEntry> = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

  // Resolve CIDs for each action
  const allUpdates: { uid: number; title: string; cid: string }[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const cacheKey = buildCacheKey(action, i);
    const entry = cache[cacheKey];
    if (!entry?.hash) {
      console.error(`Missing cache entry for action ${i} (${action.title}), key: ${cacheKey}`);
      console.error("Run the IPFS uploader first: npx tsx script/utils/ipfs-uploader.ts");
      process.exit(1);
    }
    allUpdates.push({ uid: i, title: action.title, cid: entry.hash });
  }

  // Check on-chain state to skip already-updated actions
  const rpcUrl = getRpcUrl();
  console.log(`\nChecking on-chain state...\n`);

  const pending: typeof allUpdates = [];
  const alreadyDone: typeof allUpdates = [];

  for (const u of allUpdates) {
    const isUpToDate = readOnChainCid(actionRegistry, u.uid, u.cid, rpcUrl);
    if (isUpToDate) {
      alreadyDone.push(u);
    } else {
      pending.push(u);
    }
  }

  if (alreadyDone.length > 0) {
    console.log(`Already up-to-date (${alreadyDone.length}):`);
    for (const u of alreadyDone) {
      console.log(`  [${u.uid}] ${u.title}`);
    }
    console.log();
  }

  if (pending.length === 0) {
    console.log("All actions already have correct CIDs on-chain. Nothing to do.");
    return;
  }

  console.log(`Need update (${pending.length}):`);
  for (const u of pending) {
    console.log(`  [${u.uid}] ${u.title} -> ${u.cid}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: No transactions sent.");
    return;
  }

  const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
  console.log(`\nRPC: ${rpcUrl.replace(/\/v2\/.*/, "/v2/***")}`);
  console.log(`Keystore: ${keystoreName}`);
  console.log(`\nSending ${pending.length} transactions...\n`);

  let success = 0;
  let failed = 0;

  for (const u of pending) {
    const args = [
      "send",
      actionRegistry,
      "updateActionInstructions(uint256,string)",
      u.uid.toString(),
      u.cid,
      "--rpc-url",
      rpcUrl,
      "--account",
      keystoreName,
    ];

    console.log(`[${u.uid}] ${u.title}...`);
    try {
      const output = execFileSync("cast", args, {
        stdio: ["inherit", "pipe", "pipe"],
        timeout: 120_000,
      });
      const txOutput = output.toString().trim();
      const txHashMatch = txOutput.match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
      const txHash = txHashMatch ? txHashMatch[1] : txOutput.slice(0, 80);
      console.log(`  OK: ${txHash}`);
      success++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed out of ${pending.length} pending.`);
  console.log(`Total: ${alreadyDone.length + success} / ${allUpdates.length} actions up-to-date.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
