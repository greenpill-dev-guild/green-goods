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
  zeroPadValue,
} from "ethers";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { NetworkManager } from "../utils/network";
import { buildReleaseLock, loadReleaseManifest, type ReleaseManifest } from "../utils/release-manifest";
import { retryRpcAvailability } from "../utils/rpc-retry";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_INVENTORY = path.join(RUNTIME_ROOT, "42161-pool-backfill.json");
const DEFAULT_FINAL_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-final.json");
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
const SAFE_SINGLETON_V141 = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";
const SAFE_FACTORY_V141 = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const COMPATIBILITY_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";
const GREEN_GOODS_RECOVERY_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const DEV_GUILD_RECOVERY_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";
const SAFE_DOMAIN = "GG_COMMITMENT_POOL_SAFE_V1";

const OFFICIAL_CODE_HASHES = {
  singleton: "0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff",
  factory: "0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317",
  compatibilityFallbackHandler: "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9",
} as const;

const DEV_GUILD_REVIEWED_OWNERS = [
  "0x04D60647836bcA09c37B379550038BdaaFD82503",
  "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  "0xD2838aCb302F40E06f3FDC05f5b357034113262E",
] as const;

const SAFE_INTERFACE = new Interface([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)",
  "function VERSION() view returns (string)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)",
  "function nonce() view returns (uint256)",
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

type Command = "plan" | "verify" | "deploy";

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

export interface FinalSafeEntry {
  index: number;
  tokenId: number;
  garden: string;
  safe: string;
  owners: string[];
  threshold: "2";
  initializer: string;
  initializerHash: string;
  saltNonce: string;
  legacyPrediction: {
    safe: string;
    codePresent: boolean;
  };
  transaction: {
    to: string;
    value: "0";
    data: string;
    nonce: number;
  };
  observed: SafeInspection;
  state: "ABSENT" | "DEPLOYED";
}

export interface FinalSafePlan {
  schemaVersion: 2;
  kind: "GARDEN_SAFE_FINAL";
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
  greenGoodsRecoverySafe: string;
  greenGoodsRecoveryInspection: SafeInspection;
  devGuildRecoverySafe: string;
  devGuildRecoveryInspection: SafeInspection;
  singleton: string;
  factory: string;
  compatibilityFallbackHandler: string;
  canonicalToken: string;
  dependencyCodeHashes: {
    singleton: string;
    factory: string;
    compatibilityFallbackHandler: string;
    canonicalToken: string;
    proxyCreationCode: string;
  };
  authorityEnabled: false;
  valueAssertion: {
    nativeBalance: "zero";
    canonicalTokenBalance: "zero";
    arbitraryTokenInventory: "not-enumerated";
  };
  entries: FinalSafeEntry[];
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
  if (!command || !["plan", "verify", "deploy"].includes(command)) {
    throw new Error("Use: garden-safe-owners.ts plan|verify|deploy [reviewed options]");
  }
  let inventoryPath = DEFAULT_INVENTORY;
  let planPath = DEFAULT_FINAL_PLAN;
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
    else if (argument === "--receipt") recoveryReceipt = value;
    else if (argument === "--step") {
      recoveryStep = Number(value);
      if (!Number.isSafeInteger(recoveryStep) || recoveryStep < 1 || recoveryStep > EXPECTED_GARDEN_COUNT) {
        throw new Error(`--step must be between 1 and ${EXPECTED_GARDEN_COUNT}`);
      }
    } else throw new Error(`Unknown argument: ${argument}`);
    index++;
  }
  if (recoveryReceipt !== undefined && recoveryStep === undefined) throw new Error("--receipt requires --step");
  if (command === "deploy" && !broadcast) throw new Error("deploy requires --broadcast");
  if (command === "deploy" && recoveryStep === undefined) {
    throw new Error("deploy requires one explicit --step boundary");
  }
  if ((command === "plan" || command === "verify") && broadcast) {
    throw new Error(`${command} does not accept --broadcast`);
  }
  if ((command === "plan" || command === "verify") && (recoveryReceipt !== undefined || recoveryStep !== undefined)) {
    throw new Error(`${command} does not accept --step or --receipt`);
  }
  return { command, inventoryPath, planPath, broadcast, recoveryReceipt, recoveryStep };
}

function normalizedOwners(owners: string[]): string[] {
  return owners.map(getAddress).sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()));
}

function sameOwnerSet(actual: string[], expected: string[]): boolean {
  const left = normalizedOwners(actual);
  const right = normalizedOwners(expected);
  return left.length === right.length && left.every((owner, index) => owner === right[index]);
}

export function deriveSaltNonce(garden: string): bigint {
  return BigInt(
    keccak256(
      AbiCoder.defaultAbiCoder().encode(["string", "uint64", "address"], [SAFE_DOMAIN, SOURCE_CHAIN_ID, garden]),
    ),
  );
}

export function buildFinalSafeInitializer(
  gardenAccount: string,
  greenGoodsRecoverySafe: string,
  devGuildRecoverySafe: string,
): string {
  const owners = normalizedOwners([gardenAccount, greenGoodsRecoverySafe, devGuildRecoverySafe]);
  if (owners.includes(ZeroAddress) || new Set(owners).size !== 3) {
    throw new Error("Final Garden Safe requires three unique owners and no zero address");
  }
  return SAFE_INTERFACE.encodeFunctionData("setup", [
    owners,
    2,
    ZeroAddress,
    "0x",
    COMPATIBILITY_FALLBACK_HANDLER,
    ZeroAddress,
    0,
    ZeroAddress,
  ]);
}

function buildLegacyBootstrapInitializer(deploymentOwner: string, recoverySafe: string): string {
  const owners = normalizedOwners([deploymentOwner, recoverySafe]);
  if (owners.includes(ZeroAddress) || new Set(owners).size !== 2) {
    throw new Error("Legacy bootstrap identity is invalid");
  }
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
  const [code, nativeBalance, tokenBalance] = await Promise.all([
    provider.getCode(address, blockTag),
    provider.getBalance(address, blockTag),
    token.balanceOf(address, { blockTag }) as Promise<bigint>,
  ]);
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
  const [singletonStorage, version, owners, threshold, modulesPage, guardStorage, fallbackStorage, nonce] =
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
    fallbackHandler: getAddress(dataSlice(fallbackStorage, 12)),
    nonce: String(nonce),
    nativeBalance: nativeBalance.toString(),
    tokenBalance: tokenBalance.toString(),
  };
}

export function assertRecoverySafeConfiguration(
  inspection: SafeInspection,
  singleton: string,
  fallbackHandler: string,
): void {
  const owners = normalizedOwners(inspection.owners);
  const threshold = Number(inspection.threshold);
  if (
    !inspection.codePresent ||
    inspection.singleton !== getAddress(singleton) ||
    inspection.version !== "1.4.1" ||
    !Number.isSafeInteger(threshold) ||
    threshold < 2 ||
    threshold > owners.length ||
    owners.length < 3 ||
    new Set(owners).size !== owners.length ||
    inspection.modules.length !== 0 ||
    inspection.guard !== ZeroAddress ||
    inspection.fallbackHandler !== getAddress(fallbackHandler)
  ) {
    throw new Error("Recovery owner is not the reviewed module-free Safe v1.4.1 configuration");
  }
}

function assertExpectedRecoverySafe(
  inspection: SafeInspection,
  expectedOwners: string[],
  expectedThreshold: string,
  singleton: string,
  fallbackHandler: string,
): void {
  assertRecoverySafeConfiguration(inspection, singleton, fallbackHandler);
  if (inspection.threshold !== expectedThreshold || !sameOwnerSet(inspection.owners, expectedOwners)) {
    throw new Error("Recovery owner does not match its frozen reviewed owner set and threshold");
  }
}

export function assertRecoverySafeMatchesPlan(
  inspection: SafeInspection,
  reviewedInspection: SafeInspection,
  singleton: string,
  fallbackHandler: string,
): void {
  assertRecoverySafeConfiguration(inspection, singleton, fallbackHandler);
  assertRecoverySafeConfiguration(reviewedInspection, singleton, fallbackHandler);
  if (
    inspection.version !== reviewedInspection.version ||
    inspection.singleton !== reviewedInspection.singleton ||
    inspection.threshold !== reviewedInspection.threshold ||
    inspection.nonce !== reviewedInspection.nonce ||
    !sameOwnerSet(inspection.owners, reviewedInspection.owners) ||
    inspection.fallbackHandler !== reviewedInspection.fallbackHandler
  ) {
    throw new Error("Recovery Safe configuration changed after final Safe planning");
  }
}

function canonicalBalancesAndConfigClear(inspection: SafeInspection): boolean {
  return (
    inspection.nativeBalance === "0" &&
    inspection.tokenBalance === "0" &&
    inspection.modules.length === 0 &&
    inspection.guard === ZeroAddress
  );
}

export function assertFinalSafeState(
  inspection: SafeInspection,
  gardenAccount: string,
  greenGoodsRecoverySafe: string,
  devGuildRecoverySafe: string,
  singleton: string,
  fallbackHandler: string,
): void {
  const expectedOwners = [gardenAccount, greenGoodsRecoverySafe, devGuildRecoverySafe];
  if (
    !inspection.codePresent ||
    inspection.singleton !== getAddress(singleton) ||
    inspection.version !== "1.4.1" ||
    inspection.threshold !== "2" ||
    inspection.nonce !== "0" ||
    inspection.owners.length !== 3 ||
    new Set(normalizedOwners(inspection.owners)).size !== 3 ||
    !sameOwnerSet(inspection.owners, expectedOwners) ||
    inspection.fallbackHandler !== getAddress(fallbackHandler) ||
    !canonicalBalancesAndConfigClear(inspection)
  ) {
    throw new Error("Garden Safe is not the exact native/G$-clear final 2-of-3 state");
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
      if (code === "0x") throw new Error(`Live Garden token ${entry.tokenId} has no account code`);
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

function expectedRecoveryInputs(manifest: ReleaseManifest): {
  greenGoodsOwners: string[];
  greenGoodsThreshold: string;
  devGuildOwners: string[];
  devGuildThreshold: string;
} {
  if (
    getAddress(manifest.ownership.protocolSafe) !== getAddress(GREEN_GOODS_RECOVERY_SAFE) ||
    getAddress(manifest.ownership.gardenRecoveryOwner) !== getAddress(DEV_GUILD_RECOVERY_SAFE)
  ) {
    throw new Error("Release manifest recovery identities differ from the human-frozen Celo Safes");
  }
  return {
    greenGoodsOwners: manifest.ownership.protocolSafeConfiguration.owners.map(getAddress),
    greenGoodsThreshold: manifest.ownership.protocolSafeConfiguration.threshold,
    devGuildOwners: DEV_GUILD_REVIEWED_OWNERS.map(getAddress),
    devGuildThreshold: "2",
  };
}

function officialDependencyBlockers(hashes: FinalSafePlan["dependencyCodeHashes"]): string[] {
  const blockers: string[] = [];
  if (hashes.singleton !== OFFICIAL_CODE_HASHES.singleton) blockers.push("Safe v1.4.1 singleton code hash drifted");
  if (hashes.factory !== OFFICIAL_CODE_HASHES.factory) blockers.push("Safe v1.4.1 factory code hash drifted");
  if (hashes.compatibilityFallbackHandler !== OFFICIAL_CODE_HASHES.compatibilityFallbackHandler) {
    blockers.push("Safe v1.4.1 compatibility handler code hash drifted");
  }
  if (hashes.canonicalToken === keccak256("0x")) blockers.push("Canonical G$ token has no code");
  return blockers;
}

async function buildFinalPlan(inventoryPath: string): Promise<FinalSafePlan> {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const recoveryInputs = expectedRecoveryInputs(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  const [{ provider, finalizedBlock }, source] = await Promise.all([providerAndBlock(), sourceProviderAndBlock()]);
  await assertLiveSourceInventory(source.provider, source.finalizedBlock, inventoryPath, inventory);
  const sender = getAddress(manifest.ownership.deploymentSender);
  const greenGoodsRecoverySafe = getAddress(manifest.ownership.protocolSafe);
  const devGuildRecoverySafe = getAddress(manifest.ownership.gardenRecoveryOwner);
  const singleton = getAddress(manifest.safeAuthority.safeSingleton);
  const factoryAddress = getAddress(manifest.safeAuthority.safeFactory);
  const canonicalToken = getAddress(manifest.safeAuthority.zodiacRoles.canonicalTarget as string);
  const handler = getAddress(COMPATIBILITY_FALLBACK_HANDLER);
  if (singleton !== getAddress(SAFE_SINGLETON_V141) || factoryAddress !== getAddress(SAFE_FACTORY_V141)) {
    throw new Error("Release manifest does not use official Safe v1.4.1 Celo identities");
  }
  const factory = new Contract(factoryAddress, FACTORY_INTERFACE, provider);
  const expectedNonce = await provider.getTransactionCount(sender, "pending");
  const [
    proxyCreationCode,
    greenGoodsRecoveryInspection,
    devGuildRecoveryInspection,
    singletonCode,
    factoryCode,
    handlerCode,
    tokenCode,
  ] = await Promise.all([
    factory.proxyCreationCode({ blockTag: finalizedBlock }) as Promise<string>,
    inspectSafe(provider, greenGoodsRecoverySafe, canonicalToken, finalizedBlock),
    inspectSafe(provider, devGuildRecoverySafe, canonicalToken, finalizedBlock),
    provider.getCode(singleton, finalizedBlock),
    provider.getCode(factoryAddress, finalizedBlock),
    provider.getCode(handler, finalizedBlock),
    provider.getCode(canonicalToken, finalizedBlock),
  ]);
  const dependencyCodeHashes = {
    singleton: keccak256(singletonCode),
    factory: keccak256(factoryCode),
    compatibilityFallbackHandler: keccak256(handlerCode),
    canonicalToken: keccak256(tokenCode),
    proxyCreationCode: keccak256(proxyCreationCode),
  };
  const blockers = officialDependencyBlockers(dependencyCodeHashes);
  try {
    assertExpectedRecoverySafe(
      greenGoodsRecoveryInspection,
      recoveryInputs.greenGoodsOwners,
      recoveryInputs.greenGoodsThreshold,
      singleton,
      handler,
    );
  } catch (error) {
    blockers.push(`Green Goods recovery Safe: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    assertExpectedRecoverySafe(
      devGuildRecoveryInspection,
      recoveryInputs.devGuildOwners,
      recoveryInputs.devGuildThreshold,
      singleton,
      handler,
    );
  } catch (error) {
    blockers.push(`Dev Guild recovery Safe: ${error instanceof Error ? error.message : String(error)}`);
  }
  const entries: FinalSafeEntry[] = [];
  for (const [offset, item] of inventory.entries()) {
    const garden = getAddress(item.garden);
    const initializer = buildFinalSafeInitializer(garden, greenGoodsRecoverySafe, devGuildRecoverySafe);
    const saltNonce = deriveSaltNonce(garden);
    const safe = predictSafeAddress(factoryAddress, singleton, proxyCreationCode, initializer, saltNonce);
    const legacyInitializer = buildLegacyBootstrapInitializer(sender, devGuildRecoverySafe);
    const legacySafe = predictSafeAddress(factoryAddress, singleton, proxyCreationCode, legacyInitializer, saltNonce);
    const [observed, legacyCode] = await Promise.all([
      inspectSafe(provider, safe, canonicalToken, finalizedBlock),
      provider.getCode(legacySafe, finalizedBlock),
    ]);
    if (legacyCode !== "0x") blockers.push(`Legacy 1-of-2 Safe ${legacySafe} already has code for Garden ${garden}`);
    let state: FinalSafeEntry["state"];
    if (!observed.codePresent) {
      state = "ABSENT";
      if (!canonicalBalancesAndConfigClear(observed)) {
        blockers.push(`Counterfactual final Safe ${safe} has native/G$ balance or configured authority`);
      }
    } else {
      state = "DEPLOYED";
      try {
        assertFinalSafeState(observed, garden, greenGoodsRecoverySafe, devGuildRecoverySafe, singleton, handler);
      } catch (error) {
        blockers.push(`${safe}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    entries.push({
      index: offset + 1,
      tokenId: item.tokenId,
      garden,
      safe,
      owners: normalizedOwners([garden, greenGoodsRecoverySafe, devGuildRecoverySafe]),
      threshold: "2",
      initializer,
      initializerHash: keccak256(initializer),
      saltNonce: saltNonce.toString(),
      legacyPrediction: { safe: legacySafe, codePresent: legacyCode !== "0x" },
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
    schemaVersion: 2,
    kind: "GARDEN_SAFE_FINAL",
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
    greenGoodsRecoverySafe,
    greenGoodsRecoveryInspection,
    devGuildRecoverySafe,
    devGuildRecoveryInspection,
    singleton,
    factory: factoryAddress,
    compatibilityFallbackHandler: handler,
    canonicalToken,
    dependencyCodeHashes,
    authorityEnabled: false,
    valueAssertion: {
      nativeBalance: "zero",
      canonicalTokenBalance: "zero",
      arbitraryTokenInventory: "not-enumerated",
    },
    entries,
    blockers,
  };
}

export function validateFinalSafePlan(plan: FinalSafePlan, inventoryPath: string): void {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const recoveryInputs = expectedRecoveryInputs(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  if (
    plan.schemaVersion !== 2 ||
    plan.kind !== "GARDEN_SAFE_FINAL" ||
    plan.chainId !== CELO_CHAIN_ID ||
    plan.releaseId !== manifest.releaseId ||
    plan.releaseManifestHash !== lock.manifestHash ||
    plan.releaseSourceCommit !== lock.sourceCommit ||
    plan.inventoryHash !== hashFileContent(inventoryPath) ||
    plan.sourceDeploymentHash !== hashFileContent(SOURCE_DEPLOYMENT) ||
    !Number.isSafeInteger(plan.sourceFinalizedBlock) ||
    plan.sourceFinalizedBlock < 1 ||
    plan.authorityEnabled !== false ||
    plan.valueAssertion?.nativeBalance !== "zero" ||
    plan.valueAssertion?.canonicalTokenBalance !== "zero" ||
    plan.valueAssertion?.arbitraryTokenInventory !== "not-enumerated" ||
    plan.entries.length !== EXPECTED_GARDEN_COUNT
  ) {
    throw new Error("Final Safe plan is not bound to the reviewed release and Garden inventory");
  }
  if (
    getAddress(plan.sender) !== getAddress(manifest.ownership.deploymentSender) ||
    getAddress(plan.greenGoodsRecoverySafe) !== getAddress(GREEN_GOODS_RECOVERY_SAFE) ||
    getAddress(plan.devGuildRecoverySafe) !== getAddress(DEV_GUILD_RECOVERY_SAFE) ||
    getAddress(plan.singleton) !== getAddress(SAFE_SINGLETON_V141) ||
    getAddress(plan.factory) !== getAddress(SAFE_FACTORY_V141) ||
    getAddress(plan.canonicalToken) !== getAddress(manifest.safeAuthority.zodiacRoles.canonicalTarget as string) ||
    getAddress(plan.compatibilityFallbackHandler) !== getAddress(COMPATIBILITY_FALLBACK_HANDLER)
  ) {
    throw new Error("Final Safe plan identities differ from the frozen release inputs");
  }
  assertExpectedRecoverySafe(
    plan.greenGoodsRecoveryInspection,
    recoveryInputs.greenGoodsOwners,
    recoveryInputs.greenGoodsThreshold,
    plan.singleton,
    plan.compatibilityFallbackHandler,
  );
  assertExpectedRecoverySafe(
    plan.devGuildRecoveryInspection,
    recoveryInputs.devGuildOwners,
    recoveryInputs.devGuildThreshold,
    plan.singleton,
    plan.compatibilityFallbackHandler,
  );
  const dependencyHashes = Object.values(plan.dependencyCodeHashes ?? {});
  if (dependencyHashes.length !== 5 || dependencyHashes.some((hash) => !/^0x[0-9a-f]{64}$/iu.test(hash))) {
    throw new Error("Final Safe plan dependency code hashes are incomplete");
  }
  const hashBlockers = officialDependencyBlockers(plan.dependencyCodeHashes);
  if (hashBlockers.length > 0) throw new Error(hashBlockers.join("; "));
  for (const [offset, entry] of plan.entries.entries()) {
    const inventoryEntry = inventory[offset];
    const initializer = buildFinalSafeInitializer(entry.garden, plan.greenGoodsRecoverySafe, plan.devGuildRecoverySafe);
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
      !sameOwnerSet(entry.owners, [entry.garden, plan.greenGoodsRecoverySafe, plan.devGuildRecoverySafe]) ||
      entry.threshold !== "2" ||
      entry.initializer !== initializer ||
      entry.initializerHash !== keccak256(initializer) ||
      entry.saltNonce !== saltNonce.toString() ||
      entry.legacyPrediction.codePresent ||
      getAddress(entry.legacyPrediction.safe) === getAddress(entry.safe) ||
      getAddress(entry.transaction.to) !== getAddress(plan.factory) ||
      entry.transaction.value !== "0" ||
      entry.transaction.data !== expectedData ||
      entry.transaction.nonce !== plan.expectedNonce + offset
    ) {
      throw new Error(`Final Safe plan boundary ${offset + 1} was modified`);
    }
    if (entry.state === "ABSENT") {
      if (entry.observed.codePresent || !canonicalBalancesAndConfigClear(entry.observed)) {
        throw new Error(`Final Safe plan boundary ${offset + 1} has invalid counterfactual state`);
      }
    } else if (entry.state === "DEPLOYED") {
      assertFinalSafeState(
        entry.observed,
        entry.garden,
        plan.greenGoodsRecoverySafe,
        plan.devGuildRecoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
    } else {
      throw new Error(`Final Safe plan boundary ${offset + 1} has invalid state`);
    }
  }
  if (plan.blockers.length > 0) throw new Error(`Final Safe plan is blocked: ${plan.blockers.join("; ")}`);
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
    throw new Error("Checkpoint does not belong to the exact reviewed final Safe plan");
  }
  for (const [offset, entry] of checkpoint.completed.entries()) {
    if (entry.index !== offset + 1) throw new Error("Checkpoint must be a contiguous boundary prefix");
  }
  return checkpoint;
}

function writeCheckpoint(planPath: string, checkpoint: Checkpoint): void {
  atomicWrite(checkpointPath(planPath), checkpoint);
}

export function assertNextBoundary(selected: number | undefined, completed: number, label: string): number {
  const nextBoundary = completed + 1;
  if (selected !== nextBoundary)
    throw new Error(`${label} must target the next uncheckpointed boundary ${nextBoundary}`);
  return selected;
}

function assertCheckpointRecord(recorded: CheckpointEntry, entry: FinalSafeEntry): void {
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

export function assertCheckpointReceiptBlock(recorded: CheckpointEntry, verifiedBlockNumber: number): void {
  if (recorded.blockNumber !== verifiedBlockNumber) {
    throw new Error(
      `Checkpoint boundary ${recorded.index} records block ${recorded.blockNumber}, verified receipt is block ${verifiedBlockNumber}`,
    );
  }
}

function foundryCredentialArgs(expectedCommit: string): string[] {
  if (process.env.GG_RELEASE_OPERATOR_SESSION !== expectedCommit) {
    throw new Error("Broadcast release-operator session does not match the reviewed commit");
  }
  const account = process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? "green-goods-deployer";
  const passwordFile = process.env.ETH_PASSWORD;
  if (!passwordFile || !fs.existsSync(passwordFile)) {
    throw new Error("Broadcast requires the release operator's temporary ETH_PASSWORD file");
  }
  return ["--account", account, "--password-file", passwordFile];
}

function sendTransaction(to: string, data: string, nonce: number, rpcUrl: string, expectedCommit: string): string {
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
      ...foundryCredentialArgs(expectedCommit),
      "--json",
    ],
    { cwd: CONTRACTS_ROOT, env: process.env },
    "Garden Safe final deployment boundary",
  );
  return parseCastTransactionHash(output, "Garden Safe final deployment boundary");
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

async function assertLiveFinalDependencies(provider: JsonRpcProvider, plan: FinalSafePlan): Promise<string> {
  const [singletonCode, factoryCode, handlerCode, tokenCode, greenGoodsInspection, devGuildInspection] =
    await Promise.all([
      provider.getCode(plan.singleton, "latest"),
      provider.getCode(plan.factory, "latest"),
      provider.getCode(plan.compatibilityFallbackHandler, "latest"),
      provider.getCode(plan.canonicalToken, "latest"),
      inspectSafe(provider, plan.greenGoodsRecoverySafe, plan.canonicalToken, "latest"),
      inspectSafe(provider, plan.devGuildRecoverySafe, plan.canonicalToken, "latest"),
    ]);
  const factory = new Contract(plan.factory, FACTORY_INTERFACE, provider);
  const proxyCreationCode = (await factory.proxyCreationCode()) as string;
  const liveHashes = {
    singleton: keccak256(singletonCode),
    factory: keccak256(factoryCode),
    compatibilityFallbackHandler: keccak256(handlerCode),
    canonicalToken: keccak256(tokenCode),
    proxyCreationCode: keccak256(proxyCreationCode),
  };
  for (const [name, expected] of Object.entries(plan.dependencyCodeHashes)) {
    if (liveHashes[name as keyof typeof liveHashes] !== expected) {
      throw new Error(`Live ${name} code differs from the reviewed final Safe plan`);
    }
  }
  assertRecoverySafeMatchesPlan(
    greenGoodsInspection,
    plan.greenGoodsRecoveryInspection,
    plan.singleton,
    plan.compatibilityFallbackHandler,
  );
  assertRecoverySafeMatchesPlan(
    devGuildInspection,
    plan.devGuildRecoveryInspection,
    plan.singleton,
    plan.compatibilityFallbackHandler,
  );
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
    if ((await provider.getCode(entry.legacyPrediction.safe, "latest")) !== "0x") {
      throw new Error(`Legacy 1-of-2 Safe ${entry.legacyPrediction.safe} now has code`);
    }
  }
  return proxyCreationCode;
}

async function verifyFinalPlan(planPath: string, inventoryPath: string): Promise<Checkpoint> {
  const plan = readJson<FinalSafePlan>(planPath);
  validateFinalSafePlan(plan, inventoryPath);
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  const source = await sourceProviderAndBlock(networkManager);
  await assertLiveSourceInventory(source.provider, source.finalizedBlock, inventoryPath, inventory);
  await assertLiveFinalDependencies(provider, plan);
  const checkpoint = loadCheckpoint(planPath);
  for (const [offset, entry] of plan.entries.entries()) {
    const observed = await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest");
    if (offset < checkpoint.completed.length) {
      const recorded = checkpoint.completed[offset];
      assertCheckpointRecord(recorded, entry);
      const receipt = await verifyReceipt(provider, recorded.transactionHash, plan.sender, entry.transaction);
      assertCheckpointReceiptBlock(recorded, receipt.blockNumber);
      assertFinalSafeState(
        observed,
        entry.garden,
        plan.greenGoodsRecoverySafe,
        plan.devGuildRecoverySafe,
        plan.singleton,
        plan.compatibilityFallbackHandler,
      );
    } else if (observed.codePresent) {
      throw new Error(`Final Safe ${entry.safe} exists without checkpoint evidence; recover its exact receipt`);
    } else if (!canonicalBalancesAndConfigClear(observed)) {
      throw new Error(`Counterfactual final Safe ${entry.safe} has native/G$ balance or configured authority`);
    }
  }
  return checkpoint;
}

export function buildFinalDeploymentArtifact(plan: FinalSafePlan, checkpoint: Checkpoint): unknown {
  if (checkpoint.completed.length !== plan.entries.length) {
    throw new Error("Final Safe deployment artifact requires complete receipt-backed evidence");
  }
  return {
    schemaVersion: 2,
    stage: "final-garden-account-ownership",
    chainId: CELO_CHAIN_ID,
    releaseId: plan.releaseId,
    sourceCommit: plan.releaseSourceCommit,
    authorityEnabled: false,
    ownerPolicy: "2-of-3 exact GardenAccount plus two reviewed recovery Safes; no modules or guard",
    valueAssertion: plan.valueAssertion,
    singleton: plan.singleton,
    factory: plan.factory,
    compatibilityFallbackHandler: plan.compatibilityFallbackHandler,
    recoverySafes: {
      greenGoods: plan.greenGoodsRecoverySafe,
      devGuild: plan.devGuildRecoverySafe,
    },
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

async function executeFinalDeployment(
  planPath: string,
  inventoryPath: string,
  recoveryReceipt?: string,
  boundaryStep?: number,
): Promise<void> {
  const plan = readJson<FinalSafePlan>(planPath);
  validateFinalSafePlan(plan, inventoryPath);
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const inventory = validateInventory(inventoryPath, manifest, lock.manifestHash);
  const source = await sourceProviderAndBlock(networkManager);
  await assertLiveSourceInventory(source.provider, source.finalizedBlock, inventoryPath, inventory);
  await assertLiveFinalDependencies(provider, plan);
  const checkpoint = loadCheckpoint(planPath);
  const selectedBoundary = assertNextBoundary(boundaryStep, checkpoint.completed.length, "Final Safe deployment");

  for (const entry of plan.entries.slice(0, checkpoint.completed.length)) {
    const recorded = checkpoint.completed[entry.index - 1];
    assertCheckpointRecord(recorded, entry);
    const receipt = await verifyReceipt(provider, recorded.transactionHash, plan.sender, entry.transaction);
    assertCheckpointReceiptBlock(recorded, receipt.blockNumber);
    assertFinalSafeState(
      await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
      entry.garden,
      plan.greenGoodsRecoverySafe,
      plan.devGuildRecoverySafe,
      plan.singleton,
      plan.compatibilityFallbackHandler,
    );
  }

  const entry = plan.entries[selectedBoundary - 1];
  const observed = await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest");
  let transactionHash: string;
  if (recoveryReceipt) {
    transactionHash = recoveryReceipt;
  } else if (observed.codePresent) {
    assertFinalSafeState(
      observed,
      entry.garden,
      plan.greenGoodsRecoverySafe,
      plan.devGuildRecoverySafe,
      plan.singleton,
      plan.compatibilityFallbackHandler,
    );
    throw new Error(`Final Safe ${entry.safe} exists without checkpoint evidence; recover with --receipt`);
  } else {
    if (!canonicalBalancesAndConfigClear(observed)) {
      throw new Error(`Counterfactual final Safe ${entry.safe} has native/G$ balance or configured authority`);
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
      plan.releaseSourceCommit,
    );
  }

  const receipt = await verifyReceipt(provider, transactionHash, plan.sender, entry.transaction);
  assertFinalSafeState(
    await inspectSafe(provider, entry.safe, plan.canonicalToken, "latest"),
    entry.garden,
    plan.greenGoodsRecoverySafe,
    plan.devGuildRecoverySafe,
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
  if (checkpoint.completed.length === plan.entries.length) {
    atomicWrite(DEPLOYMENT_ARTIFACT, buildFinalDeploymentArtifact(plan, checkpoint));
  }
  process.stdout.write(
    `Verified ${checkpoint.completed.length}/${plan.entries.length} final native/G$-clear Garden Safes; credential session must close before another boundary.\n`,
  );
}

function printPlanSummary(planPath: string, plan: FinalSafePlan): void {
  process.stdout.write(
    stable({
      kind: plan.kind,
      chainId: plan.chainId,
      finalizedBlock: plan.finalizedBlock,
      sender: plan.sender,
      recoverySafes: [plan.greenGoodsRecoverySafe, plan.devGuildRecoverySafe],
      boundaries: plan.entries.length,
      blockers: plan.blockers,
      planPath,
    }),
  );
}

async function main(args: string[]): Promise<void> {
  const options = parseArguments(args);
  if (options.command === "plan") {
    const plan = await buildFinalPlan(options.inventoryPath);
    atomicWrite(options.planPath, plan);
    printPlanSummary(options.planPath, plan);
    if (plan.blockers.length > 0) throw new Error(`Final Safe planning failed: ${plan.blockers.join("; ")}`);
    return;
  }
  if (options.command === "verify") {
    const plan = readJson<FinalSafePlan>(options.planPath);
    const checkpoint = await verifyFinalPlan(options.planPath, options.inventoryPath);
    printPlanSummary(options.planPath, plan);
    process.stdout.write(`Verified ${checkpoint.completed.length}/${plan.entries.length} receipt-backed boundaries.\n`);
    return;
  }
  await executeFinalDeployment(options.planPath, options.inventoryPath, options.recoveryReceipt, options.recoveryStep);
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
