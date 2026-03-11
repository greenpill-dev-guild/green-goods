#!/usr/bin/env bun

/**
 * Generates Safe Transaction Builder JSON to fix community names on Gardens V2
 * RegistryCommunity contracts.
 *
 * The bug: GardenToken called gardensModule.onGardenMinted() BEFORE initializing
 * the GardenAccount, so _resolveCommunityName() always read an empty name and
 * fell back to "Green Goods Community" for every garden.
 *
 * This script:
 * 1. Auto-discovers all gardens from deployment files
 * 2. Fetches each garden's name and its community's current name from RPC
 * 3. Derives the correct community name as "{gardenName} Community"
 * 4. Generates setCommunityName() calls for all mismatched communities
 * 5. Outputs Safe Transaction Builder JSON for the council safe
 */

import "varlock/auto-load";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createPublicClient, encodeFunctionData, getAddress, http } from "viem";

// ---------------------------------------------------------------------------
// ABIs (minimal)
// ---------------------------------------------------------------------------

const GARDEN_ACCOUNT_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const GARDENS_MODULE_ABI = [
  {
    type: "function",
    name: "gardenCommunities",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "community", type: "address" }],
  },
] as const;

const REGISTRY_COMMUNITY_ABI = [
  {
    type: "function",
    name: "communityName",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "setCommunityName",
    stateMutability: "nonpayable",
    inputs: [{ name: "_communityName", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "councilSafe",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Chain config
// ---------------------------------------------------------------------------

const CHAIN_CONFIGS: Record<
  number,
  { label: string; envKey: string; defaultRpcUrl: string }
> = {
  11155111: {
    label: "sepolia",
    envKey: "SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://ethereum-sepolia.publicnode.com",
  },
  42161: {
    label: "arbitrum",
    envKey: "ARBITRUM_RPC_URL",
    defaultRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  42220: {
    label: "celo",
    envKey: "CELO_RPC_URL",
    defaultRpcUrl: "https://forno.celo.org",
  },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GardenInfo = {
  tokenId: number;
  gardenAddress: `0x${string}`;
  gardenName: string | null;
  communityAddress: `0x${string}` | null;
  currentCommunityName: string | null;
  expectedCommunityName: string | null;
  councilSafe: `0x${string}` | null;
};

type PreparedTransaction = {
  gardenAddress: `0x${string}`;
  communityAddress: `0x${string}`;
  gardenName: string;
  currentName: string | null;
  newName: string;
  calldata: `0x${string}`;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/generate-garden-name-safe-txs.ts --chain <id>",
      "  bun scripts/generate-garden-name-safe-txs.ts --chain <id> --dry-run",
      "",
      "Options:",
      "  --chain          Chain ID (11155111, 42161, 42220)",
      "  --suffix         Community name suffix (default: \" Community\")",
      "  --out            Output path (default: reports/garden-name-safe-batch-<chainId>-<ts>.json)",
      "  --batch-name     Custom batch name for Safe TX Builder",
      "  --rpc-url        Override RPC URL",
      "  --dry-run        Only print discovered gardens and exit",
      "",
      "Auto-discovers all gardens, fetches their names and community names from RPC,",
      "and generates setCommunityName() transactions for any community whose name",
      'doesn\'t match "{gardenName}{suffix}".',
    ].join("\n")
  );
  process.exit(1);
}

function resolveChainId(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !(parsed in CHAIN_CONFIGS)) {
    throw new Error(`Unsupported or missing chain id: ${value ?? "(empty)"}`);
  }
  return parsed;
}

function resolveRpcUrl(chainId: number, explicitRpcUrl?: string): string {
  if (explicitRpcUrl) return explicitRpcUrl;
  const config = CHAIN_CONFIGS[chainId];
  const envValue = process.env[config.envKey]?.trim();
  return envValue || config.defaultRpcUrl;
}

/**
 * Derives the expected community name from a garden name.
 * Mirrors GardensModule._resolveCommunityName() logic.
 */
function deriveCommunityName(
  gardenName: string | null,
  suffix: string
): string | null {
  if (!gardenName || gardenName.trim().length === 0) return null;
  return `${gardenName}${suffix}`;
}

// ---------------------------------------------------------------------------
// On-chain data fetching
// ---------------------------------------------------------------------------

async function loadDeployment(chainId: number) {
  const deploymentPath = path.resolve(
    `packages/contracts/deployments/${chainId}-latest.json`
  );
  const raw = await readFile(deploymentPath, "utf8");
  return JSON.parse(raw) as {
    gardensModule?: string;
    rootGarden?: { address: string; tokenId: number };
  };
}

async function loadGardenAddresses(
  chainId: number
): Promise<Array<{ tokenId: number; address: string }>> {
  const gardensPath = path.resolve(
    `packages/contracts/deployments/${chainId}-gardens.json`
  );
  try {
    const raw = await readFile(gardensPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gardens: Array<{ tokenId: number; address: string }>;
    };
    return parsed.gardens;
  } catch {
    // Fall back to rootGarden from deployment
    const deployment = await loadDeployment(chainId);
    if (deployment.rootGarden?.address) {
      return [
        {
          tokenId: deployment.rootGarden.tokenId,
          address: deployment.rootGarden.address,
        },
      ];
    }
    return [];
  }
}

async function fetchGardenInfo(
  rpcUrl: string,
  gardensModuleAddress: `0x${string}`,
  garden: { tokenId: number; address: string },
  suffix: string
): Promise<GardenInfo> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const gardenAddress = getAddress(garden.address) as `0x${string}`;

  // Fetch garden name from GardenAccount
  let gardenName: string | null = null;
  try {
    const result = await client.readContract({
      address: gardenAddress,
      abi: GARDEN_ACCOUNT_ABI,
      functionName: "name",
    });
    if (typeof result === "string" && result.trim().length > 0) {
      gardenName = result;
    }
  } catch {
    // Account may not be initialized or may not exist
  }

  // Fetch community address from GardensModule
  let communityAddress: `0x${string}` | null = null;
  try {
    const result = await client.readContract({
      address: gardensModuleAddress,
      abi: GARDENS_MODULE_ABI,
      functionName: "gardenCommunities",
      args: [gardenAddress],
    });
    if (result && result !== ZERO_ADDRESS) {
      communityAddress = result as `0x${string}`;
    }
  } catch {
    // GardensModule may not exist on this chain
  }

  if (!communityAddress) {
    return {
      tokenId: garden.tokenId,
      gardenAddress,
      gardenName,
      communityAddress: null,
      currentCommunityName: null,
      expectedCommunityName: deriveCommunityName(gardenName, suffix),
      councilSafe: null,
    };
  }

  // Fetch current community name and council safe in parallel
  const [nameResult, safeResult] = await Promise.allSettled([
    client.readContract({
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "communityName",
    }),
    client.readContract({
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "councilSafe",
    }),
  ]);

  return {
    tokenId: garden.tokenId,
    gardenAddress,
    gardenName,
    communityAddress,
    currentCommunityName:
      nameResult.status === "fulfilled" && typeof nameResult.value === "string"
        ? nameResult.value
        : null,
    expectedCommunityName: deriveCommunityName(gardenName, suffix),
    councilSafe:
      safeResult.status === "fulfilled" && safeResult.value !== ZERO_ADDRESS
        ? (safeResult.value as `0x${string}`)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Safe TX Builder output
// ---------------------------------------------------------------------------

function buildSafeTransaction(tx: PreparedTransaction) {
  return {
    to: tx.communityAddress,
    value: "0",
    data: null,
    contractMethod: {
      inputs: [
        { internalType: "string", name: "_communityName", type: "string" },
      ],
      name: "setCommunityName",
      payable: false,
    },
    contractInputsValues: {
      _communityName: tx.newName,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      chain: { type: "string" },
      suffix: { type: "string", default: " Community" },
      out: { type: "string" },
      "batch-name": { type: "string" },
      "rpc-url": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.chain) usage();

  const chainId = resolveChainId(values.chain);
  const network = CHAIN_CONFIGS[chainId];
  const rpcUrl = resolveRpcUrl(chainId, values["rpc-url"]);
  const suffix = values.suffix ?? " Community";

  // 1. Load deployment and discover gardens
  const deployment = await loadDeployment(chainId);
  const gardensModuleAddress = deployment.gardensModule;

  if (!gardensModuleAddress || gardensModuleAddress === ZERO_ADDRESS) {
    throw new Error(
      `No GardensModule deployed on ${network.label} (${chainId}). Cannot update community names.`
    );
  }

  const gardenEntries = await loadGardenAddresses(chainId);
  if (gardenEntries.length === 0) {
    throw new Error(
      `No gardens found in deployment files for ${network.label} (${chainId}).`
    );
  }

  // 2. Fetch on-chain state for all gardens
  console.log(
    `Fetching on-chain data for ${gardenEntries.length} garden(s) on ${network.label}...\n`
  );

  const gardens: GardenInfo[] = [];
  for (const entry of gardenEntries) {
    const info = await fetchGardenInfo(
      rpcUrl,
      getAddress(gardensModuleAddress) as `0x${string}`,
      entry,
      suffix
    );
    gardens.push(info);

    const gardenNameDisplay = info.gardenName
      ? `"${info.gardenName}"`
      : "(unavailable)";
    const communityNameDisplay = info.currentCommunityName
      ? `"${info.currentCommunityName}"`
      : "(unavailable)";
    const expectedDisplay = info.expectedCommunityName
      ? `"${info.expectedCommunityName}"`
      : "(cannot derive)";
    const mismatch =
      info.currentCommunityName &&
      info.expectedCommunityName &&
      info.currentCommunityName !== info.expectedCommunityName;

    console.log(
      `  Garden #${info.tokenId} ${info.gardenAddress}\n` +
        `    Garden Name:     ${gardenNameDisplay}\n` +
        `    Community:       ${info.communityAddress ?? "(none)"}\n` +
        `    Community Name:  ${communityNameDisplay}${mismatch ? " << MISMATCH" : ""}\n` +
        `    Expected Name:   ${expectedDisplay}\n` +
        `    Council Safe:    ${info.councilSafe ?? "(unavailable)"}\n`
    );
  }

  // Dry run — just print state and exit
  if (values["dry-run"]) {
    const mismatches = gardens.filter(
      (g) =>
        g.communityAddress &&
        g.expectedCommunityName &&
        g.currentCommunityName !== g.expectedCommunityName
    );
    console.log(
      `Dry run complete. ${mismatches.length} community name(s) need updating.`
    );
    return;
  }

  // 3. Build transactions for all mismatched names
  const prepared: PreparedTransaction[] = [];
  const skipped: Array<{ gardenAddress: string; reason: string }> = [];

  for (const garden of gardens) {
    if (!garden.communityAddress) {
      skipped.push({
        gardenAddress: garden.gardenAddress,
        reason: "No RegistryCommunity deployed for this garden.",
      });
      continue;
    }

    if (!garden.gardenName) {
      skipped.push({
        gardenAddress: garden.gardenAddress,
        reason:
          "Cannot read garden name from GardenAccount — cannot derive community name.",
      });
      continue;
    }

    if (!garden.expectedCommunityName) {
      skipped.push({
        gardenAddress: garden.gardenAddress,
        reason: "Garden name is empty — cannot derive community name.",
      });
      continue;
    }

    if (garden.currentCommunityName === garden.expectedCommunityName) {
      skipped.push({
        gardenAddress: garden.gardenAddress,
        reason: `Community name already correct: "${garden.expectedCommunityName}".`,
      });
      continue;
    }

    const calldata = encodeFunctionData({
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "setCommunityName",
      args: [garden.expectedCommunityName],
    });

    prepared.push({
      gardenAddress: garden.gardenAddress,
      communityAddress: garden.communityAddress,
      gardenName: garden.gardenName,
      currentName: garden.currentCommunityName,
      newName: garden.expectedCommunityName,
      calldata,
    });
  }

  if (prepared.length === 0) {
    console.log("No transactions to generate — all community names are correct.");
    if (skipped.length > 0) {
      console.log("\nSkipped:");
      for (const s of skipped) console.log(`  ${s.gardenAddress}: ${s.reason}`);
    }
    return;
  }

  // 4. Build Safe TX Builder JSON
  const councilSafe =
    gardens.find((g) => g.councilSafe)?.councilSafe ?? "";

  const batchName =
    values["batch-name"] ??
    `Fix community names for ${prepared.length} garden(s) (${network.label})`;

  const safeTransactionBuilder = {
    version: "1.0",
    chainId: String(chainId),
    createdAt: Date.now(),
    meta: {
      name: batchName,
      description:
        "Fix Gardens V2 RegistryCommunity names that were hardcoded to " +
        '"Green Goods Community" due to an initialization ordering bug. ' +
        "Each community name is derived from its garden name. " +
        "Generated by scripts/generate-garden-name-safe-txs.ts",
      txBuilderVersion: "1.17.0",
      createdFromSafeAddress: councilSafe,
      createdFromOwnerAddress: "",
      checksum: "",
    },
    transactions: prepared.map(buildSafeTransaction),
  };

  // 5. Write output
  const outPath = path.resolve(
    values.out ??
      `reports/garden-name-safe-batch-${chainId}-${Date.now()}.json`
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(safeTransactionBuilder, null, 2));

  // 6. Summary
  console.log("Safe Transaction Builder JSON generated.\n");
  console.log(`  File:         ${outPath}`);
  console.log(`  Chain:        ${network.label} (${chainId})`);
  console.log(`  Council Safe: ${councilSafe}`);
  console.log(`  Transactions: ${prepared.length}`);

  for (const tx of prepared) {
    console.log(`\n  ${tx.communityAddress} (${tx.gardenName}):`);
    console.log(`    "${tx.currentName ?? "(unknown)"}" -> "${tx.newName}"`);
  }

  if (skipped.length > 0) {
    console.log("\n  Skipped:");
    for (const s of skipped)
      console.log(`    ${s.gardenAddress}: ${s.reason}`);
  }

  console.log(
    `\nImport ${outPath} into the Safe Transaction Builder at:\n` +
      `  https://app.safe.global/apps/open?safe=${network.label}:${councilSafe}&appUrl=https://safe-transaction-builder.safe.global`
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
