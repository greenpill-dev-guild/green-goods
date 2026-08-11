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
import { NetworkManager } from "../../../packages/contracts/script/utils/network";
import { writeReleaseJsonAtomic } from "../../../packages/contracts/script/utils/release-artifacts";
import {
  buildReleaseLock,
  loadReleaseManifest,
} from "../../../packages/contracts/script/utils/release-manifest";
import { assertSepoliaGate } from "../../../packages/contracts/script/utils/release-gate";

const PLAN_HUB = __dirname;
const REPO_ROOT = path.resolve(PLAN_HUB, "../../..");
const CONTRACTS_ROOT = path.join(REPO_ROOT, "packages/contracts");
const ROOT_ENV = path.join(REPO_ROOT, ".env");
const EXPECTED_GARDEN_COUNT = 13;
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";

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
  safeNonce: number;
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
  owner: string;
  expectedSafeNonce: number;
  gardenToken: string;
  gardenAccountImplementation: string;
  tokenboundRegistry: string;
  tokenboundSalt: string;
  rootGarden: string;
  rootTokenId: number;
  expectedGardenCount: 13;
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
  expectedSafeNonce?: number;
  receiptHash?: string;
  help: boolean;
}

interface BackfillCheckpoint {
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
    safeNonce: number;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: string;
  }>;
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
      case "--step":
        options.step = parseInteger(args[++index], "--step", 1);
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
  bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run
  bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --broadcast \\
    --plan <reviewed-plan.json> --step <index> --expected-safe-nonce <n> --receipt <safe-tx-hash>

The dry-run pins a finalized Arbitrum block, enumerates exactly 13 live GardenToken accounts,
then fails closed unless the frozen ABI can satisfy the authorized backfill-before-unpause order.
The merged ABI currently gates registerPool behind whenOperational, so an executable plan cannot
be produced without a separately resolved architecture/release-order decision.

Broadcast is Phase B only. The owner is a contract Safe, so this wrapper never holds or infers
Safe signatures. Each authorized Safe transaction is submitted through the reviewed Safe owner
ceremony, then this Bun target verifies its exact execTransaction payload, receipt, post-state,
and atomically advances the canonical backfill checkpoint. It will not continue to another step.
`);
}

function readDeployment(chainId: number): Record<string, unknown> {
  const deploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Record<string, unknown>;
}

function frozenModuleAddress(): { address: string; manifestHash: string; releaseId: string; sourceCommit: string; safe: string } {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const module = lock.identities.find(
    (identity) => identity.network === "arbitrum" && identity.name === "CommitmentPoolingModule" && identity.kind === "proxy",
  );
  if (!module) throw new Error("Frozen release lock has no CommitmentPoolingModule proxy");
  return {
    address: requiredAddress(module.address, "frozen CommitmentPoolingModule proxy"),
    manifestHash: lock.manifestHash,
    releaseId: manifest.releaseId,
    sourceCommit: lock.sourceCommit,
    safe: requiredAddress(manifest.ownership.protocolSafe, "protocol Safe"),
  };
}

export function buildBackfillTransactions(args: {
  module: string;
  rootGarden: string;
  gardens: GardenEnumeration[];
  startingSafeNonce: number;
}): BackfillTransaction[] {
  requiredAddress(args.module, "module");
  const rootGarden = requiredAddress(args.rootGarden, "root garden");
  if (args.gardens.length !== EXPECTED_GARDEN_COUNT) {
    throw new Error(`Expected exactly ${EXPECTED_GARDEN_COUNT} gardens, found ${args.gardens.length}`);
  }
  const normalized = new Set(args.gardens.map((garden) => getAddress(garden.garden).toLowerCase()));
  if (normalized.size !== EXPECTED_GARDEN_COUNT) throw new Error("Garden enumeration contains duplicate accounts");
  if (!normalized.has(rootGarden.toLowerCase())) throw new Error("Garden enumeration does not contain the canonical root");

  throw new Error(
    "Authorized release order requires pool registration/backfill before the separately gated pooling unpause, " +
      "but the frozen CommitmentPoolingModule ABI gates registerPool behind whenOperational. " +
      "Do not emit an unpause-first plan or silently change the merged ABI.",
  );
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
    } catch {
      break;
    }
    const garden = requiredAddress(
      await registry.account(implementation, TOKENBOUND_SALT, 42161, gardenToken, tokenId, { blockTag }),
      `garden account ${tokenId}`,
    );
    const code = await provider.getCode(garden, blockTag);
    if (code === "0x") throw new Error(`Garden account ${garden} for token ${tokenId} has no code at block ${blockTag}`);
    gardens.push({ tokenId, garden, tokenOwner, codeHash: keccak256(code) });
  }
  if (gardens.length === maximumInventory) throw new Error(`Garden inventory exceeded the bounded ${maximumInventory}-token scan`);
  return gardens;
}

async function readModulePreflight(
  provider: JsonRpcProvider,
  deployment: Record<string, unknown>,
  module: string,
  safe: string,
  blockTag: number,
): Promise<boolean> {
  const code = await provider.getCode(module, blockTag);
  if (code === "0x") return true;
  const pooling = new Contract(module, moduleInterface, provider);
  const owner = requiredAddress(await pooling.owner({ blockTag }), "pooling owner");
  if (owner !== getAddress(safe)) throw new Error(`Pooling owner is ${owner}, expected protocol Safe ${safe}`);
  if ((await pooling.paused({ blockTag })) !== true) throw new Error("Pooling must remain paused before activation planning");

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
  await pooling.setPaused.staticCall(false, { from: safe, blockTag });
  return false;
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
    throw new Error(`Pool backfill inventory drift at finalized block ${finalized.number}: ${inventoryErrors.join("; ")}`);
  }
  const rootEntry = gardens.find((garden) => garden.tokenId === rootTokenId);
  if (!rootEntry || getAddress(rootEntry.garden) !== rootGarden) {
    throw new Error("Canonical root artifact does not round-trip through the live ERC-6551 account derivation");
  }
  const safe = new Contract(frozen.safe, safeInterface, provider);
  const liveSafeNonce = safeNumber(await safe.nonce({ blockTag: finalized.number }), "protocol Safe nonce");
  if (options.expectedSafeNonce !== undefined && options.expectedSafeNonce !== liveSafeNonce) {
    throw new Error(`Safe nonce drift: expected ${options.expectedSafeNonce}, finalized nonce is ${liveSafeNonce}`);
  }
  const moduleDeploymentPending = await readModulePreflight(
    provider,
    deployment,
    frozen.address,
    frozen.safe,
    finalized.number,
  );
  const transactions = buildBackfillTransactions({
    module: frozen.address,
    rootGarden,
    gardens,
    startingSafeNonce: liveSafeNonce,
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
    owner: frozen.safe,
    expectedSafeNonce: liveSafeNonce,
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
      "Authorize and execute one direct Safe execTransaction payload, verify its receipt and post-state, then stop.",
    canonicalArtifactMutation: false,
  };
  const outputPath = path.join(CONTRACTS_ROOT, ".generated/runtime/42161-pool-backfill.json");
  writeReleaseJsonAtomic(outputPath, plan);
  return { plan, outputPath };
}

function parseSafeExecution(transaction: TransactionResponse, expected: BackfillTransaction, safe: string) {
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
  if (BigInt(decoded[6]) !== 0n || getAddress(decoded[7] as string) !== getAddress("0x0000000000000000000000000000000000000000") || getAddress(decoded[8] as string) !== getAddress("0x0000000000000000000000000000000000000000")) {
    throw new Error("Safe backfill boundary may not configure a gas refund token, price, or recipient");
  }
  return decoded;
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
): Promise<{ poolId?: string }> {
  const module = new Contract(plan.module, moduleInterface, provider);
  if (boundary.kind === "UNPAUSE") {
    if ((await module.paused()) !== false) throw new Error("Pooling remained paused after the Safe boundary");
    return {};
  }
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
  if (!options.planPath || options.step === undefined || options.expectedSafeNonce === undefined || !options.receiptHash) {
    throw new Error(
      "Safe boundary verification requires --plan, --step, --expected-safe-nonce, and --receipt; this wrapper never infers Safe signatures",
    );
  }
  if (options.network !== "arbitrum") throw new Error("Pool backfill supports only --network arbitrum");
  const planPath = path.resolve(process.cwd(), options.planPath);
  if (!fs.existsSync(planPath)) throw new Error(`Reviewed backfill plan not found: ${planPath}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as PoolBackfillPlan;
  const frozen = frozenModuleAddress();
  if (
    plan.schemaVersion !== 1 ||
    plan.chainId !== 42161 ||
    plan.network !== "arbitrum" ||
    getAddress(plan.module) !== frozen.address ||
    getAddress(plan.owner) !== frozen.safe ||
    plan.releaseManifestHash !== frozen.manifestHash
  ) {
    throw new Error("Backfill plan does not match the frozen release, chain, module, or Safe owner");
  }
  const boundary = plan.transactions[options.step - 1];
  if (!boundary || boundary.index !== options.step) throw new Error(`Backfill plan has no boundary ${options.step}`);
  if (boundary.safeNonce !== options.expectedSafeNonce) {
    throw new Error(`Boundary Safe nonce is ${boundary.safeNonce}, not ${options.expectedSafeNonce}`);
  }

  const planHash = keccak256(toUtf8Bytes(stable(plan)));
  const checkpointPath = path.join(PLAN_HUB, "artifacts/42161-pool-backfill.json");
  const checkpoint = fs.existsSync(checkpointPath)
    ? (JSON.parse(fs.readFileSync(checkpointPath, "utf8")) as BackfillCheckpoint)
    : initialCheckpoint(plan, planHash);
  if (checkpoint.planHash !== planHash) throw new Error("Backfill checkpoint belongs to a different reviewed plan");
  if (options.step > 1 && !checkpoint.completed.some((entry) => entry.step === options.step! - 1)) {
    throw new Error(`Boundary ${options.step - 1} has no verified receipt checkpoint`);
  }

  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("arbitrum"), 42161, { staticNetwork: true });
  const transaction = await provider.getTransaction(options.receiptHash);
  const receipt = await provider.getTransactionReceipt(options.receiptHash);
  if (!transaction || !receipt) throw new Error(`Receipt evidence is unavailable for ${options.receiptHash}`);
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
      boundary.safeNonce,
    ),
  );
  if (expectedSafeTransactionHash.toLowerCase() !== loggedSafeTransactionHash.toLowerCase()) {
    throw new Error(`Safe receipt does not prove planned nonce ${boundary.safeNonce}`);
  }
  const postState = await verifyPostState(provider, plan, boundary);

  const existing = checkpoint.completed.find((entry) => entry.step === options.step);
  if (existing) {
    if (existing.transactionHash.toLowerCase() !== options.receiptHash.toLowerCase()) {
      throw new Error(`Boundary ${options.step} already has a different verified receipt`);
    }
    console.log(`Boundary ${options.step} is already verified; no transaction was replayed`);
    return;
  }

  const evidence = {
    step: options.step,
    safeNonce: boundary.safeNonce,
    transactionHash: options.receiptHash,
    blockNumber: receipt.blockNumber,
    verifiedAt: new Date().toISOString(),
  };
  checkpoint.completed.push(evidence);
  if (boundary.kind === "UNPAUSE") {
    checkpoint.activation = {
      status: "VERIFIED",
      transactionHash: options.receiptHash,
      blockNumber: receipt.blockNumber,
    };
  } else if (boundary.kind === "REGISTER_PROTOCOL") {
    checkpoint.protocolRegistration = {
      rootGarden: plan.rootGarden,
      status: "VERIFIED",
      poolId: postState.poolId,
      transactionHash: options.receiptHash,
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
      transactionHash: options.receiptHash,
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
