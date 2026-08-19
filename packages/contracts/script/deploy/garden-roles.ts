#!/usr/bin/env bun

/**
 * Plans the Zodiac Roles lane for the 18 Celo Garden Safes.
 *
 * Ownership model (frozen 2026-08-18): each modifier is deployed with the deployment EOA as owner,
 * configured and ownership-transferred to its Safe while it is still inert, and only then enabled.
 * A modifier holds no authority over a Safe until `enableModule`, so the configuration window
 * carries no custody risk, and at the moment it gains power it is already Safe-owned.
 *
 * That leaves exactly one signed transaction per Safe — `enableModule` — because Safe restricts it
 * to the Safe itself. Every other step is a plain EOA call. This planner computes those 18
 * transaction hashes up front (each Safe is at nonce zero) so both recovery Safes can pre-approve
 * all of them in one batched transaction each, rather than signing eighteen times.
 *
 * Read-only. Signing, broadcast, and the permission tree itself are out of scope here.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  AbiCoder,
  Contract,
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  JsonRpcProvider,
  keccak256,
  solidityPackedKeccak256,
  TypedDataEncoder,
  type TypedDataField,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";

import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { NetworkManager } from "../utils/network";
import { assertReleaseOperatorSession, resolveCheckoutCommit } from "../utils/release-session";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_SAFE_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-final.json");
const DEFAULT_PLAN = path.join(RUNTIME_ROOT, "42220-garden-roles.json");
const PROOF_FIXTURE = path.join(RUNTIME_ROOT, "42220-garden-roles-proof.json");

const CELO_CHAIN_ID = 42_220;
const EXPECTED_GARDEN_COUNT = 18;

/** Pinned in .plans/active/commitment-pooling/evidence/celo-zodiac-roles-mastercopies-2026-08-18.json. */
const ROLES_MASTERCOPY = "0x9646fDAD06d3e24444381f44362a3B0eB343D337";
const MODULE_PROXY_FACTORY = "0x000000000000aDdB49795b0f9bA5BC298cDda236";
const MULTI_SEND_CALL_ONLY = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";
const DEPLOYMENT_OPERATOR = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const CELO_SETTLEMENT_EXECUTOR = "0xB8a7F3c3DfA407c45e05b7B2381233101938a84F";
const GREEN_GOODS_RECOVERY_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const DEV_GUILD_RECOVERY_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";

/** Zodiac's minimal proxy, with the mastercopy spliced in. */
const PROXY_PREFIX = "0x602d8060093d393df3363d3d373d3d3d363d73";
const PROXY_SUFFIX = "0x5af43d82803e903d91602b57fd5bf3";
const SALT_DOMAIN = "GG_GARDEN_ROLES_V1";

/** Canonical G$ and its transfer selector, frozen in config/commitment-pooling-release.json. */
const CANONICAL_TOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const TRANSFER_SELECTOR = "0xa9059cbb";

/** Domain-separated identifiers; Roles treats both purely as opaque bytes32 keys. */
export const ROLE_KEY = solidityPackedKeccak256(["string"], ["GG_CELO_SETTLEMENT_ROLE_V1"]);
export const ALLOWANCE_KEY = solidityPackedKeccak256(["string"], ["GG_CELO_SETTLEMENT_ALLOWANCE_V1"]);

/**
 * Periodic allowance, derived from the caps frozen in the release manifest: maxPeriodAmount over
 * periodDuration. The per-transfer and per-batch caps are enforced by the executor rather than
 * Roles, because they measure the Safe's gross debit including a sender-paid G$ fee.
 */
export const MAX_PERIOD_AMOUNT = 15_000_000n * 10n ** 18n;
export const PERIOD_DURATION = 2_592_000n;

/** Zodiac Roles v2 enums, read from the pinned 2.1.0 Types.sol. */
const ABI_TYPE = { None: 0, Static: 1, Calldata: 5 } as const;
const OPERATOR = { Or: 2, Matches: 5, EqualTo: 16, WithinAllowance: 28 } as const;

const FACTORY_INTERFACE = new Interface([
  "function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address)",
]);
const ROLES_CONFIG_INTERFACE = new Interface([
  "function scopeTarget(bytes32 roleKey, address targetAddress)",
  "function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, tuple(uint8 parent, uint8 paramType, uint8 operator, bytes compValue)[] conditions, uint8 options)",
  "function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)",
  "function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)",
  "function transferOwnership(address newOwner)",
  "function owner() view returns (address)",
  "function avatar() view returns (address)",
  "function target() view returns (address)",
  "function isModuleEnabled(address module) view returns (bool)",
  "function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint64 timestamp, uint128 balance)",
]);
const ROLES_INTERFACE = new Interface(["function setUp(bytes initParams)"]);
const SAFE_INTERFACE = new Interface([
  "function enableModule(address module)",
  "function approveHash(bytes32 hashToApprove)",
  "function nonce() view returns (uint256)",
  "function isModuleEnabled(address module) view returns (bool)",
]);

const SAFE_TX_TYPES: Record<string, TypedDataField[]> = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
};

dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

interface SafePlanEntry {
  tokenId: number;
  garden: string;
  safe: string;
}

export interface RolesBoundary {
  tokenId: number;
  garden: string;
  safe: string;
  modifier: string;
  saltNonce: string;
  initializerHash: string;
  enableModuleData: string;
  safeTxHash: string;
  safeNonce: number;
  permissionsConfigHash: string;
}

/**
 * The EOA half of the ceremony, flattened in execution order. Every Roles config function is
 * onlyOwner and reads msg.sender directly, so these cannot be batched through MultiSend — each is
 * its own boundary. None of them is signed, and none has authority over a Safe: the modifier stays
 * inert until a later stage enables it.
 */
export type RolesTransactionKind =
  | "DEPLOY_MODIFIER"
  | "SCOPE_TARGET"
  | "SCOPE_FUNCTION"
  | "SET_ALLOWANCE"
  | "ASSIGN_EXECUTOR"
  | "TRANSFER_OWNERSHIP";

export interface PlannedRolesTransaction {
  step: number;
  tokenId: number;
  safe: string;
  modifier: string;
  kind: RolesTransactionKind;
  to: string;
  value: "0";
  data: string;
}

export interface GardenRolesPlan {
  schemaVersion: 1;
  kind: "GARDEN_ROLES_MODIFIER_PLAN";
  chainId: 42220;
  generatedAt: string;
  mastercopy: string;
  factory: string;
  modifierOwnerAtDeployment: string;
  ownershipTransfersToSafeBeforeEnable: true;
  authorityEnabled: false;
  roleKey: string;
  allowanceKey: string;
  canonicalTarget: string;
  canonicalSelector: string;
  allowance: { balance: string; maxRefill: string; refill: string; period: string };
  recipientAllowlist: string[];
  conditions: ConditionFlat[];
  conditionsEncoded: string;
  boundaries: RolesBoundary[];
  transactions: PlannedRolesTransaction[];
  recoveryApprovals: Array<{ recoverySafe: string; multiSendTo: string; multiSendData: string }>;
  blockers: string[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

/** `setUp(abi.encode(owner, avatar, target))`, the initializer the factory hashes into its salt. */
export function rolesInitializer(owner: string, safe: string): string {
  const params = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [getAddress(owner), getAddress(safe), getAddress(safe)],
  );
  return ROLES_INTERFACE.encodeFunctionData("setUp", [params]);
}

/** One modifier per Safe, so the salt nonce is domain-separated by that Safe. */
export function modifierSaltNonce(safe: string): bigint {
  return BigInt(solidityPackedKeccak256(["string", "address"], [SALT_DOMAIN, getAddress(safe)]));
}

/**
 * Zodiac derives its proxy salt as `keccak256(keccak256(initializer) ++ saltNonce)` and deploys the
 * minimal proxy through CREATE2 from the factory.
 */
export function predictModifier(initializer: string, saltNonce: bigint): string {
  const salt = solidityPackedKeccak256(["bytes32", "uint256"], [keccak256(initializer), saltNonce]);
  const proxyInitCode = concat([PROXY_PREFIX, getAddress(ROLES_MASTERCOPY), PROXY_SUFFIX]);
  return getCreate2Address(getAddress(MODULE_PROXY_FACTORY), salt, keccak256(proxyInitCode));
}

/** Safe's EIP-712 SafeTx hash; every Garden Safe is at nonce zero, so these are known up front. */
export function safeTransactionHash(safe: string, data: string, nonce: number): string {
  return TypedDataEncoder.hash({ chainId: CELO_CHAIN_ID, verifyingContract: getAddress(safe) }, SAFE_TX_TYPES, {
    to: getAddress(safe),
    value: 0n,
    data,
    operation: 0,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZeroAddress,
    refundReceiver: ZeroAddress,
    nonce: BigInt(nonce),
  });
}

/** MultiSend packs each call as operation ++ to ++ value ++ dataLength ++ data. */
export function encodeMultiSend(calls: ReadonlyArray<{ to: string; data: string }>): string {
  const packed = calls.map((call) =>
    concat([
      "0x00",
      getAddress(call.to),
      AbiCoder.defaultAbiCoder().encode(["uint256"], [0n]),
      AbiCoder.defaultAbiCoder().encode(["uint256"], [(call.data.length - 2) / 2]),
      call.data,
    ]),
  );
  return new Interface(["function multiSend(bytes transactions)"]).encodeFunctionData("multiSend", [concat(packed)]);
}

export interface ConditionFlat {
  parent: number;
  paramType: number;
  operator: number;
  compValue: string;
}

/**
 * Scopes `transfer(address,uint256)` on canonical G$ so the role may send only to a registered
 * Garden Safe, and only within the periodic allowance.
 *
 * The flat tree is breadth-first with parent indices. Node 0 matches the calldata; its children map
 * positionally to the two parameters. The recipient is a logical Or over one EqualTo per registered
 * Safe, which is how Roles expresses set membership — logical nodes carry no paramType of their
 * own, so the leaves hold Static.
 */
export function buildTransferConditions(recipients: readonly string[]): ConditionFlat[] {
  if (recipients.length !== EXPECTED_GARDEN_COUNT) {
    throw new Error(`Recipient allowlist must name all ${EXPECTED_GARDEN_COUNT} registered Garden Safes`);
  }
  const unique = new Set(recipients.map((value) => getAddress(value)));
  if (unique.size !== recipients.length) throw new Error("Recipient allowlist contains a duplicate Safe");

  const encoder = AbiCoder.defaultAbiCoder();
  const conditions: ConditionFlat[] = [
    { parent: 0, paramType: ABI_TYPE.Calldata, operator: OPERATOR.Matches, compValue: "0x" },
    { parent: 0, paramType: ABI_TYPE.None, operator: OPERATOR.Or, compValue: "0x" },
    {
      parent: 0,
      paramType: ABI_TYPE.Static,
      operator: OPERATOR.WithinAllowance,
      compValue: encoder.encode(["bytes32"], [ALLOWANCE_KEY]),
    },
  ];
  for (const recipient of recipients) {
    conditions.push({
      parent: 1,
      paramType: ABI_TYPE.Static,
      operator: OPERATOR.EqualTo,
      compValue: encoder.encode(["address"], [getAddress(recipient)]),
    });
  }
  return conditions;
}

/** The exact ConditionFlat[] payload scopeFunction receives, so proofs can execute these bytes. */
export function encodeConditions(conditions: readonly ConditionFlat[]): string {
  return AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint8 parent, uint8 paramType, uint8 operator, bytes compValue)[]"],
    [conditions.map((condition) => [condition.parent, condition.paramType, condition.operator, condition.compValue])],
  );
}

/**
 * Commits the immutable half of the permission: Safe, modifier, both keys, canonical G$, the exact
 * selector, and the condition-tree shape. Mutable caps, fee policy, and live allowance balances are
 * deliberately excluded — their own setters and events stay authoritative.
 */
export function permissionsConfigHash(
  safe: string,
  rolesModifier: string,
  conditions: readonly ConditionFlat[],
): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bytes32", "bytes32", "address", "bytes4", "tuple(uint8,uint8,uint8,bytes)[]"],
    [
      getAddress(safe),
      getAddress(rolesModifier),
      ROLE_KEY,
      ALLOWANCE_KEY,
      getAddress(CANONICAL_TOKEN),
      TRANSFER_SELECTOR,
      conditions.map((condition) => [condition.parent, condition.paramType, condition.operator, condition.compValue]),
    ],
  );
  return keccak256(encoded);
}

/** Six ordered boundaries per Safe, in the order the frozen ownership model requires. */
export function buildRolesTransactions(
  boundaries: readonly RolesBoundary[],
  conditions: readonly ConditionFlat[],
  executor: string,
): PlannedRolesTransaction[] {
  const encodedConditions = conditions.map((condition) => [
    condition.parent,
    condition.paramType,
    condition.operator,
    condition.compValue,
  ]);
  const transactions: PlannedRolesTransaction[] = [];
  let step = 0;
  const push = (boundary: RolesBoundary, kind: RolesTransactionKind, to: string, data: string): void => {
    step += 1;
    transactions.push({
      step,
      tokenId: boundary.tokenId,
      safe: boundary.safe,
      modifier: boundary.modifier,
      kind,
      to: getAddress(to),
      value: "0",
      data,
    });
  };

  for (const boundary of boundaries) {
    push(
      boundary,
      "DEPLOY_MODIFIER",
      MODULE_PROXY_FACTORY,
      FACTORY_INTERFACE.encodeFunctionData("deployModule", [
        ROLES_MASTERCOPY,
        rolesInitializer(DEPLOYMENT_OPERATOR, boundary.safe),
        BigInt(boundary.saltNonce),
      ]),
    );
    push(
      boundary,
      "SCOPE_TARGET",
      boundary.modifier,
      ROLES_CONFIG_INTERFACE.encodeFunctionData("scopeTarget", [ROLE_KEY, CANONICAL_TOKEN]),
    );
    push(
      boundary,
      "SCOPE_FUNCTION",
      boundary.modifier,
      ROLES_CONFIG_INTERFACE.encodeFunctionData("scopeFunction", [
        ROLE_KEY,
        CANONICAL_TOKEN,
        TRANSFER_SELECTOR,
        encodedConditions,
        0,
      ]),
    );
    push(
      boundary,
      "SET_ALLOWANCE",
      boundary.modifier,
      ROLES_CONFIG_INTERFACE.encodeFunctionData("setAllowance", [
        ALLOWANCE_KEY,
        MAX_PERIOD_AMOUNT,
        MAX_PERIOD_AMOUNT,
        MAX_PERIOD_AMOUNT,
        PERIOD_DURATION,
        0n,
      ]),
    );
    push(
      boundary,
      "ASSIGN_EXECUTOR",
      boundary.modifier,
      ROLES_CONFIG_INTERFACE.encodeFunctionData("assignRoles", [executor, [ROLE_KEY], [true]]),
    );
    // Ownership leaves the operator before the modifier can ever gain authority.
    push(
      boundary,
      "TRANSFER_OWNERSHIP",
      boundary.modifier,
      ROLES_CONFIG_INTERFACE.encodeFunctionData("transferOwnership", [boundary.safe]),
    );
  }
  return transactions;
}

async function buildPlan(safePlanPath: string): Promise<GardenRolesPlan> {
  const safePlan = readJson<{ entries: SafePlanEntry[] }>(safePlanPath);
  const blockers: string[] = [];
  if (safePlan.entries.length !== EXPECTED_GARDEN_COUNT) {
    blockers.push(`Safe plan lists ${safePlan.entries.length} Gardens, expected ${EXPECTED_GARDEN_COUNT}`);
  }

  const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("celo"), CELO_CHAIN_ID, {
    staticNetwork: true,
  });

  // Every Safe shares one reviewed condition tree: the allowlist is the registered Safe set.
  const recipientAllowlist = safePlan.entries.map((entry) => getAddress(entry.safe));
  const conditions = buildTransferConditions(recipientAllowlist);

  const boundaries: RolesBoundary[] = [];
  for (const entry of safePlan.entries) {
    const initializer = rolesInitializer(DEPLOYMENT_OPERATOR, entry.safe);
    const saltNonce = modifierSaltNonce(entry.safe);
    const predicted = predictModifier(initializer, saltNonce);

    // Cross-check the local derivation against the factory itself. eth_call simulates the
    // deployment and returns the address it would create, without broadcasting anything.
    const simulated = await provider.call({
      to: MODULE_PROXY_FACTORY,
      data: FACTORY_INTERFACE.encodeFunctionData("deployModule", [ROLES_MASTERCOPY, initializer, saltNonce]),
      from: DEPLOYMENT_OPERATOR,
    });
    const returned = getAddress(`0x${simulated.slice(26, 66)}`);
    if (returned !== predicted) {
      blockers.push(`Garden ${entry.tokenId}: factory would deploy ${returned}, predicted ${predicted}`);
    }
    if ((await provider.getCode(predicted, "latest")) !== "0x") {
      blockers.push(`Garden ${entry.tokenId}: a contract already exists at ${predicted}`);
    }
    const liveNonce = BigInt(await provider.call({ to: entry.safe, data: SAFE_INTERFACE.encodeFunctionData("nonce") }));
    if (liveNonce !== 0n) blockers.push(`Garden ${entry.tokenId}: Safe nonce is ${liveNonce}, expected 0`);

    const enableModuleData = SAFE_INTERFACE.encodeFunctionData("enableModule", [predicted]);
    boundaries.push({
      tokenId: entry.tokenId,
      garden: getAddress(entry.garden),
      safe: getAddress(entry.safe),
      modifier: predicted,
      saltNonce: saltNonce.toString(),
      initializerHash: keccak256(initializer),
      enableModuleData,
      safeTxHash: safeTransactionHash(entry.safe, enableModuleData, Number(liveNonce)),
      safeNonce: Number(liveNonce),
      permissionsConfigHash: permissionsConfigHash(entry.safe, predicted, conditions),
    });
  }

  // Each recovery Safe pre-approves every boundary hash in one batched transaction.
  const recoveryApprovals = [GREEN_GOODS_RECOVERY_SAFE, DEV_GUILD_RECOVERY_SAFE].map((recoverySafe) => ({
    recoverySafe: getAddress(recoverySafe),
    multiSendTo: getAddress(MULTI_SEND_CALL_ONLY),
    multiSendData: encodeMultiSend(
      boundaries.map((boundary) => ({
        to: boundary.safe,
        data: SAFE_INTERFACE.encodeFunctionData("approveHash", [boundary.safeTxHash]),
      })),
    ),
  }));

  // Tree integrity is proven: test/fork/CeloGardenRolesPermission.t.sol deploys a modifier on a
  // pinned Celo fork, installs these exact encoded conditions through scopeFunction, and shows a
  // registered recipient settling while an unregistered one, an over-allowance amount, a foreign
  // selector, and an unscoped target all revert. What remains is that this planner deliberately
  // exposes no execution path.
  blockers.push(
    "Enabling is not implemented: the two batched recovery approvals and the 18 pre-approved " +
      "enableModule boundaries have no stage, and enabling still sits behind the value-tier audit gate.",
  );

  return {
    schemaVersion: 1,
    kind: "GARDEN_ROLES_MODIFIER_PLAN",
    chainId: CELO_CHAIN_ID,
    generatedAt: new Date().toISOString(),
    mastercopy: getAddress(ROLES_MASTERCOPY),
    factory: getAddress(MODULE_PROXY_FACTORY),
    modifierOwnerAtDeployment: getAddress(DEPLOYMENT_OPERATOR),
    ownershipTransfersToSafeBeforeEnable: true,
    authorityEnabled: false,
    roleKey: ROLE_KEY,
    allowanceKey: ALLOWANCE_KEY,
    canonicalTarget: getAddress(CANONICAL_TOKEN),
    canonicalSelector: TRANSFER_SELECTOR,
    allowance: {
      balance: MAX_PERIOD_AMOUNT.toString(),
      maxRefill: MAX_PERIOD_AMOUNT.toString(),
      refill: MAX_PERIOD_AMOUNT.toString(),
      period: PERIOD_DURATION.toString(),
    },
    recipientAllowlist,
    conditions,
    conditionsEncoded: encodeConditions(conditions),
    boundaries,
    transactions: buildRolesTransactions(boundaries, conditions, CELO_SETTLEMENT_EXECUTOR),
    recoveryApprovals,
    blockers,
  };
}

export interface RolesCliOptions {
  command: "plan" | "deploy";
  safePlanPath: string;
  planPath: string;
  broadcast: boolean;
  step?: number;
}

export function parseArguments(args: string[]): RolesCliOptions {
  const command = args[0] as RolesCliOptions["command"] | undefined;
  if (!command || !["plan", "deploy"].includes(command)) {
    throw new Error("Use: garden-roles.ts plan|deploy [--safe-plan <path>] [--plan <path>] [--broadcast --step <n>]");
  }
  let safePlanPath = DEFAULT_SAFE_PLAN;
  let planPath = DEFAULT_PLAN;
  let broadcast = false;
  let step: number | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--broadcast") {
      broadcast = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    index += 1;
    if (key === "--safe-plan") safePlanPath = value;
    else if (key === "--plan") planPath = value;
    else if (key === "--step") {
      step = Number(value);
      if (!Number.isInteger(step) || step < 1) throw new Error("--step must be a positive boundary index");
    } else throw new Error(`Unknown argument: ${key}`);
  }
  if (command === "deploy") {
    if (!broadcast) throw new Error("deploy requires --broadcast");
    if (step === undefined) throw new Error("deploy requires one explicit --step boundary");
  } else if (broadcast || step !== undefined) {
    throw new Error("plan does not accept --broadcast or --step");
  }
  return { command, safePlanPath, planPath, broadcast, step };
}

export interface RolesCheckpointEntry {
  step: number;
  kind: RolesTransactionKind;
  safe: string;
  transactionHash: string;
  blockNumber: number;
}

export interface RolesCheckpoint {
  schemaVersion: 1;
  planHash: string;
  completed: RolesCheckpointEntry[];
}

function checkpointPath(planPath: string): string {
  return planPath.replace(/\.json$/u, ".checkpoint.json");
}

function hashFileContent(filePath: string): string {
  return keccak256(toUtf8Bytes(fs.readFileSync(filePath, "utf8")));
}

/** Regenerating the plan after a mined boundary must stop the lane, not resume against new addresses. */
export function loadRolesCheckpoint(planPath: string): RolesCheckpoint {
  const filePath = checkpointPath(planPath);
  const planHash = hashFileContent(planPath);
  if (!fs.existsSync(filePath)) return { schemaVersion: 1, planHash, completed: [] };
  const checkpoint = readJson<RolesCheckpoint>(filePath);
  if (checkpoint.schemaVersion !== 1 || checkpoint.planHash !== planHash) {
    throw new Error("Checkpoint does not belong to the exact reviewed Roles plan");
  }
  for (const [offset, entry] of checkpoint.completed.entries()) {
    if (entry.step !== offset + 1) throw new Error("Checkpoint must be a contiguous boundary prefix");
  }
  return checkpoint;
}

export function assertNextRolesBoundary(selected: number, completed: number): number {
  const nextBoundary = completed + 1;
  if (selected !== nextBoundary) {
    throw new Error(`Roles deploy must target the next uncheckpointed boundary ${nextBoundary}`);
  }
  return selected;
}

function credentialArgs(): string[] {
  assertReleaseOperatorSession(resolveCheckoutCommit(REPOSITORY_ROOT));
  const passwordFile = process.env.ETH_PASSWORD;
  if (!passwordFile || !fs.existsSync(passwordFile)) {
    throw new Error("Broadcast requires the release operator's temporary ETH_PASSWORD file");
  }
  return ["--account", process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? "green-goods-deployer", "--password-file", passwordFile];
}

function sendRolesTransaction(transaction: PlannedRolesTransaction, rpcUrl: string): string {
  const output = execCastCaptured(
    [
      "send",
      transaction.to,
      "--data",
      transaction.data,
      "--value",
      "0",
      "--chain",
      String(CELO_CHAIN_ID),
      "--rpc-url",
      rpcUrl,
      ...credentialArgs(),
      "--json",
    ],
    { cwd: CONTRACTS_ROOT, env: process.env },
    transaction.kind,
  );
  return parseCastTransactionHash(output, transaction.kind);
}

/**
 * Each boundary asserts only what it depends on. Roles exposes no getter for target or function
 * scoping, so those steps prove a successful receipt plus an unchanged owner; the steps that do have
 * readable state — allowance, role membership, ownership — are checked against the plan directly.
 */
async function assertRolesPrecondition(transaction: PlannedRolesTransaction, provider: JsonRpcProvider): Promise<void> {
  const code = await provider.getCode(transaction.modifier, "latest");
  if (transaction.kind === "DEPLOY_MODIFIER") {
    if (code !== "0x") throw new Error(`Modifier ${transaction.modifier} already has code`);
    return;
  }
  if (code === "0x") throw new Error(`Modifier ${transaction.modifier} is not deployed`);
  const roles = new Contract(transaction.modifier, ROLES_CONFIG_INTERFACE, provider);
  const owner = getAddress((await roles.owner()) as string);
  if (owner !== getAddress(DEPLOYMENT_OPERATOR)) {
    throw new Error(`Modifier ${transaction.modifier} is owned by ${owner}, not the deployment operator`);
  }
}

async function assertRolesPostcondition(
  transaction: PlannedRolesTransaction,
  provider: JsonRpcProvider,
): Promise<void> {
  const roles = new Contract(transaction.modifier, ROLES_CONFIG_INTERFACE, provider);
  if (transaction.kind === "DEPLOY_MODIFIER") {
    if ((await provider.getCode(transaction.modifier, "latest")) === "0x") {
      throw new Error("Modifier deployment produced no code");
    }
    if (getAddress((await roles.avatar()) as string) !== getAddress(transaction.safe)) {
      throw new Error("Deployed modifier does not target its Garden Safe as avatar");
    }
    // `target` collides with ethers' Contract.target property, so resolve the function explicitly.
    if (getAddress((await roles.getFunction("target").staticCall()) as string) !== getAddress(transaction.safe)) {
      throw new Error("Deployed modifier does not target its Garden Safe");
    }
    return;
  }
  if (transaction.kind === "SET_ALLOWANCE") {
    const allowance = (await roles.allowances(ALLOWANCE_KEY)) as unknown as bigint[];
    if (allowance[0] !== MAX_PERIOD_AMOUNT || allowance[2] !== PERIOD_DURATION) {
      throw new Error("Allowance does not match the frozen period cap");
    }
    return;
  }
  if (transaction.kind === "ASSIGN_EXECUTOR") {
    if (!((await roles.isModuleEnabled(CELO_SETTLEMENT_EXECUTOR)) as boolean)) {
      throw new Error("Executor was not registered as a Roles member");
    }
    return;
  }
  const owner = getAddress((await roles.owner()) as string);
  const expected = transaction.kind === "TRANSFER_OWNERSHIP" ? transaction.safe : DEPLOYMENT_OPERATOR;
  if (owner !== getAddress(expected)) throw new Error(`Modifier owner is ${owner}, expected ${expected}`);
}

export async function executeRolesBoundary(plan: GardenRolesPlan, step: number, planPath: string): Promise<void> {
  const transaction = plan.transactions[step - 1];
  if (!transaction || transaction.step !== step) throw new Error(`Reviewed plan has no boundary ${step}`);
  const checkpoint = loadRolesCheckpoint(planPath);
  assertNextRolesBoundary(step, checkpoint.completed.length);

  const manager = new NetworkManager();
  const rpcUrl = manager.getRpcUrl("celo");
  const provider = new JsonRpcProvider(rpcUrl, CELO_CHAIN_ID, { staticNetwork: true });
  await assertRolesPrecondition(transaction, provider);

  const transactionHash = sendRolesTransaction(transaction, rpcUrl);
  const receipt = await provider.waitForTransaction(transactionHash, 1, 180_000);
  if (!receipt || receipt.status !== 1) throw new Error(`${transaction.kind} did not produce a successful receipt`);
  const sent = await provider.getTransaction(transactionHash);
  if (
    !sent ||
    getAddress(sent.from) !== getAddress(DEPLOYMENT_OPERATOR) ||
    getAddress(sent.to ?? ZeroAddress) !== getAddress(transaction.to) ||
    sent.data !== transaction.data ||
    sent.value !== 0n
  ) {
    throw new Error(`${transaction.kind} receipt does not match the reviewed boundary`);
  }
  await assertRolesPostcondition(transaction, provider);

  checkpoint.completed.push({
    step,
    kind: transaction.kind,
    safe: transaction.safe,
    transactionHash,
    blockNumber: receipt.blockNumber,
  });
  atomicWrite(checkpointPath(planPath), checkpoint);
  process.stdout.write(
    `${transaction.kind} boundary ${step}/${plan.transactions.length} verified as ${transactionHash}; close the credential session.\n`,
  );
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(args);
  const { command, safePlanPath, planPath } = options;

  if (command === "deploy") {
    if (!fs.existsSync(planPath)) throw new Error(`Reviewed plan is missing: ${planPath}`);
    await executeRolesBoundary(readJson<GardenRolesPlan>(planPath), options.step as number, planPath);
    return;
  }

  const plan = await buildPlan(safePlanPath);
  atomicWrite(planPath, plan);
  // The fork proof reads its fixture inside the EVM, where the full plan's 108 calldata payloads
  // exhaust the test gas budget. This carries only what the proof executes.
  atomicWrite(PROOF_FIXTURE, {
    modifierOwnerAtDeployment: plan.modifierOwnerAtDeployment,
    canonicalTarget: plan.canonicalTarget,
    canonicalSelector: plan.canonicalSelector,
    roleKey: plan.roleKey,
    allowanceKey: plan.allowanceKey,
    allowance: plan.allowance,
    conditionsEncoded: plan.conditionsEncoded,
    boundaries: plan.boundaries.slice(0, 2).map((boundary) => ({
      safe: boundary.safe,
      modifier: boundary.modifier,
      saltNonce: boundary.saltNonce,
    })),
  });
  console.log(
    JSON.stringify(
      {
        planPath,
        boundaries: plan.boundaries.length,
        modifierOwnerAtDeployment: plan.modifierOwnerAtDeployment,
        recoveryApprovals: plan.recoveryApprovals.length,
        blockers: plan.blockers,
      },
      null,
      2,
    ),
  );
  console.log("No transaction was signed or broadcast.");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
