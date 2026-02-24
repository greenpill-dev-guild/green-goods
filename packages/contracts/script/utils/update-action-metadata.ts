#!/usr/bin/env node

/**
 * Update Action Metadata — Instructions + Images
 *
 * Uploads action images to IPFS (Storacha), loads instruction CIDs from cache,
 * checks on-chain state, and generates a single Forge batch script to update
 * all actions in one keystore prompt.
 *
 * Usage:
 *   cd packages/contracts
 *   npx tsx script/utils/update-action-metadata.ts [flags]
 *
 * Flags:
 *   --dry-run         Show what would be updated, no IPFS uploads or on-chain changes
 *   --upload-only     Upload images to IPFS (cache them) but don't update on-chain
 *   --skip-images     Skip image upload (load CIDs from cache instead)
 *   --force           Re-upload all images (ignore media cache) and skip on-chain checks
 *
 * Environment:
 *   ARBITRUM_RPC_URL or VITE_ALCHEMY_API_KEY — Arbitrum RPC endpoint
 *   FOUNDRY_KEYSTORE_ACCOUNT — Foundry keystore name (default: green-goods-deployer)
 *   VITE_STORACHA_KEY — ed25519 signing key for Storacha uploads
 *   VITE_STORACHA_PROOF — UCAN delegation proof for Storacha uploads
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Env loading (same approach as ipfs-uploader.ts)
// ---------------------------------------------------------------------------
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
    /* env vars may already be set */
  }
}

loadEnvFile(path.join(__dirname, "../../../../", ".env"));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHAIN_ID = 42161; // Arbitrum One
const DEPLOYMENT_FILE = path.join(process.cwd(), `deployments/${CHAIN_ID}-latest.json`);
const INSTRUCTIONS_CACHE = path.join(process.cwd(), ".ipfs-cache.json");
const MEDIA_CACHE = path.join(process.cwd(), ".ipfs-media-cache.json");
const ACTIONS_FILE = path.join(process.cwd(), "config", "actions.json");
const IMAGES_DIR = path.join(process.cwd(), "config", "action-images");
const TEMP_DIR = path.join(__dirname, "../temp");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ActionConfig {
  title: string;
  slug: string;
  description: string;
  capitals: string[];
  startTime: string | number;
  endTime: string | number;
  media: string[];
  uiConfig: Record<string, unknown>;
}

interface CacheEntry {
  hash: string;
  title: string;
  uploadedAt: string;
}

interface ActionUpdate {
  uid: number;
  title: string;
  slug: string;
  instructionsCid: string | null;
  mediaCid: string | null;
  needsInstructions: boolean;
  needsMedia: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts action slug to image filename: solar.site_setup → solar-site-setup.webp */
function slugToImageFilename(slug: string): string {
  return slug.replace(".", "-").replace(/_/g, "-") + ".webp";
}

/** Same cache key logic as ipfs-uploader.ts — hash of full action config + index */
function buildInstructionsCacheKey(action: ActionConfig, index: number): string {
  const serialized = JSON.stringify(action);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `${index}-${hash}`;
}

/** Media cache key: based on image file content hash + slug */
function buildMediaCacheKey(slug: string, imageBuffer: Buffer): string {
  const hash = createHash("sha256").update(imageBuffer).digest("hex").slice(0, 16);
  return `${slug}-${hash}`;
}

function getRpcUrl(): string {
  const explicit = process.env.ARBITRUM_RPC_URL;
  if (explicit) return explicit;
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY || process.env.VITE_ALCHEMY_API_KEY;
  if (alchemyKey) return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  throw new Error("No Arbitrum RPC URL. Set ARBITRUM_RPC_URL or VITE_ALCHEMY_API_KEY in .env");
}

/**
 * Check if a CID is present in the on-chain Action ABI output.
 * Hex-encodes the CID and looks for it in the raw `cast call` response.
 */
function onChainHasCid(actionRegistry: string, uid: number, cid: string, rpcUrl: string): boolean {
  try {
    const raw = execFileSync(
      "cast",
      ["call", actionRegistry, "getAction(uint256)", uid.toString(), "--rpc-url", rpcUrl],
      { stdio: ["pipe", "pipe", "pipe"], timeout: 30_000 },
    )
      .toString()
      .trim();
    const cidHex = Buffer.from(cid, "utf8").toString("hex");
    return raw.includes(cidHex);
  } catch {
    return false;
  }
}

/** Load JSON file or return empty object */
function loadJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    /* use default */
  }
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Storacha client (lazy-initialized)
// ---------------------------------------------------------------------------
interface StorachaClient {
  uploadFile: (file: File) => Promise<{ toString(): string }>;
  setCurrentSpace: (did: string) => Promise<void>;
  addSpace: (proof: unknown) => Promise<{ did(): string }>;
}

async function initStoracha(): Promise<StorachaClient> {
  const storachaKey = process.env.VITE_STORACHA_KEY;
  const storachaProof = process.env.VITE_STORACHA_PROOF;

  if (!storachaKey || !storachaProof) {
    throw new Error("VITE_STORACHA_KEY and VITE_STORACHA_PROOF required for uploads");
  }

  const Client = await import("@storacha/client");
  const Proof = await import("@storacha/client/proof");
  const { Signer } = await import("@storacha/client/principal/ed25519");
  const { StoreMemory } = await import("@storacha/client/stores/memory");

  const principal = Signer.parse(storachaKey);
  const client = await Client.create({ principal, store: new StoreMemory() });
  const proof = await Proof.parse(storachaProof);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());
  console.log(`  Storacha space: ${space.did()}`);

  return client as unknown as StorachaClient;
}

async function uploadFileToStoracha(
  client: StorachaClient,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  retries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const blob = new Blob([buffer], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      const cid = await client.uploadFile(file);
      return cid.toString();
    } catch (error) {
      if (attempt === retries) throw error;
      const waitMs = 1000 * attempt;
      console.log(`    Retry ${attempt}/${retries} in ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error("Upload failed after all retries");
}

// ---------------------------------------------------------------------------
// Phase 1: Upload images to IPFS
// ---------------------------------------------------------------------------
async function uploadImages(
  actions: ActionConfig[],
  options: { dryRun: boolean; force: boolean },
): Promise<Map<number, string>> {
  console.log("\n=== Phase 1: Upload Action Images to IPFS ===\n");

  const mediaCache = loadJsonFile<Record<string, CacheEntry>>(MEDIA_CACHE, {});
  const mediaCids = new Map<number, string>();
  const toUpload: { index: number; slug: string; filename: string; imagePath: string }[] = [];

  // Map actions to images and check cache
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const filename = slugToImageFilename(action.slug);
    const imagePath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(imagePath)) {
      console.log(`  [${i}] ${action.title} — MISSING IMAGE: ${filename}`);
      continue;
    }

    // Check cache (keyed by slug + file content hash)
    const imageBuffer = fs.readFileSync(imagePath);
    const cacheKey = buildMediaCacheKey(action.slug, imageBuffer);

    if (!options.force && mediaCache[cacheKey]?.hash) {
      const cached = mediaCache[cacheKey];
      console.log(`  [${i}] ${action.title} — cached: ${cached.hash}`);
      mediaCids.set(i, cached.hash);
      continue;
    }

    toUpload.push({ index: i, slug: action.slug, filename, imagePath });
  }

  if (toUpload.length === 0) {
    console.log("\n  All images cached. No uploads needed.");
    return mediaCids;
  }

  if (options.dryRun) {
    console.log(`\n  --dry-run: Would upload ${toUpload.length} images.`);
    for (const item of toUpload) {
      console.log(`    [${item.index}] ${item.filename}`);
    }
    return mediaCids;
  }

  // Initialize Storacha
  console.log(`\n  Initializing Storacha for ${toUpload.length} image uploads...`);
  const client = await initStoracha();

  // Upload sequentially with progress
  let uploaded = 0;
  for (const item of toUpload) {
    const imageBuffer = fs.readFileSync(item.imagePath);
    const sizeMB = (imageBuffer.length / 1024 / 1024).toFixed(1);
    process.stdout.write(`  [${item.index}] ${item.filename} (${sizeMB} MB)... `);

    try {
      const cid = await uploadFileToStoracha(client, imageBuffer, item.filename, "image/webp");
      console.log(`✓ ${cid}`);
      mediaCids.set(item.index, cid);

      // Update cache
      const cacheKey = buildMediaCacheKey(item.slug, imageBuffer);
      mediaCache[cacheKey] = {
        hash: cid,
        title: actions[item.index].title,
        uploadedAt: new Date().toISOString(),
      };
      uploaded++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`✗ FAILED: ${msg}`);
    }
  }

  // Save cache
  fs.writeFileSync(MEDIA_CACHE, JSON.stringify(mediaCache, null, 2));
  console.log(`\n  Uploaded: ${uploaded}/${toUpload.length}, Total cached: ${mediaCids.size}/${actions.length}`);

  return mediaCids;
}

// ---------------------------------------------------------------------------
// Phase 2: Load instruction CIDs
// ---------------------------------------------------------------------------
function loadInstructionCids(actions: ActionConfig[]): Map<number, string> {
  console.log("\n=== Phase 2: Load Instruction CIDs from Cache ===\n");

  const cache = loadJsonFile<Record<string, CacheEntry>>(INSTRUCTIONS_CACHE, {});
  const instructionCids = new Map<number, string>();
  let found = 0;
  let missing = 0;

  for (let i = 0; i < actions.length; i++) {
    const cacheKey = buildInstructionsCacheKey(actions[i], i);
    const entry = cache[cacheKey];
    if (entry?.hash) {
      instructionCids.set(i, entry.hash);
      found++;
    } else {
      console.log(`  [${i}] ${actions[i].title} — MISSING from .ipfs-cache.json`);
      missing++;
    }
  }

  console.log(`  Found: ${found}, Missing: ${missing}`);
  if (missing > 0) {
    console.log("  Run ipfs-uploader.ts first to upload missing instruction documents:");
    console.log("    npx tsx script/utils/ipfs-uploader.ts");
  }

  return instructionCids;
}

// ---------------------------------------------------------------------------
// Phase 3: Check on-chain state and determine updates
// ---------------------------------------------------------------------------
function determineUpdates(
  actions: ActionConfig[],
  instructionCids: Map<number, string>,
  mediaCids: Map<number, string>,
  actionRegistry: string,
  rpcUrl: string,
  force: boolean,
): ActionUpdate[] {
  console.log("\n=== Phase 3: Check On-chain State ===\n");

  if (force) {
    console.log("  --force: Skipping on-chain checks, will update all actions\n");
  }

  const updates: ActionUpdate[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const instrCid = instructionCids.get(i) ?? null;
    const mediaCid = mediaCids.get(i) ?? null;

    let needsInstructions = false;
    let needsMedia = false;

    if (instrCid) {
      if (force) {
        needsInstructions = true;
      } else {
        const hasInstr = onChainHasCid(actionRegistry, i, instrCid, rpcUrl);
        needsInstructions = !hasInstr;
      }
    }

    if (mediaCid) {
      if (force) {
        needsMedia = true;
      } else {
        const hasMedia = onChainHasCid(actionRegistry, i, mediaCid, rpcUrl);
        needsMedia = !hasMedia;
      }
    }

    const label = [];
    if (needsInstructions) label.push("instructions");
    if (needsMedia) label.push("media");

    if (label.length > 0) {
      console.log(`  [${i}] ${action.title} — needs: ${label.join(", ")}`);
    } else {
      console.log(`  [${i}] ${action.title} — up-to-date`);
    }

    updates.push({
      uid: i,
      title: action.title,
      slug: action.slug,
      instructionsCid: instrCid,
      mediaCid: mediaCid,
      needsInstructions,
      needsMedia,
    });
  }

  const pending = updates.filter((u) => u.needsInstructions || u.needsMedia);
  console.log(`\n  Total: ${updates.length}, Need update: ${pending.length}`);

  return updates;
}

// ---------------------------------------------------------------------------
// Phase 4: Generate batch Solidity script
// ---------------------------------------------------------------------------
function generateBatchScript(updates: ActionUpdate[], actionRegistry: string): string {
  const pending = updates.filter((u) => u.needsInstructions || u.needsMedia);
  if (pending.length === 0) return "";

  const updateCalls = pending
    .map((u) => {
      const lines: string[] = [];
      lines.push(`        // [${u.uid}] ${u.title}`);

      if (u.needsInstructions && u.instructionsCid) {
        lines.push(`        registry.updateActionInstructions(${u.uid}, "${u.instructionsCid}");`);
        lines.push(`        console.log("Updated instructions for action ${u.uid}");`);
      }

      if (u.needsMedia && u.mediaCid) {
        lines.push(`        {`);
        lines.push(`            string[] memory media = new string[](1);`);
        lines.push(`            media[0] = "${u.mediaCid}";`);
        lines.push(`            registry.updateActionMedia(${u.uid}, media);`);
        lines.push(`            console.log("Updated media for action ${u.uid}");`);
        lines.push(`        }`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  return `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";

/// @notice Auto-generated batch update script. Updates ${pending.length} action(s).
contract UpdateActionMetadata is Script {
    function run() external {
        vm.startBroadcast();

        ActionRegistry registry = ActionRegistry(${actionRegistry});

${updateCalls}

        vm.stopBroadcast();
        console.log("All action metadata updated successfully!");
    }
}`;
}

// ---------------------------------------------------------------------------
// Phase 5: Execute forge script
// ---------------------------------------------------------------------------
function executeBatchScript(solidity: string, rpcUrl: string): void {
  console.log("\n=== Phase 5: Execute Batch Update ===\n");

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const scriptPath = path.join(TEMP_DIR, "UpdateActionMetadata.s.sol");
  fs.writeFileSync(scriptPath, solidity);

  const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";

  const args = [
    "script",
    `${scriptPath}:UpdateActionMetadata`,
    "--rpc-url",
    rpcUrl,
    "--broadcast",
    "--account",
    keystoreName,
  ];

  console.log(`  Keystore: ${keystoreName}`);
  console.log(`  RPC: ${rpcUrl.replace(/\/v2\/.*/, "/v2/***")}`);
  console.log(`  Script: ${scriptPath}`);
  console.log(`\n  Executing forge script (enter keystore password once)...\n`);

  try {
    execFileSync("forge", args, {
      stdio: "inherit",
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      cwd: path.join(__dirname, "../.."),
      timeout: 300_000, // 5 minutes
    });
    console.log("\n  Batch update completed successfully!");
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ignore cleanup failures */
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const uploadOnly = args.includes("--upload-only");
  const skipImages = args.includes("--skip-images");
  const force = args.includes("--force");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Update Action Metadata                 ║");
  console.log("║   Instructions + Images → On-chain       ║");
  console.log("╚══════════════════════════════════════════╝");

  if (dryRun) console.log("\n  🔍 DRY RUN — no changes will be made\n");

  // Load actions
  if (!fs.existsSync(ACTIONS_FILE)) {
    console.error(`Actions file not found: ${ACTIONS_FILE}`);
    process.exit(1);
  }
  const actionsData = JSON.parse(fs.readFileSync(ACTIONS_FILE, "utf8"));
  const actions: ActionConfig[] = actionsData.actions;
  console.log(`\n  Loaded ${actions.length} actions from config/actions.json`);

  // Load deployment
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    console.error(`Deployment file not found: ${DEPLOYMENT_FILE}`);
    console.error("Deploy core contracts first.");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const actionRegistry = deployment.actionRegistry as string;
  console.log(`  ActionRegistry: ${actionRegistry}`);

  // Phase 1: Upload images (or load from cache if --skip-images)
  let mediaCids = new Map<number, string>();
  if (!skipImages) {
    mediaCids = await uploadImages(actions, { dryRun, force });
  } else {
    console.log("\n=== Phase 1: Skipped upload (--skip-images), loading from cache ===\n");
    const mediaCache = loadJsonFile<Record<string, CacheEntry>>(MEDIA_CACHE, {});
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const filename = slugToImageFilename(action.slug);
      const imagePath = path.join(IMAGES_DIR, filename);
      if (!fs.existsSync(imagePath)) continue;
      const imageBuffer = fs.readFileSync(imagePath);
      const cacheKey = buildMediaCacheKey(action.slug, imageBuffer);
      if (mediaCache[cacheKey]?.hash) {
        mediaCids.set(i, mediaCache[cacheKey].hash);
        console.log(`  [${i}] ${action.title} — cached: ${mediaCache[cacheKey].hash}`);
      } else {
        console.log(`  [${i}] ${action.title} — NOT in media cache`);
      }
    }
    console.log(`\n  Loaded ${mediaCids.size}/${actions.length} media CIDs from cache`);
  }

  if (uploadOnly) {
    console.log("\n  --upload-only: Stopping after IPFS upload.");
    return;
  }

  // Phase 2: Load instruction CIDs
  const instructionCids = loadInstructionCids(actions);

  // Phase 3: Determine updates
  const rpcUrl = getRpcUrl();
  const updates = determineUpdates(actions, instructionCids, mediaCids, actionRegistry, rpcUrl, force);

  // Phase 4: Generate batch script
  const pending = updates.filter((u) => u.needsInstructions || u.needsMedia);
  if (pending.length === 0) {
    console.log("\n  All actions are up-to-date. Nothing to do.");
    return;
  }

  console.log("\n=== Phase 4: Generate Batch Solidity Script ===\n");
  const solidity = generateBatchScript(updates, actionRegistry);

  if (dryRun) {
    const instrCount = pending.filter((u) => u.needsInstructions).length;
    const mediaCount = pending.filter((u) => u.needsMedia).length;
    console.log(`  Would update: ${instrCount} instructions, ${mediaCount} media CIDs`);
    console.log("  --dry-run: No transactions sent.");

    // Show the generated script for inspection
    const previewPath = path.join(TEMP_DIR, "UpdateActionMetadata.preview.sol");
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    fs.writeFileSync(previewPath, solidity);
    console.log(`\n  Preview script written to: ${previewPath}`);
    return;
  }

  // Phase 5: Execute
  executeBatchScript(solidity, rpcUrl);
}

main().catch((err) => {
  console.error("\nFatal:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
