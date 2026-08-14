#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  isAddress,
  keccak256,
  toUtf8Bytes,
  type TransactionReceipt,
  type TransactionResponse,
} from "ethers";
import { NetworkManager } from "../utils/network";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { retryRpcAvailability } from "../utils/rpc-retry";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { assertSepoliaGate } from "../utils/release-gate";
import { buildReleaseLock, loadReleaseManifest } from "../utils/release-manifest";

const CONTRACTS_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(CONTRACTS_ROOT, "../..");
const ROOT_ENV = path.join(REPO_ROOT, ".env");
const EXPECTED_GARDEN_COUNT = 18;
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const ERC1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SAFE_TRANSACTION_BOUNDARY_RULE =
  "Authorize and execute one direct Safe execTransaction payload, verify its receipt and post-state, then stop.";
const DEPLOYER_TRANSACTION_BOUNDARY_RULE =
  "Execute one direct deployer transaction, verify its receipt and post-state, then stop.";

dotenv.config({ path: ROOT_ENV });

const gardenTokenInterface = new Interface(["function ownerOf(uint256 tokenId) view returns (address)"]);
const registryInterface = new Interface([
  "function account(address implementation,bytes32 salt,uint256 chainId,address tokenContract,uint256 tokenId) view returns (address)",
]);
const moduleInterface = new Interface([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function setPaused(bool paused)",
  "function registerPool(address garden,uint8 poolType) returns (uint256 poolId)",
  "function protocolPoolId() view returns (uint256)",
  "function getPoolByGarden(address garden) view returns (uint256 poolId,(address garden,uint8 poolType,uint8 state,bool proofEnabled,bool settlementEnabled,string charterCID,uint256 openSeasonCycleId,address settlementAdapter,uint32 liveCommitmentCount,uint32 nonTerminalCycleCount) pool)",
]);
const integrationInterface = new Interface([
  "function commitmentPoolingModule() view returns (address)",
  "function commitmentModule() view returns (address)",
]);
const safeInterface = new Interface([
  "function nonce() view returns (uint256)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool success)",
  "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns (bytes32)",
  "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
]);

export interface GardenEnumeration {
  tokenId: number;
  garden: string;
  tokenOwner: string;
  codeHash: string;
}

export interface BackfillTransaction {
  index: number;
  kind: "UNPAUSE" | "REGISTER_PROTOCOL" | "REGISTER_GARDEN";
  garden?: string;
  tokenId?: number;
  nonce: number;
  to: string;
  value: "0";
  data: string;
  operation: 0;
  resumableState: string;
}

export interface PoolBackfillPlan {
  schemaVersion: 1;
  generatedAt: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  network: "arbitrum";
  chainId: 42161;
  finalizedBlock: number;
  module: string;
  moduleDeploymentPending: boolean;
  authority: "SAFE" | "DEPLOYER";
  owner: string;
  expectedNonce: number;
  gardenToken: string;
  gardenAccountImplementation: string;
  tokenboundRegistry: string;
  tokenboundSalt: string;
  rootGarden: string;
  rootTokenId: number;
  expectedGardenCount: 18;
  gardens: Record<string, GardenEnumeration & { status: "PLANNED" | "SKIPPED_PROTOCOL_ROOT" }>;
  transactions: BackfillTransaction[];
  transactionBoundaryRule: string;
  canonicalArtifactMutation: false;
}

interface BackfillOptions {
  network: string;
  dryRun: boolean;
  broadcast: boolean;
  overrideSepoliaGate: boolean;
  planPath?: string;
  step?: number;
  authority: "safe" | "deployer";
  expectedNonce?: number;
  expectedSafeNonce?: number;
  receiptHash?: string;
  help: boolean;
}

export interface BackfillCheckpoint {
  schemaVersion: 1;
  releaseId: string;
  releaseManifestHash: string;
  chainId: 42161;
  module: string;
  owner: string;
  planHash: string;
  activation: {
    status: "PLANNED" | "VERIFIED";
    transactionHash?: string;
    blockNumber?: number;
  };
  protocolRegistration: {
    rootGarden: string;
    status: "PLANNED" | "VERIFIED";
    poolId?: string;
    transactionHash?: string;
    blockNumber?: number;
  };
  gardens: Record<
    string,
    GardenEnumeration & {
      status: "PLANNED" | "SKIPPED_PROTOCOL_ROOT" | "REGISTERED";
      poolId?: string;
      transactionHash?: string;
      blockNumber?: number;
    }
  >;
  completed: Array<{
    step: number;
    nonce: number;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: string;
  }>;
}

function assertEvidenceMatch(
  label: string,
  status: "VERIFIED" | "REGISTERED" | string,
  transactionHash: string | undefined,
  blockNumber: number | undefined,
  evidence: BackfillCheckpoint["completed"][number] | undefined,
): void {
  if (
    !evidence ||
    (status !== "VERIFIED" && status !== "REGISTERED") ||
    transactionHash?.toLowerCase() !== evidence.transactionHash.toLowerCase() ||
    blockNumber !== evidence.blockNumber
  ) {
    throw new Error(`${label} does not match its verified receipt evidence`);
  }
}

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function requiredAddress(value: unknown, label: string): string {
  if (typeof value !== "string" || !isAddress(value) || /^0x0+$/iu.test(value)) {
    throw new Error(`${label} is missing or zero`);
  }
  return getAddress(value);
}

function safeNumber(value: bigint, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} is not a safe integer`);
  return number;
}

function parseInteger(value: string | undefined, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`${label} requires an integer >= ${minimum}`);
  return parsed;
}

function parseOptions(args: string[]): BackfillOptions {
  const options: BackfillOptions = {
    network: "arbitrum",
    dryRun: false,
    broadcast: false,
    overrideSepoliaGate: false,
    authority: "safe",
    help: false,
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--network":
        options.network = args[++index] ?? "";
        if (!options.network) throw new Error("--network requires a name");
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--broadcast":
        options.broadcast = true;
        break;
      case "--override-sepolia-gate":
        options.overrideSepoliaGate = true;
        break;
      case "--plan":
        options.planPath = args[++index];
        if (!options.planPath) throw new Error("--plan requires a path");
        break;
      case "--authority": {
        const authority = args[++index];
        if (authority !== "safe" && authority !== "deployer") {
          throw new Error("--authority requires safe or deployer");
        }
        options.authority = authority;
        break;
      }
      case "--step":
        options.step = parseInteger(args[++index], "--step", 1);
        break;
      case "--expected-nonce":
        options.expectedNonce = parseInteger(args[++index], "--expected-nonce", 0);
        break;
      case "--expected-safe-nonce":
        options.expectedSafeNonce = parseInteger(args[++index], "--expected-safe-nonce", 0);
        break;
      case "--receipt":
        options.receiptHash = args[++index];
        if (!options.receiptHash || !/^0x[0-9a-fA-F]{64}$/u.test(options.receiptHash)) {
          throw new Error("--receipt requires a transaction hash");
        }
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (options.broadcast && options.dryRun) throw new Error("--broadcast and --dry-run are mutually exclusive");
  return options;
}

function showHelp(): void {
  console.log(`
Commitment Pooling one-shot activation and pool backfill

Usage:
  bun script/deploy/backfill-pools.ts --network arbitrum --dry-run --authority deployer
  bun script/deploy/backfill-pools.ts --network arbitrum --broadcast \\
    --authority deployer --plan <reviewed-plan.json> --step <index> --expected-nonce <n>

Future Safe receipt verification remains available with:
  bun script/deploy/backfill-pools.ts --network arbitrum --broadcast --authority safe \\
    --plan <reviewed-plan.json> --step <index> --expected-safe-nonce <n> --receipt <safe-tx-hash>

The dry-run pins a finalized Arbitrum block, enumerates exactly 18 live GardenToken accounts,
requires the canonical root to round-trip as GardenToken token ID 0, and emits exact boundaries
that register the Protocol pool and every Garden pool while Commitment Pooling remains paused.
The current deployer ceremony executes registration boundaries 1-18. Unpause is boundary 19 and
remains a separate command after every registration receipt has been verified.

Broadcast is Phase B only. Deployer mode sends one reviewed direct transaction through the frozen
keystore session, then verifies its receipt and post-state before advancing the checkpoint. Safe
mode never holds or infers Safe signatures and verifies only an externally submitted exact
execTransaction receipt. Each invocation stops after one boundary.
`);
}

function readDeployment(chainId: number): Record<string, unknown> {
  const deploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Record<string, unknown>;
}

function frozenModuleAddress(): {
  address: string;
  implementation: string;
  implementationRuntimeHash?: string;
  immutableRuntime: boolean;
  manifestHash: string;
  releaseId: string;
  sourceCommit: string;
  deployer: string;
  safe: string;
} {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const module = lock.identities.find(
    (identity) =>
      identity.network === "arbitrum" && identity.name === "CommitmentPoolingModule" && identity.kind === "proxy",
  );
  if (!module) throw new Error("Frozen release lock has no CommitmentPoolingModule proxy");
  const implementation = lock.identities.find(
    (identity) =>
      identity.network === "arbitrum" &&
      identity.name === "CommitmentPoolingModule" &&
      identity.kind === "implementation",
  );
  if (!implementation) throw new Error("Frozen release lock has no CommitmentPoolingModule implementation");
  return {
    address: requiredAddress(module.address, "frozen CommitmentPoolingModule proxy"),
    implementation: requiredAddress(implementation.address, "frozen CommitmentPoolingModule implementation"),
    implementationRuntimeHash: implementation.immutableRuntime ? undefined : implementation.runtimeTemplateHash,
    immutableRuntime: implementation.immutableRuntime,
    manifestHash: lock.manifestHash,
    releaseId: manifest.releaseId,
    sourceCommit: lock.sourceCommit,
    deployer: requiredAddress(manifest.ownership.deploymentSender, "deployment sender"),
    safe: requiredAddress(manifest.ownership.protocolSafe, "protocol Safe"),
  };
}

function sortedGardens(plan: PoolBackfillPlan): GardenEnumeration[] {
  const entries = Object.entries(plan.gardens);
  if (entries.length !== EXPECTED_GARDEN_COUNT) {
    throw new Error(`Backfill plan must contain exactly ${EXPECTED_GARDEN_COUNT} garden records`);
  }
  return entries.map(([key, record]) => {
    const garden = requiredAddress(record.garden, `garden record ${key}`);
    if (key !== garden.toLowerCase()) throw new Error(`Garden record key ${key} is not its normalized account`);
    if (!Number.isSafeInteger(record.tokenId) || record.tokenId < 0) {
      throw new Error(`Garden ${garden} has an invalid token ID`);
    }
    requiredAddress(record.tokenOwner, `garden ${garden} token owner`);
    if (!/^0x[0-9a-fA-F]{64}$/u.test(record.codeHash)) throw new Error(`Garden ${garden} has an invalid code hash`);
    const root = garden === getAddress(plan.rootGarden);
    if (record.status !== (root ? "SKIPPED_PROTOCOL_ROOT" : "PLANNED")) {
      throw new Error(`Garden ${garden} has an invalid planned status`);
    }
    return { tokenId: record.tokenId, garden, tokenOwner: getAddress(record.tokenOwner), codeHash: record.codeHash };
  });
}

export function validateBackfillPlan(plan: PoolBackfillPlan): void {
  if (
    plan.schemaVersion !== 1 ||
    plan.network !== "arbitrum" ||
    plan.chainId !== 42161 ||
    plan.expectedGardenCount !== EXPECTED_GARDEN_COUNT ||
    plan.canonicalArtifactMutation !== false
  ) {
    throw new Error("Backfill plan has an unsupported schema, chain, count, or mutation policy");
  }
  if (
    typeof plan.moduleDeploymentPending !== "boolean" ||
    !/^0x[0-9a-fA-F]{64}$/u.test(plan.releaseManifestHash) ||
    !/^[0-9a-f]{40}$/u.test(plan.releaseSourceCommit)
  ) {
    throw new Error("Backfill plan release identity fields are invalid");
  }
  if (!Number.isSafeInteger(plan.finalizedBlock) || plan.finalizedBlock < 1) {
    throw new Error("Backfill plan finalized block is invalid");
  }
  if (!Number.isSafeInteger(plan.expectedNonce) || plan.expectedNonce < 0) {
    throw new Error("Backfill plan authority nonce is invalid");
  }
  if (!Number.isSafeInteger(plan.rootTokenId) || plan.rootTokenId < 0) {
    throw new Error("Backfill plan root token ID is invalid");
  }
  const module = requiredAddress(plan.module, "plan module");
  requiredAddress(plan.owner, "plan owner");
  requiredAddress(plan.gardenToken, "plan garden token");
  requiredAddress(plan.gardenAccountImplementation, "plan garden account implementation");
  if (
    getAddress(plan.tokenboundRegistry) !== getAddress(TOKENBOUND_REGISTRY) ||
    plan.tokenboundSalt !== TOKENBOUND_SALT
  ) {
    throw new Error("Backfill plan changes the canonical ERC-6551 derivation");
  }
  const expectedBoundaryRule =
    plan.authority === "SAFE"
      ? SAFE_TRANSACTION_BOUNDARY_RULE
      : plan.authority === "DEPLOYER"
        ? DEPLOYER_TRANSACTION_BOUNDARY_RULE
        : undefined;
  if (!expectedBoundaryRule || plan.transactionBoundaryRule !== expectedBoundaryRule) {
    throw new Error("Backfill plan changes the one-transaction boundary rule");
  }
  const rootGarden = requiredAddress(plan.rootGarden, "plan root garden");
  const gardens = sortedGardens(plan);
  const root = gardens.find((garden) => garden.garden === rootGarden);
  if (!root || root.tokenId !== plan.rootTokenId) throw new Error("Backfill plan root does not round-trip");
  const canonical = buildBackfillTransactions({
    module,
    rootGarden,
    gardens,
    startingNonce: plan.expectedNonce,
  });
  if (JSON.stringify(plan.transactions) !== JSON.stringify(canonical)) {
    throw new Error("Backfill plan transactions do not match the canonical root-first paused plan");
  }
}

export function validateCheckpointPrefix(
  checkpoint: BackfillCheckpoint,
  plan: PoolBackfillPlan,
  requestedStep: number,
): void {
  if (
    checkpoint.schemaVersion !== 1 ||
    checkpoint.releaseId !== plan.releaseId ||
    checkpoint.releaseManifestHash !== plan.releaseManifestHash ||
    checkpoint.chainId !== plan.chainId ||
    getAddress(checkpoint.module) !== getAddress(plan.module) ||
    getAddress(checkpoint.owner) !== getAddress(plan.owner)
  ) {
    throw new Error("Backfill checkpoint does not match the reviewed plan header");
  }
  const steps = checkpoint.completed.map((entry) => entry.step).sort((left, right) => left - right);
  if (new Set(steps).size !== steps.length) throw new Error("Backfill checkpoint contains duplicate boundaries");
  for (let index = 0; index < steps.length; index++) {
    if (steps[index] !== index + 1) throw new Error("Backfill checkpoint is not one contiguous verified prefix");
    const expected = plan.transactions[index];
    const evidence = checkpoint.completed.find((entry) => entry.step === index + 1)!;
    if (!expected || evidence.nonce !== expected.nonce) {
      throw new Error("Backfill checkpoint nonces do not match the reviewed plan");
    }
  }
  const alreadyVerified = steps.includes(requestedStep);
  if (requestedStep === plan.transactions.length) {
    const requiredLength = alreadyVerified ? plan.transactions.length : plan.transactions.length - 1;
    if (steps.length !== requiredLength) {
      throw new Error("Final unpause requires every registration boundary to be verified first");
    }
    if (checkpoint.protocolRegistration.status !== "VERIFIED") {
      throw new Error("Final unpause requires verified Protocol registration");
    }
    assertEvidenceMatch(
      "Protocol registration",
      checkpoint.protocolRegistration.status,
      checkpoint.protocolRegistration.transactionHash,
      checkpoint.protocolRegistration.blockNumber,
      checkpoint.completed.find((entry) => entry.step === 1),
    );
    const checkpointGardenKeys = Object.keys(checkpoint.gardens).sort();
    const planGardenKeys = Object.keys(plan.gardens).sort();
    if (JSON.stringify(checkpointGardenKeys) !== JSON.stringify(planGardenKeys)) {
      throw new Error("Backfill checkpoint Garden set does not match the reviewed plan");
    }
    for (const [garden, planned] of Object.entries(plan.gardens)) {
      const record = checkpoint.gardens[garden];
      if (
        !record ||
        record.tokenId !== planned.tokenId ||
        getAddress(record.garden) !== getAddress(planned.garden) ||
        getAddress(record.tokenOwner) !== getAddress(planned.tokenOwner) ||
        record.codeHash !== planned.codeHash
      ) {
        throw new Error(`Checkpoint Garden ${garden} differs from the reviewed plan`);
      }
      if (garden === plan.rootGarden.toLowerCase()) continue;
      if (record.status !== "REGISTERED") throw new Error(`Final unpause requires registered garden ${garden}`);
      if (!record.poolId || BigInt(record.poolId) === 0n) {
        throw new Error(`Final unpause requires a recorded pool ID for garden ${garden}`);
      }
      const boundary = plan.transactions.find((transaction) => transaction.garden?.toLowerCase() === garden);
      assertEvidenceMatch(
        `Garden registration ${garden}`,
        record.status,
        record.transactionHash,
        record.blockNumber,
        checkpoint.completed.find((entry) => entry.step === boundary?.index),
      );
    }
  }
  if ((!alreadyVerified && steps.length !== requestedStep - 1) || (alreadyVerified && steps.length < requestedStep)) {
    throw new Error(`Boundary ${requestedStep} is not the next boundary in the verified prefix`);
  }
}

export function buildBackfillTransactions(args: {
  module: string;
  rootGarden: string;
  gardens: GardenEnumeration[];
  startingNonce: number;
}): BackfillTransaction[] {
  const module = requiredAddress(args.module, "module");
  const rootGarden = requiredAddress(args.rootGarden, "root garden");
  if (args.gardens.length !== EXPECTED_GARDEN_COUNT) {
    throw new Error(`Expected exactly ${EXPECTED_GARDEN_COUNT} gardens, found ${args.gardens.length}`);
  }
  const normalized = new Set(args.gardens.map((garden) => getAddress(garden.garden).toLowerCase()));
  if (normalized.size !== EXPECTED_GARDEN_COUNT) throw new Error("Garden enumeration contains duplicate accounts");
  if (!normalized.has(rootGarden.toLowerCase()))
    throw new Error("Garden enumeration does not contain the canonical root");
  const tokenIds = new Set(args.gardens.map((garden) => garden.tokenId));
  if (tokenIds.size !== EXPECTED_GARDEN_COUNT) throw new Error("Garden enumeration contains duplicate token IDs");

  const ordered = [...args.gardens].sort((left, right) => left.tokenId - right.tokenId);
  const root = ordered.find((entry) => getAddress(entry.garden) === rootGarden)!;
  const registrations = [
    { kind: "REGISTER_PROTOCOL" as const, garden: rootGarden, tokenId: root.tokenId, poolType: 1 },
    ...ordered
      .filter((entry) => getAddress(entry.garden) !== rootGarden)
      .map((entry) => ({
        kind: "REGISTER_GARDEN" as const,
        garden: getAddress(entry.garden),
        tokenId: entry.tokenId,
        poolType: 0,
      })),
  ];
  const transactions: BackfillTransaction[] = registrations.map((registration, offset) => ({
    index: offset + 1,
    kind: registration.kind,
    garden: registration.garden,
    tokenId: registration.tokenId,
    nonce: args.startingNonce + offset,
    to: module,
    value: "0",
    data: moduleInterface.encodeFunctionData("registerPool", [registration.garden, registration.poolType]),
    operation: 0,
    resumableState: `Pool ${registration.garden} is registered with type ${registration.poolType} while the module remains paused`,
  }));
  transactions.push({
    index: transactions.length + 1,
    kind: "UNPAUSE",
    nonce: args.startingNonce + transactions.length,
    to: module,
    value: "0",
    data: moduleInterface.encodeFunctionData("setPaused", [false]),
    operation: 0,
    resumableState: "Every planned pool registration is receipt-verified before this separate unpause boundary",
  });
  return transactions;
}

async function enumerateGardens(
  provider: JsonRpcProvider,
  deployment: Record<string, unknown>,
  blockTag: number,
): Promise<GardenEnumeration[]> {
  const gardenToken = requiredAddress(deployment.gardenToken, "gardenToken");
  const implementation = requiredAddress(deployment.gardenAccountImpl, "gardenAccountImpl");
  const token = new Contract(gardenToken, gardenTokenInterface, provider);
  const registry = new Contract(TOKENBOUND_REGISTRY, registryInterface, provider);
  const gardens: GardenEnumeration[] = [];

  const maximumInventory = 256;
  for (let tokenId = 0; tokenId < maximumInventory; tokenId++) {
    let tokenOwner: string;
    try {
      tokenOwner = requiredAddress(await token.ownerOf(tokenId, { blockTag }), `ownerOf(${tokenId})`);
    } catch (error) {
      if (isContractCallRevert(error)) break;
      throw new Error(
        `Unable to enumerate Garden token ${tokenId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const garden = requiredAddress(
      await registry.account(implementation, TOKENBOUND_SALT, 42161, gardenToken, tokenId, { blockTag }),
      `garden account ${tokenId}`,
    );
    const code = await provider.getCode(garden, blockTag);
    if (code === "0x")
      throw new Error(`Garden account ${garden} for token ${tokenId} has no code at block ${blockTag}`);
    gardens.push({ tokenId, garden, tokenOwner, codeHash: keccak256(code) });
  }
  if (gardens.length === maximumInventory)
    throw new Error(`Garden inventory exceeded the bounded ${maximumInventory}-token scan`);
  return gardens;
}

export function isContractCallRevert(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "CALL_EXCEPTION");
}

async function readModulePreflight(
  provider: JsonRpcProvider,
  deployment: Record<string, unknown>,
  module: string,
  expectedOwner: string,
  blockTag: number,
): Promise<boolean> {
  const code = await provider.getCode(module, blockTag);
  if (code === "0x") return true;
  const pooling = new Contract(module, moduleInterface, provider);
  const owner = requiredAddress(await pooling.owner({ blockTag }), "pooling owner");
  if (owner !== getAddress(expectedOwner)) {
    throw new Error(`Pooling owner is ${owner}, expected reviewed owner ${expectedOwner}`);
  }
  if ((await pooling.paused({ blockTag })) !== true)
    throw new Error("Pooling must remain paused before activation planning");

  const gardenToken = requiredAddress(deployment.gardenToken, "gardenToken");
  const workApproval = requiredAddress(deployment.workApprovalResolver, "workApprovalResolver");
  const gardenLink = requiredAddress(
    await new Contract(gardenToken, integrationInterface, provider).commitmentPoolingModule({ blockTag }),
    "GardenToken commitmentPoolingModule",
  );
  const workLink = requiredAddress(
    await new Contract(workApproval, integrationInterface, provider).commitmentModule({ blockTag }),
    "WorkApprovalResolver commitmentModule",
  );
  if (gardenLink !== getAddress(module) || workLink !== getAddress(module)) {
    throw new Error("Both reverse integration links must equal the frozen pooling module before unpause planning");
  }
  await pooling.setPaused.staticCall(false, { from: expectedOwner, blockTag });
  return false;
}

async function assertFrozenModuleIdentity(
  provider: JsonRpcProvider,
  module: string,
  implementation: string,
  implementationRuntimeHash: string | undefined,
  blockTag: number,
): Promise<void> {
  if ((await provider.getCode(module, blockTag)) === "0x") throw new Error("Frozen pooling proxy has no code");
  const stored = await provider.getStorage(module, ERC1967_IMPLEMENTATION_SLOT, blockTag);
  const liveImplementation = getAddress(`0x${stored.slice(-40)}`);
  if (liveImplementation !== getAddress(implementation)) {
    throw new Error(`Pooling proxy implementation is ${liveImplementation}, expected ${implementation}`);
  }
  const code = await provider.getCode(liveImplementation, blockTag);
  if (code === "0x" || (implementationRuntimeHash && keccak256(code) !== implementationRuntimeHash)) {
    throw new Error("Pooling implementation runtime code does not match the frozen release lock");
  }
}

async function assertModuleConfiguration(
  provider: JsonRpcProvider,
  deployment: Record<string, unknown>,
  module: string,
  expectedOwner: string,
  blockTag: number,
  expectedPaused: boolean,
): Promise<void> {
  const pooling = new Contract(module, moduleInterface, provider);
  const owner = requiredAddress(await pooling.owner({ blockTag }), "pooling owner");
  if (owner !== getAddress(expectedOwner)) {
    throw new Error(`Pooling owner is ${owner}, expected reviewed owner ${expectedOwner}`);
  }
  if ((await pooling.paused({ blockTag })) !== expectedPaused) {
    throw new Error(
      `Pooling pause state does not match the reviewed ${expectedPaused ? "paused" : "unpaused"} boundary`,
    );
  }
  const gardenToken = requiredAddress(deployment.gardenToken, "gardenToken");
  const workApproval = requiredAddress(deployment.workApprovalResolver, "workApprovalResolver");
  const gardenLink = requiredAddress(
    await new Contract(gardenToken, integrationInterface, provider).commitmentPoolingModule({ blockTag }),
    "GardenToken commitmentPoolingModule",
  );
  const workLink = requiredAddress(
    await new Contract(workApproval, integrationInterface, provider).commitmentModule({ blockTag }),
    "WorkApprovalResolver commitmentModule",
  );
  if (gardenLink !== getAddress(module) || workLink !== getAddress(module)) {
    throw new Error("Both reverse integration links must equal the frozen pooling module");
  }
  if (expectedPaused) await pooling.setPaused.staticCall(false, { from: expectedOwner, blockTag });
}

function assertInventoryMatchesPlan(plan: PoolBackfillPlan, observed: GardenEnumeration[]): void {
  const expected = sortedGardens(plan).sort((left, right) => left.tokenId - right.tokenId);
  const actual = [...observed].sort((left, right) => left.tokenId - right.tokenId);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Live Garden inventory no longer matches the finalized reviewed backfill plan");
  }
}

async function buildPlan(options: BackfillOptions): Promise<{ plan: PoolBackfillPlan; outputPath: string }> {
  if (options.network !== "arbitrum") throw new Error("Pool backfill supports only --network arbitrum");
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("arbitrum"), 42161, { staticNetwork: true });
  const finalized = await provider.getBlock("finalized");
  if (!finalized) throw new Error("Arbitrum RPC returned no finalized block");
  const deployment = readDeployment(42161);
  const frozen = frozenModuleAddress();
  const gardens = await enumerateGardens(provider, deployment, finalized.number);
  const root = deployment.rootGarden as Record<string, unknown> | undefined;
  const rootGarden = requiredAddress(root?.address, "rootGarden.address");
  const rootTokenId = Number(root?.tokenId);
  if (!Number.isSafeInteger(rootTokenId) || rootTokenId < 0) throw new Error("rootGarden.tokenId is invalid");
  const observedRoot = gardens.find((garden) => getAddress(garden.garden) === rootGarden);
  const inventoryErrors: string[] = [];
  if (gardens.length !== EXPECTED_GARDEN_COUNT) {
    inventoryErrors.push(`frozen count is ${EXPECTED_GARDEN_COUNT}, finalized live count is ${gardens.length}`);
  }
  if (!observedRoot) {
    inventoryErrors.push(`canonical root ${rootGarden} is absent from the finalized live set`);
  } else if (observedRoot.tokenId !== rootTokenId) {
    inventoryErrors.push(`root artifact tokenId is ${rootTokenId}, finalized derivation is ${observedRoot.tokenId}`);
  }
  if (inventoryErrors.length > 0) {
    throw new Error(
      `Pool backfill inventory drift at finalized block ${finalized.number}: ${inventoryErrors.join("; ")}`,
    );
  }
  const rootEntry = gardens.find((garden) => garden.tokenId === rootTokenId);
  if (!rootEntry || getAddress(rootEntry.garden) !== rootGarden) {
    throw new Error("Canonical root artifact does not round-trip through the live ERC-6551 account derivation");
  }
  const authority = options.authority === "deployer" ? "DEPLOYER" : "SAFE";
  const owner = authority === "DEPLOYER" ? frozen.deployer : frozen.safe;
  const liveNonce =
    authority === "SAFE"
      ? safeNumber(
          await new Contract(owner, safeInterface, provider).nonce({ blockTag: finalized.number }),
          "protocol Safe nonce",
        )
      : await provider.getTransactionCount(owner, "pending");
  const requestedNonce = authority === "SAFE" ? options.expectedSafeNonce : options.expectedNonce;
  if (requestedNonce !== undefined && requestedNonce !== liveNonce) {
    throw new Error(`Authority nonce drift: expected ${requestedNonce}, live nonce is ${liveNonce}`);
  }
  const moduleDeploymentPending = await readModulePreflight(
    provider,
    deployment,
    frozen.address,
    owner,
    finalized.number,
  );
  if (!moduleDeploymentPending) {
    await assertFrozenModuleIdentity(
      provider,
      frozen.address,
      frozen.implementation,
      frozen.implementationRuntimeHash,
      finalized.number,
    );
  }
  const transactions = buildBackfillTransactions({
    module: frozen.address,
    rootGarden,
    gardens,
    startingNonce: liveNonce,
  });
  const gardenRecords = Object.fromEntries(
    gardens.map((garden) => [
      garden.garden.toLowerCase(),
      {
        ...garden,
        status: garden.garden === rootGarden ? "SKIPPED_PROTOCOL_ROOT" : "PLANNED",
      },
    ]),
  ) as PoolBackfillPlan["gardens"];
  const plan: PoolBackfillPlan = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseId: frozen.releaseId,
    releaseManifestHash: frozen.manifestHash,
    releaseSourceCommit: frozen.sourceCommit,
    network: "arbitrum",
    chainId: 42161,
    finalizedBlock: finalized.number,
    module: frozen.address,
    moduleDeploymentPending,
    authority,
    owner,
    expectedNonce: liveNonce,
    gardenToken: requiredAddress(deployment.gardenToken, "gardenToken"),
    gardenAccountImplementation: requiredAddress(deployment.gardenAccountImpl, "gardenAccountImpl"),
    tokenboundRegistry: TOKENBOUND_REGISTRY,
    tokenboundSalt: TOKENBOUND_SALT,
    rootGarden,
    rootTokenId,
    expectedGardenCount: EXPECTED_GARDEN_COUNT,
    gardens: gardenRecords,
    transactions,
    transactionBoundaryRule:
      authority === "DEPLOYER" ? DEPLOYER_TRANSACTION_BOUNDARY_RULE : SAFE_TRANSACTION_BOUNDARY_RULE,
    canonicalArtifactMutation: false,
  };
  validateBackfillPlan(plan);
  const outputPath = path.join(CONTRACTS_ROOT, ".generated/runtime/42161-pool-backfill.json");
  writeReleaseJsonAtomic(outputPath, plan);
  return { plan, outputPath };
}

export function parseSafeExecution(transaction: TransactionResponse, expected: BackfillTransaction, safe: string) {
  if (transaction.value !== 0n) {
    throw new Error("Backfill receipt transaction may not attach native value to the protocol Safe");
  }
  if (!transaction.to || getAddress(transaction.to) !== getAddress(safe)) {
    throw new Error("Receipt transaction does not target the frozen protocol Safe");
  }
  const decoded = safeInterface.decodeFunctionData("execTransaction", transaction.data);
  if (
    getAddress(decoded[0] as string) !== getAddress(expected.to) ||
    BigInt(decoded[1]) !== 0n ||
    String(decoded[2]).toLowerCase() !== expected.data.toLowerCase() ||
    Number(decoded[3]) !== expected.operation
  ) {
    throw new Error("Safe execTransaction payload differs from the reviewed backfill boundary");
  }
  if (
    BigInt(decoded[6]) !== 0n ||
    getAddress(decoded[7] as string) !== getAddress("0x0000000000000000000000000000000000000000") ||
    getAddress(decoded[8] as string) !== getAddress("0x0000000000000000000000000000000000000000")
  ) {
    throw new Error("Safe backfill boundary may not configure a gas refund token, price, or recipient");
  }
  return decoded;
}

export function validateDeployerExecution(
  transaction: TransactionResponse,
  expected: BackfillTransaction,
  deployer: string,
): void {
  if (transaction.value !== 0n) throw new Error("Deployer backfill transaction may not attach native value");
  if (getAddress(transaction.from) !== getAddress(deployer)) {
    throw new Error("Backfill receipt sender differs from the reviewed deployer");
  }
  if (!transaction.to || getAddress(transaction.to) !== getAddress(expected.to)) {
    throw new Error("Backfill receipt target differs from the reviewed module");
  }
  if (transaction.data.toLowerCase() !== expected.data.toLowerCase() || transaction.nonce !== expected.nonce) {
    throw new Error("Backfill receipt calldata or nonce differs from the reviewed boundary");
  }
}

export interface RegisteredPoolSnapshot {
  garden: string;
  poolId: string;
  poolGarden: string;
  poolType: number;
  protocolPoolId?: string;
}

export function validateRegisteredPoolSnapshots(
  plan: PoolBackfillPlan,
  checkpoint: BackfillCheckpoint,
  snapshots: RegisteredPoolSnapshot[],
): void {
  const registrations = plan.transactions.slice(0, -1);
  if (snapshots.length !== registrations.length) {
    throw new Error(`Unpause preflight requires ${registrations.length} exact live pools`);
  }
  const byGarden = new Map(snapshots.map((snapshot) => [getAddress(snapshot.garden), snapshot]));
  if (byGarden.size !== registrations.length) throw new Error("Unpause preflight contains duplicate live pools");
  for (const registration of registrations) {
    if (!registration.garden) throw new Error("Canonical registration boundary has no garden");
    const snapshot = byGarden.get(getAddress(registration.garden));
    const expectedType = registration.kind === "REGISTER_PROTOCOL" ? 1 : 0;
    if (
      !snapshot ||
      BigInt(snapshot.poolId) === 0n ||
      getAddress(snapshot.poolGarden) !== getAddress(registration.garden) ||
      snapshot.poolType !== expectedType
    ) {
      throw new Error(`Unpause preflight is missing exact pool ${registration.garden}`);
    }
    if (registration.kind === "REGISTER_PROTOCOL") {
      if (
        !snapshot.protocolPoolId ||
        BigInt(snapshot.protocolPoolId) !== BigInt(snapshot.poolId) ||
        !checkpoint.protocolRegistration.poolId ||
        BigInt(checkpoint.protocolRegistration.poolId) !== BigInt(snapshot.poolId)
      ) {
        throw new Error("Unpause preflight Protocol pool differs from the receipt-backed checkpoint");
      }
    } else {
      const saved = checkpoint.gardens[registration.garden.toLowerCase()];
      if (!saved?.poolId || BigInt(saved.poolId) !== BigInt(snapshot.poolId)) {
        throw new Error(`Unpause preflight pool ID differs from checkpoint for ${registration.garden}`);
      }
    }
  }
}

function assertSafeSuccess(receipt: TransactionReceipt, safe: string): string {
  if (receipt.status !== 1) throw new Error(`Safe transaction ${receipt.hash} did not succeed`);
  let safeTransactionHash: string | undefined;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(safe)) continue;
    try {
      const parsed = safeInterface.parseLog(log);
      if (parsed?.name === "ExecutionSuccess") safeTransactionHash = String(parsed.args.txHash);
    } catch {
      // Ignore unrelated Safe logs; the exact ExecutionSuccess event remains mandatory.
    }
  }
  if (!safeTransactionHash) throw new Error(`Safe transaction ${receipt.hash} emitted no ExecutionSuccess event`);
  return safeTransactionHash;
}

async function verifyPostState(
  provider: JsonRpcProvider,
  plan: PoolBackfillPlan,
  boundary: BackfillTransaction,
  checkpoint: BackfillCheckpoint,
): Promise<{ poolId?: string }> {
  const module = new Contract(plan.module, moduleInterface, provider);
  if (boundary.kind === "UNPAUSE") {
    if ((await module.paused()) !== false) throw new Error("Pooling remained paused after the Safe boundary");
    validateRegisteredPoolSnapshots(plan, checkpoint, await readRegisteredPoolSnapshots(module, plan));
    return {};
  }
  if ((await module.paused()) !== true) throw new Error("Pooling unpaused before the pool backfill completed");
  if (!boundary.garden) throw new Error("Pool registration boundary has no garden");
  const result = await module.getPoolByGarden(boundary.garden);
  const poolId = BigInt(result[0]);
  const pool = result[1];
  if (poolId === 0n || getAddress(pool.garden) !== getAddress(boundary.garden)) {
    throw new Error(`No exact pool exists for ${boundary.garden}`);
  }
  const expectedType = boundary.kind === "REGISTER_PROTOCOL" ? 1 : 0;
  if (Number(pool.poolType) !== expectedType) throw new Error(`Wrong pool type for ${boundary.garden}`);
  if (boundary.kind === "REGISTER_PROTOCOL" && BigInt(await module.protocolPoolId()) !== poolId) {
    throw new Error("protocolPoolId does not point to the root garden pool");
  }
  return { poolId: poolId.toString() };
}

async function readRegisteredPoolSnapshots(
  module: Contract,
  plan: PoolBackfillPlan,
): Promise<RegisteredPoolSnapshot[]> {
  const protocolPoolId = String(await module.protocolPoolId());
  const snapshots: RegisteredPoolSnapshot[] = [];
  for (const registration of plan.transactions.slice(0, -1)) {
    if (!registration.garden) throw new Error("Canonical registration boundary has no garden");
    const result = await module.getPoolByGarden(registration.garden);
    snapshots.push({
      garden: registration.garden,
      poolId: String(result[0]),
      poolGarden: String(result[1].garden),
      poolType: Number(result[1].poolType),
      ...(registration.kind === "REGISTER_PROTOCOL" ? { protocolPoolId } : {}),
    });
  }
  return snapshots;
}

export async function verifyRegistrationReceiptPrefix(
  provider: JsonRpcProvider,
  plan: PoolBackfillPlan,
  checkpoint: BackfillCheckpoint,
): Promise<void> {
  for (const boundary of plan.transactions.slice(0, -1)) {
    const evidence = checkpoint.completed.find((entry) => entry.step === boundary.index);
    if (!evidence) throw new Error(`Unpause preflight has no receipt for boundary ${boundary.index}`);
    const { transaction, receipt } = await retryRpcAvailability(
      async () => {
        const [transaction, receipt] = await Promise.all([
          provider.getTransaction(evidence.transactionHash),
          provider.getTransactionReceipt(evidence.transactionHash),
        ]);
        return transaction && receipt ? { transaction, receipt } : undefined;
      },
      { unavailableMessage: `Unpause preflight receipt remained unavailable for boundary ${boundary.index}` },
    );
    if (receipt.status !== 1 || receipt.blockNumber !== evidence.blockNumber) {
      throw new Error(`Unpause preflight receipt differs for boundary ${boundary.index}`);
    }
    if (plan.authority === "SAFE") {
      const decoded = parseSafeExecution(transaction, boundary, plan.owner);
      const loggedSafeTransactionHash = assertSafeSuccess(receipt, plan.owner);
      const safe = new Contract(plan.owner, safeInterface, provider);
      const expectedSafeTransactionHash = String(
        await safe.getTransactionHash(
          decoded[0],
          decoded[1],
          decoded[2],
          decoded[3],
          decoded[4],
          decoded[5],
          decoded[6],
          decoded[7],
          decoded[8],
          boundary.nonce,
        ),
      );
      if (expectedSafeTransactionHash.toLowerCase() !== loggedSafeTransactionHash.toLowerCase()) {
        throw new Error(`Unpause preflight Safe receipt does not prove boundary ${boundary.index}`);
      }
    } else {
      validateDeployerExecution(transaction, boundary, plan.owner);
    }
  }
}

function initialCheckpoint(plan: PoolBackfillPlan, planHash: string): BackfillCheckpoint {
  return {
    schemaVersion: 1,
    releaseId: plan.releaseId,
    releaseManifestHash: plan.releaseManifestHash,
    chainId: plan.chainId,
    module: plan.module,
    owner: plan.owner,
    planHash,
    activation: { status: "PLANNED" },
    protocolRegistration: { rootGarden: plan.rootGarden, status: "PLANNED" },
    gardens: structuredClone(plan.gardens),
    completed: [],
  };
}

async function verifyAuthorizedBoundary(options: BackfillOptions): Promise<void> {
  if (!options.planPath || options.step === undefined) {
    throw new Error("Backfill boundary execution requires --plan and --step");
  }
  if (options.network !== "arbitrum") throw new Error("Pool backfill supports only --network arbitrum");
  const planPath = path.resolve(process.cwd(), options.planPath);
  const canonicalPlanPath = path.join(CONTRACTS_ROOT, ".generated/runtime/42161-pool-backfill.json");
  if (planPath !== canonicalPlanPath)
    throw new Error(`Backfill broadcast requires the generated plan ${canonicalPlanPath}`);
  if (!fs.existsSync(planPath)) throw new Error(`Reviewed backfill plan not found: ${planPath}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as PoolBackfillPlan;
  validateBackfillPlan(plan);
  if (options.authority.toUpperCase() !== plan.authority) {
    throw new Error(`Requested ${options.authority} authority differs from plan authority ${plan.authority}`);
  }
  const expectedNonce = plan.authority === "SAFE" ? options.expectedSafeNonce : options.expectedNonce;
  if (expectedNonce === undefined) {
    throw new Error(
      plan.authority === "SAFE"
        ? "Safe boundary verification requires --expected-safe-nonce and --receipt"
        : "Deployer boundary execution requires --expected-nonce",
    );
  }
  if (plan.authority === "SAFE" && !options.receiptHash) {
    throw new Error("Safe boundary verification requires an externally submitted --receipt");
  }
  const frozen = frozenModuleAddress();
  const frozenOwner = plan.authority === "SAFE" ? frozen.safe : frozen.deployer;
  if (
    plan.schemaVersion !== 1 ||
    plan.chainId !== 42161 ||
    plan.network !== "arbitrum" ||
    getAddress(plan.module) !== frozen.address ||
    getAddress(plan.owner) !== frozenOwner ||
    plan.releaseManifestHash !== frozen.manifestHash ||
    plan.releaseId !== frozen.releaseId ||
    plan.releaseSourceCommit !== frozen.sourceCommit
  ) {
    throw new Error("Backfill plan does not match the frozen release, chain, module, or reviewed owner");
  }
  const boundary = plan.transactions[options.step - 1];
  if (!boundary || boundary.index !== options.step) throw new Error(`Backfill plan has no boundary ${options.step}`);
  if (boundary.nonce !== expectedNonce) {
    throw new Error(`Boundary nonce is ${boundary.nonce}, not ${expectedNonce}`);
  }

  const planHash = keccak256(toUtf8Bytes(stable(plan)));
  const checkpointPath = path.join(CONTRACTS_ROOT, ".generated/runtime/42161-pool-backfill.checkpoint.json");
  const checkpoint = fs.existsSync(checkpointPath)
    ? (JSON.parse(fs.readFileSync(checkpointPath, "utf8")) as BackfillCheckpoint)
    : initialCheckpoint(plan, planHash);
  if (checkpoint.planHash !== planHash) throw new Error("Backfill checkpoint belongs to a different reviewed plan");
  validateCheckpointPrefix(checkpoint, plan, options.step);

  const networkManager = new NetworkManager();
  const rpcUrl = networkManager.getRpcUrl("arbitrum");
  const provider = new JsonRpcProvider(rpcUrl, 42161, { staticNetwork: true });
  const existing = checkpoint.completed.find((entry) => entry.step === options.step);
  let receiptHash = existing?.transactionHash ?? options.receiptHash;
  if (!receiptHash) {
    if (plan.authority !== "DEPLOYER") throw new Error("Safe backfill requires an externally submitted receipt");
    const finalized = await provider.getBlock("finalized");
    if (!finalized) throw new Error("Arbitrum RPC returned no finalized block before backfill broadcast");
    const deployment = readDeployment(42161);
    await assertFrozenModuleIdentity(
      provider,
      plan.module,
      frozen.implementation,
      frozen.implementationRuntimeHash,
      finalized.number,
    );
    assertInventoryMatchesPlan(plan, await enumerateGardens(provider, deployment, finalized.number));
    await assertModuleConfiguration(provider, deployment, plan.module, plan.owner, finalized.number, true);
    if (boundary.kind === "UNPAUSE") {
      await verifyRegistrationReceiptPrefix(provider, plan, checkpoint);
      const module = new Contract(plan.module, moduleInterface, provider);
      validateRegisteredPoolSnapshots(plan, checkpoint, await readRegisteredPoolSnapshots(module, plan));
    }
    const pendingNonce = await provider.getTransactionCount(plan.owner, "pending");
    if (pendingNonce !== expectedNonce) {
      throw new Error(`Deployer nonce drift: expected ${expectedNonce}, live pending nonce is ${pendingNonce}`);
    }
    const manifest = loadReleaseManifest();
    receiptHash = parseCastTransactionHash(
      execCastCaptured(
        [
          "send",
          boundary.to,
          boundary.data,
          "--chain",
          "42161",
          "--nonce",
          String(expectedNonce),
          "--account",
          manifest.ownership.deploymentKeystore,
          "--rpc-url",
          rpcUrl,
          "--json",
        ],
        { cwd: CONTRACTS_ROOT, env: process.env, inputStdio: "inherit" },
        "Bun-wrapped deployer pool backfill boundary",
      ),
      "Bun-wrapped deployer pool backfill boundary",
    );
  }
  const { transaction, receipt } = await retryRpcAvailability(
    async () => {
      const [transaction, receipt] = await Promise.all([
        provider.getTransaction(receiptHash),
        provider.getTransactionReceipt(receiptHash),
      ]);
      return transaction && receipt ? { transaction, receipt } : undefined;
    },
    {
      unavailableMessage: `Receipt evidence remained unavailable for ${receiptHash}`,
      onRetry: (attempt) => console.warn(`Backfill receipt has not propagated; retrying after attempt ${attempt}/6`),
    },
  );
  if (receipt.status !== 1) throw new Error(`Backfill receipt ${receiptHash} failed`);
  const deployment = readDeployment(42161);
  await assertFrozenModuleIdentity(
    provider,
    plan.module,
    frozen.implementation,
    frozen.implementationRuntimeHash,
    receipt.blockNumber,
  );
  if (
    getAddress(plan.gardenToken) !== requiredAddress(deployment.gardenToken, "gardenToken") ||
    getAddress(plan.gardenAccountImplementation) !== requiredAddress(deployment.gardenAccountImpl, "gardenAccountImpl")
  ) {
    throw new Error("Backfill plan Garden deployment identities no longer match the shipped deployment artifact");
  }
  const deploymentRoot = deployment.rootGarden as Record<string, unknown> | undefined;
  if (
    getAddress(plan.rootGarden) !== requiredAddress(deploymentRoot?.address, "rootGarden.address") ||
    plan.rootTokenId !== Number(deploymentRoot?.tokenId)
  ) {
    throw new Error("Backfill plan root no longer matches the shipped deployment artifact");
  }
  assertInventoryMatchesPlan(plan, await enumerateGardens(provider, deployment, receipt.blockNumber));
  await assertModuleConfiguration(
    provider,
    deployment,
    plan.module,
    plan.owner,
    receipt.blockNumber,
    boundary.kind !== "UNPAUSE",
  );
  if (plan.authority === "SAFE") {
    const decoded = parseSafeExecution(transaction, boundary, plan.owner);
    const loggedSafeTransactionHash = assertSafeSuccess(receipt, plan.owner);
    const safe = new Contract(plan.owner, safeInterface, provider);
    const expectedSafeTransactionHash = String(
      await safe.getTransactionHash(
        decoded[0],
        decoded[1],
        decoded[2],
        decoded[3],
        decoded[4],
        decoded[5],
        decoded[6],
        decoded[7],
        decoded[8],
        boundary.nonce,
      ),
    );
    if (expectedSafeTransactionHash.toLowerCase() !== loggedSafeTransactionHash.toLowerCase()) {
      throw new Error(`Safe receipt does not prove planned nonce ${boundary.nonce}`);
    }
  } else {
    validateDeployerExecution(transaction, boundary, plan.owner);
  }
  const postState = await verifyPostState(provider, plan, boundary, checkpoint);

  if (existing) {
    if (existing.transactionHash.toLowerCase() !== receiptHash.toLowerCase()) {
      throw new Error(`Boundary ${options.step} already has a different verified receipt`);
    }
    console.log(`Boundary ${options.step} is already verified; no transaction was replayed`);
    return;
  }

  const evidence = {
    step: options.step,
    nonce: boundary.nonce,
    transactionHash: receiptHash,
    blockNumber: receipt.blockNumber,
    verifiedAt: new Date().toISOString(),
  };
  checkpoint.completed.push(evidence);
  if (boundary.kind === "UNPAUSE") {
    checkpoint.activation = {
      status: "VERIFIED",
      transactionHash: receiptHash,
      blockNumber: receipt.blockNumber,
    };
  } else if (boundary.kind === "REGISTER_PROTOCOL") {
    checkpoint.protocolRegistration = {
      rootGarden: plan.rootGarden,
      status: "VERIFIED",
      poolId: postState.poolId,
      transactionHash: receiptHash,
      blockNumber: receipt.blockNumber,
    };
  } else if (boundary.garden) {
    const key = boundary.garden.toLowerCase();
    const garden = checkpoint.gardens[key];
    if (!garden || garden.status === "SKIPPED_PROTOCOL_ROOT") throw new Error(`Invalid Garden backfill key ${key}`);
    checkpoint.gardens[key] = {
      ...garden,
      status: "REGISTERED",
      poolId: postState.poolId,
      transactionHash: receiptHash,
      blockNumber: receipt.blockNumber,
    };
  }
  writeReleaseJsonAtomic(checkpointPath, checkpoint);
  console.log(`Boundary ${options.step} receipt and post-state verified; checkpoint written atomically`);
}

async function main(): Promise<void> {
  let options: BackfillOptions;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    showHelp();
    process.exitCode = 1;
    return;
  }
  if (options.help || (!options.dryRun && !options.broadcast)) {
    showHelp();
    return;
  }
  try {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });
    if (options.dryRun) {
      const { plan, outputPath } = await buildPlan(options);
      console.log(stable(plan));
      console.log(`Dry-run artifact: ${outputPath}`);
      console.log("No chain state or canonical release artifact was mutated.");
      return;
    }
    await verifyAuthorizedBoundary(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
