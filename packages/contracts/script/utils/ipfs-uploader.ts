#!/usr/bin/env bun

/**
 * IPFS Action Uploader
 *
 * Purpose: Upload action instruction documents to IPFS via Storacha.
 * Called by Deploy.s.sol via FFI during deployment.
 *
 * Inputs: Reads config/actions.json
 * Side-effects: Uploads to IPFS, creates .ipfs-cache.json
 * Outputs: JSON array of IPFS hashes to stdout
 *
 * IMPORTANT: This script must output ONLY valid JSON to stdout.
 * All diagnostics/errors go to stderr via console.error().
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Silently load .env file without any stdout output.
 * The dotenv CLI wrapper outputs banners which breaks FFI JSON parsing.
 */
function loadEnvFile(envPath: string): void {
  try {
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Handle quoted values (may contain # that's not a comment)
      if (value.startsWith('"')) {
        // Find closing quote
        const closeQuote = value.indexOf('"', 1);
        if (closeQuote !== -1) {
          value = value.slice(1, closeQuote);
        }
      } else if (value.startsWith("'")) {
        // Find closing quote
        const closeQuote = value.indexOf("'", 1);
        if (closeQuote !== -1) {
          value = value.slice(1, closeQuote);
        }
      } else {
        // Unquoted value - strip inline comments
        const commentIndex = value.indexOf("#");
        if (commentIndex !== -1) {
          value = value.slice(0, commentIndex).trim();
        }
      }

      // Don't override existing env vars
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently fail - env vars may already be set
  }
}

// Load environment variables silently
loadEnvFile(path.join(__dirname, "../../../../", ".env"));

const CACHE_FILE = path.join(process.cwd(), ".ipfs-cache.json");
const ACTIONS_FILE = path.join(process.cwd(), "config", "actions.json");

// Types
interface ActionTemplate {
  aliasFor?: string;
  steps: string[];
  requirements: {
    materials: string[];
    skills: string[];
    timeEstimate: string;
  };
  tips: string[];
}

interface ActionConfig {
  title: string;
  description: string;
  capitals: string[];
  startTime: number;
  endTime: number;
  uiConfig: Record<string, unknown>;
}

interface ActionsData {
  actions: ActionConfig[];
  templates: Record<string, ActionTemplate>;
}

interface CacheEntry {
  hash: string;
  title: string;
  uploadedAt: string;
}

interface Cache {
  [key: string]: CacheEntry;
}

interface InstructionsDocument {
  title: string;
  description: string;
  capitals: string[];
  timeframe: {
    start: number;
    end: number;
  };
  uiConfig: Record<string, unknown>;
  steps: string[];
  requirements: ActionTemplate["requirements"];
  tips: string[];
}

/**
 * Get template for an action based on its title
 * Templates are loaded from actions.json and matched by keyword in title
 */
function getTemplateForAction(title: string, templates: Record<string, ActionTemplate>): ActionTemplate {
  const lowerTitle = title.toLowerCase();

  // Define priority order for keyword matching (more specific first)
  const keywordPriority = ["identify", "observe", "water", "litter", "waste", "plant", "harvest", "workshop"];

  // Try priority keywords first
  for (const keyword of keywordPriority) {
    if (lowerTitle.includes(keyword)) {
      const template = templates[keyword];
      if (!template) continue;

      // Handle aliases (e.g., 'observe' → 'identify')
      if (template.aliasFor) {
        return templates[template.aliasFor] || templates.default;
      }

      return template;
    }
  }

  // Fallback to default template
  return (
    templates.default || {
      steps: [],
      requirements: { materials: [], skills: [], timeEstimate: "30-60 minutes" },
      tips: [],
    }
  );
}

/**
 * Generate enhanced instructions document for an action
 */
function generateInstructionsDocument(
  action: ActionConfig,
  templates: Record<string, ActionTemplate>,
): InstructionsDocument {
  const template = getTemplateForAction(action.title, templates);

  return {
    title: action.title,
    description: action.description,
    capitals: action.capitals,
    timeframe: {
      start: action.startTime,
      end: action.endTime,
    },
    uiConfig: action.uiConfig,
    steps: template.steps,
    requirements: template.requirements,
    tips: template.tips,
  };
}

/**
 * Load cached IPFS hashes
 */
function loadCache(): Cache {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data) as Cache;
    }
  } catch (error) {
    console.error("IPFS uploader: unable to load cache, continuing without cached data.", error);
  }
  return {};
}

/**
 * Save IPFS hashes to cache
 */
function saveCache(cache: Cache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("IPFS uploader: unable to persist cache to disk.", error);
  }
}

/**
 * Build deterministic cache key from action contents to avoid stale uploads
 */
function buildCacheKey(action: ActionConfig, index: number): string {
  const serialized = JSON.stringify(action);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `${index}-${hash}`;
}

interface StorachaClient {
  uploadFile: (file: File) => Promise<{ toString(): string }>;
  setCurrentSpace: (did: string) => Promise<void>;
  addSpace: (proof: unknown) => Promise<{ did(): string }>;
}

/**
 * Initialize Storacha client
 */
async function initStoracha(): Promise<StorachaClient> {
  const storachaKey = process.env.VITE_STORACHA_KEY;
  const storachaProof = process.env.VITE_STORACHA_PROOF;

  if (!storachaKey || !storachaProof) {
    throw new Error("VITE_STORACHA_KEY and VITE_STORACHA_PROOF environment variables required");
  }

  // Dynamic imports for ES modules
  const Client = await import("@storacha/client");
  const Proof = await import("@storacha/client/proof");

  const client = await Client.create();

  // Parse the proof and add space to the client
  const proof = await Proof.parse(storachaProof);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  return client as unknown as StorachaClient;
}

/**
 * Upload action to IPFS via Storacha with retry logic
 */
async function uploadToIPFS(
  client: StorachaClient,
  name: string,
  data: InstructionsDocument,
  retries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Convert JSON to Blob/File for upload
      const jsonString = JSON.stringify(data);
      const blob = new Blob([jsonString], { type: "application/json" });
      const file = new File([blob], `${name}.json`, { type: "application/json" });

      const cid = await client.uploadFile(file);
      return cid.toString();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error("Upload failed after all retries");
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    // Load actions
    if (!fs.existsSync(ACTIONS_FILE)) {
      console.error(`Error: Actions file not found: ${ACTIONS_FILE}`);
      process.exit(1);
    }

    const actionsData = JSON.parse(fs.readFileSync(ACTIONS_FILE, "utf8")) as ActionsData;
    const actions = actionsData.actions;
    const templates = actionsData.templates;
    console.error(`IPFS uploader: processing ${actions.length} actions from config/actions.json`);

    if (!actions || !Array.isArray(actions)) {
      console.error("Error: Invalid actions.json format - missing or invalid 'actions' array");
      process.exit(1);
    }

    if (!templates || typeof templates !== "object") {
      console.error("Error: Invalid actions.json format - missing or invalid 'templates' object");
      process.exit(1);
    }

    // Load cache
    const cache = loadCache();
    const ipfsHashes: string[] = [];
    let hasChanges = false;
    let cacheHits = 0;
    let uploads = 0;

    // Check if we have valid cache for all actions
    const allCached = actions.every((action, idx) => {
      const cacheKey = buildCacheKey(action, idx);
      return cache[cacheKey]?.hash;
    });

    // Get Storacha credentials
    const storachaKey = process.env.VITE_STORACHA_KEY;
    const storachaProof = process.env.VITE_STORACHA_PROOF;

    // If credentials not set and we have cache, use cache
    if (!storachaKey || !storachaProof) {
      if (allCached) {
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const cacheKey = buildCacheKey(action, i);
          ipfsHashes.push(cache[cacheKey].hash);
        }
        console.log(JSON.stringify(ipfsHashes));
        process.exit(0);
      } else {
        console.error(
          "Error: VITE_STORACHA_KEY and VITE_STORACHA_PROOF environment variables required and no valid cache found",
        );
        process.exit(1);
      }
    }

    // Initialize Storacha
    const client = await initStoracha();

    // Process each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const cacheKey = buildCacheKey(action, i);

      // Check cache first
      if (cache[cacheKey]?.hash) {
        cacheHits += 1;
        console.error(`Cache hit for action ${i}: ${action.title} -> ${cache[cacheKey].hash}`);
        ipfsHashes.push(cache[cacheKey].hash);
        continue;
      }

      // Generate instructions document
      const instructionsDoc = generateInstructionsDocument(action, templates);

      // Upload to IPFS
      try {
        const hash = await uploadToIPFS(client, action.title.replace(/\s+/g, "-").toLowerCase(), instructionsDoc);
        uploads += 1;

        // Upload successful
        ipfsHashes.push(hash);

        // Update cache
        cache[cacheKey] = { hash, title: action.title, uploadedAt: new Date().toISOString() };
        console.error(`Uploaded action ${i}: ${action.title} -> ${hash}`);
        hasChanges = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error) || "Unknown error";
        console.error(`Failed to upload ${action.title}: ${errorMsg}`);

        // Try to use cache if available
        if (cache[cacheKey]?.hash) {
          console.error("Using cached hash as fallback");
          ipfsHashes.push(cache[cacheKey].hash);
        } else {
          console.error("Error: Upload failed and no cache available");
          process.exit(1);
        }
      }
    }

    // Save cache if there were changes
    if (hasChanges) {
      saveCache(cache);
    }

    if (ipfsHashes.length !== actions.length) {
      console.error(`Error: IPFS hash count (${ipfsHashes.length}) does not match actions count (${actions.length})`);
      process.exit(1);
    }

    console.error(`IPFS uploader complete: ${uploads} uploaded, ${cacheHits} cached, ${ipfsHashes.length} total`);

    // Output hashes as JSON array (only valid JSON to stdout)
    console.log(JSON.stringify(ipfsHashes));
    process.exit(0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(`Fatal error: ${errorMsg}`);
    console.error(errorStack);
    process.exit(1);
  }
}

main();
