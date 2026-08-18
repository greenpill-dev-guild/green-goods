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
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  JsonRpcProvider,
  keccak256,
  solidityPackedKeccak256,
  TypedDataEncoder,
  type TypedDataField,
  ZeroAddress,
} from "ethers";

import { NetworkManager } from "../utils/network";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_SAFE_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-final.json");
const DEFAULT_PLAN = path.join(RUNTIME_ROOT, "42220-garden-roles.json");

const CELO_CHAIN_ID = 42_220;
const EXPECTED_GARDEN_COUNT = 18;

/** Pinned in .plans/active/commitment-pooling/evidence/celo-zodiac-roles-mastercopies-2026-08-18.json. */
const ROLES_MASTERCOPY = "0x9646fDAD06d3e24444381f44362a3B0eB343D337";
const MODULE_PROXY_FACTORY = "0x000000000000aDdB49795b0f9bA5BC298cDda236";
const MULTI_SEND_CALL_ONLY = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";
const DEPLOYMENT_OPERATOR = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const GREEN_GOODS_RECOVERY_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const DEV_GUILD_RECOVERY_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";

/** Zodiac's minimal proxy, with the mastercopy spliced in. */
const PROXY_PREFIX = "0x602d8060093d393df3363d3d373d3d3d363d73";
const PROXY_SUFFIX = "0x5af43d82803e903d91602b57fd5bf3";
const SALT_DOMAIN = "GG_GARDEN_ROLES_V1";

const FACTORY_INTERFACE = new Interface([
  "function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address)",
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
  boundaries: RolesBoundary[];
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

async function buildPlan(safePlanPath: string): Promise<GardenRolesPlan> {
  const safePlan = readJson<{ entries: SafePlanEntry[] }>(safePlanPath);
  const blockers: string[] = [];
  if (safePlan.entries.length !== EXPECTED_GARDEN_COUNT) {
    blockers.push(`Safe plan lists ${safePlan.entries.length} Gardens, expected ${EXPECTED_GARDEN_COUNT}`);
  }

  const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("celo"), CELO_CHAIN_ID, {
    staticNetwork: true,
  });

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

  blockers.push(
    "Permission tree is undecided: roleKey, allowanceKey, the recipient condition, and the Roles allowance " +
      "refill parameters are not frozen yet, so no modifier may be configured or enabled from this plan.",
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
    boundaries,
    recoveryApprovals,
    blockers,
  };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args[0];
  if (command !== "plan") throw new Error("Use: garden-roles.ts plan [--safe-plan <path>] [--plan <path>]");
  let safePlanPath = DEFAULT_SAFE_PLAN;
  let planPath = DEFAULT_PLAN;
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    if (key === "--safe-plan") safePlanPath = value;
    else if (key === "--plan") planPath = value;
    else throw new Error(`Unknown argument: ${key}`);
  }

  const plan = await buildPlan(safePlanPath);
  atomicWrite(planPath, plan);
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
