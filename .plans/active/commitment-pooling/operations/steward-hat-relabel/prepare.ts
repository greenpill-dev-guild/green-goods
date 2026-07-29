#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { NetworkManager } from "../../../../../packages/contracts/script/utils/network";

type NetworkName = "sepolia" | "arbitrum";

interface Options {
  network: NetworkName;
  outputDir: string;
  expectedCaller?: string;
  expectedCount?: number;
  safeBatch: boolean;
  rpcUrl?: string;
}

interface Deployment {
  gardenToken: string;
  gardenAccountImpl: string;
  hatsModule: string;
  rootGarden?: {
    address?: string;
    tokenId?: number;
  };
}

interface RpcLog {
  topics?: string[];
}

interface MintEnumeration {
  tokenIds: bigint[];
  strategy: "full-range" | "chunked" | "sequential-expected-count";
  fromBlock: string;
  toBlock: string;
  chunkCount: number;
  minimumChunkSize: string;
  maximumChunkSize: string;
}

export interface GardenHatRecord {
  tokenId: string;
  garden: string;
  ownerHatId: string;
  operatorHatId: string;
  evaluatorHatId: string;
  gardenerHatId: string;
  funderHatId: string;
  communityHatId: string;
  adminHatId: string;
  configured: boolean;
  currentDetails: string;
  targetDetails: string | null;
  mutable: boolean;
  active: boolean;
  moduleOwnerIsAdmin: boolean;
  expectedCallerIsAdmin: boolean | null;
  gardenIsAdmin: boolean;
  gardenAccountOwner: string;
  tokenOwner: string;
  ownerHasCode: boolean;
  expectedCallerControlsGarden: boolean | null;
  validationErrors: string[];
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "../../../../..");
const CONTRACTS_ROOT = path.join(REPO_ROOT, "packages/contracts");
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const UNIVERSAL_HATS = "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const INITIAL_LOG_CHUNK_SIZE = 49_999n;
const MINIMUM_LOG_CHUNK_SIZE = 1_000n;

dotenv.config({ path: path.join(REPO_ROOT, ".env"), quiet: true });

function usage(exitCode = 1): never {
  console.error(`Usage:
  bun prepare.ts --network <sepolia|arbitrum> [options]

Options:
  --output-dir <path>       Artifact directory (default: this directory)
  --rpc-url <url>           Override the configured read-only RPC
  --expected-caller <addr>  Additional proposed Safe/caller to assess
  --expected-count <n>      Fail unless live garden count equals n
  --safe-batch              Emit Safe Transaction Builder JSON (Arbitrum only)

The command always assesses the HatsModule owner and emits a direct-admin plan when authorized.
It is read-only onchain and never broadcasts or executes any plan.`);
  process.exit(exitCode);
}

function isAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(value) &&
    value.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
  );
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function parseOptions(argv: string[]): Options {
  let network: NetworkName | undefined;
  let outputDir = MODULE_DIR;
  let expectedCaller: string | undefined;
  let expectedCount: number | undefined;
  let safeBatch = false;
  let rpcUrl: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--network":
        network = argv[++i] as NetworkName;
        break;
      case "--output-dir":
        outputDir = path.resolve(process.cwd(), argv[++i] ?? "");
        break;
      case "--rpc-url":
        rpcUrl = argv[++i];
        break;
      case "--expected-caller":
        expectedCaller = argv[++i];
        break;
      case "--expected-count":
        expectedCount = Number(argv[++i]);
        break;
      case "--safe-batch":
        safeBatch = true;
        break;
      case "--help":
      case "-h":
        usage(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }

  if (network !== "sepolia" && network !== "arbitrum") {
    throw new Error("--network must be sepolia or arbitrum");
  }
  if (expectedCaller && !isAddress(expectedCaller)) {
    throw new Error("--expected-caller must be a non-zero address");
  }
  if (expectedCount !== undefined && (!Number.isInteger(expectedCount) || expectedCount <= 0)) {
    throw new Error("--expected-count must be a positive integer");
  }
  if (safeBatch && network !== "arbitrum") {
    throw new Error("The PRD-748 Safe batch is restricted to Arbitrum One");
  }
  if (safeBatch && !expectedCaller) {
    throw new Error("--safe-batch requires --expected-caller");
  }
  if (safeBatch && expectedCount === undefined) {
    throw new Error("--safe-batch requires --expected-count");
  }

  return { network, outputDir, expectedCaller, expectedCount, safeBatch, rpcUrl };
}

export function redactRpcUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//[REDACTED]`;
  } catch {
    return "[REDACTED_RPC_URL]";
  }
}

export function redactRpcError(message: string, rpcUrl: string): string {
  return message.split(rpcUrl).join(redactRpcUrl(rpcUrl));
}

function runCast(rpcUrl: string, args: string[]): string {
  try {
    return execFileSync("cast", [...args, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast ${args[0]} failed: ${redactRpcError(message, rpcUrl)}`);
  }
}

function encodeCalldata(signature: string, args: string[]): string {
  try {
    return execFileSync("cast", ["calldata", signature, ...args], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast calldata failed (${signature}): ${message}`);
  }
}

function call(
  rpcUrl: string,
  to: string,
  signature: string,
  args: string[] = [],
  blockNumber?: string,
): string {
  const blockArgs = blockNumber ? ["--block", blockNumber] : [];
  return runCast(rpcUrl, ["call", to, signature, ...args, ...blockArgs]);
}

function parseAddress(output: string): string {
  const address = output.match(/0x[a-fA-F0-9]{40}/)?.[0];
  if (!isAddress(address)) throw new Error(`Expected non-zero address, received: ${output}`);
  return address;
}

function parseBool(output: string): boolean {
  const value = output.trim().toLowerCase();
  if (value !== "true" && value !== "false" && value !== "1" && value !== "0") {
    throw new Error(`Expected bool, received: ${output}`);
  }
  return value === "true" || value === "1";
}

function parseUintValues(output: string): bigint[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\(?\s*(0x[a-fA-F0-9]+|\d+)/)?.[1])
    .filter((value): value is string => typeof value === "string")
    .map((value) => BigInt(value));
}

function parseFirstString(output: string): string {
  const encoded = output.match(/"(?:\\.|[^"\\])*"/)?.[0];
  if (!encoded) throw new Error(`Expected a quoted string, received: ${output}`);
  return JSON.parse(encoded) as string;
}

function readImplementation(rpcUrl: string, proxy: string, blockNumber: string): string {
  const output = runCast(rpcUrl, ["storage", proxy, EIP1967_IMPLEMENTATION_SLOT, "--block", blockNumber]);
  const word = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  if (!word) throw new Error(`Invalid EIP-1967 implementation word: ${output}`);
  return parseAddress(`0x${word.slice(-40)}`);
}

function loadDeployment(chainId: number): Deployment {
  const deploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Deployment;
  for (const [key, value] of [
    ["gardenToken", deployment.gardenToken],
    ["gardenAccountImpl", deployment.gardenAccountImpl],
    ["hatsModule", deployment.hatsModule],
  ] as const) {
    if (!isAddress(value)) throw new Error(`Invalid ${key} in ${deploymentPath}`);
  }
  return deployment;
}

function parseMintedTokenIds(logs: RpcLog[]): bigint[] {
  const ids = new Set<string>();

  for (const log of logs) {
    const from = log.topics?.[1];
    const tokenId = log.topics?.[3];
    if (!from || !tokenId || !/^0x[a-fA-F0-9]{64}$/.test(from)) continue;
    if (BigInt(from) !== 0n) continue;
    ids.add(BigInt(tokenId).toString());
  }

  return [...ids].map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function loadLogs(
  rpcUrl: string,
  gardenToken: string,
  fromBlock: bigint,
  toBlock: bigint,
): RpcLog[] {
  const output = runCast(rpcUrl, [
    "logs",
    "--json",
    "--from-block",
    fromBlock.toString(),
    "--to-block",
    toBlock.toString(),
    "--address",
    gardenToken,
    "Transfer(address,address,uint256)",
  ]);
  return JSON.parse(output) as RpcLog[];
}

function hasCodeAtBlock(rpcUrl: string, address: string, blockNumber: bigint): boolean {
  const code = runCast(rpcUrl, ["code", address, "--block", blockNumber.toString()]);
  return code !== "" && code !== "0x";
}

function findDeploymentBlock(rpcUrl: string, address: string, snapshotBlock: bigint): bigint {
  if (!hasCodeAtBlock(rpcUrl, address, snapshotBlock)) {
    throw new Error(`GardenToken ${address} has no code at snapshot block ${snapshotBlock}`);
  }

  let low = 0n;
  let high = snapshotBlock;
  while (low < high) {
    const midpoint = low + (high - low) / 2n;
    if (hasCodeAtBlock(rpcUrl, address, midpoint)) {
      high = midpoint;
    } else {
      low = midpoint + 1n;
    }
  }
  return low;
}

function loadMintedTokenIds(
  rpcUrl: string,
  gardenToken: string,
  snapshotBlockText: string,
  expectedCount?: number,
): MintEnumeration {
  const snapshotBlock = BigInt(snapshotBlockText);

  if (expectedCount !== undefined) {
    const tokenIds = Array.from({ length: expectedCount }, (_, tokenId) => BigInt(tokenId));
    for (const tokenId of tokenIds) {
      parseAddress(
        call(
          rpcUrl,
          gardenToken,
          "ownerOf(uint256)(address)",
          [tokenId.toString()],
          snapshotBlockText,
        ),
      );
    }

    let unexpectedNextToken = false;
    try {
      call(
        rpcUrl,
        gardenToken,
        "ownerOf(uint256)(address)",
        [expectedCount.toString()],
        snapshotBlockText,
      );
      unexpectedNextToken = true;
    } catch {
      // GardenToken IDs are contiguous from zero and has no burn path. A
      // revert here proves the reviewed expected count is still exact.
    }
    if (unexpectedNextToken) {
      throw new Error(`Garden token ${expectedCount} exists; expected count ${expectedCount} is stale`);
    }

    return {
      tokenIds,
      strategy: "sequential-expected-count",
      fromBlock: snapshotBlockText,
      toBlock: snapshotBlockText,
      chunkCount: 0,
      minimumChunkSize: "0",
      maximumChunkSize: "0",
    };
  }

  try {
    const logs = loadLogs(rpcUrl, gardenToken, 0n, snapshotBlock);
    const tokenIds = parseMintedTokenIds(logs);
    if (tokenIds.length === 0) throw new Error("GardenToken logs contained no mint events");
    return {
      tokenIds,
      strategy: "full-range",
      fromBlock: "0",
      toBlock: snapshotBlockText,
      chunkCount: 1,
      minimumChunkSize: (snapshotBlock + 1n).toString(),
      maximumChunkSize: (snapshotBlock + 1n).toString(),
    };
  } catch {
    // Public RPCs commonly cap eth_getLogs ranges. Fall back to a deployment-bounded,
    // adaptive scan while retaining the same fixed snapshot block.
  }

  const deploymentBlock = findDeploymentBlock(rpcUrl, gardenToken, snapshotBlock);
  const logs: RpcLog[] = [];
  const chunkSizes: bigint[] = [];
  let chunkSize = INITIAL_LOG_CHUNK_SIZE;
  let cursor = deploymentBlock;

  while (cursor <= snapshotBlock) {
    const endBlock = cursor + chunkSize - 1n > snapshotBlock ? snapshotBlock : cursor + chunkSize - 1n;
    try {
      logs.push(...loadLogs(rpcUrl, gardenToken, cursor, endBlock));
      chunkSizes.push(endBlock - cursor + 1n);
      cursor = endBlock + 1n;
    } catch (error) {
      if (chunkSize <= MINIMUM_LOG_CHUNK_SIZE) throw error;
      chunkSize = chunkSize / 2n;
      if (chunkSize < MINIMUM_LOG_CHUNK_SIZE) chunkSize = MINIMUM_LOG_CHUNK_SIZE;
    }
  }

  const tokenIds = parseMintedTokenIds(logs);
  if (tokenIds.length === 0) throw new Error("GardenToken logs contained no mint events");
  return {
    tokenIds,
    strategy: "chunked",
    fromBlock: deploymentBlock.toString(),
    toBlock: snapshotBlockText,
    chunkCount: chunkSizes.length,
    minimumChunkSize: chunkSizes.reduce((minimum, value) => (value < minimum ? value : minimum)).toString(),
    maximumChunkSize: chunkSizes.reduce((maximum, value) => (value > maximum ? value : maximum)).toString(),
  };
}

function deriveGarden(
  rpcUrl: string,
  chainId: number,
  deployment: Deployment,
  tokenId: bigint,
  blockNumber: string,
): string {
  return parseAddress(
    call(
      rpcUrl,
      TOKENBOUND_REGISTRY,
      "account(address,bytes32,uint256,address,uint256)(address)",
      [deployment.gardenAccountImpl, TOKENBOUND_SALT, chainId.toString(), deployment.gardenToken, tokenId.toString()],
      blockNumber,
    ),
  );
}

function targetDetails(currentDetails: string): string {
  if (!currentDetails.endsWith(" Operator")) {
    throw new Error(`Unexpected operator-hat details: ${JSON.stringify(currentDetails)}`);
  }
  const gardenName = currentDetails.slice(0, -" Operator".length);
  if (!gardenName.trim()) throw new Error(`Missing garden name in details: ${JSON.stringify(currentDetails)}`);
  return `${gardenName} Steward`;
}

function readGardenRecord(
  rpcUrl: string,
  gardenToken: string,
  hatsModule: string,
  hatsProtocol: string,
  tokenId: bigint,
  garden: string,
  blockNumber: string,
  moduleOwner: string,
  expectedCaller?: string,
): GardenHatRecord {
  const idsOutput = call(
    rpcUrl,
    hatsModule,
    "getGardenHatIds(address)(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
    [garden],
    blockNumber,
  );
  const ids = parseUintValues(idsOutput);
  if (ids.length < 7 || ids.slice(0, 7).some((id) => id === 0n)) {
    throw new Error(`Garden ${garden} has an incomplete hat configuration: ${idsOutput}`);
  }
  const configured = parseBool(call(rpcUrl, hatsModule, "isConfigured(address)(bool)", [garden], blockNumber));
  if (!configured) throw new Error(`Garden ${garden} is not configured in HatsModule`);

  const operatorHatId = ids[1].toString();
  const hatOutput = call(
    rpcUrl,
    hatsProtocol,
    "viewHat(uint256)(string,uint32,uint32,address,address,string,uint16,bool,bool)",
    [operatorHatId],
    blockNumber,
  );
  const details = parseFirstString(hatOutput);
  const bools = hatOutput.match(/\b(?:true|false)\b/g) ?? [];
  if (bools.length < 2) throw new Error(`Could not read mutability/active state for hat ${operatorHatId}`);
  let newDetails: string | null = null;
  const validationErrors: string[] = [];
  try {
    newDetails = targetDetails(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    validationErrors.push(`Token ${tokenId}, garden ${garden}, hat ${operatorHatId}: ${message}`);
  }
  const tokenOwner = parseAddress(
    call(rpcUrl, gardenToken, "ownerOf(uint256)(address)", [tokenId.toString()], blockNumber),
  );
  const gardenAccountOwner = parseAddress(call(rpcUrl, garden, "owner()(address)", [], blockNumber));
  if (normalizeAddress(tokenOwner) !== normalizeAddress(gardenAccountOwner)) {
    validationErrors.push(
      `Token ${tokenId} owner ${tokenOwner} does not match GardenAccount owner ${gardenAccountOwner}`,
    );
  }
  const gardenIsAdmin = parseBool(
    call(rpcUrl, hatsProtocol, "isAdminOfHat(address,uint256)(bool)", [garden, operatorHatId], blockNumber),
  );
  if (!gardenIsAdmin) {
    validationErrors.push(`GardenAccount ${garden} is not an effective admin of operator hat ${operatorHatId}`);
  }
  const ownerCode = runCast(rpcUrl, ["code", gardenAccountOwner, "--block", blockNumber]);

  return {
    tokenId: tokenId.toString(),
    garden,
    ownerHatId: ids[0].toString(),
    operatorHatId,
    evaluatorHatId: ids[2].toString(),
    gardenerHatId: ids[3].toString(),
    funderHatId: ids[4].toString(),
    communityHatId: ids[5].toString(),
    adminHatId: ids[6].toString(),
    configured,
    currentDetails: details,
    targetDetails: newDetails,
    mutable: bools[0] === "true",
    active: bools[1] === "true",
    moduleOwnerIsAdmin: parseBool(
      call(rpcUrl, hatsProtocol, "isAdminOfHat(address,uint256)(bool)", [moduleOwner, operatorHatId], blockNumber),
    ),
    expectedCallerIsAdmin: expectedCaller
      ? parseBool(
          call(
            rpcUrl,
            hatsProtocol,
            "isAdminOfHat(address,uint256)(bool)",
            [expectedCaller, operatorHatId],
            blockNumber,
          ),
        )
      : null,
    gardenIsAdmin,
    gardenAccountOwner,
    tokenOwner,
    ownerHasCode: ownerCode !== "" && ownerCode !== "0x",
    expectedCallerControlsGarden: expectedCaller
      ? normalizeAddress(expectedCaller) === normalizeAddress(gardenAccountOwner)
      : null,
    validationErrors,
  };
}

function writeJson(outputPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

type PreparationValidationRecord = Pick<
  GardenHatRecord,
  | "garden"
  | "operatorHatId"
  | "mutable"
  | "active"
  | "expectedCallerIsAdmin"
  | "expectedCallerControlsGarden"
  | "gardenIsAdmin"
  | "validationErrors"
>;

export function collectPreparationValidationErrors(
  records: PreparationValidationRecord[],
  expectedCaller?: string,
): string[] {
  const validationErrors = records.flatMap((record) => record.validationErrors);
  const gardens = new Set(records.map((record) => normalizeAddress(record.garden)));
  const hats = new Set(records.map((record) => record.operatorHatId));

  if (gardens.size !== records.length) validationErrors.push("Duplicate derived garden address detected");
  if (hats.size !== records.length) validationErrors.push("Duplicate operator hat id detected");
  if (records.some((record) => !record.mutable)) validationErrors.push("At least one target operator hat is immutable");
  if (records.some((record) => !record.active)) validationErrors.push("At least one target operator hat is inactive");
  if (
    expectedCaller &&
    records.some(
      (record) => !record.expectedCallerIsAdmin && !(record.expectedCallerControlsGarden && record.gardenIsAdmin),
    )
  ) {
    validationErrors.push(`Declared caller ${expectedCaller} cannot authorize every target hat`);
  }

  return validationErrors;
}

function buildSafeBatch(chainId: number, caller: string, hatsProtocol: string, records: GardenHatRecord[]) {
  return {
    version: "1.0",
    chainId: chainId.toString(),
    createdAt: Date.now(),
    meta: {
      name: "PRD-748: relabel Operator hats to Steward",
      description: "Prepared read-only from live Green Goods and Hats Protocol state. Human review and Safe execution required.",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: caller,
      createdFromOwnerAddress: "",
    },
    transactions: records.map((record) => {
      if (record.expectedCallerIsAdmin) {
        return {
          to: hatsProtocol,
          value: "0",
          data: null,
          contractMethod: {
            inputs: [
              { internalType: "uint256", name: "_hatId", type: "uint256" },
              { internalType: "string", name: "_newDetails", type: "string" },
            ],
            name: "changeHatDetails",
            payable: false,
          },
          contractInputsValues: {
            _hatId: record.operatorHatId,
            _newDetails: record.targetDetails as string,
          },
        };
      }

      const hatsCalldata = encodeCalldata("changeHatDetails(uint256,string)", [
        record.operatorHatId,
        record.targetDetails as string,
      ]);
      return {
        to: record.garden,
        value: "0",
        data: null,
        contractMethod: {
          inputs: [
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "value", type: "uint256" },
            { internalType: "bytes", name: "data", type: "bytes" },
            { internalType: "uint8", name: "operation", type: "uint8" },
          ],
          name: "execute",
          payable: true,
        },
        contractInputsValues: {
          to: hatsProtocol,
          value: "0",
          data: hatsCalldata,
          operation: "0",
        },
      };
    }),
  };
}

function buildDirectAdminPlan(
  chainId: number,
  caller: string,
  hatsProtocol: string,
  blockNumber: string,
  records: GardenHatRecord[],
) {
  return {
    version: 1,
    chainId: chainId.toString(),
    createdAt: new Date().toISOString(),
    snapshotBlock: blockNumber,
    authorizationModel:
      "The HatsModule owner is a live effective ancestor admin for every target hat and calls Hats.changeHatDetails directly.",
    caller,
    hatsProtocol,
    targetCount: records.length,
    transactions: records.map((record) => ({
      tokenId: record.tokenId,
      garden: record.garden,
      operatorHatId: record.operatorHatId,
      currentDetails: record.currentDetails,
      targetDetails: record.targetDetails,
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
        _hatId: record.operatorHatId,
        _newDetails: record.targetDetails as string,
      },
    })),
  };
}

function buildExecutionPartitions(hatsProtocol: string, records: GardenHatRecord[]) {
  const partitions = new Map<
    string,
    {
      controller: string;
      controllerHasCode: boolean;
      transactions: Array<Record<string, unknown>>;
    }
  >();

  for (const record of records) {
    const key = normalizeAddress(record.gardenAccountOwner);
    const partition = partitions.get(key) ?? {
      controller: record.gardenAccountOwner,
      controllerHasCode: record.ownerHasCode,
      transactions: [],
    };
    const hatsCalldata = encodeCalldata("changeHatDetails(uint256,string)", [
      record.operatorHatId,
      record.targetDetails as string,
    ]);
    partition.transactions.push({
      tokenId: record.tokenId,
      garden: record.garden,
      operatorHatId: record.operatorHatId,
      currentDetails: record.currentDetails,
      targetDetails: record.targetDetails,
      to: record.garden,
      value: "0",
      contractMethod: {
        inputs: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes", name: "data", type: "bytes" },
          { internalType: "uint8", name: "operation", type: "uint8" },
        ],
        name: "execute",
        payable: true,
      },
      contractInputsValues: {
        to: hatsProtocol,
        value: "0",
        data: hatsCalldata,
        operation: "0",
      },
    });
    partitions.set(key, partition);
  }

  return [...partitions.values()];
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const networkManager = new NetworkManager();
  const chainId = networkManager.getChainId(options.network);
  const rpcUrl = options.rpcUrl || networkManager.getRpcUrl(options.network);
  const deployment = loadDeployment(chainId);
  const blockNumber = runCast(rpcUrl, ["block-number"]);
  const implementationBefore = readImplementation(rpcUrl, deployment.hatsModule, blockNumber);
  const ownerBefore = parseAddress(call(rpcUrl, deployment.hatsModule, "owner()(address)", [], blockNumber));
  const hatsProtocolBefore = parseAddress(call(rpcUrl, deployment.hatsModule, "hats()(address)", [], blockNumber));

  if (normalizeAddress(hatsProtocolBefore) !== normalizeAddress(UNIVERSAL_HATS)) {
    throw new Error(`Unexpected Hats Protocol address: ${hatsProtocolBefore}`);
  }

  const mintEnumeration = loadMintedTokenIds(
    rpcUrl,
    deployment.gardenToken,
    blockNumber,
    options.expectedCount,
  );
  const tokenIds = mintEnumeration.tokenIds;
  if (options.expectedCount !== undefined && tokenIds.length !== options.expectedCount) {
    throw new Error(`Expected ${options.expectedCount} live gardens, enumerated ${tokenIds.length}`);
  }

  const records = tokenIds.map((tokenId) => {
    const garden = deriveGarden(rpcUrl, chainId, deployment, tokenId, blockNumber);
    return readGardenRecord(
      rpcUrl,
      deployment.gardenToken,
      deployment.hatsModule,
      hatsProtocolBefore,
      tokenId,
      garden,
      blockNumber,
      ownerBefore,
      options.expectedCaller,
    );
  });

  const validationErrors = collectPreparationValidationErrors(records, options.expectedCaller);
  const warnings: string[] = [];

  if (deployment.rootGarden?.address && deployment.rootGarden.tokenId !== undefined) {
    const root = records.find((record) => record.tokenId === deployment.rootGarden?.tokenId?.toString());
    if (!root || normalizeAddress(root.garden) !== normalizeAddress(deployment.rootGarden.address)) {
      const liveRoot = records.find(
        (record) => normalizeAddress(record.garden) === normalizeAddress(deployment.rootGarden?.address ?? ""),
      );
      warnings.push(
        liveRoot
          ? `Deployment artifact records root token ${deployment.rootGarden.tokenId}; live root address is token ${liveRoot.tokenId}`
          : "Deployment artifact root garden address was not found in live GardenToken mint events",
      );
    }
  }

  const probeAccounts = new Map<string, string>();
  for (const account of [ownerBefore, deployment.hatsModule, options.expectedCaller, ...records.map((record) => record.garden)]) {
    if (isAddress(account)) probeAccounts.set(normalizeAddress(account), account);
  }
  for (const record of records) {
    try {
      const gardenOwner = parseAddress(call(rpcUrl, record.garden, "owner()(address)", [], blockNumber));
      probeAccounts.set(normalizeAddress(gardenOwner), gardenOwner);
    } catch {
      // Historical GardenAccount versions may not expose owner().
    }
  }

  const stamp = `${chainId}-${blockNumber}`;
  const common = {
    version: 1,
    generatedAt: new Date().toISOString(),
    network: options.network,
    chainId: chainId.toString(),
    blockNumber,
    rpcUrl: redactRpcUrl(rpcUrl),
    gardenToken: deployment.gardenToken,
    gardenAccountImpl: deployment.gardenAccountImpl,
    hatsModule: deployment.hatsModule,
    hatsProtocol: hatsProtocolBefore,
    moduleOwner: ownerBefore,
    expectedCaller: options.expectedCaller ?? null,
    gardenCount: records.length,
    mintEnumeration: {
      event: "Transfer(address,address,uint256)",
      strategy: mintEnumeration.strategy,
      fromBlock: mintEnumeration.fromBlock,
      toBlock: mintEnumeration.toBlock,
      chunkCount: mintEnumeration.chunkCount,
      minimumChunkSize: mintEnumeration.minimumChunkSize,
      maximumChunkSize: mintEnumeration.maximumChunkSize,
    },
  };

  const inventoryPath = path.join(options.outputDir, `preflight-${stamp}.json`);
  writeJson(inventoryPath, { ...common, warnings, validationErrors, gardens: records });

  const baselinePath = path.join(options.outputDir, `steward-upgrade-baseline-${stamp}.json`);
  writeJson(baselinePath, {
    version: 1,
    generatedAt: common.generatedAt,
    chainId: common.chainId,
    blockNumber,
    hatsModule: deployment.hatsModule,
    implementationBefore,
    ownerBefore,
    hatsProtocolBefore,
    gardens: records.map((record) => ({
      tokenId: record.tokenId,
      garden: record.garden,
      ownerHatId: record.ownerHatId,
      operatorHatId: record.operatorHatId,
      evaluatorHatId: record.evaluatorHatId,
      gardenerHatId: record.gardenerHatId,
      funderHatId: record.funderHatId,
      communityHatId: record.communityHatId,
      adminHatId: record.adminHatId,
      configured: record.configured,
    })),
    probeAccounts: [...probeAccounts.values()],
  });

  console.log(`Live preflight: ${inventoryPath}`);
  console.log(`Upgrade baseline: ${baselinePath}`);

  if (validationErrors.length > 0) {
    throw new Error(`Preflight found ${validationErrors.length} blocker(s); no Safe batch was emitted`);
  }

  const partitionsPath = path.join(options.outputDir, `execution-partitions-${stamp}.json`);
  const partitions = buildExecutionPartitions(hatsProtocolBefore, records);
  writeJson(partitionsPath, {
    ...common,
    warnings,
    authorizationModel:
      "Each GardenAccount wears its garden admin hat. Its current GardenToken owner must call GardenAccount.execute.",
    partitionCount: partitions.length,
    partitions,
  });
  console.log(`Execution partitions: ${partitionsPath}`);

  if (records.every((record) => record.moduleOwnerIsAdmin)) {
    const directPlanPath = path.join(options.outputDir, `direct-admin-plan-${stamp}.json`);
    writeJson(
      directPlanPath,
      buildDirectAdminPlan(chainId, ownerBefore, hatsProtocolBefore, blockNumber, records),
    );
    console.log(`Direct common-admin plan: ${directPlanPath}`);
  } else {
    console.log(`No direct common-admin plan: HatsModule owner ${ownerBefore} is not admin for every target`);
  }

  if (options.safeBatch && options.expectedCaller) {
    const safePath = path.join(options.outputDir, `safe-batch-${stamp}.json`);
    writeJson(safePath, buildSafeBatch(chainId, options.expectedCaller, hatsProtocolBefore, records));
    console.log(`Safe batch: ${safePath}`);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`Steward hat preparation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
