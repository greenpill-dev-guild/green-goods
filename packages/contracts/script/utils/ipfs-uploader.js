#!/usr/bin/env node

/**
 * IPFS Action Uploader
 *
 * Purpose: Upload action instruction documents to IPFS via Storacha.
 * Called by Deploy.s.sol via FFI during deployment.
 *
 * Inputs: Reads config/actions.json
 * Side-effects: Uploads to IPFS, creates .ipfs-cache.json
 * Outputs: JSON array of IPFS hashes to stdout
 */

// Don't use dotenv to avoid stdout pollution when called via FFI
// Environment variables should be passed by the deployment script
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../../../", ".env") });

const CACHE_FILE = path.join(process.cwd(), ".ipfs-cache.json");
const ACTIONS_FILE = path.join(process.cwd(), "config", "actions.json");

/**
 * Get template for an action based on its title
 * Templates are loaded from actions.json and matched by keyword in title
 *
 * @param {string} title - Action title
 * @param {object} templates - Template definitions from actions.json
 * @returns {object} Template with steps, requirements, and tips
 */
function getTemplateForAction(title, templates) {
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
 * @param {object} action - Action configuration from actions.json
 * @param {object} templates - Template definitions from actions.json
 * @returns {object} Complete instructions document for IPFS
 */
function generateInstructionsDocument(action, templates) {
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
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    // Failed to load cache, will proceed without it
    console.warn("IPFS uploader: unable to load cache, continuing without cached data.", error);
  }
  return {};
}

/**
 * Save IPFS hashes to cache
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    // Failed to save cache, will continue without it
    console.warn("IPFS uploader: unable to persist cache to disk.", error);
  }
}

/**
 * Build deterministic cache key from action contents to avoid stale uploads
 */
function buildCacheKey(action, index) {
  const serialized = JSON.stringify(action);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `${index}-${hash}`;
}

/**
 * Initialize Storacha client
 */
async function initStoracha() {
  const storachaKey = process.env.STORACHA_KEY;
  const storachaProof = process.env.STORACHA_PROOF;

  if (!storachaKey || !storachaProof) {
    throw new Error("STORACHA_KEY and STORACHA_PROOF environment variables required");
  }

  // Dynamic import for ES modules
  const Client = await import("@storacha/client");
  const client = await Client.create();

  // Add proof and key to the client
  const proof = Client.Proof.parse(storachaProof);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  return client;
}

/**
 * Upload action to IPFS via Storacha with retry logic
 */
async function uploadToIPFS(client, name, data, retries = 3) {
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
      // Retry silently to avoid Forge error logs
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load actions
    if (!fs.existsSync(ACTIONS_FILE)) {
      console.error(`Error: Actions file not found: ${ACTIONS_FILE}`, { toStderr: true });
      process.exit(1);
    }

    const actionsData = JSON.parse(fs.readFileSync(ACTIONS_FILE, "utf8"));
    const actions = actionsData.actions;
    const templates = actionsData.templates;
    console.error(`IPFS uploader: processing ${actions.length} actions from config/actions.json`, { toStderr: true });

    if (!actions || !Array.isArray(actions)) {
      console.error("Error: Invalid actions.json format - missing or invalid 'actions' array", { toStderr: true });
      process.exit(1);
    }

    if (!templates || typeof templates !== "object") {
      console.error("Error: Invalid actions.json format - missing or invalid 'templates' object", { toStderr: true });
      process.exit(1);
    }

    // Load cache
    const cache = loadCache();
    const ipfsHashes = [];
    let hasChanges = false;
    let cacheHits = 0;
    let uploads = 0;

    // Check if we have valid cache for all actions
    const allCached = actions.every((action, idx) => {
      const cacheKey = buildCacheKey(action, idx);
      return cache[cacheKey]?.hash;
    });

    // Get Storacha credentials
    const storachaKey = process.env.STORACHA_KEY;
    const storachaProof = process.env.STORACHA_PROOF;

    // If credentials not set and we have cache, use cache
    if (!storachaKey || !storachaProof) {
      if (allCached) {
        // Note: Don't write to stderr when using cache to avoid Forge error logs
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const cacheKey = buildCacheKey(action, i);
          ipfsHashes.push(cache[cacheKey].hash);
        }
        console.log(JSON.stringify(ipfsHashes));
        process.exit(0);
      } else {
        console.error(
          "Error: STORACHA_KEY and STORACHA_PROOF environment variables required and no valid cache found",
          {
            toStderr: true,
          },
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
        console.error(`Cache hit for action ${i}: ${action.title} -> ${cache[cacheKey].hash}`, { toStderr: true });
        ipfsHashes.push(cache[cacheKey].hash);
        continue;
      }

      // Generate instructions document
      const instructionsDoc = generateInstructionsDocument(action, templates);

      // Upload to IPFS (silent to avoid Forge error logs)
      try {
        const hash = await uploadToIPFS(client, action.title.replace(/\s+/g, "-").toLowerCase(), instructionsDoc);
        uploads += 1;

        // Upload successful
        ipfsHashes.push(hash);

        // Update cache
        cache[cacheKey] = { hash, title: action.title, uploadedAt: new Date().toISOString() };
        console.error(`Uploaded action ${i}: ${action.title} -> ${hash}`, { toStderr: true });
        hasChanges = true;
      } catch (error) {
        const errorMsg = error?.message || error?.toString() || "Unknown error";
        console.error(`Failed to upload ${action.title}: ${errorMsg}`, { toStderr: true });

        // Try to use cache if available
        if (cache[cacheKey]?.hash) {
          console.error("Using cached hash as fallback", { toStderr: true });
          ipfsHashes.push(cache[cacheKey].hash);
        } else {
          console.error("Error: Upload failed and no cache available", { toStderr: true });
          process.exit(1);
        }
      }
    }

    // Save cache if there were changes
    if (hasChanges) {
      saveCache(cache);
    }

    if (ipfsHashes.length !== actions.length) {
      console.error(`Error: IPFS hash count (${ipfsHashes.length}) does not match actions count (${actions.length})`, {
        toStderr: true,
      });
      process.exit(1);
    }

    console.error(`IPFS uploader complete: ${uploads} uploaded, ${cacheHits} cached, ${ipfsHashes.length} total`, {
      toStderr: true,
    });

    // Output hashes as JSON array
    console.log(JSON.stringify(ipfsHashes));
    process.exit(0);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`, { toStderr: true });
    console.error(error.stack, { toStderr: true });
    process.exit(1);
  }
}

main();
