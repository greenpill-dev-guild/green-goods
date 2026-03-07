#!/usr/bin/env bun

import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createPublicClient, encodeFunctionData, getAddress, http } from "viem";

const GARDEN_ACCOUNT_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "updateName",
    stateMutability: "nonpayable",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [],
  },
] as const;

const CHAIN_CONFIGS = {
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
} satisfies Record<number, { label: string; envKey: string; defaultRpcUrl: string }>;

type InputUpdate = {
  gardenAddress?: string;
  newName?: string;
  gardenName?: string;
  newCommunityName?: string;
  communityName?: string;
  note?: string;
};

type NormalizedUpdate = {
  gardenAddress: `0x${string}`;
  newName: string | null;
  newCommunityName: string | null;
  note?: string;
};

type PreparedTransaction = {
  gardenAddress: `0x${string}`;
  currentName: string | null;
  newName: string;
  calldata: `0x${string}`;
  note?: string;
  warning?: string;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/generate-garden-name-safe-txs.ts --chain <id> --input <updates.json> [--out <output.json>] [--safe-address <0x...>] [--batch-name <name>]",
      "",
      "Input JSON format:",
      '  [{ "gardenAddress": "0x...", "newName": "River Keepers Garden", "newCommunityName": "River Keepers Community" }]',
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
  if (envValue) return envValue;

  return config.defaultRpcUrl;
}

function normalizeUpdates(raw: unknown): NormalizedUpdate[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { updates?: unknown[] }).updates)
      ? (raw as { updates: unknown[] }).updates
      : null;

  if (!items) {
    throw new Error('Expected a JSON array or an object shaped like { "updates": [...] }.');
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Update ${index + 1} is not an object.`);
    }

    const update = item as InputUpdate;
    if (!update.gardenAddress) {
      throw new Error(`Update ${index + 1} is missing gardenAddress.`);
    }

    const newName = (update.newName ?? update.gardenName ?? "").trim() || null;
    const newCommunityName = (update.newCommunityName ?? update.communityName ?? "").trim() || null;

    return {
      gardenAddress: getAddress(update.gardenAddress),
      newName,
      newCommunityName,
      note: update.note?.trim() || undefined,
    };
  });
}

async function readInputFile(inputPath: string): Promise<NormalizedUpdate[]> {
  if (path.extname(inputPath).toLowerCase() !== ".json") {
    throw new Error("Only JSON input files are supported for garden rename batches.");
  }

  const file = await readFile(inputPath, "utf8");
  return normalizeUpdates(JSON.parse(file));
}

async function loadCurrentGardenName(
  rpcUrl: string,
  gardenAddress: `0x${string}`
): Promise<string | null> {
  const client = createPublicClient({ transport: http(rpcUrl) });

  try {
    const currentName = await client.readContract({
      address: gardenAddress,
      abi: GARDEN_ACCOUNT_ABI,
      functionName: "name",
    });
    return typeof currentName === "string" ? currentName : null;
  } catch {
    return null;
  }
}

function buildSafeTransaction(update: PreparedTransaction) {
  return {
    to: update.gardenAddress,
    value: "0",
    data: null,
    contractMethod: {
      inputs: [{ internalType: "string", name: "_name", type: "string" }],
      name: "updateName",
      payable: false,
    },
    contractInputsValues: {
      _name: update.newName,
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      chain: { type: "string" },
      input: { type: "string" },
      out: { type: "string" },
      "safe-address": { type: "string" },
      "batch-name": { type: "string" },
      "rpc-url": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.chain || !values.input) {
    usage();
  }

  const chainId = resolveChainId(values.chain);
  const network = CHAIN_CONFIGS[chainId];
  const inputPath = path.resolve(values.input);
  const outPath = path.resolve(
    values.out ?? `reports/garden-name-safe-batch-${chainId}-${Date.now()}.json`
  );
  const rpcUrl = resolveRpcUrl(chainId, values["rpc-url"]);
  const safeAddress = values["safe-address"] ? getAddress(values["safe-address"]) : "";
  const batchName =
    values["batch-name"] ?? `Green Goods garden name updates (${network.label})`;

  const updates = await readInputFile(inputPath);

  const preparedTransactions: PreparedTransaction[] = [];
  const skipped: Array<{
    gardenAddress: `0x${string}`;
    reason: string;
    currentName: string | null;
    requestedName: string | null;
    note?: string;
  }> = [];
  const unresolvedCommunityUpdates: Array<{
    gardenAddress: `0x${string}`;
    requestedCommunityName: string;
    reason: string;
    note?: string;
  }> = [];

  for (const update of updates) {
    const currentName = update.newName
      ? await loadCurrentGardenName(rpcUrl, update.gardenAddress)
      : null;

    if (update.newCommunityName) {
      unresolvedCommunityUpdates.push({
        gardenAddress: update.gardenAddress,
        requestedCommunityName: update.newCommunityName,
        note: update.note,
        reason:
          "No mutable RegistryCommunity name setter is exposed in the current Green Goods / Gardens V2 contract surface. Existing community names still require an upstream contract or subgraph-level remediation path.",
      });
    }

    if (!update.newName) {
      skipped.push({
        gardenAddress: update.gardenAddress,
        currentName,
        requestedName: update.newName,
        note: update.note,
        reason: "No newName provided for the garden account rename.",
      });
      continue;
    }

    if (currentName && currentName.trim() === update.newName) {
      skipped.push({
        gardenAddress: update.gardenAddress,
        currentName,
        requestedName: update.newName,
        note: update.note,
        reason: "Garden already has the requested name.",
      });
      continue;
    }

    const calldata = encodeFunctionData({
      abi: GARDEN_ACCOUNT_ABI,
      functionName: "updateName",
      args: [update.newName],
    });

    preparedTransactions.push({
      gardenAddress: update.gardenAddress,
      currentName,
      newName: update.newName,
      calldata,
      note: update.note,
      warning:
        currentName === null
          ? "Current name could not be verified from RPC. Review this transaction manually before signing."
          : undefined,
    });
  }

  const safeTransactionBuilder = {
    version: "1.0",
    chainId: String(chainId),
    createdAt: Date.now(),
    meta: {
      name: batchName,
      description: "Generated by scripts/generate-garden-name-safe-txs.ts",
      txBuilderVersion: "1.17.0",
      createdFromSafeAddress: safeAddress,
      createdFromOwnerAddress: "",
      checksum: "",
    },
    transactions: preparedTransactions.map(buildSafeTransaction),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    chainId,
    network: network.label,
    rpcUrl,
    inputPath,
    summary: {
      requestedUpdates: updates.length,
      preparedTransactions: preparedTransactions.length,
      skipped: skipped.length,
      unresolvedCommunityUpdates: unresolvedCommunityUpdates.length,
    },
    safeTransactionBuilder,
    rawTransactions: preparedTransactions.map((item) => ({
      to: item.gardenAddress,
      value: "0",
      data: item.calldata,
      functionName: "updateName",
      args: [item.newName],
      currentName: item.currentName,
      newName: item.newName,
      note: item.note,
      warning: item.warning,
    })),
    skipped,
    unresolvedCommunityUpdates,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(
    [
      `Generated garden rename batch for ${network.label} (${chainId}).`,
      `Prepared transactions: ${preparedTransactions.length}`,
      `Skipped: ${skipped.length}`,
      `Unresolved community-name requests: ${unresolvedCommunityUpdates.length}`,
      `Output: ${outPath}`,
    ].join("\n")
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
