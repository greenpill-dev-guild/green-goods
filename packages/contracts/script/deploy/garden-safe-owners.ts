#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  AbiCoder,
  Contract,
  concat,
  dataSlice,
  getAddress,
  getCreate2Address,
  Interface,
  JsonRpcProvider,
  keccak256,
  toBeHex,
  toUtf8Bytes,
  ZeroAddress,
  ZeroHash,
  zeroPadValue,
} from "ethers";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { retryRpcAvailability } from "../utils/rpc-retry";
import { NetworkManager } from "../utils/network";
import { buildReleaseLock, loadReleaseManifest, type ReleaseManifest } from "../utils/release-manifest";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_INVENTORY = path.join(RUNTIME_ROOT, "42161-pool-backfill.json");
const DEFAULT_BOOTSTRAP_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-bootstrap.json");
const DEFAULT_SWAP_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-owner-swap.json");
const DEFAULT_REPLACEMENTS = path.join(RUNTIME_ROOT, "42220-garden-safe-replacements.json");
const DEPLOYMENT_ARTIFACT = path.join(CONTRACTS_ROOT, "deployments/42220-settlement-safes.json");
const SOURCE_DEPLOYMENT = path.join(CONTRACTS_ROOT, "deployments/42161-latest.json");

const CELO_CHAIN_ID = 42_220;
const SOURCE_CHAIN_ID = 42_161;
const EXPECTED_GARDEN_COUNT = 18;
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const SAFE_SENTINEL = "0x0000000000000000000000000000000000000001";
const SAFE_GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const SAFE_FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
const COMPATIBILITY_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";
const SAFE_DOMAIN = "GG_COMMITMENT_POOL_SAFE_V1";

const SAFE_INTERFACE = new Interface([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)",
  "function VERSION() view returns (string)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)",
  "function nonce() view returns (uint256)",
  "function swapOwner(address prevOwner,address oldOwner,address newOwner)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns (bool success)",
]);
const FACTORY_INTERFACE = new Interface([
  "function proxyCreationCode() view returns (bytes)",
  "function createProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address proxy)",
]);
const ERC20_INTERFACE = new Interface(["function balanceOf(address account) view returns (uint256)"]);
const GARDEN_TOKEN_INTERFACE = new Interface(["function ownerOf(uint256 tokenId) view returns (address)"]);
const TOKENBOUND_REGISTRY_INTERFACE = new Interface([
  "function account(address implementation,bytes32 salt,uint256 chainId,address tokenContract,uint256 tokenId) view returns (address)",
]);

type Command = "plan" | "deploy" | "swap-plan" | "swap";

export interface GardenInventoryEntry {
  tokenId: number;
  garden: string;
  tokenOwner: string;
  codeHash: string;
  status: string;
}

interface GardenInventory {
  schemaVersion: number;
  releaseId: string;
  releaseManifestHash: string;
  chainId: number;
  gardenToken: string;
  gardenAccountImplementation: string;
  tokenboundRegistry: string;
  tokenboundSalt: string;
  rootGarden: string;
  rootTokenId: number;
  expectedGardenCount: number;
  gardens: Record<string, GardenInventoryEntry>;
}

interface SourceDeployment {
  gardenToken: string;
  gardenAccountImpl: string;
  rootGarden: { address: string; tokenId: number };
}

export interface SafeInspection {
  codePresent: boolean;
  singleton: string;
  version: string | null;
  owners: string[];
  threshold: string;
  modules: string[];
  guard: string;
  fallbackHandler: string;
  nonce: string;
  nativeBalance: string;
  tokenBalance: string;
}

export interface BootstrapEntry {
  index: number;
  tokenId: number;
  garden: string;
  safe: string;
  owners: string[];
  threshold: "1";
  initializer: string;
  initializerHash: string;
  saltNonce: string;
  transaction: {
    to: string;
    value: "0";
    data: string;
    nonce: number;
  };
  observed: SafeInspection;
  state: "ABSENT" | "BOOTSTRAPPED";
}

export interface BootstrapPlan {
  schemaVersion: 1;
  kind: "GARDEN_SAFE_BOOTSTRAP";
  generatedAt: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  inventoryHash: string;
  sourceDeploymentHash: string;
  chainId: 42220;
  sourceFinalizedBlock: number;
  finalizedBlock: number;
  expectedNonce: number;
  sender: string;
  recoverySafe: string;
  recoverySafeInspection: SafeInspection;
  singleton: string;
  factory: string;
  compatibilityFallbackHandler: string;
  canonicalToken: string;
  dependencyCodeHashes: {
    singleton: string;
    factory: string;
    compatibilityFallbackHandler: string;
    canonicalToken: string;
  };
  authorityEnabled: false;
  entries: BootstrapEntry[];
  blockers: string[];
}

export interface ReplacementEntry {
  garden: string;
  safe: string;
  replacementOwner: string;
}

interface ReplacementFile {
  schemaVersion: 1;
  replacements: ReplacementEntry[];
}

export interface SwapEntry {
  index: number;
  garden: string;
  safe: string;
  oldOwner: string;
  replacementOwner: string;
  recoverySafe: string;
  previousOwner: string;
  expectedSafeNonce: string;
  transaction: {
    to: string;
    value: "0";
    data: string;
    nonce: number;
  };
  observed: SafeInspection;
  state: "READY" | "SWAPPED";
}

export interface SwapPlan {
  schemaVersion: 1;
  kind: "GARDEN_SAFE_OWNER_SWAP";
  generatedAt: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  bootstrapPlanHash: string;
  replacementsHash: string;
  chainId: 42220;
  finalizedBlock: number;
  expectedNonce: number;
  sender: string;
  recoverySafe: string;
  singleton: string;
  compatibilityFallbackHandler: string;
  canonicalToken: string;
  authorityEnabled: false;
  entries: SwapEntry[];
  blockers: string[];
}

export interface CheckpointEntry {
  index: number;
  transactionHash: string;
  blockNumber: number;
  safe: string;
  garden: string;
}

export interface Checkpoint {
  schemaVersion: 1;
  planHash: string;
  completed: CheckpointEntry[];
}

interface ParsedArguments {
  command: Command;
  inventoryPath: string;
  planPath: string;
  replacementsPath: string;
  broadcast: boolean;
  recoveryReceipt?: string;
  recoveryStep?: number;
}

dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, stable(value), { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function confinedRuntimePath(value: string, label: string): string {
  const resolved = path.resolve(CONTRACTS_ROOT, value);
  if (resolved !== RUNTIME_ROOT && !resolved.startsWith(`${RUNTIME_ROOT}${path.sep}`)) {
    throw new Error(`${label} must stay inside ${RUNTIME_ROOT}`);
  }
  return resolved;
}

export function parseArguments(args: string[]): ParsedArguments {
  const command = args[0] as Command | undefined;
  if (!command || !["plan", "deploy", "swap-plan", "swap"].includes(command)) {
    throw new Error("Use: garden-safe-owners.ts plan|deploy|swap-plan|swap [reviewed options]");
  }
  let inventoryPath = DEFAULT_INVENTORY;
  let planPath = command.startsWith("swap") ? DEFAULT_SWAP_PLAN : DEFAULT_BOOTSTRAP_PLAN;
  let replacementsPath = DEFAULT_REPLACEMENTS;
  let broadcast = false;
  let recoveryReceipt: string | undefined;
  let recoveryStep: number | undefined;
  for (let index = 1; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--broadcast") {
      broadcast = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    if (argument === "--inventory") inventoryPath = confinedRuntimePath(value, "inventory");
    else if (argument === "--plan") planPath = confinedRuntimePath(value, "plan");
    else if (argument === "--replacements") replacementsPath = confinedRuntimePath(value, "replacements");
    else if (argument === "--receipt") recoveryReceipt = value;
    else if (argument === "--step") {
      recoveryStep = Number(value);
      if (!Number.isSafeInteger(recoveryStep) || recoveryStep < 1 || recoveryStep > EXPECTED_GARDEN_COUNT) {
        throw new Error(`--step must be between 1 and ${EXPECTED_GARDEN_COUNT}`);
      }
    } else throw new Error(`Unknown argument: ${argument}`);
    index++;
  }
  if ((recoveryReceipt === undefined) !== (recoveryStep === undefined)) {
    throw new Error("--receipt and --step must be supplied together");
  }
  if ((command === "deploy" || command === "swap") && !broadcast) {
    throw new Error(`${command} requires --broadcast`);
  }
  if ((command === "plan" || command === "swap-plan") && broadcast) {
    throw new Error(`${command} does not accept --broadcast`);
  }
  return { command, inventoryPath, planPath, replacementsPath, broadcast, recoveryReceipt, recoveryStep };
}

function normalizedOwners(owners: string[]): string[] {
  return owners.map(getAddress).sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()));
}

export function deriveSaltNonce(garden: string): bigint {
  return BigInt(
    keccak256(
      AbiCoder.defaultAbiCoder().encode(["string", "uint64", "address"], [SAFE_DOMAIN, SOURCE_CHAIN_ID, garden]),
    ),
  );
}

export function buildBootstrapInitializer(deploymentOwner: string, recoverySafe: string): string {
  const owners = normalizedOwners([deploymentOwner, recoverySafe]);
  if (owners[0] === owners[1]) throw new Error("Bootstrap owners must be distinct");
  return SAFE_INTERFACE.encodeFunctionData("setup", [
    owners,
    1,
    ZeroAddress,
    "0x",
    COMPATIBILITY_FALLBACK_HANDLER,
    ZeroAddress,
    0,
    ZeroAddress,
  ]);
}

export function predictSafeAddress(
  factory: string,
  singleton: string,
  proxyCreationCode: string,
  initializer: string,
  saltNonce: bigint,
): string {
  const salt = keccak256(concat([keccak256(initializer), zeroPadValue(toBeHex(saltNonce), 32)]));
  const deploymentCode = concat([proxyCreationCode, zeroPadValue(singleton, 32)]);
  return getAddress(getCreate2Address(factory, salt, keccak256(deploymentCode)));
}

export function prevalidatedSignature(owner: string): string {
  return concat([zeroPadValue(getAddress(owner), 32), ZeroHash, "0x01"]);
}

export function previousOwner(owners: string[], owner: string): string {
  const normalized = owners.map(getAddress);
  const target = getAddress(owner);
  const index = normalized.indexOf(target);
  if (index < 0) throw new Error(`Owner ${target} is absent`);
  return index === 0 ? SAFE_SENTINEL : normalized[index - 1];
}

export function buildSwapExecutionData(
  safe: string,
  owners: string[],
  deploymentOwner: string,
  replacementOwner: string,
): { previousOwner: string; data: string } {
  const oldOwner = getAddress(deploymentOwner);
  const replacement = getAddress(replacementOwner);
  if (replacement === ZeroAddress || replacement === oldOwner || owners.map(getAddress).includes(replacement)) {
    throw new Error(`Invalid replacement owner ${replacement}`);
  }
  const predecessor = previousOwner(owners, oldOwner);
  const swapCall = SAFE_INTERFACE.encodeFunctionData("swapOwner", [predecessor, oldOwner, replacement]);
  const data = SAFE_INTERFACE.encodeFunctionData("execTransaction", [
    getAddress(safe),
    0,
    swapCall,
    0,
    0,
    0,
    0,
    ZeroAddress,
    ZeroAddress,
    prevalidatedSignature(oldOwner),
  ]);
  return { previousOwner: predecessor, data };
}

function hashFileContent(filePath: string): string {
  return keccak256(toUtf8Bytes(fs.readFileSync(filePath, "utf8")));
}

function validateInventory(filePath: string, manifest: ReleaseManifest, manifestHash: string): GardenInventoryEntry[] {
  const inventory = readJson<GardenInventory>(filePath);
  const deployment = readJson<SourceDeployment>(SOURCE_DEPLOYMENT);
  if (inventory.schemaVersion !== 1 || inventory.chainId !== SOURCE_CHAIN_ID) {
    throw new Error("Garden inventory must be the reviewed Arbitrum schema-v1 plan");
  }
  if (inventory.releaseId !== manifest.releaseId || inventory.releaseManifestHash !== manifestHash) {
    throw new Error("Garden inventory is not bound to the current release manifest");
  }
  const gardenToken = manifest.existingProxyUpgrades.find((upgrade) => upgrade.name === "GardenToken")?.proxy;
  if (
    !gardenToken ||
    getAddress(inventory.gardenToken) !== getAddress(gardenToken) ||
    getAddress(inventory.gardenToken) !== getAddress(deployment.gardenToken) ||
    getAddress(inventory.gardenAccountImplementation) !== getAddress(deployment.gardenAccountImpl) ||
    getAddress(inventory.tokenboundRegistry) !== getAddress(TOKENBOUND_REGISTRY) ||
    inventory.tokenboundSalt !== TOKENBOUND_SALT ||
    getAddress(inventory.rootGarden) !== getAddress(deployment.rootGarden.address) ||
    inventory.rootTokenId !== deployment.rootGarden.tokenId
  ) {
    throw new Error("Garden inventory token does not match the release manifest");
  }
  const keyedEntries = Object.entries(inventory.gardens).sort(([, left], [, right]) => left.tokenId - right.tokenId);
  const entries = keyedEntries.map(([, entry]) => entry);
  if (
    inventory.expectedGardenCount !== EXPECTED_GARDEN_COUNT ||
    entries.length !== EXPECTED_GARDEN_COUNT ||
    entries.some((entry, index) => entry.tokenId !== index)
  ) {
    throw new Error(`Garden inventory must contain exact token IDs 0-${EXPECTED_GARDEN_COUNT - 1}`);
  }
  const gardens = new Set<string>();
  for (const [key, entry] of keyedEntries) {
    const garden = getAddress(entry.garden).toLowerCase();
    if (key !== garden) throw new Error(`Garden inventory key ${key} does not match ${entry.garden}`);
    if (gardens.has(garden)) throw new Error(`Duplicate Garden inventory address ${entry.garden}`);
    gardens.add(garden);
    getAddress(entry.tokenOwner);
    if (!/^0x[0-9a-f]{64}$/iu.test(entry.codeHash)) throw new Error(`Garden ${entry.garden} has invalid code hash`);
    const expectedStatus = entry.tokenId === inventory.rootTokenId ? "SKIPPED_PROTOCOL_ROOT" : "PLANNED";
    if (entry.status !== expectedStatus) throw new Error(`Garden ${entry.garden} has invalid inventory status`);
  }
  if (getAddress(entries[inventory.rootTokenId].garden) !== getAddress(inventory.rootGarden)) {
    throw new Error("Garden inventory root does not round-trip to its token ID");
  }
  return entries;
}

async function inspectSafe(
  provider: JsonRpcProvider,
  safe: string,
  canonicalToken: string,
  blockTag: number | "finalized" | "latest" = "finalized",
): Promise<SafeInspection> {
  const address = getAddress(safe);
  const token = new Contract(canonicalToken, ERC20_INTERFACE, provider);
  const [code, nativeBalance, tokenResult] = await Promise.all([
    provider.getCode(address, blockTag),
    provider.getBalance(address, blockTag),
    token.balanceOf(address, { blockTag }) as Promise<bigint>,
  ]);
  const tokenBalance = tokenResult;
  if (code === "0x") {
    return {
      codePresent: false,
      singleton: ZeroAddress,
      version: null,
      owners: [],
      threshold: "0",
      modules: [],
      guard: ZeroAddress,
      fallbackHandler: ZeroAddress,
      nonce: "0",
      nativeBalance: nativeBalance.toString(),
      tokenBalance: tokenBalance.toString(),
    };
  }
  const contract = new Contract(address, SAFE_INTERFACE, provider);
  const [singletonStorage, version, owners, threshold, modulesPage, guardStorage, fallbackHandlerStorage, nonce] =
    await Promise.all([
      provider.getStorage(address, 0, blockTag),
      contract.VERSION({ blockTag }),
      contract.getOwners({ blockTag }),
      contract.getThreshold({ blockTag }),
      contract.getModulesPaginated(SAFE_SENTINEL, 32, { blockTag }),
      provider.getStorage(address, SAFE_GUARD_STORAGE_SLOT, blockTag),
      provider.getStorage(address, SAFE_FALLBACK_HANDLER_STORAGE_SLOT, blockTag),
      contract.nonce({ blockTag }),
    ]);
  return {
    codePresent: true,
    singleton: getAddress(dataSlice(singletonStorage, 12)),
    version: String(version),
    owners: (owners as string[]).map(getAddress),
    threshold: String(threshold),
    modules: (modulesPage[0] as string[]).map(getAddress),
    guard: getAddress(dataSlice(guardStorage, 12)),
    fallbackHandler: getAddress(dataSlice(fallbackHandlerStorage, 12)),
    nonce: String(nonce),
    nativeBalance: nativeBalance.toString(),
    tokenBalance: tokenBalance.toString(),
  };
}

function sameOwnerSet(actual: string[], expected: string[]): boolean {
  const left = normalizedOwners(actual);
  const right = normalizedOwners(expected);
  return left.length === right.length && left.every((owner, index) => owner === right[index]);
}

function emptyAndUnmodified(inspection: SafeInspection): boolean {
  return (
    inspection.nativeBalance === "0" &&
    inspection.tokenBalance === "0" &&
    inspection.modules.length === 0 &&
    inspection.guard === ZeroAddress
  );
}

export function assertBootstrapState(
  inspection: SafeInspection,
  deploymentOwner: string,
  recoverySafe: string,
  singleton: string,
  fallbackHandler: string,
): void {
  if (
    !inspection.codePresent ||
    inspection.singleton !== getAddress(singleton) ||
    inspection.version !== "1.4.1" ||
    inspection.threshold !== "1" ||
    inspection.nonce !== "0" ||
    !sameOwnerSet(inspection.owners, [deploymentOwner, recoverySafe]) ||
    inspection.fallbackHandler !== getAddress(fallbackHandler) ||
    !emptyAndUnmodified(inspection)
  ) {
    throw new Error("Garden Safe is not the exact empty 1-of-2 bootstrap state");
  }
}

export function assertSwappedState(
  inspection: SafeInspection,
  replacementOwner: string,
  recoverySafe: string,
  singleton: string,
  fallbackHandler: string,
): void {
  if (
    !inspection.codePresent ||
    inspection.singleton !== getAddress(singleton) ||
    inspection.version !== "1.4.1" ||
    inspection.threshold !== "1" ||
    inspection.nonce !== "1" ||
    !sameOwnerSet(inspection.owners, [replacementOwner, recoverySafe]) ||
    inspection.fallbackHandler !== getAddress(fallbackHandler) ||
    !emptyAndUnmodified(inspection)
  ) {
    throw new Error("Garden Safe is not the exact empty post-swap state");
  }
}

async function providerAndBlock(networkManager = new NetworkManager()): Promise<{
  provider: JsonRpcProvider;
  finalizedBlock: number;
}> {
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const [network, finalized] = await Promise.all([provider.getNetwork(), provider.getBlock("finalized")]);
  if (network.chainId !== BigInt(CELO_CHAIN_ID) || !finalized) throw new Error("Celo finalized RPC is unavailable");
  return { provider, finalizedBlock: finalized.number };
}

async function sourceProviderAndBlock(networkManager = new NetworkManager()): Promise<{
  provider: JsonRpcProvider;
  finalizedBlock: number;
}> {
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("arbitrum"), SOURCE_CHAIN_ID, { staticNetwork: true });
  const [network, finalized] = await Promise.all([provider.getNetwork(), provider.getBlock("finalized")]);
  if (network.chainId !== BigInt(SOURCE_CHAIN_ID) || !finalized) {
    throw new Error("Arbitrum finalized RPC is unavailable");
  }
  return { provider, finalizedBlock: finalized.number };
}

async function assertLiveSourceInventory(
  provider: JsonRpcProvider,
  finalizedBlock: number,
  inventoryPath: string,
  expected: GardenInventoryEntry[],
): Promise<void> {
  const inventory = readJson<GardenInventory>(inventoryPath);
  const token = new Contract(inventory.gardenToken, GARDEN_TOKEN_INTERFACE, provider);
  const registry = new Contract(TOKENBOUND_REGISTRY, TOKENBOUND_REGISTRY_INTERFACE, provider);
  const live = await Promise.all(
    expected.map(async (entry) => {
      const [tokenOwner, garden] = await Promise.all([
        token.ownerOf(entry.tokenId, { blockTag: finalizedBlock }) as Promise<string>,
        registry.account(
          inventory.gardenAccountImplementation,
          TOKENBOUND_SALT,
          SOURCE_CHAIN_ID,
          inventory.gardenToken,
          entry.tokenId,
          { blockTag: finalizedBlock },
        ) as Promise<string>,
      ]);
      const code = await provider.getCode(garden, finalizedBlock);
      if (code === "0x") throw new Error(`Live Garden ${garden} for token ${entry.tokenId} has no code`);
      return { tokenOwner: getAddress(tokenOwner), garden: getAddress(garden), codeHash: keccak256(code) };
    }),
  );
  for (const [index, entry] of expected.entries()) {
    if (
      live[index].garden !== getAddress(entry.garden) ||
      live[index].tokenOwner !== getAddress(entry.tokenOwner) ||
      live[index].codeHash !== entry.codeHash
    ) {
      throw new Error(`Reviewed Garden inventory differs from live token ${entry.tokenId}`);
    }
  }
  try {
    await token.ownerOf(EXPECTED_GARDEN_COUNT, { blockTag: finalizedBlock });
  } catch (error) {
    if (isContractCallRevert(error)) return;
    throw new Error(
      `Unable to prove Garden inventory bound at token ${EXPECTED_GARDEN_COUNT}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  throw new Error(`Live Garden inventory now extends beyond token ${EXPECTED_GARDEN_COUNT - 1}`);
}

export function isContractCallRevert(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "CALL_EXCEPTION");
}

async function buildBootstrapPlan(inventoryPath: string): Promise<BootstrapPlan> {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  const [{ provider, finalizedBlock }, source] = await Promise.all([providerAndBlock(), sourceProviderAndBlock()]);
  await assertLiveSourceInventory(source.provider, source.finalizedBlock, inventoryPath, inventory);
  const sender = getAddress(manifest.ownership.deploymentSender);
  const recoverySafe = getAddress(manifest.ownership.gardenRecoveryOwner);
  const singleton = getAddress(manifest.safeAuthority.safeSingleton);
  const factoryAddress = getAddress(manifest.safeAuthority.safeFactory);
  const canonicalToken = getAddress(manifest.safeAuthority.zodiacRoles.canonicalTarget as string);
  const handler = getAddress(COMPATIBILITY_FALLBACK_HANDLER);
  const factory = new Contract(factoryAddress, FACTORY_INTERFACE, provider);
  const expectedNonce = await provider.getTransactionCount(sender, "pending");
  const [proxyCreationCode, recoverySafeInspection, singletonCode, factoryCode, handlerCode, tokenCode] =
    await Promise.all([
      factory.proxyCreationCode({ blockTag: finalizedBlock }) as Promise<string>,
      inspectSafe(provider, recoverySafe, canonicalToken, finalizedBlock),
      provider.getCode(singleton, finalizedBlock),
      provider.getCode(factoryAddress, finalizedBlock),
      provider.getCode(handler, finalizedBlock),
      provider.getCode(canonicalToken, finalizedBlock),
    ]);
  const blockers: string[] = [];
  if (singletonCode === "0x" || factoryCode === "0x" || handlerCode === "0x" || tokenCode === "0x") {
    blockers.push("Pinned Safe or canonical-token dependency has no finalized Celo code");
  }
  if (
    !recoverySafeInspection.codePresent ||
    recoverySafeInspection.threshold !== "2" ||
    recoverySafeInspection.owners.length !== 3 ||
    recoverySafeInspection.modules.length !== 0 ||
    recoverySafeInspection.guard !== ZeroAddress
  ) {
    blockers.push("Garden recovery Safe is not the reviewed module-free 2-of-3 configuration");
  }
  const owners = normalizedOwners([sender, recoverySafe]);
  const entries: BootstrapEntry[] = [];
  for (const [offset, item] of inventory.entries()) {
    const garden = getAddress(item.garden);
    const initializer = buildBootstrapInitializer(sender, recoverySafe);
    const saltNonce = deriveSaltNonce(garden);
    const safe = predictSafeAddress(factoryAddress, singleton, proxyCreationCode, initializer, saltNonce);
    const observed = await inspectSafe(provider, safe, canonicalToken, finalizedBlock);
    let state: BootstrapEntry["state"];
    if (!observed.codePresent) {
      state = "ABSENT";
      if (!emptyAndUnmodified(observed)) blockers.push(`Counterfactual Safe ${safe} is prefunded`);
    } else {
      state = "BOOTSTRAPPED";
      try {
        assertBootstrapState(observed, sender, recoverySafe, singleton, handler);
      } catch {
        blockers.push(`Safe ${safe} conflicts with the exact bootstrap state`);
      }
    }
    entries.push({
      index: offset + 1,
      tokenId: item.tokenId,
      garden,
      safe,
      owners,
      threshold: "1",
      initializer,
      initializerHash: keccak256(initializer),
      saltNonce: saltNonce.toString(),
      transaction: {
        to: factoryAddress,
        value: "0",
        data: FACTORY_INTERFACE.encodeFunctionData("createProxyWithNonce", [singleton, initializer, saltNonce]),
        nonce: expectedNonce + offset,
      },
      observed,
      state,
    });
  }
  return {
    schemaVersion: 1,
    kind: "GARDEN_SAFE_BOOTSTRAP",
    generatedAt: new Date().toISOString(),
    releaseId: manifest.releaseId,
    releaseManifestHash: lock.manifestHash,
    releaseSourceCommit: lock.sourceCommit,
    inventoryHash: hashFileContent(inventoryPath),
    sourceDeploymentHash: hashFileContent(SOURCE_DEPLOYMENT),
    chainId: CELO_CHAIN_ID,
    sourceFinalizedBlock: source.finalizedBlock,
    finalizedBlock,
    expectedNonce,
    sender,
    recoverySafe,
    recoverySafeInspection,
    singleton,
    factory: factoryAddress,
    compatibilityFallbackHandler: handler,
    canonicalToken,
    dependencyCodeHashes: {
      singleton: keccak256(singletonCode),
      factory: keccak256(factoryCode),
      compatibilityFallbackHandler: keccak256(handlerCode),
      canonicalToken: keccak256(tokenCode),
    },
    authorityEnabled: false,
    entries,
    blockers,
  };
}

function validateBootstrapPlan(plan: BootstrapPlan, inventoryPath: string): void {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  if (
    plan.schemaVersion !== 1 ||
    plan.kind !== "GARDEN_SAFE_BOOTSTRAP" ||
    plan.chainId !== CELO_CHAIN_ID ||
    plan.releaseId !== manifest.releaseId ||
    plan.releaseManifestHash !== lock.manifestHash ||
    plan.releaseSourceCommit !== lock.sourceCommit ||
    plan.inventoryHash !== hashFileContent(inventoryPath) ||
    plan.sourceDeploymentHash !== hashFileContent(SOURCE_DEPLOYMENT) ||
    !Number.isSafeInteger(plan.sourceFinalizedBlock) ||
    plan.sourceFinalizedBlock < 1 ||
    plan.authorityEnabled !== false ||
    plan.entries.length !== EXPECTED_GARDEN_COUNT
  ) {
    throw new Error("Bootstrap plan is not bound to the current reviewed release and Garden inventory");
  }
  if (
    getAddress(plan.sender) !== getAddress(manifest.ownership.deploymentSender) ||
    getAddress(plan.recoverySafe) !== getAddress(manifest.ownership.gardenRecoveryOwner) ||
    getAddress(plan.singleton) !== getAddress(manifest.safeAuthority.safeSingleton) ||
    getAddress(plan.factory) !== getAddress(manifest.safeAuthority.safeFactory) ||
    getAddress(plan.canonicalToken) !== getAddress(manifest.safeAuthority.zodiacRoles.canonicalTarget as string) ||
    getAddress(plan.compatibilityFallbackHandler) !== getAddress(COMPATIBILITY_FALLBACK_HANDLER)
  ) {
    throw new Error("Bootstrap plan identity differs from the frozen release inputs");
  }
  const dependencyHashes = Object.values(plan.dependencyCodeHashes ?? {});
  if (dependencyHashes.length !== 4 || dependencyHashes.some((hash) => !/^0x[0-9a-f]{64}$/iu.test(hash))) {
    throw new Error("Bootstrap plan dependency code hashes are incomplete");
  }
  for (const [offset, entry] of plan.entries.entries()) {
    const inventoryEntry = inventory[offset];
    const initializer = buildBootstrapInitializer(plan.sender, plan.recoverySafe);
    const saltNonce = deriveSaltNonce(entry.garden);
    const expectedData = FACTORY_INTERFACE.encodeFunctionData("createProxyWithNonce", [
      plan.singleton,
      initializer,
      saltNonce,
    ]);
    if (
      entry.index !== offset + 1 ||
      entry.tokenId !== inventoryEntry.tokenId ||
      getAddress(entry.garden) !== getAddress(inventoryEntry.garden) ||
      !sameOwnerSet(entry.owners, [plan.sender, plan.recoverySafe]) ||
      entry.threshold !== "1" ||
      entry.initializer !== initializer ||
      entry.initializerHash !== keccak256(initializer) ||
      entry.saltNonce !== saltNonce.toString() ||
      entry.transaction.to !== plan.factory ||
      entry.transaction.value !== "0" ||
      entry.transaction.data !== expectedData ||
      entry.transaction.nonce !== plan.expectedNonce + offset
    ) {
      throw new Error(`Bootstrap plan boundary ${offset + 1} was modified`);
    }
  }
  if (plan.blockers.length > 0) throw new Error(`Bootstrap plan is blocked: ${plan.blockers.join("; ")}`);
}

function loadReplacements(filePath: string, bootstrap: BootstrapPlan): ReplacementEntry[] {
  const input = readJson<ReplacementFile>(filePath);
  if (input.schemaVersion !== 1 || input.replacements.length !== EXPECTED_GARDEN_COUNT) {
    throw new Error(`Replacement file must contain exactly ${EXPECTED_GARDEN_COUNT} entries`);
  }
  const byGarden = new Map(input.replacements.map((entry) => [getAddress(entry.garden), entry]));
  if (byGarden.size !== EXPECTED_GARDEN_COUNT) throw new Error("Replacement file contains duplicate Gardens");
  const replacements = bootstrap.entries.map((entry) => {
    const replacement = byGarden.get(getAddress(entry.garden));
    if (!replacement || getAddress(replacement.safe) !== getAddress(entry.safe)) {
      throw new Error(`Replacement mapping is missing exact Safe ${entry.safe}`);
    }
    const owner = getAddress(replacement.replacementOwner);
    if (
      owner === ZeroAddress ||
      owner === getAddress(bootstrap.sender) ||
      owner === getAddress(bootstrap.recoverySafe) ||
      owner === getAddress(entry.safe)
    ) {
      throw new Error(`Garden ${entry.garden} has invalid replacement owner ${owner}`);
    }
    return { garden: getAddress(entry.garden), safe: getAddress(entry.safe), replacementOwner: owner };
  });
  assertUniqueReplacementOwners(replacements);
  return replacements;
}

export function assertUniqueReplacementOwners(replacements: ReplacementEntry[]): void {
  const owners = new Set(replacements.map((entry) => getAddress(entry.replacementOwner)));
  if (owners.size !== replacements.length) throw new Error("Replacement file reuses one replacement owner");
}

async function buildSwapPlan(
  bootstrapPath: string,
  inventoryPath: string,
  replacementsPath: string,
): Promise<SwapPlan> {
  const bootstrap = readJson<BootstrapPlan>(bootstrapPath);
  validateBootstrapPlan(bootstrap, inventoryPath);
  const replacements = loadReplacements(replacementsPath, bootstrap);
  const { provider, finalizedBlock } = await providerAndBlock();
  await verifyCompleteBootstrapEvidence(provider, bootstrapPath, bootstrap);
  const expectedNonce = await provider.getTransactionCount(bootstrap.sender, "pending");
  const blockers: string[] = [];
  const entries: SwapEntry[] = [];
  for (const [offset, replacement] of replacements.entries()) {
    const observed = await inspectSafe(provider, replacement.safe, bootstrap.canonicalToken, finalizedBlock);
    let state: SwapEntry["state"];
    let predecessor = ZeroAddress;
    let data = "0x";
    if (sameOwnerSet(observed.owners, [bootstrap.sender, bootstrap.recoverySafe])) {
      state = "READY";
      try {
        assertBootstrapState(
          observed,
          bootstrap.sender,
          bootstrap.recoverySafe,
          bootstrap.singleton,
          bootstrap.compatibilityFallbackHandler,
        );
        const built = buildSwapExecutionData(
          replacement.safe,
          observed.owners,
          bootstrap.sender,
          replacement.replacementOwner,
        );
        predecessor = built.previousOwner;
        data = built.data;
      } catch (error) {
        blockers.push(`${replacement.safe}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (sameOwnerSet(observed.owners, [replacement.replacementOwner, bootstrap.recoverySafe])) {
      state = "SWAPPED";
      try {
        assertSwappedState(
          observed,
          replacement.replacementOwner,
          bootstrap.recoverySafe,
          bootstrap.singleton,
          bootstrap.compatibilityFallbackHandler,
        );
      } catch (error) {
        blockers.push(`${replacement.safe}: ${error instanceof Error ? error.message : String(error)}`);
      }
      predecessor = SAFE_SENTINEL;
      data = "0x";
    } else {
      state = "READY";
      blockers.push(`${replacement.safe}: unexpected owner set before swap`);
    }
    entries.push({
      index: offset + 1,
      garden: replacement.garden,
      safe: replacement.safe,
      oldOwner: bootstrap.sender,
      replacementOwner: replacement.replacementOwner,
      recoverySafe: bootstrap.recoverySafe,
      previousOwner: predecessor,
      expectedSafeNonce: observed.nonce,
      transaction: { to: replacement.safe, value: "0", data, nonce: expectedNonce + offset },
      observed,
      state,
    });
  }
  return {
    schemaVersion: 1,
    kind: "GARDEN_SAFE_OWNER_SWAP",
    generatedAt: new Date().toISOString(),
    releaseId: bootstrap.releaseId,
    releaseManifestHash: bootstrap.releaseManifestHash,
    releaseSourceCommit: bootstrap.releaseSourceCommit,
    bootstrapPlanHash: hashFileContent(bootstrapPath),
    replacementsHash: hashFileContent(replacementsPath),
    chainId: CELO_CHAIN_ID,
    finalizedBlock,
    expectedNonce,
    sender: bootstrap.sender,
    recoverySafe: bootstrap.recoverySafe,
    singleton: bootstrap.singleton,
    compatibilityFallbackHandler: bootstrap.compatibilityFallbackHandler,
    canonicalToken: bootstrap.canonicalToken,
    authorityEnabled: false,
    entries,
    blockers,
  };
}

function validateSwapPlan(
  plan: SwapPlan,
  bootstrapPath: string,
  inventoryPath: string,
  replacementsPath: string,
): void {
  const bootstrap = readJson<BootstrapPlan>(bootstrapPath);
  validateBootstrapPlan(bootstrap, inventoryPath);
  const replacements = loadReplacements(replacementsPath, bootstrap);
  if (
    plan.schemaVersion !== 1 ||
    plan.kind !== "GARDEN_SAFE_OWNER_SWAP" ||
    plan.chainId !== CELO_CHAIN_ID ||
    plan.releaseManifestHash !== bootstrap.releaseManifestHash ||
    plan.releaseSourceCommit !== bootstrap.releaseSourceCommit ||
    plan.bootstrapPlanHash !== hashFileContent(bootstrapPath) ||
    plan.replacementsHash !== hashFileContent(replacementsPath) ||
    plan.authorityEnabled !== false ||
    plan.entries.length !== EXPECTED_GARDEN_COUNT
  ) {
    throw new Error("Swap plan is not bound to the reviewed bootstrap and replacement artifacts");
  }
  if (
    getAddress(plan.sender) !== getAddress(bootstrap.sender) ||
    getAddress(plan.recoverySafe) !== getAddress(bootstrap.recoverySafe) ||
    getAddress(plan.singleton) !== getAddress(bootstrap.singleton) ||
    getAddress(plan.compatibilityFallbackHandler) !== getAddress(bootstrap.compatibilityFallbackHandler) ||
    getAddress(plan.canonicalToken) !== getAddress(bootstrap.canonicalToken)
  ) {
    throw new Error("Swap plan Safe identities differ from the reviewed bootstrap plan");
  }
  for (const [offset, entry] of plan.entries.entries()) {
    const replacement = replacements[offset];
    if (
      entry.index !== offset + 1 ||
      getAddress(entry.garden) !== replacement.garden ||
      getAddress(entry.safe) !== replacement.safe ||
      getAddress(entry.oldOwner) !== getAddress(plan.sender) ||
      getAddress(entry.replacementOwner) !== replacement.replacementOwner ||
      getAddress(entry.recoverySafe) !== getAddress(plan.recoverySafe) ||
      entry.expectedSafeNonce !== entry.observed.nonce ||
      entry.transaction.to !== replacement.safe ||
      entry.transaction.value !== "0" ||
      entry.transaction.nonce !== plan.expectedNonce + offset
    ) {
      throw new Error(`Swap plan boundary ${offset + 1} was modified`);
    }
    if (entry.state === "READY") {
      assertBootstrapState(
        entry.observed,
        plan.sender,
        plan.recoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
      const built = buildSwapExecutionData(entry.safe, entry.observed.owners, plan.sender, entry.replacementOwner);
      if (entry.previousOwner !== built.previousOwner || entry.transaction.data !== built.data) {
        throw new Error(`Swap plan calldata ${offset + 1} was modified`);
      }
    } else if (entry.state === "SWAPPED") {
      assertSwappedState(
        entry.observed,
        entry.replacementOwner,
        plan.recoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
      if (entry.transaction.data !== "0x") throw new Error(`Completed swap boundary ${offset + 1} has calldata`);
    } else {
      throw new Error(`Swap plan boundary ${offset + 1} has invalid state`);
    }
  }
  if (plan.blockers.length > 0) throw new Error(`Swap plan is blocked: ${plan.blockers.join("; ")}`);
}

function checkpointPath(planPath: string): string {
  return planPath.replace(/\.json$/u, ".checkpoint.json");
}

function loadCheckpoint(planPath: string): Checkpoint {
  const filePath = checkpointPath(planPath);
  const planHash = hashFileContent(planPath);
  if (!fs.existsSync(filePath)) return { schemaVersion: 1, planHash, completed: [] };
  const checkpoint = readJson<Checkpoint>(filePath);
  if (checkpoint.schemaVersion !== 1 || checkpoint.planHash !== planHash) {
    throw new Error("Checkpoint does not belong to the exact reviewed plan");
  }
  for (const [offset, entry] of checkpoint.completed.entries()) {
    if (entry.index !== offset + 1) throw new Error("Checkpoint must be a contiguous boundary prefix");
  }
  return checkpoint;
}

function writeCheckpoint(planPath: string, checkpoint: Checkpoint): void {
  atomicWrite(checkpointPath(planPath), checkpoint);
}

function assertCheckpointRecord(
  recorded: CheckpointEntry,
  entry: { index: number; safe: string; garden: string },
): void {
  if (
    recorded.index !== entry.index ||
    getAddress(recorded.safe) !== getAddress(entry.safe) ||
    getAddress(recorded.garden) !== getAddress(entry.garden) ||
    !/^0x[0-9a-f]{64}$/iu.test(recorded.transactionHash) ||
    !Number.isSafeInteger(recorded.blockNumber) ||
    recorded.blockNumber < 1
  ) {
    throw new Error(`Checkpoint evidence for boundary ${entry.index} was modified`);
  }
}

function foundryCredentialArgs(): string[] {
  const account = process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? "green-goods-deployer";
  const passwordFile = process.env.ETH_PASSWORD;
  if (!passwordFile || !fs.existsSync(passwordFile)) {
    throw new Error("Broadcast requires the release operator's temporary ETH_PASSWORD file");
  }
  return ["--account", account, "--password-file", passwordFile];
}

function sendTransaction(to: string, data: string, nonce: number, rpcUrl: string): string {
  const output = execCastCaptured(
    [
      "send",
      getAddress(to),
      "--data",
      data,
      "--value",
      "0",
      "--nonce",
      String(nonce),
      "--chain",
      String(CELO_CHAIN_ID),
      "--rpc-url",
      rpcUrl,
      ...foundryCredentialArgs(),
      "--json",
    ],
    { cwd: CONTRACTS_ROOT, env: process.env },
    "Garden Safe boundary",
  );
  return parseCastTransactionHash(output, "Garden Safe boundary");
}

export async function verifyReceipt(
  provider: JsonRpcProvider,
  transactionHash: string,
  sender: string,
  transaction: { to: string; value: "0"; data: string; nonce: number },
  retryOptions: { attempts?: number; wait?: (milliseconds: number) => Promise<void> } = {},
): Promise<{ blockNumber: number }> {
  const { receipt, live } = await retryRpcAvailability(
    async () => {
      const [receipt, live] = await Promise.all([
        provider.getTransactionReceipt(transactionHash),
        provider.getTransaction(transactionHash),
      ]);
      return receipt && live ? { receipt, live } : undefined;
    },
    { ...retryOptions, unavailableMessage: `Transaction ${transactionHash} remained unavailable` },
  );
  if (receipt.status !== 1) throw new Error(`Transaction ${transactionHash} failed`);
  if (
    getAddress(live.from) !== getAddress(sender) ||
    getAddress(live.to ?? ZeroAddress) !== getAddress(transaction.to) ||
    live.data !== transaction.data ||
    live.value !== 0n ||
    live.nonce !== transaction.nonce
  ) {
    throw new Error(`Transaction ${transactionHash} does not match the reviewed boundary`);
  }
  return { blockNumber: receipt.blockNumber };
}

async function assertLiveBootstrapDependencies(provider: JsonRpcProvider, plan: BootstrapPlan): Promise<void> {
  const [singletonCode, factoryCode, handlerCode, tokenCode, recoveryInspection] = await Promise.all([
    provider.getCode(plan.singleton, "latest"),
    provider.getCode(plan.factory, "latest"),
    provider.getCode(plan.compatibilityFallbackHandler, "latest"),
    provider.getCode(plan.canonicalToken, "latest"),
    inspectSafe(provider, plan.recoverySafe, plan.canonicalToken, "latest"),
  ]);
  const liveHashes = {
    singleton: keccak256(singletonCode),
    factory: keccak256(factoryCode),
    compatibilityFallbackHandler: keccak256(handlerCode),
    canonicalToken: keccak256(tokenCode),
  };
  for (const [name, expected] of Object.entries(plan.dependencyCodeHashes)) {
    if (liveHashes[name as keyof typeof liveHashes] !== expected) {
      throw new Error(`Live ${name} code differs from the reviewed bootstrap plan`);
    }
  }
  if (
    !recoveryInspection.codePresent ||
    recoveryInspection.version !== plan.recoverySafeInspection.version ||
    recoveryInspection.singleton !== plan.recoverySafeInspection.singleton ||
    recoveryInspection.threshold !== "2" ||
    !sameOwnerSet(recoveryInspection.owners, plan.recoverySafeInspection.owners) ||
    recoveryInspection.modules.length !== 0 ||
    recoveryInspection.guard !== ZeroAddress ||
    recoveryInspection.fallbackHandler !== plan.recoverySafeInspection.fallbackHandler
  ) {
    throw new Error("Garden recovery Safe configuration changed after bootstrap planning");
  }
  const factory = new Contract(plan.factory, FACTORY_INTERFACE, provider);
  const proxyCreationCode = (await factory.proxyCreationCode()) as string;
  for (const entry of plan.entries) {
    const predicted = predictSafeAddress(
      plan.factory,
      plan.singleton,
      proxyCreationCode,
      entry.initializer,
      BigInt(entry.saltNonce),
    );
    if (predicted !== getAddress(entry.safe)) {
      throw new Error(`Safe ${entry.safe} is not the live factory prediction for Garden ${entry.garden}`);
    }
  }
}

async function verifyCompleteBootstrapEvidence(
  provider: JsonRpcProvider,
  planPath: string,
  plan: BootstrapPlan,
): Promise<void> {
  const checkpoint = loadCheckpoint(planPath);
  if (checkpoint.completed.length !== plan.entries.length) {
    throw new Error(`Owner swap requires all ${plan.entries.length} bootstrap receipts`);
  }
  for (const [index, entry] of plan.entries.entries()) {
    const recorded = checkpoint.completed[index];
    assertCheckpointRecord(recorded, entry);
    await verifyReceipt(provider, recorded.transactionHash, plan.sender, entry.transaction);
  }
}

export function buildBootstrapDeploymentArtifact(plan: BootstrapPlan, checkpoint: Checkpoint): unknown {
  return {
    schemaVersion: 1,
    stage: "temporary-empty-bootstrap",
    chainId: CELO_CHAIN_ID,
    releaseId: plan.releaseId,
    sourceCommit: plan.releaseSourceCommit,
    authorityEnabled: false,
    ownerPolicy: "1-of-2 deployment EOA plus 2-of-3 recovery Safe; no value or modules",
    singleton: plan.singleton,
    factory: plan.factory,
    compatibilityFallbackHandler: plan.compatibilityFallbackHandler,
    recoverySafe: plan.recoverySafe,
    safes: plan.entries.map((entry, index) => ({
      tokenId: entry.tokenId,
      garden: entry.garden,
      safe: entry.safe,
      owners: entry.owners,
      threshold: entry.threshold,
      initializerHash: entry.initializerHash,
      saltNonce: entry.saltNonce,
      deployment: checkpoint.completed[index],
    })),
  };
}

export function buildSwappedDeploymentArtifact(
  plan: SwapPlan,
  bootstrap: BootstrapPlan,
  bootstrapCheckpoint: Checkpoint,
  swapCheckpoint: Checkpoint,
): unknown {
  if (
    bootstrapCheckpoint.completed.length !== bootstrap.entries.length ||
    swapCheckpoint.completed.length !== plan.entries.length
  ) {
    throw new Error("Post-swap deployment artifact requires complete bootstrap and swap evidence");
  }
  return {
    schemaVersion: 1,
    stage: "reviewed-owner-swap-complete",
    chainId: CELO_CHAIN_ID,
    releaseId: plan.releaseId,
    sourceCommit: plan.releaseSourceCommit,
    authorityEnabled: false,
    ownerPolicy: "1-of-2 unique per-Garden owner plus 2-of-3 recovery Safe; no value or modules",
    singleton: plan.singleton,
    factory: bootstrap.factory,
    compatibilityFallbackHandler: plan.compatibilityFallbackHandler,
    recoverySafe: plan.recoverySafe,
    safes: plan.entries.map((entry, index) => ({
      tokenId: bootstrap.entries[index].tokenId,
      garden: entry.garden,
      safe: entry.safe,
      owners: normalizedOwners([entry.replacementOwner, plan.recoverySafe]),
      threshold: "1",
      initializerHash: bootstrap.entries[index].initializerHash,
      saltNonce: bootstrap.entries[index].saltNonce,
      deployment: bootstrapCheckpoint.completed[index],
      ownerSwap: swapCheckpoint.completed[index],
    })),
  };
}

async function executeBootstrap(
  planPath: string,
  inventoryPath: string,
  recoveryReceipt?: string,
  recoveryStep?: number,
): Promise<void> {
  const plan = readJson<BootstrapPlan>(planPath);
  validateBootstrapPlan(plan, inventoryPath);
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  const source = await sourceProviderAndBlock(networkManager);
  await assertLiveSourceInventory(source.provider, source.finalizedBlock, inventoryPath, inventory);
  await assertLiveBootstrapDependencies(provider, plan);
  const checkpoint = loadCheckpoint(planPath);
  if (recoveryStep !== undefined && recoveryStep !== checkpoint.completed.length + 1) {
    throw new Error(`Receipt recovery must target the next boundary ${checkpoint.completed.length + 1}`);
  }
  for (const entry of plan.entries) {
    if (entry.index <= checkpoint.completed.length) {
      const recorded = checkpoint.completed[entry.index - 1];
      assertCheckpointRecord(recorded, entry);
      await verifyReceipt(provider, recorded.transactionHash, plan.sender, entry.transaction);
      assertBootstrapState(
        await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
        plan.sender,
        plan.recoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
      continue;
    }
    const observed = await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest");
    let transactionHash: string;
    if (observed.codePresent) {
      assertBootstrapState(observed, plan.sender, plan.recoverySafe, plan.singleton, plan.compatibilityFallbackHandler);
      if (recoveryStep !== entry.index || !recoveryReceipt) {
        throw new Error(
          `Safe ${entry.safe} exists without checkpoint evidence; recover boundary ${entry.index} with --receipt`,
        );
      }
      transactionHash = recoveryReceipt;
    } else {
      if (!emptyAndUnmodified(observed)) throw new Error(`Counterfactual Safe ${entry.safe} is prefunded`);
      const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
      if (pendingNonce !== entry.transaction.nonce) {
        throw new Error(
          `Boundary ${entry.index} expected deployer nonce ${entry.transaction.nonce}, live ${pendingNonce}`,
        );
      }
      transactionHash = sendTransaction(
        entry.transaction.to,
        entry.transaction.data,
        entry.transaction.nonce,
        networkManager.getRpcUrl("celo"),
      );
    }
    const receipt = await verifyReceipt(provider, transactionHash, plan.sender, entry.transaction);
    assertBootstrapState(
      await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
      plan.sender,
      plan.recoverySafe,
      plan.singleton,
      plan.compatibilityFallbackHandler,
    );
    checkpoint.completed.push({
      index: entry.index,
      transactionHash,
      blockNumber: receipt.blockNumber,
      safe: entry.safe,
      garden: entry.garden,
    });
    writeCheckpoint(planPath, checkpoint);
  }
  atomicWrite(DEPLOYMENT_ARTIFACT, buildBootstrapDeploymentArtifact(plan, checkpoint));
  console.log(`Verified ${checkpoint.completed.length}/${plan.entries.length} empty Garden Safe bootstraps.`);
}

async function executeSwap(
  planPath: string,
  bootstrapPath: string,
  inventoryPath: string,
  replacementsPath: string,
  recoveryReceipt?: string,
  recoveryStep?: number,
): Promise<void> {
  const plan = readJson<SwapPlan>(planPath);
  validateSwapPlan(plan, bootstrapPath, inventoryPath, replacementsPath);
  const bootstrap = readJson<BootstrapPlan>(bootstrapPath);
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  await assertLiveBootstrapDependencies(provider, bootstrap);
  await verifyCompleteBootstrapEvidence(provider, bootstrapPath, bootstrap);
  const checkpoint = loadCheckpoint(planPath);
  if (recoveryStep !== undefined && recoveryStep !== checkpoint.completed.length + 1) {
    throw new Error(`Receipt recovery must target the next boundary ${checkpoint.completed.length + 1}`);
  }
  for (const entry of plan.entries) {
    if (entry.index <= checkpoint.completed.length) {
      const recorded = checkpoint.completed[entry.index - 1];
      assertCheckpointRecord(recorded, entry);
      await verifyReceipt(provider, recorded.transactionHash, plan.sender, entry.transaction);
      assertSwappedState(
        await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
        entry.replacementOwner,
        plan.recoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
      continue;
    }
    const observed = await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest");
    let transactionHash: string;
    if (sameOwnerSet(observed.owners, [entry.replacementOwner, plan.recoverySafe])) {
      assertSwappedState(
        observed,
        entry.replacementOwner,
        plan.recoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
      if (recoveryStep !== entry.index || !recoveryReceipt) {
        throw new Error(`Safe ${entry.safe} is swapped without checkpoint evidence; recover boundary ${entry.index}`);
      }
      transactionHash = recoveryReceipt;
    } else {
      assertBootstrapState(observed, plan.sender, plan.recoverySafe, plan.singleton, plan.compatibilityFallbackHandler);
      if (observed.nonce !== entry.expectedSafeNonce) {
        throw new Error(`Safe ${entry.safe} nonce changed from ${entry.expectedSafeNonce} to ${observed.nonce}`);
      }
      const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
      if (pendingNonce !== entry.transaction.nonce) {
        throw new Error(
          `Boundary ${entry.index} expected deployer nonce ${entry.transaction.nonce}, live ${pendingNonce}`,
        );
      }
      transactionHash = sendTransaction(
        entry.transaction.to,
        entry.transaction.data,
        entry.transaction.nonce,
        networkManager.getRpcUrl("celo"),
      );
    }
    const receipt = await verifyReceipt(provider, transactionHash, plan.sender, entry.transaction);
    assertSwappedState(
      await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
      entry.replacementOwner,
      plan.recoverySafe,
      plan.singleton,
      plan.compatibilityFallbackHandler,
    );
    checkpoint.completed.push({
      index: entry.index,
      transactionHash,
      blockNumber: receipt.blockNumber,
      safe: entry.safe,
      garden: entry.garden,
    });
    writeCheckpoint(planPath, checkpoint);
  }
  const bootstrapCheckpoint = loadCheckpoint(bootstrapPath);
  atomicWrite(DEPLOYMENT_ARTIFACT, buildSwappedDeploymentArtifact(plan, bootstrap, bootstrapCheckpoint, checkpoint));
  console.log(`Verified ${checkpoint.completed.length}/${plan.entries.length} deployer-owner swaps.`);
}

function printPlanSummary(planPath: string, plan: BootstrapPlan | SwapPlan): void {
  console.log(
    stable({
      kind: plan.kind,
      chainId: plan.chainId,
      finalizedBlock: plan.finalizedBlock,
      sender: plan.sender,
      recoverySafe: plan.recoverySafe,
      boundaries: plan.entries.length,
      blockers: plan.blockers,
      planPath,
    }),
  );
}

async function main(args: string[]): Promise<void> {
  const options = parseArguments(args);
  if (options.command === "plan") {
    const plan = await buildBootstrapPlan(options.inventoryPath);
    atomicWrite(options.planPath, plan);
    printPlanSummary(options.planPath, plan);
    if (plan.blockers.length > 0) throw new Error(`Bootstrap planning failed: ${plan.blockers.join("; ")}`);
    return;
  }
  if (options.command === "deploy") {
    await executeBootstrap(options.planPath, options.inventoryPath, options.recoveryReceipt, options.recoveryStep);
    return;
  }
  if (options.command === "swap-plan") {
    const bootstrapPath = confinedRuntimePath(DEFAULT_BOOTSTRAP_PLAN, "bootstrap plan");
    const plan = await buildSwapPlan(bootstrapPath, options.inventoryPath, options.replacementsPath);
    atomicWrite(options.planPath, plan);
    printPlanSummary(options.planPath, plan);
    if (plan.blockers.length > 0) throw new Error(`Swap planning failed: ${plan.blockers.join("; ")}`);
    return;
  }
  const bootstrapPath = confinedRuntimePath(DEFAULT_BOOTSTRAP_PLAN, "bootstrap plan");
  await executeSwap(
    options.planPath,
    bootstrapPath,
    options.inventoryPath,
    options.replacementsPath,
    options.recoveryReceipt,
    options.recoveryStep,
  );
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
