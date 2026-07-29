#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { arbitrum } from "viem/chains";

import { redactRpcUrl } from "../../../../../packages/contracts/script/utils/cli-parser";
import { NetworkManager } from "../../../../../packages/contracts/script/utils/network";

export interface InventoryGarden {
  tokenId: string;
  garden: Address;
  ownerHatId: string;
  operatorHatId: string;
  evaluatorHatId: string;
  gardenerHatId: string;
  funderHatId: string;
  communityHatId: string;
  adminHatId: string;
  currentDetails: string;
}

interface Inventory {
  chainId: string;
  gardenToken: Address;
  gardenAccountImpl: Address;
  hatsModule: Address;
  hatsProtocol: Address;
  gardenCount: number;
  gardens: InventoryGarden[];
}

interface Options {
  inventoryPath: string;
  outputDir: string;
  expectedCount: number;
  rpcUrl?: string;
}

const UNIVERSAL_HATS = "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137" as Address;
const EXPECTED_MODULE_OWNER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6" as Address;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_PLAN_DIR = path.resolve(MODULE_DIR, "../../../../../packages/contracts/deployments/tx-plans");
const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

const gardenTokenAbi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
const gardenAccountAbi = parseAbi(["function owner() view returns (address)"]);
const hatsModuleAbi = parseAbi([
  "function owner() view returns (address)",
  "function hats() view returns (address)",
  "function getGardenHatIds(address garden) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
]);
const hatsAbi = parseAbi([
  "function viewHat(uint256 _hatId) view returns (string details,uint32 maxSupply,uint32 supply,address eligibility,address toggle,string imageURI,uint16 lastHatId,bool mutable_,bool active)",
  "function isAdminOfHat(address _user,uint256 _hatId) view returns (bool)",
]);

function usage(exitCode = 1): never {
  console.error(`Usage:
  bun refresh-direct-plan.ts --inventory <preflight.json> --expected-count <n> [options]

Options:
  --output-dir <path>  Artifact directory (default: this directory)
  --rpc-url <url>      Override the configured Arbitrum RPC

This command is read-only. It refreshes an already-reviewed inventory at one
live block using multicall and emits a direct-admin relabel plan plus an upgrade
baseline. It never signs, broadcasts, or executes transactions.`);
  process.exit(exitCode);
}

function parseOptions(argv: string[]): Options {
  let inventoryPath: string | undefined;
  let outputDir = MODULE_DIR;
  let expectedCount: number | undefined;
  let rpcUrl: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    switch (argv[index]) {
      case "--inventory":
        inventoryPath = path.resolve(process.cwd(), argv[++index] ?? "");
        break;
      case "--output-dir":
        outputDir = path.resolve(process.cwd(), argv[++index] ?? "");
        break;
      case "--expected-count":
        expectedCount = Number(argv[++index]);
        break;
      case "--rpc-url":
        rpcUrl = argv[++index];
        break;
      case "--help":
      case "-h":
        usage(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }

  if (!inventoryPath || !fs.existsSync(inventoryPath)) {
    throw new Error("--inventory must name an existing reviewed preflight JSON");
  }
  if (!Number.isInteger(expectedCount) || (expectedCount ?? 0) <= 0) {
    throw new Error("--expected-count must be a positive integer");
  }

  return { inventoryPath, outputDir, expectedCount: expectedCount as number, rpcUrl };
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requireAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value as Address;
}

function targetDetails(currentDetails: string): string {
  if (!currentDetails.endsWith(" Operator")) {
    throw new Error(`Unexpected operator-hat details: ${JSON.stringify(currentDetails)}`);
  }
  return `${currentDetails.slice(0, -" Operator".length)} Steward`;
}

function writeJson(outputPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

export function validateInventoryCoverage(
  gardens: Pick<InventoryGarden, "tokenId" | "garden" | "operatorHatId">[],
  expectedCount: number,
): void {
  const tokenIds = gardens.map((garden) => garden.tokenId);
  if (tokenIds.some((tokenId) => !/^\d+$/.test(tokenId))) {
    throw new Error("Reviewed inventory contains an invalid token ID");
  }

  const uniqueTokenIds = new Set(tokenIds);
  const expectedTokenIds = Array.from({ length: expectedCount }, (_, index) => index.toString());
  if (
    uniqueTokenIds.size !== expectedCount ||
    expectedTokenIds.some((tokenId) => !uniqueTokenIds.has(tokenId))
  ) {
    throw new Error(`Reviewed inventory token IDs must uniquely cover 0..${expectedCount - 1}`);
  }

  const gardenAddresses = gardens.map((garden) => garden.garden.toLowerCase());
  if (new Set(gardenAddresses).size !== gardens.length) {
    throw new Error("Reviewed inventory contains a duplicate garden address");
  }

  const operatorHatIds = gardens.map((garden) => garden.operatorHatId);
  if (operatorHatIds.some((hatId) => !/^\d+$/.test(hatId))) {
    throw new Error("Reviewed inventory contains an invalid operator hat ID");
  }
  const normalizedOperatorHatIds = operatorHatIds.map((hatId) => BigInt(hatId).toString());
  if (new Set(normalizedOperatorHatIds).size !== gardens.length) {
    throw new Error("Reviewed inventory contains a duplicate operator hat ID");
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const inventory = JSON.parse(fs.readFileSync(options.inventoryPath, "utf8")) as Inventory;

  if (
    inventory.chainId !== arbitrum.id.toString() ||
    inventory.gardenCount !== options.expectedCount ||
    inventory.gardens.length !== options.expectedCount
  ) {
    throw new Error("Reviewed inventory does not match Arbitrum or the expected garden count");
  }
  validateInventoryCoverage(inventory.gardens, options.expectedCount);
  requireAddress(inventory.gardenToken, "gardenToken");
  requireAddress(inventory.hatsModule, "hatsModule");
  requireAddress(inventory.hatsProtocol, "hatsProtocol");

  const networkManager = new NetworkManager();
  const rpcUrl = options.rpcUrl || networkManager.getRpcUrl("arbitrum");
  const client = createPublicClient({
    chain: arbitrum,
    transport: http(rpcUrl, { retryCount: 2, timeout: 20_000 }),
    batch: { multicall: true },
  });
  const blockNumber = await client.getBlockNumber();

  const [moduleOwner, hatsProtocol, implementationWord] = await Promise.all([
    client.readContract({
      address: inventory.hatsModule,
      abi: hatsModuleAbi,
      functionName: "owner",
      blockNumber,
    }),
    client.readContract({
      address: inventory.hatsModule,
      abi: hatsModuleAbi,
      functionName: "hats",
      blockNumber,
    }),
    client.getStorageAt({
      address: inventory.hatsModule,
      slot: EIP1967_IMPLEMENTATION_SLOT,
      blockNumber,
    }),
  ]);

  if (!sameAddress(moduleOwner, EXPECTED_MODULE_OWNER)) {
    throw new Error(`Unexpected HatsModule owner ${moduleOwner}; expected ${EXPECTED_MODULE_OWNER}`);
  }
  if (!sameAddress(hatsProtocol, UNIVERSAL_HATS) || !sameAddress(hatsProtocol, inventory.hatsProtocol)) {
    throw new Error(`Unexpected Hats Protocol address ${hatsProtocol}`);
  }
  if (!implementationWord) throw new Error("Could not read HatsModule implementation slot");
  const implementationBefore = requireAddress(`0x${implementationWord.slice(-40)}`, "implementation");

  const tokenIds = inventory.gardens.map((garden) => BigInt(garden.tokenId));
  const tokenOwnerResults = await client.multicall({
    allowFailure: true,
    blockNumber,
    contracts: [
      ...tokenIds.map((tokenId) => ({
        address: inventory.gardenToken,
        abi: gardenTokenAbi,
        functionName: "ownerOf" as const,
        args: [tokenId],
      })),
      {
        address: inventory.gardenToken,
        abi: gardenTokenAbi,
        functionName: "ownerOf" as const,
        args: [BigInt(options.expectedCount)],
      },
    ],
  });
  if (tokenOwnerResults.at(-1)?.status === "success") {
    throw new Error(`Garden token ${options.expectedCount} exists; expected count is stale`);
  }

  const [gardenOwners, gardenHatIds, hatViews, ownerAdminChecks, gardenAdminChecks] = await Promise.all([
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: inventory.gardens.map((garden) => ({
        address: garden.garden,
        abi: gardenAccountAbi,
        functionName: "owner" as const,
      })),
    }),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: inventory.gardens.map((garden) => ({
        address: inventory.hatsModule,
        abi: hatsModuleAbi,
        functionName: "getGardenHatIds" as const,
        args: [garden.garden],
      })),
    }),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: inventory.gardens.map((garden) => ({
        address: hatsProtocol,
        abi: hatsAbi,
        functionName: "viewHat" as const,
        args: [BigInt(garden.operatorHatId)],
      })),
    }),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: inventory.gardens.map((garden) => ({
        address: hatsProtocol,
        abi: hatsAbi,
        functionName: "isAdminOfHat" as const,
        args: [moduleOwner, BigInt(garden.operatorHatId)],
      })),
    }),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: inventory.gardens.map((garden) => ({
        address: hatsProtocol,
        abi: hatsAbi,
        functionName: "isAdminOfHat" as const,
        args: [garden.garden, BigInt(garden.operatorHatId)],
      })),
    }),
  ]);

  const refreshedGardens = inventory.gardens.map((garden, index) => {
    const tokenOwnerResult = tokenOwnerResults[index];
    if (tokenOwnerResult?.status !== "success") {
      throw new Error(`Garden token ${garden.tokenId} does not exist at block ${blockNumber}`);
    }
    const tokenOwner = requireAddress(tokenOwnerResult.result, `ownerOf(${garden.tokenId})`);
    const gardenOwner = requireAddress(gardenOwners[index], `garden ${garden.garden} owner`);
    if (!sameAddress(tokenOwner, gardenOwner)) {
      throw new Error(`Token ${garden.tokenId} owner does not match GardenAccount owner`);
    }

    const ids = gardenHatIds[index];
    const expectedIds = [
      garden.ownerHatId,
      garden.operatorHatId,
      garden.evaluatorHatId,
      garden.gardenerHatId,
      garden.funderHatId,
      garden.communityHatId,
      garden.adminHatId,
    ];
    for (let idIndex = 0; idIndex < expectedIds.length; idIndex++) {
      if (ids[idIndex].toString() !== expectedIds[idIndex]) {
        throw new Error(`Garden ${garden.garden} hat id ${idIndex} changed`);
      }
    }
    if (!ids[7]) throw new Error(`Garden ${garden.garden} is no longer configured`);

    const hat = hatViews[index];
    const currentDetails = hat[0];
    if (currentDetails !== garden.currentDetails) {
      throw new Error(
        `Hat ${garden.operatorHatId} details changed from ${JSON.stringify(garden.currentDetails)} to ${JSON.stringify(currentDetails)}`,
      );
    }
    if (!hat[7] || !hat[8]) throw new Error(`Hat ${garden.operatorHatId} is not mutable and active`);
    if (!ownerAdminChecks[index]) throw new Error(`HatsModule owner is not admin of hat ${garden.operatorHatId}`);
    if (!gardenAdminChecks[index]) throw new Error(`GardenAccount is not admin of hat ${garden.operatorHatId}`);

    return {
      ...garden,
      configured: true,
      currentDetails,
      targetDetails: targetDetails(currentDetails),
      mutable: true,
      active: true,
      moduleOwnerIsAdmin: true,
      gardenIsAdmin: true,
      gardenAccountOwner: gardenOwner,
      tokenOwner,
    };
  });

  const stamp = `${arbitrum.id}-${blockNumber}`;
  const generatedAt = new Date().toISOString();
  const preflightPath = path.join(options.outputDir, `preflight-${stamp}.json`);
  const baselinePath = path.join(options.outputDir, `steward-upgrade-baseline-${stamp}.json`);
  const directPlanPath = path.join(options.outputDir, `direct-admin-plan-${stamp}.json`);
  const executablePlanPath = path.join(CONTRACTS_PLAN_DIR, `${arbitrum.id}-steward-relabel-${blockNumber}-plan.json`);

  writeJson(preflightPath, {
    version: 1,
    generatedAt,
    network: "arbitrum",
    chainId: arbitrum.id.toString(),
    blockNumber: blockNumber.toString(),
    rpcUrl: redactRpcUrl(rpcUrl),
    gardenToken: inventory.gardenToken,
    gardenAccountImpl: inventory.gardenAccountImpl,
    hatsModule: inventory.hatsModule,
    hatsProtocol,
    moduleOwner,
    expectedCaller: moduleOwner,
    gardenCount: refreshedGardens.length,
    mintEnumeration: {
      strategy: "reviewed-inventory-live-multicall",
      expectedCount: options.expectedCount,
      nextTokenChecked: options.expectedCount.toString(),
    },
    warnings: [],
    validationErrors: [],
    gardens: refreshedGardens,
  });

  writeJson(baselinePath, {
    version: 1,
    generatedAt,
    chainId: arbitrum.id.toString(),
    blockNumber: blockNumber.toString(),
    hatsModule: inventory.hatsModule,
    implementationBefore,
    ownerBefore: moduleOwner,
    hatsProtocolBefore: hatsProtocol,
    gardens: refreshedGardens.map((garden) => ({
      tokenId: garden.tokenId,
      garden: garden.garden,
      ownerHatId: garden.ownerHatId,
      operatorHatId: garden.operatorHatId,
      evaluatorHatId: garden.evaluatorHatId,
      gardenerHatId: garden.gardenerHatId,
      funderHatId: garden.funderHatId,
      communityHatId: garden.communityHatId,
      adminHatId: garden.adminHatId,
      configured: garden.configured,
    })),
    probeAccounts: [moduleOwner, inventory.hatsModule, ...refreshedGardens.map((garden) => garden.garden)],
  });

  const directPlan = {
    version: 1,
    chainId: arbitrum.id.toString(),
    createdAt: generatedAt,
    snapshotBlock: blockNumber.toString(),
    authorizationModel:
      "The HatsModule owner is a live effective ancestor admin for every target hat and calls Hats.changeHatDetails directly.",
    caller: moduleOwner,
    hatsProtocol,
    targetCount: refreshedGardens.length,
    transactions: refreshedGardens.map((garden) => ({
      tokenId: garden.tokenId,
      garden: garden.garden,
      operatorHatId: garden.operatorHatId,
      currentDetails: garden.currentDetails,
      targetDetails: garden.targetDetails,
      to: hatsProtocol,
      value: "0",
      contractMethod: {
        inputs: [
          { internalType: "uint256", name: "_hatId", type: "uint256" },
          { internalType: "string", name: "_newDetails", type: "string" },
        ],
        name: "changeHatDetails",
        payable: false,
      },
      contractInputsValues: {
        _hatId: garden.operatorHatId,
        _newDetails: garden.targetDetails,
      },
    })),
  };
  writeJson(directPlanPath, directPlan);
  writeJson(executablePlanPath, directPlan);

  console.log(`Live block: ${blockNumber}`);
  console.log(`Validated targets: ${refreshedGardens.length}`);
  console.log(`HatsModule owner/common admin: ${moduleOwner}`);
  console.log(`Current implementation: ${implementationBefore}`);
  console.log(`Live preflight: ${preflightPath}`);
  console.log(`Upgrade baseline: ${baselinePath}`);
  console.log(`Direct common-admin plan: ${directPlanPath}`);
  console.log(`Executable relabel plan: ${executablePlanPath}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`Steward direct-plan refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
