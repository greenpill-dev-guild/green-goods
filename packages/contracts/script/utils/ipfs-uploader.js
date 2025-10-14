#!/usr/bin/env node

/**
 * IPFS Action Uploader
 *
 * Purpose: Upload action instruction documents to IPFS via Pinata.
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
const pinataSDK = require("@pinata/sdk");

const CACHE_FILE = path.join(process.cwd(), ".ipfs-cache.json");
const ACTIONS_FILE = path.join(process.cwd(), "config", "actions.json");

/**
 * Generate enhanced instructions document for an action
 */
function generateInstructionsDocument(action) {
  const title = action.title.toLowerCase();

  // Generate action-specific steps
  let steps = [];
  if (title.includes("plant")) {
    steps = [
      "Photograph the planting location before starting",
      "Prepare the soil and planting area according to plant requirements",
      "Plant at appropriate depth and spacing for the species",
      "Water thoroughly if needed",
      "Take after photos documenting the completed planting",
      "Record plant type, species/name, count, and any observations",
    ];
  } else if (title.includes("identify") || title.includes("observe")) {
    steps = [
      "Locate and photograph the plants you are identifying",
      "Document visual characteristics (leaves, bark, flowers, fruits)",
      "Note the plant's size, shape, and growth pattern",
      "Record environmental conditions and habitat",
      "Assess overall health and note any issues",
      "Upload photos and complete the identification form",
    ];
  } else if (title.includes("litter")) {
    steps = [
      "Photograph the area before cleanup begins",
      "Safely collect and sort litter by type",
      "Count and weigh collected items if possible",
      "Take photos of collected litter for documentation",
      "Properly dispose of or recycle collected materials",
      "Photograph the cleaned area and submit your report",
    ];
  } else {
    steps = [
      "Review the action requirements carefully",
      "Gather necessary materials and tools",
      "Document the before state with photos",
      "Complete the action according to guidelines",
      "Document the after state with photos",
      "Submit your completed work for verification",
    ];
  }

  // Generate requirements
  let requirements = {
    materials: [],
    skills: [],
    timeEstimate: "30-60 minutes",
  };

  if (title.includes("plant")) {
    requirements = {
      materials: [
        "Plants (trees, seedlings, shrubs, or other vegetation)",
        "Digging tools if needed (shovel, trowel)",
        "Water source (if required)",
        "Mulch or soil amendments (optional)",
        "Camera or smartphone",
      ],
      skills: ["Basic plant identification", "Proper planting techniques", "Soil preparation"],
      timeEstimate: "30 minutes - 2 hours",
    };
  } else if (title.includes("identify") || title.includes("observe")) {
    requirements = {
      materials: [
        "Camera or smartphone",
        "Field notebook or digital device",
        "Measuring tools (optional)",
        "Plant identification resources (optional)",
      ],
      skills: ["Plant observation", "Species recognition", "Note-taking"],
      timeEstimate: "15-40 minutes",
    };
  } else if (title.includes("litter")) {
    requirements = {
      materials: [
        "Gloves",
        "Bags for collection",
        "Grabber tool (optional)",
        "Scale for weighing (optional)",
        "Camera or smartphone",
      ],
      skills: ["Safe litter handling", "Waste type identification", "Proper disposal knowledge"],
      timeEstimate: "30-90 minutes",
    };
  }

  // Generate tips
  let tips = [];
  if (title.includes("plant")) {
    tips = [
      "Choose planting time based on climate and plant type",
      "Research proper depth and spacing for your specific plant",
      "Take clear before/after photos from the same angle",
      "Label plants or keep records for future reference",
    ];
  } else if (title.includes("identify") || title.includes("observe")) {
    tips = [
      "Take photos from consistent angles for comparison over time",
      "Note weather and seasonal conditions",
      "Use custom names to track specific plants (e.g., 'Oak Tree by Front Gate')",
      "Regular observations help identify patterns and issues early",
    ];
  } else if (title.includes("litter")) {
    tips = [
      "Wear gloves for safety and hygiene",
      "Take before/after comparison photos",
      "Sort items for proper recycling when possible",
      "Work in teams for larger areas and safety",
    ];
  } else {
    tips = [
      "Document your work thoroughly with clear photos",
      "Provide detailed descriptions in your submission",
      "Ask questions if any requirements are unclear",
      "Share learnings with your community",
    ];
  }

  return {
    title: action.title,
    description: action.description,
    capitals: action.capitals,
    timeframe: {
      start: action.startTime,
      end: action.endTime,
    },
    uiConfig: action.uiConfig,
    steps,
    requirements,
    tips,
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
  }
}

/**
 * Upload action to IPFS with retry logic
 */
async function uploadToIPFS(pinata, name, data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pinata.pinJSONToIPFS(data, {
        pinataMetadata: {
          name: `green-goods-action-${name}`,
        },
        pinataOptions: {
          cidVersion: 0,
        },
      });
      return result.IpfsHash;
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

    if (!actions || !Array.isArray(actions)) {
      console.error("Error: Invalid actions.json format", { toStderr: true });
      process.exit(1);
    }

    // Load cache
    const cache = loadCache();
    const ipfsHashes = [];
    let hasChanges = false;

    // Check if we have valid cache for all actions
    const allCached = actions.every((action, idx) => {
      const cacheKey = `${action.title}-${idx}`;
      return cache[cacheKey]?.hash;
    });

    // Get Pinata JWT (check both PINATA_JWT and VITE_PINATA_JWT)
    const pinataJWT = process.env.PINATA_JWT || process.env.VITE_PINATA_JWT;

    // If PINATA_JWT is not set and we have cache, use cache
    if (!pinataJWT) {
      if (allCached) {
        // Note: Don't write to stderr when using cache to avoid Forge error logs
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const cacheKey = `${action.title}-${i}`;
          ipfsHashes.push(cache[cacheKey].hash);
        }
        console.log(JSON.stringify(ipfsHashes));
        process.exit(0);
      } else {
        console.error("Error: PINATA_JWT or VITE_PINATA_JWT environment variable required and no valid cache found", {
          toStderr: true,
        });
        process.exit(1);
      }
    }

    // Initialize Pinata
    const pinata = new pinataSDK({ pinataJWTKey: pinataJWT });

    // Process each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const cacheKey = `${action.title}-${i}`;

      // Check cache first
      if (cache[cacheKey]?.hash) {
        // Using cached hash (silent to avoid Forge error logs)
        ipfsHashes.push(cache[cacheKey].hash);
        continue;
      }

      // Generate instructions document
      const instructionsDoc = generateInstructionsDocument(action);

      // Upload to IPFS (silent to avoid Forge error logs)
      try {
        const hash = await uploadToIPFS(pinata, action.title.replace(/\s+/g, "-").toLowerCase(), instructionsDoc);

        // Upload successful
        ipfsHashes.push(hash);

        // Update cache
        cache[cacheKey] = {
          hash,
          title: action.title,
          uploadedAt: new Date().toISOString(),
        };
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
